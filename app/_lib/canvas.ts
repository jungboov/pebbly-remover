// 캔버스 도우미 — 워커에선 OffscreenCanvas, 화면 스레드(워커를 못 쓸 때)에선 <canvas>
export type Canvas = OffscreenCanvas | HTMLCanvasElement;
export type Ctx = OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;

export const canvas = (w: number, h: number): Canvas =>
  typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h });

export const ctx2d = (c: Canvas, opts?: CanvasRenderingContext2DSettings): Ctx => {
  const x = c.getContext('2d', opts) as Ctx | null;
  if (!x) throw new Error('canvas: no 2d context');
  return x;
};

// 큰 캔버스는 다 쓰면 바로 0×0으로 — 가비지 수거를 기다리면 48MP 한 장이 200MB씩 남음
export const free = (c: Canvas) => { c.width = 0; c.height = 0; };

export const encode = (c: Canvas, type = 'image/png', quality?: number): Promise<Blob> =>
  'convertToBlob' in c
    ? c.convertToBlob({ type, quality })
    : new Promise((res, rej) => c.toBlob(b => (b ? res(b) : rej(new Error('canvas: encode'))), type, quality));
