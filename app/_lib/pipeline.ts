// 사진 한 장 배경 지우기: 풀기 → 모델 입력(1024×1024) → 마스크 → 원본 크기로 늘려 씌우기 → 후처리 → PNG
// 줄이기·늘리기·합치기는 캔버스(브라우저 그리기)로 — 예전 라이브러리는 JS 반복문이라 큰 사진에서 느리고 원본 크기 배열을 여러 벌 만들었음(48MP 3.3GB)
// 워커에선 OffscreenCanvas, 화면 스레드(워커를 못 쓸 때)에선 <canvas>
import { SIZE } from './model';

type Canvas = OffscreenCanvas | HTMLCanvasElement;
type Ctx = OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;
export type Segment = (input: Float32Array) => Promise<Float32Array>;
export type Step = (p: number) => void;

// 후처리 자리: 지운 결과 캔버스를 받아 새 캔버스를 돌려줌 — 테두리·여백 맞춤·크기 조절 같은 것을 여기에 하나씩 더함(지금은 없음).
// 워커 안에서 돌아서 화면이 안 멈춤. 부르는 쪽은 run({ post: [{ op: '이름', ...값 }] })
export type PostStep = { op: string } & Record<string, unknown>;
const POST: Record<string, (c: Canvas, step: PostStep) => Canvas | Promise<Canvas>> = {};

// 결과 크기 상한: 그보다 큰 사진(200MP 등)은 줄여서 — 5천만 화소면 캔버스 한 장이 200MB. 그 크기로 못 만들면(iOS 사파리는 1,677만 화소까지) 한 번 더 작게
const MAX_PIXELS = [50_000_000, 16_777_216];

const canvas = (w: number, h: number): Canvas =>
  typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h });
const ctx2d = (c: Canvas, opts?: CanvasRenderingContext2DSettings): Ctx => {
  const x = c.getContext('2d', opts) as Ctx | null;
  if (!x) throw new Error('canvas: no 2d context');
  return x;
};
// 큰 캔버스는 다 쓰면 바로 0×0으로 — 가비지 수거를 기다리면 48MP 한 장이 200MB씩 남음
const free = (c: Canvas) => { c.width = 0; c.height = 0; };
const encode = (c: Canvas): Promise<Blob> =>
  'convertToBlob' in c
    ? c.convertToBlob({ type: 'image/png' })
    : new Promise((res, rej) => c.toBlob(b => (b ? res(b) : rej(new Error('canvas: encode'))), 'image/png'));

// 모델 입력: 비율 무시하고 1024×1024로(모델이 그렇게 배움), 단순 쌍선형, (값−128)/256, 채널별로.
// 반 칸 옮겨 한 번 더 그리는 것: 예전 라이브러리는 출력 x를 원본 x·배율에서 뽑아서(픽셀 중심이 아님) 그 자리에 맞춤 —
// 결과가 예전과 가장 비슷해짐(큰 거품 사진 평균 차이 2.9 → 1.7/255, 보통 사진 0.6). 옮겨서 빈 가장자리 한 줄은 첫 그림이 채움
async function maskOf(bmp: ImageBitmap, segment: Segment, step: Step): Promise<Canvas> {
  const n = SIZE * SIZE, c = canvas(SIZE, SIZE), x = ctx2d(c, { willReadFrequently: true });
  x.imageSmoothingQuality = 'low';
  x.drawImage(bmp, 0, 0, SIZE, SIZE);
  x.drawImage(bmp, 0.5 - (0.5 * SIZE) / bmp.width, 0.5 - (0.5 * SIZE) / bmp.height, SIZE, SIZE);
  const px = x.getImageData(0, 0, SIZE, SIZE).data, input = new Float32Array(3 * n);
  for (let i = 0, j = 0; j < n; i += 4, j++) {
    input[j] = (px[i] - 128) / 256;
    input[j + n] = (px[i + 1] - 128) / 256;
    input[j + 2 * n] = (px[i + 2] - 128) / 256;
  }
  step(20);
  const m = await segment(input);
  step(80);
  const md = new ImageData(SIZE, SIZE), a = md.data;
  for (let j = 0; j < n; j++) a[4 * j + 3] = m[j] * 255;
  x.putImageData(md, 0, 0);
  return c;
}

// 원본(상한보다 크면 줄여서) 위에 마스크를 늘려 씌움(destination-in: 원본 알파 × 마스크) → 후처리 → PNG
async function compose(bmp: ImageBitmap, mask: Canvas, maxPixels: number, post: PostStep[]): Promise<Blob> {
  const k = Math.min(1, Math.sqrt(maxPixels / (bmp.width * bmp.height)));
  const W = Math.max(1, Math.round(bmp.width * k)), H = Math.max(1, Math.round(bmp.height * k));
  let out = canvas(W, H);
  const x = ctx2d(out);
  x.imageSmoothingQuality = 'high';
  x.drawImage(bmp, 0, 0, W, H);
  x.globalCompositeOperation = 'destination-in';
  x.imageSmoothingQuality = 'low';
  x.drawImage(mask, 0, 0, W, H);
  x.globalCompositeOperation = 'source-over';
  for (const s of post) {
    const f = POST[s.op];
    if (!f) throw new Error(`post: ${s.op}`);
    const next = await f(out, s);
    if (next !== out) free(out);
    out = next;
  }
  try {
    return await encode(out);
  } finally {
    free(out);
  }
}

// 풀기는 createImageBitmap — 브라우저가 여는 그림이면 다(PNG·JPEG·WebP·GIF·AVIF·BMP…), 사진 방향(EXIF)도 맞춰 줌
export async function removeBackground(file: Blob, segment: Segment, step: Step = () => {}, post: PostStep[] = []): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  try {
    step(10);
    const mask = await maskOf(bmp, segment, step);
    try {
      for (let i = 0; ; i++) {
        try {
          const b = await compose(bmp, mask, MAX_PIXELS[i], post);
          step(100);
          return b;
        } catch (e) {
          if (i === MAX_PIXELS.length - 1) throw e;
          console.warn('결과를 더 작게:', e);
        }
      }
    } finally {
      free(mask);
    }
  } finally {
    bmp.close();
  }
}
