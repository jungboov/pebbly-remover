// 캔버스 일(썸네일·후처리·받기 설정·HEIC 풀기·칼선)을 캔버스 워커(canvas.worker.ts)로 — 워커에서 못 그리는 브라우저는 화면 스레드에서 같은 코드
// 한 번에 하나씩(큰 사진 여러 장을 한꺼번에 풀면 잠깐 원본 크기 × 장수만큼 메모리가 튐)
import type { Spec, Src } from './post';
import type { DlOpts } from './shrink';
import type { CutOpts, Geo } from './cutline';
import type { ArtKind, PdfImage, Prep, SheetArt } from './cutArt';

export type Job =
  | { op: 'thumb'; file: Blob }
  | { op: 'render'; src: Src; spec: Spec; key: string }
  | { op: 'shrink'; blob: Blob; opts: DlOpts; original: Blob | null; bg: string }
  | { op: 'heic'; file: Blob }
  | { op: 'cutPrep'; file: Blob }
  | { op: 'cutGeo'; art: Blob; aw: number; ah: number; opts: CutOpts }
  | { op: 'cutArt'; art: Blob; geo: Geo; dpi: number; kind: ArtKind }
  | { op: 'cutSheet'; paper: [number, number]; items: SheetArt[]; dpi: number };

let worker: Worker | null = null;
let seq = 0;
const waiting = new Map<number, { resolve: (r: unknown) => void; reject: (e: Error) => void }>();
let chain: Promise<unknown> = Promise.resolve();

const canUseWorker = () =>
  typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined' && 'convertToBlob' in OffscreenCanvas.prototype;

function inWorker(job: Job): Promise<unknown> {
  if (!worker) {
    const w = new Worker(new URL('./canvas.worker.ts', import.meta.url));
    w.onmessage = (e: MessageEvent) => {
      const p = waiting.get(e.data.id);
      waiting.delete(e.data.id);
      if (e.data.error === undefined) p?.resolve(e.data.result);
      else p?.reject(new Error(e.data.error || 'canvas worker'));
    };
    w.onerror = (e: ErrorEvent) => {
      e.preventDefault();
      for (const p of waiting.values()) p.reject(new Error(`canvas worker: ${e.message || 'crashed'}`));
      waiting.clear();
      w.terminate();
      worker = null;
    };
    worker = w;
  }
  const id = ++seq;
  return new Promise((resolve, reject) => { waiting.set(id, { resolve, reject }); worker!.postMessage({ ...job, id }); });
}

async function onMain(job: Job): Promise<unknown> {
  switch (job.op) {
    case 'thumb': return (await import('./thumb')).thumbOf(job.file);
    case 'shrink': return (await import('./shrink')).shrink(job.blob, job.opts, job.original, job.bg);
    case 'heic': return (await import('./heic')).heicToJpeg(job.file);
    case 'render': return (await import('./post')).render(job.src, job.spec, job.key);
    case 'cutPrep': return (await import('./cutArt')).prepCut(job.file);
    case 'cutGeo': return (await import('./cutArt')).geoOf(job.art, job.aw, job.ah, job.opts);
    case 'cutArt': return (await import('./cutArt')).artFor(job.art, job.geo, job.dpi, job.kind);
    case 'cutSheet': return (await import('./cutArt')).sheetPng(job.paper, job.items, job.dpi);
  }
}

function run<T>(job: Job): Promise<T> {
  const p = chain.then(() => (canUseWorker() ? inWorker(job) : onMain(job))) as Promise<T>;
  chain = p.catch(() => {});
  return p;
}

// 썸네일 주소(못 만들면 undefined — 썸네일은 원본 그대로, 지우기에서 오류가 남)
export async function makeThumb(file: Blob): Promise<string | undefined> {
  try {
    return URL.createObjectURL(await run<Blob>({ op: 'thumb', file }));
  } catch {
    return undefined;
  }
}

// 원본 + 마스크를 상품 사진·스티커로(key = 사진 id: 다듬은 마스크를 워커가 기억)
export const renderOutput = (src: Src, spec: Spec, key: string) => run<Blob>({ op: 'render', src, spec, key });

// 받기 설정대로 다시 저장(형식·크기·용량·사진 정보) — original은 사진 정보를 남길 때, bg는 JPG로 받을 때 투명한 곳 색
export const shrinkOutput = (blob: Blob, opts: DlOpts, original: Blob | null, bg = '#ffffff') => run<Blob>({ op: 'shrink', blob, opts, original, bg });

// 아이폰 사진(HEIC)을 JPG로(기기가 풀 수 있으면 그대로)
export const decodeHeic = (file: Blob) => run<Blob>({ op: 'heic', file });

// 칼선: 준비 · 계산 · 인쇄용 그림 · 시트 PNG
export const cutPrep = (file: Blob) => run<Prep>({ op: 'cutPrep', file });
export const cutGeo = (art: Blob, aw: number, ah: number, opts: CutOpts) => run<Geo>({ op: 'cutGeo', art, aw, ah, opts });
export const cutArt = <K extends ArtKind>(art: Blob, geo: Geo, dpi: number, kind: K) => run<K extends 'pdf' ? PdfImage : Blob>({ op: 'cutArt', art, geo, dpi, kind });
export const cutSheet = (paper: [number, number], items: SheetArt[], dpi: number) => run<Blob>({ op: 'cutSheet', paper, items, dpi });
