// 캔버스 워커: 썸네일 · 후처리(상품 사진·스티커 다시 그리기) · 받기 설정(줄여서 저장) · HEIC 풀기 · 칼선(준비·계산·인쇄용 그림)
// 화면 스레드 밖, 모델 워커와도 따로(모델이 지우는 동안에도 바로)
// 받는 말: { id, ...Job } (canvasJobs.ts) · 보내는 말: { id, result?, error? }
import { thumbOf } from './thumb';
import { render } from './post';
import { shrink } from './shrink';
import { heicToJpeg } from './heic';
import { artFor, geoOf, prepCut, sheetPng } from './cutArt';
import type { Job } from './canvasJobs';

const scope = self as unknown as { postMessage(m: unknown): void; onmessage: ((e: MessageEvent) => void) | null };

export async function runJob(m: Job): Promise<unknown> {
  switch (m.op) {
    case 'thumb': return thumbOf(m.file);
    case 'render': return render(m.src, m.spec, m.key);
    case 'shrink': return shrink(m.blob, m.opts, m.original, m.bg);
    case 'heic': return heicToJpeg(m.file);
    case 'cutPrep': return prepCut(m.file);
    case 'cutGeo': return geoOf(m.art, m.aw, m.ah, m.opts);
    case 'cutArt': return artFor(m.art, m.geo, m.dpi, m.kind);
    case 'cutSheet': return sheetPng(m.paper, m.items, m.dpi);
  }
}

scope.onmessage = async (e) => {
  const m = e.data as Job & { id: number };
  try {
    scope.postMessage({ id: m.id, result: await runJob(m) });
  } catch (err) {
    scope.postMessage({ id: m.id, error: err instanceof Error ? err.message : String(err) });
  }
};
