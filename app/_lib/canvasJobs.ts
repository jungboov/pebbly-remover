// 캔버스 일(썸네일·후처리)을 캔버스 워커(canvas.worker.ts)로 — 워커에서 못 그리는 브라우저는 화면 스레드에서 같은 코드
// 한 번에 하나씩(큰 사진 여러 장을 한꺼번에 풀면 잠깐 원본 크기 × 장수만큼 메모리가 튐)
import type { Box, Spec } from './post';

type Job = { op: 'thumb'; file: Blob } | { op: 'render'; cutout: Blob; box: Box | null; spec: Spec };

let worker: Worker | null = null;
let seq = 0;
const waiting = new Map<number, { resolve: (b: Blob) => void; reject: (e: Error) => void }>();
let chain: Promise<unknown> = Promise.resolve();

const canUseWorker = () =>
  typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined' && 'convertToBlob' in OffscreenCanvas.prototype;

function inWorker(job: Job): Promise<Blob> {
  if (!worker) {
    const w = new Worker(new URL('./canvas.worker.ts', import.meta.url));
    w.onmessage = (e: MessageEvent) => {
      const p = waiting.get(e.data.id);
      waiting.delete(e.data.id);
      if (e.data.blob) p?.resolve(e.data.blob);
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

async function onMain(job: Job): Promise<Blob> {
  if (job.op === 'thumb') return (await import('./thumb')).thumbOf(job.file);
  return (await import('./post')).render(job.cutout, job.box, job.spec);
}

function run(job: Job): Promise<Blob> {
  const p = chain.then(() => (canUseWorker() ? inWorker(job) : onMain(job)));
  chain = p.catch(() => {});
  return p;
}

// 썸네일 주소(못 만들면 undefined — 썸네일은 원본 그대로, 지우기에서 오류가 남)
export async function makeThumb(file: Blob): Promise<string | undefined> {
  try {
    return URL.createObjectURL(await run({ op: 'thumb', file }));
  } catch {
    return undefined;
  }
}

// 지운 결과를 상품 사진·스티커로
export const renderOutput = (cutout: Blob, box: Box | null, spec: Spec) => run({ op: 'render', cutout, box, spec });
