// 사진 한 장 배경 지우기: 풀기 → 모델 입력(1024×1024) → 마스크 → 원본 크기로 늘려 씌우기 → 투명 PNG(+ 마스크·원본 크기)
// 줄이기·늘리기·합치기는 캔버스(브라우저 그리기)로 — 예전 라이브러리는 JS 반복문이라 큰 사진에서 느리고 원본 크기 배열을 여러 벌 만들었음(48MP 3.3GB)
// 상품 사진·스티커로 맞추는 후처리는 post.ts(원본 + 이 마스크에서 다시 그려서, 모델을 다시 안 돌림)
import { SIZE } from './model';
import { canvas, ctx2d, encode, free, type Canvas } from './canvas';

export type Segment = (input: Float32Array) => Promise<Float32Array>;
export type Step = (p: number) => void;
// 투명 PNG · 모델 마스크(1024², 0~255 — 후처리 재료) · 원본 크기
export type Cutout = { blob: Blob; mask: Uint8Array; size: [w: number, h: number] };

// 결과 크기 상한: 그보다 큰 사진(200MP 등)은 줄여서 — 5천만 화소면 캔버스 한 장이 200MB. 그 크기로 못 만들면(iOS 사파리는 1,677만 화소까지) 한 번 더 작게
const MAX_PIXELS = [50_000_000, 16_777_216];

// 모델 입력: 비율 무시하고 1024×1024로(모델이 그렇게 배움), 단순 쌍선형, (값−128)/256, 채널별로.
// 반 칸 옮겨 한 번 더 그리는 것: 예전 라이브러리는 출력 x를 원본 x·배율에서 뽑아서(픽셀 중심이 아님) 그 자리에 맞춤 —
// 결과가 예전과 가장 비슷해짐(큰 거품 사진 평균 차이 2.9 → 1.7/255, 보통 사진 0.6). 옮겨서 빈 가장자리 한 줄은 첫 그림이 채움
// 돌려주는 것: 마스크를 알파로 담은 1024 캔버스 + 같은 마스크(0~255)
async function maskOf(bmp: ImageBitmap, segment: Segment, step: Step): Promise<{ mask: Canvas; u8: Uint8Array }> {
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
  const md = new ImageData(SIZE, SIZE), a = md.data, u8 = new Uint8Array(n);
  for (let j = 0; j < n; j++) a[4 * j + 3] = u8[j] = Math.min(255, Math.max(0, Math.round(m[j] * 255)));
  x.putImageData(md, 0, 0);
  return { mask: c, u8 };
}

// 원본(상한보다 크면 줄여서) 위에 마스크를 늘려 씌움(destination-in: 원본 알파 × 마스크) → PNG
async function compose(bmp: ImageBitmap, mask: Canvas, maxPixels: number): Promise<Blob> {
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
  try {
    return await encode(out);
  } finally {
    free(out);
  }
}

// 풀기는 createImageBitmap — 브라우저가 여는 그림이면 다(PNG·JPEG·WebP·GIF·AVIF·BMP…), 사진 방향(EXIF)도 맞춰 줌
export async function removeBackground(file: Blob, segment: Segment, step: Step = () => {}): Promise<Cutout> {
  const bmp = await createImageBitmap(file);
  try {
    step(10);
    const { mask, u8 } = await maskOf(bmp, segment, step);
    try {
      for (let i = 0; ; i++) {
        try {
          const blob = await compose(bmp, mask, MAX_PIXELS[i]);
          step(100);
          return { blob, mask: u8, size: [bmp.width, bmp.height] };
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
