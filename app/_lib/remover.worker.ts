// 배경 지우기 웹 워커 — imgly를 화면 스레드 밖에서 돌려서 지우는 동안에도 화면이 안 멈춤
// (onnxruntime 스레드는 여기서 다시 워커를 띄움 — 교차 출처 격리 머리글이 워커 스크립트에도 붙어야 함, public/_headers)
// 받는 말: { req, op: 'preload' | 'run', attempt, blob? }  보내는 말: { type: 'progress', key, current, total } · { type: 'result', req, blob?, error? }
import { preload, removeBackground } from '@imgly/background-removal';
import { makeConfig } from './imgly';

const scope = self as unknown as { postMessage(m: unknown): void; onmessage: ((e: MessageEvent) => void) | null };
const progress = (key: string, current: number, total: number) => scope.postMessage({ type: 'progress', key, current, total });

scope.onmessage = async (e) => {
  const { req, op, attempt, blob } = e.data as { req: number; op: 'preload' | 'run'; attempt: number; blob?: Blob };
  try {
    const config = makeConfig(attempt, progress);
    if (op === 'preload') {
      await preload(config);
      scope.postMessage({ type: 'result', req });
    } else {
      scope.postMessage({ type: 'result', req, blob: await removeBackground(blob!, config) });
    }
  } catch (err) {
    scope.postMessage({ type: 'result', req, error: err instanceof Error ? err.message : String(err) });
  }
};
