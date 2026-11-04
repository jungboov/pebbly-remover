// 아이폰 사진(HEIC·HEIF) 풀기 — 기기가 풀 수 있으면(사파리 등) 그대로, 아니면 libheif(wasm, LGPL-3.0)로 풀어 JPG(0.95)로
// libheif는 HEIC가 들어올 때만 받음(압축해 약 0.4MB). 캔버스 워커에서(화면 안 멈춤)
import { canvas, ctx2d, encode, free } from './canvas';

export const isHeic = (f: File | Blob) => /image\/hei[cf]/i.test(f.type) || ('name' in f && /\.(heic|heif)$/i.test(f.name));

type HeifImage = { get_width(): number; get_height(): number; is_primary(): boolean; free?(): void; display(img: ImageData, cb: (d: ImageData | null) => void): void };
type Lib = { HeifDecoder: new () => { decode(b: Uint8Array): HeifImage[]; free?(): void } };
let lib: Promise<Lib> | null = null;

export async function heicToJpeg(file: Blob): Promise<Blob> {
  try {
    const b = await createImageBitmap(file);   // 기기가 푼다면 바꿀 필요 없음
    b.close();
    return file;
  } catch { /* libheif로 */ }
  const L = await (lib ??= import('libheif-js/libheif-wasm/libheif-bundle.mjs').then(m => m.default() as Lib).catch(e => { lib = null; throw e; }));
  const dec = new L.HeifDecoder();
  const imgs = dec.decode(new Uint8Array(await file.arrayBuffer()));
  try {
    const im = imgs.find(i => i.is_primary()) ?? imgs[0];
    if (!im) throw new Error('heic: no image');
    const W = im.get_width(), H = im.get_height();
    const data = await new Promise<ImageData>((res, rej) => im.display(new ImageData(W, H), d => (d ? res(d) : rej(new Error('heic: decode')))));
    const c = canvas(W, H);
    ctx2d(c).putImageData(data, 0, 0);
    try {
      return await encode(c, 'image/jpeg', 0.95);
    } finally {
      free(c);
    }
  } finally {
    imgs.forEach(i => i.free?.());
    dec.free?.();
  }
}
