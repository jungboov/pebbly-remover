// 캔버스 워커: 썸네일 만들기와 후처리(상품 사진·스티커 다시 그리기) — 화면 스레드 밖, 모델 워커와도 따로(모델이 지우는 동안에도 바로)
// 받는 말: { id, op: 'thumb', file } · { id, op: 'render', cutout, box, spec }  보내는 말: { id, blob?, error? }
import { thumbOf } from './thumb';
import { render, type Box, type Spec } from './post';

const scope = self as unknown as { postMessage(m: unknown): void; onmessage: ((e: MessageEvent) => void) | null };

scope.onmessage = async (e) => {
  const m = e.data as { id: number; op: 'thumb'; file: Blob } | { id: number; op: 'render'; cutout: Blob; box: Box | null; spec: Spec };
  try {
    const blob = m.op === 'thumb' ? await thumbOf(m.file) : await render(m.cutout, m.box, m.spec);
    scope.postMessage({ id: m.id, blob });
  } catch (err) {
    scope.postMessage({ id: m.id, error: err instanceof Error ? err.message : String(err) });
  }
};
