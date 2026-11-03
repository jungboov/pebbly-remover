// 썸네일: 가로 192px로 줄여 풀고(EXIF 방향 맞춤) JPEG로 — 12MP 사진 10장을 그대로 72px에 띄우면 GPU 쪽에서만 340MB를 씀
// 워커(thumb.worker.ts)에서, 워커에서 못 그리는 브라우저는 화면 스레드에서(CPU 캔버스: GPU 캔버스는 지우는 워커가 GPU를 쓰는 동안 toBlob에서 기다림)
// 부르는 쪽이 한 장씩(10장을 한꺼번에 풀면 잠깐 원본 크기 × 10만큼 메모리가 튐)
let worker: Worker | null = null;
let seq = 0;
const waiting = new Map<number, (b?: Blob) => void>();

const canUseWorker = () =>
  typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined' && 'convertToBlob' in OffscreenCanvas.prototype;

function inWorker(file: Blob): Promise<Blob | undefined> {
  if (!worker) {
    const w = new Worker(new URL('./thumb.worker.ts', import.meta.url));
    w.onmessage = (e: MessageEvent) => { waiting.get(e.data.id)?.(e.data.blob); waiting.delete(e.data.id); };
    w.onerror = (e: ErrorEvent) => { e.preventDefault(); for (const r of waiting.values()) r(); waiting.clear(); w.terminate(); worker = null; };
    worker = w;
  }
  const id = ++seq;
  return new Promise(r => { waiting.set(id, r); worker!.postMessage({ id, file }); });
}

async function onMain(file: Blob): Promise<Blob | undefined> {
  const bmp = await createImageBitmap(file, { resizeWidth: 192, resizeQuality: 'medium' });
  const c = Object.assign(document.createElement('canvas'), { width: bmp.width, height: bmp.height });
  c.getContext('2d', { willReadFrequently: true })!.drawImage(bmp, 0, 0);
  bmp.close();
  return (await new Promise<Blob | null>(r => c.toBlob(r, 'image/jpeg', 0.85))) ?? undefined;
}

// 못 만들면 undefined(썸네일은 원본 그대로, 지우기에서 오류가 남)
export async function makeThumb(file: Blob): Promise<string | undefined> {
  try {
    const b = canUseWorker() ? await inWorker(file) : await onMain(file);
    return b ? URL.createObjectURL(b) : undefined;
  } catch {
    return undefined;
  }
}
