// 썸네일: 가로 192px로 줄여 풀고(EXIF 방향 맞춤) JPEG로 — 12MP 사진 10장을 그대로 72px에 띄우면 GPU 쪽에서만 340MB를 씀
import { canvas, ctx2d, encode } from './canvas';

export async function thumbOf(file: Blob): Promise<Blob> {
  const bmp = await createImageBitmap(file, { resizeWidth: 192, resizeQuality: 'medium' });
  const c = canvas(bmp.width, bmp.height);
  // 화면 스레드에선 CPU 캔버스로: GPU 캔버스는 지우는 워커가 GPU를 쓰는 동안 toBlob에서 기다림
  ctx2d(c, { willReadFrequently: true }).drawImage(bmp, 0, 0);
  bmp.close();
  return encode(c, 'image/jpeg', 0.85);
}
