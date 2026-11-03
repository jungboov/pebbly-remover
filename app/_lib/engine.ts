// 배경 지우기를 어디서 돌릴지: 웹 워커(화면이 안 멈춤) — 워커에서 못 그리는 브라우저(OffscreenCanvas 없음)거나
// 워커에서 모델을 못 올리면 화면 스레드(예전 방식, 지우는 동안 화면이 멈춤)로
import { makeConfig, toSource, type Progress } from './imgly';

type Pending = { resolve: (blob?: Blob) => void; reject: (e: Error) => void };

const canUseWorker = () =>
  typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined' && 'convertToBlob' in OffscreenCanvas.prototype;

export type Engine = ReturnType<typeof createEngine>;

export function createEngine(onProgress: Progress) {
  let mode: 'worker' | 'main' = canUseWorker() ? 'worker' : 'main';
  let worker: Worker | null = null;
  const pending = new Map<number, Pending>();
  let seq = 0;

  const getWorker = () => {
    if (worker) return worker;
    const w = new Worker(new URL('./remover.worker.ts', import.meta.url));
    w.onmessage = (e: MessageEvent) => {
      const m = e.data;
      if (m.type === 'progress') return onProgress(m.key, m.current, m.total);
      const p = pending.get(m.req);
      if (!p) return;
      pending.delete(m.req);
      if (m.error) p.reject(new Error(m.error));
      else p.resolve(m.blob);
    };
    // 워커가 죽으면(스크립트를 못 받음·메모리) 기다리던 것은 실패, 다음 일은 새 워커로
    w.onerror = (e: ErrorEvent) => {
      e.preventDefault();
      for (const p of pending.values()) p.reject(new Error(`worker: ${e.message || 'crashed'}`));
      pending.clear();
      w.terminate();
      if (worker === w) worker = null;
    };
    return (worker = w);
  };
  const call = (msg: { op: 'preload' | 'run'; attempt: number; blob?: Blob }) =>
    new Promise<Blob | undefined>((resolve, reject) => {
      const req = ++seq;
      pending.set(req, { resolve, reject });
      getWorker().postMessage({ ...msg, req });
    });

  // 화면 스레드: 라이브러리는 이때만 받음(워커로 돌면 화면 쪽 묶음에 안 들어감)
  let lib: Promise<typeof import('@imgly/background-removal')> | null = null;
  const imgly = () => (lib ??= import('@imgly/background-removal'));

  return {
    async preload(attempt: number) {
      if (mode === 'main') return (await imgly()).preload(makeConfig(attempt, onProgress));
      try {
        await call({ op: 'preload', attempt });
      } catch (e) {
        // 워커에서 안 되면 화면 스레드로 한 번 더 — 되면 그다음부턴 화면 스레드(둘 다 안 되면 모델 오류)
        console.warn("워커로 못 돌려서 화면 스레드로:", e);
        await (await imgly()).preload(makeConfig(attempt, onProgress));
        mode = 'main';
        worker?.terminate();
        worker = null;
      }
    },
    async run(file: Blob, attempt: number): Promise<Blob> {
      if (mode === 'main') return (await imgly()).removeBackground(toSource(file), makeConfig(attempt, onProgress));
      const blob = await call({ op: 'run', attempt, blob: toSource(file) });
      if (!blob) throw new Error('worker: no result');
      return blob;
    },
    get mode() { return mode; },
  };
}
