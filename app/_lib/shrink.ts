// 받기 설정(줄여서 받기): 형식 · 크기(긴 변) · 용량(품질 또는 목표 용량) · 사진 정보
// 지운 결과(투명 PNG)·상품 사진(JPG)을 받기 직전에 다시 저장 — 캔버스 워커에서(화면 안 멈춤)
import { canvas, ctx2d, encode, free, type Canvas } from './canvas';
import { png8 } from './post';

export type DlFormat = 'auto' | 'png' | 'webp' | 'jpg';
export type DlSize = 'keep' | 'quality' | 'target';
// side: 긴 변 px(0 = 원본) · quality: 0.5~1 · target: 바이트 · strip: 사진 정보(찍은 곳·기기·시각) 지우기
export type DlOpts = { format: DlFormat; side: number; size: DlSize; quality: number; target: number; strip: boolean };
export const DL_DEFAULT: DlOpts = { format: 'auto', side: 0, size: 'keep', quality: 0.85, target: 1_000_000, strip: true };
export const DL_SIDES = [0, 2048, 1080];
export const DL_TARGETS = [500_000, 1_000_000, 2_000_000];

const TYPE: Record<Exclude<DlFormat, 'auto'>, string> = { png: 'image/png', webp: 'image/webp', jpg: 'image/jpeg' };
export const extOf = (type: string) => (type === 'image/jpeg' ? 'jpg' : type === 'image/webp' ? 'webp' : 'png');

// 받기 설정이 '그대로'면 다시 저장하지 않음(화질·시간 그대로). 사진 정보 남기기는 JPG로 받을 때만 뜻이 있음
export function passThrough(o: DlOpts, baseType: string): boolean {
  const type = o.format === 'auto' ? baseType : TYPE[o.format];
  return type === baseType && o.side === 0 && o.size === 'keep' && (o.strip || type !== 'image/jpeg');
}

// ── 사진 정보(EXIF): 원본 JPG의 APP1(Exif)을 결과 JPG에 다시 붙임 — 방향 값은 1(결과는 이미 바로 세워져 있음) ──
function exifOf(jpg: Uint8Array): Uint8Array | null {
  if (jpg[0] !== 0xff || jpg[1] !== 0xd8) return null;
  for (let i = 2; i + 4 < jpg.length;) {
    if (jpg[i] !== 0xff) return null;
    const m = jpg[i + 1], len = (jpg[i + 2] << 8) | jpg[i + 3];
    if (m === 0xda || m === 0xd9) return null;   // 그림 자료 시작 — 그 앞에 없으면 없음
    if (m === 0xe1 && String.fromCharCode(...jpg.subarray(i + 4, i + 8)) === 'Exif') return jpg.slice(i, i + 2 + len);
    i += 2 + len;
  }
  return null;
}
function orientationTo1(app1: Uint8Array) {
  const t = 10, dv = new DataView(app1.buffer, app1.byteOffset, app1.byteLength);   // 'FF E1 len(2) Exif\0\0' 뒤가 TIFF
  const le = dv.getUint16(t) === 0x4949;
  const ifd = t + dv.getUint32(t + 4, le), n = dv.getUint16(ifd, le);
  for (let k = 0; k < n; k++) {
    const e = ifd + 2 + k * 12;
    if (dv.getUint16(e, le) === 0x0112) { dv.setUint16(e + 8, 1, le); return; }
  }
}
async function withExif(out: Blob, original: Blob): Promise<Blob> {
  const app1 = exifOf(new Uint8Array(await original.slice(0, 256 * 1024).arrayBuffer()));
  if (!app1) return out;
  try { orientationTo1(app1); } catch { /* 방향 값을 못 찾으면 그대로 */ }
  const b = new Uint8Array(await out.arrayBuffer());
  let at = 2;   // SOI 뒤, JFIF(APP0)가 있으면 그 뒤
  if (b[2] === 0xff && b[3] === 0xe0) at = 4 + ((b[4] << 8) | b[5]);
  return new Blob([b.subarray(0, at), app1, b.subarray(at)] as BlobPart[], { type: 'image/jpeg' });
}

// 그리기: 긴 변을 side 이하로(원본보다 크게는 안 늘림), JPG면 투명한 곳을 바탕색으로
async function draw(input: Blob, side: number, type: string, bg: string, scale = 1): Promise<Canvas> {
  const bmp = await createImageBitmap(input);
  const k = Math.min(1, side ? side / Math.max(bmp.width, bmp.height) : 1) * scale;
  const W = Math.max(1, Math.round(bmp.width * k)), H = Math.max(1, Math.round(bmp.height * k));
  const c = canvas(W, H), x = ctx2d(c, { willReadFrequently: true });
  if (type === 'image/jpeg') { x.fillStyle = bg; x.fillRect(0, 0, W, H); }
  x.imageSmoothingQuality = 'high';
  x.drawImage(bmp, 0, 0, W, H);
  bmp.close();
  return c;
}

// 목표 용량: JPG·WebP는 품질을 반씩 좁혀 7번 안에(0.3~0.95), PNG는 무손실 → 넘으면 256색.
// 그래도 넘으면 크기를 줄여 다시(최대 4번)
async function toTarget(input: Blob, o: DlOpts, type: string, bg: string): Promise<Blob> {
  let scale = 1, last: Blob | null = null;
  for (let round = 0; round < 4; round++) {
    const c = await draw(input, o.side, type, bg, scale);
    try {
      if (type === 'image/png') {
        const png = await encode(c);
        if (png.size <= o.target) return png;
        const small = await png8(ctx2d(c, { willReadFrequently: true }).getImageData(0, 0, c.width, c.height));
        if (small.size <= o.target) return small;
        last = small.size < png.size ? small : png;
      } else {
        let lo = 0.3, hi = 0.95, best: Blob | null = null;
        const floor = await encode(c, type, lo);
        if (floor.size <= o.target) {
          best = floor;
          for (let i = 0; i < 6; i++) {
            const q = (lo + hi) / 2, b = await encode(c, type, q);
            if (b.size <= o.target) { best = b; lo = q; } else hi = q;
          }
          return best;
        }
        last = floor;
      }
    } finally {
      free(c);
    }
    scale *= Math.max(0.3, Math.sqrt(o.target / last.size) * 0.92);
  }
  return last!;
}

// input: 지운 결과·상품 사진(받기 전 모습) · original: 원본 파일(사진 정보를 남길 때) · bg: JPG로 받을 때 투명한 곳 색
export async function shrink(input: Blob, o: DlOpts, original: Blob | null, bg = '#ffffff'): Promise<Blob> {
  const type = o.format === 'auto' ? input.type : TYPE[o.format];
  let out: Blob;
  if (o.size === 'target') out = await toTarget(input, o, type, bg);
  else if (type === input.type && o.side === 0 && o.size === 'keep') out = input;
  else {
    const c = await draw(input, o.side, type, bg);
    try {
      out = await encode(c, type, type === 'image/png' ? undefined : o.size === 'quality' ? o.quality : 0.92);
    } finally {
      free(c);
    }
  }
  if (!o.strip && out.type === 'image/jpeg' && original && /jpe?g/i.test(original.type)) out = await withExif(out, original);
  return out;
}
