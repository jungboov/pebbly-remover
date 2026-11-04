// 배경 지우기 웹 워커 — 모델(model.ts)과 줄이기·합치기(pipeline.ts)를 화면 스레드 밖에서 돌려서 지우는 동안에도 화면이 안 멈춤
// (onnxruntime 스레드는 여기서 다시 워커를 띄움 — 교차 출처 격리 머리글이 워커 스크립트에도 붙어야 함, public/_headers)
// 받는 말: { req, op: 'preload', prefer } · { req, op: 'run', prefer, blob }
// 보내는 말: { type: 'progress', loaded, total } · { type: 'step', req, p } · { type: 'result', req, blob?, mask?, size?, device?, error? }
import { openModel, type Model, type Prefer } from './model';
import { removeBackground } from './pipeline';

const scope = self as unknown as { postMessage(m: unknown, transfer?: Transferable[]): void; onmessage: ((e: MessageEvent) => void) | null };

// 모델은 한 번만 열고(여는 중이면 그걸 기다림), 못 열면 다음에 처음부터
let model: Promise<Model> | null = null;
const ready = (prefer: Prefer) =>
  (model ??= openModel(prefer, (loaded, total) => scope.postMessage({ type: 'progress', loaded, total })).catch(e => { model = null; throw e; }));

scope.onmessage = async (e) => {
  const { req, op, prefer, blob } = e.data as { req: number; op: 'preload' | 'run'; prefer: Prefer; blob?: Blob };
  try {
    const m = await ready(prefer);
    if (op === 'preload') return scope.postMessage({ type: 'result', req, device: m.device });
    const out = await removeBackground(blob!, input => m.segment(input), p => scope.postMessage({ type: 'step', req, p }));
    scope.postMessage({ type: 'result', req, blob: out.blob, mask: out.mask, size: out.size }, [out.mask.buffer]);   // 마스크 1MB는 옮김(복사 안 함)
  } catch (err) {
    scope.postMessage({ type: 'result', req, error: err instanceof Error ? err.message : String(err) });
  }
};
