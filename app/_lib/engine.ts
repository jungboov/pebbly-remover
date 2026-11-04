// 배경 지우기를 어디서 돌릴지: 웹 워커(화면이 안 멈춤) — 워커에서 못 그리는 브라우저(OffscreenCanvas 없음)거나
// 워커에서 모델을 못 열면 화면 스레드(같은 코드, 지우는 동안 화면이 멈춤)로
// GPU/CPU는 model.ts가 고름 — 주소에 ?gpu=1 / ?gpu=0을 붙이면 시험 삼아 강제로
import type { Prefer, Progress } from './model';
import type { Cutout, Step } from './pipeline';

type Reply = { blob?: Blob; mask?: Uint8Array; size?: [number, number]; device?: string };
type Pending = { resolve: (m: Reply) => void; reject: (e: Error) => void };

const canUseWorker = () =>
  typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined' && 'convertToBlob' in OffscreenCanvas.prototype;

const preferred = (): Prefer => {
  const g = new URLSearchParams(location.search).get('gpu');
  return g === '1' ? 'gpu' : g === '0' ? 'cpu' : 'auto';
};

export type Engine = ReturnType<typeof createEngine>;

export function createEngine(onProgress: Progress, onStep: Step) {
  const prefer = preferred();
  let mode: 'worker' | 'main' = canUseWorker() ? 'worker' : 'main';
  let device = '';
  let worker: Worker | null = null;
  const pending = new Map<number, Pending>();
  let seq = 0;

  const getWorker = () => {
    if (worker) return worker;
    const w = new Worker(new URL('./remover.worker.ts', import.meta.url));
    w.onmessage = (e: MessageEvent) => {
      const m = e.data;
      if (m.type === 'progress') return onProgress(m.loaded, m.total);
      if (m.type === 'step') return onStep(m.p);
      const p = pending.get(m.req);
      if (!p) return;
      pending.delete(m.req);
      if (m.error) p.reject(new Error(m.error));
      else p.resolve(m);
    };
    // 워커가 죽으면(스크립트를 못 받음·메모리) 기다리던 것은 실패, 다음 일은 새 워커로(모델은 저장소에서 다시 엶)
    w.onerror = (e: ErrorEvent) => {
      e.preventDefault();
      for (const p of pending.values()) p.reject(new Error(`worker: ${e.message || 'crashed'}`));
      pending.clear();
      w.terminate();
      if (worker === w) worker = null;
    };
    return (worker = w);
  };
  const call = (msg: { op: 'preload' | 'run'; blob?: Blob }) =>
    new Promise<Reply>((resolve, reject) => {
      const req = ++seq;
      pending.set(req, { resolve, reject });
      getWorker().postMessage({ ...msg, prefer, req });
    });

  // 화면 스레드: 이때만 받음(워커로 돌면 화면 쪽 묶음에 안 들어감)
  let main: Promise<{ model: import('./model').Model; pipeline: typeof import('./pipeline') }> | null = null;
  const openMain = () =>
    (main ??= Promise.all([import('./model'), import('./pipeline')])
      .then(async ([m, pipeline]) => ({ model: await m.openModel(prefer, onProgress), pipeline }))
      .catch(e => { main = null; throw e; }));

  // 미리 열기는 한 번만(여는 중이면 같이 기다림), 실패하면 다음에 처음부터
  let warm: Promise<void> | null = null;
  const preload = () =>
    (warm ??= (async () => {
      if (mode === 'main') { device = (await openMain()).model.device; return; }
      try {
        device = (await call({ op: 'preload' })).device ?? '';
      } catch (e) {
        // 워커에서 안 되면 화면 스레드로 한 번 더 — 되면 그다음부턴 화면 스레드(둘 다 안 되면 모델 오류)
        console.warn('워커로 못 돌려서 화면 스레드로:', e);
        device = (await openMain()).model.device;
        mode = 'main';
        worker?.terminate();
        worker = null;
      }
    })().catch(e => { warm = null; throw e; }));

  return {
    preload,
    // 투명 PNG와 마스크·원본 크기(상품 사진·스티커로 다시 그릴 때 씀)
    async run(file: Blob): Promise<Cutout> {
      if (mode === 'main') {
        const { model, pipeline } = await openMain();
        return pipeline.removeBackground(file, input => model.segment(input), onStep);
      }
      const { blob, mask, size } = await call({ op: 'run', blob: file });
      if (!blob || !mask || !size) throw new Error('worker: no result');
      return { blob, mask, size };
    },
    get mode() { return mode; },
    get device() { return device; },
  };
}
