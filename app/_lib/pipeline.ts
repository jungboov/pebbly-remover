// 사진 한 장 배경 지우기: 풀기 → 모델 입력(1024×1024) → 마스크 → 원본 크기로 늘려 씌우기 → 투명 PNG(+ 물체가 있는 상자)
// 줄이기·늘리기·합치기는 캔버스(브라우저 그리기)로 — 예전 라이브러리는 JS 반복문이라 큰 사진에서 느리고 원본 크기 배열을 여러 벌 만들었음(48MP 3.3GB)
// 상품 사진·스티커로 맞추는 후처리는 post.ts(지운 결과에서 다시 그려서, 모델을 다시 안 돌림)
import { SIZE } from './model';
import { canvas, ctx2d, encode, free, type Canvas } from './canvas';
import type { Box } from './post';

export type Segment = (input: Float32Array) => Promise<Float32Array>;
export type Step = (p: number) => void;
export type Cutout = { blob: Blob; box: Box | null };
type Rel = [x: number, y: number, w: number, h: number];   // 0~1 비율

// 결과 크기 상한: 그보다 큰 사진(200MP 등)은 줄여서 — 5천만 화소면 캔버스 한 장이 200MB. 그 크기로 못 만들면(iOS 사파리는 1,677만 화소까지) 한 번 더 작게
const MAX_PIXELS = [50_000_000, 16_777_216];
// 물체 상자: 마스크가 이보다 진한 곳(10/255) — 머리카락 끝처럼 옅은 곳까지 넣음
const BOX_MIN = 0.04;

// 모델 입력: 비율 무시하고 1024×1024로(모델이 그렇게 배움), 단순 쌍선형, (값−128)/256, 채널별로.
// 반 칸 옮겨 한 번 더 그리는 것: 예전 라이브러리는 출력 x를 원본 x·배율에서 뽑아서(픽셀 중심이 아님) 그 자리에 맞춤 —
// 결과가 예전과 가장 비슷해짐(큰 거품 사진 평균 차이 2.9 → 1.7/255, 보통 사진 0.6). 옮겨서 빈 가장자리 한 줄은 첫 그림이 채움
// 돌려주는 것: 마스크를 알파로 담은 1024 캔버스 + 물체 상자(0~1 비율, 없으면 null)
async function maskOf(bmp: ImageBitmap, segment: Segment, step: Step): Promise<{ mask: Canvas; rel: Rel | null }> {
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
  let x0 = SIZE, y0 = SIZE, x1 = -1, y1 = -1;
  for (let j = 0; j < n; j++) {
    a[4 * j + 3] = m[j] * 255;
    if (m[j] > BOX_MIN) {
      const cx = j % SIZE, cy = (j - cx) / SIZE;
      if (cx < x0) x0 = cx;
      if (cx > x1) x1 = cx;
      if (cy < y0) y0 = cy;
      if (cy > y1) y1 = cy;
    }
  }
  x.putImageData(md, 0, 0);
  return { mask: c, rel: x1 < 0 ? null : [x0 / SIZE, y0 / SIZE, (x1 + 1 - x0) / SIZE, (y1 + 1 - y0) / SIZE] };
}

// 원본(상한보다 크면 줄여서) 위에 마스크를 늘려 씌움(destination-in: 원본 알파 × 마스크) → PNG
async function compose(bmp: ImageBitmap, mask: Canvas, rel: Rel | null, maxPixels: number): Promise<Cutout> {
  const k = Math.min(1, Math.sqrt(maxPixels / (bmp.width * bmp.height)));
  const W = Math.max(1, Math.round(bmp.width * k)), H = Math.max(1, Math.round(bmp.height * k));
  const out = canvas(W, H);
  const x = ctx2d(out);
  x.imageSmoothingQuality = 'high';
  x.drawImage(bmp, 0, 0, W, H);
  x.globalCompositeOperation = 'destination-in';
  x.imageSmoothingQuality = 'low';
  x.drawImage(mask, 0, 0, W, H);
  x.globalCompositeOperation = 'source-over';
  // 상자는 결과 화소로(1024 마스크 한 칸만큼 넉넉히)
  let box: Box | null = null;
  if (rel) {
    const bx = Math.max(0, Math.floor((rel[0] - 1 / SIZE) * W)), by = Math.max(0, Math.floor((rel[1] - 1 / SIZE) * H));
    box = [bx, by, Math.min(W, Math.ceil((rel[0] + rel[2] + 1 / SIZE) * W)) - bx, Math.min(H, Math.ceil((rel[1] + rel[3] + 1 / SIZE) * H)) - by, W, H];
  }
  try {
    return { blob: await encode(out), box };
  } finally {
    free(out);
  }
}

// 풀기는 createImageBitmap — 브라우저가 여는 그림이면 다(PNG·JPEG·WebP·GIF·AVIF·BMP…), 사진 방향(EXIF)도 맞춰 줌
export async function removeBackground(file: Blob, segment: Segment, step: Step = () => {}): Promise<Cutout> {
  const bmp = await createImageBitmap(file);
  try {
    step(10);
    const { mask, rel } = await maskOf(bmp, segment, step);
    try {
      for (let i = 0; ; i++) {
        try {
          const r = await compose(bmp, mask, rel, MAX_PIXELS[i]);
          step(100);
          return r;
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
