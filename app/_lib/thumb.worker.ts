// 썸네일 워커: 큰 사진을 풀어 줄이는 일도 화면 스레드 밖에서(48MP 한 장을 화면 스레드에서 줄이면 화면이 45ms쯤 멈춤)
// 받는 말: { id, file }  보내는 말: { id, blob? }
const scope = self as unknown as { postMessage(m: unknown): void; onmessage: ((e: MessageEvent) => void) | null };

scope.onmessage = async (e) => {
  const { id, file } = e.data as { id: number; file: Blob };
  try {
    const bmp = await createImageBitmap(file, { resizeWidth: 192, resizeQuality: 'medium' });
    const c = new OffscreenCanvas(bmp.width, bmp.height);
    c.getContext('2d')!.drawImage(bmp, 0, 0);
    bmp.close();
    scope.postMessage({ id, blob: await c.convertToBlob({ type: 'image/jpeg', quality: 0.85 }) });
  } catch {
    scope.postMessage({ id });
  }
};
