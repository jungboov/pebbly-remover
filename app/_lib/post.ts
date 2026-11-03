// 후처리: 지운 결과(투명 PNG + 물체 상자)를 상품 사진·스티커로 다시 그림 — 모델은 다시 안 돌림
// 캔버스 워커(canvas.worker.ts)에서 돌아서 화면이 안 멈춤(워커를 못 쓰면 화면 스레드에서 같은 코드)
import { canvas, ctx2d, encode, free, type Canvas } from './canvas';

// 물체 상자(결과 화소) + 결과 전체 크기(W·H — 물체가 사진 가장자리에 닿았는지 볼 때)
export type Box = [x: number, y: number, w: number, h: number, W: number, H: number];
export type Mode = 'cut' | 'product' | 'sticker';
// 상품 사진: 고른 색 바탕 · 정사각형 · 모든 사진 같은 여백(한 변의 비율)
export type ProductOpts = { bg: string; size: number; pad: number };
// 스티커: 흰 테두리(한 변의 비율, 0이면 없음) · 크기(STICKER_SIZES)
export type StickerOpts = { outline: number; size: number };
export type Spec = { mode: 'product'; opts: ProductOpts } | { mode: 'sticker'; opts: StickerOpts };

export const PRODUCT_DEFAULT: ProductOpts = { bg: '#ffffff', size: 1000, pad: 0.08 };
export const PRODUCT_SIZES = [1000, 1500, 2000];
// 테두리: 없음 · 얇게 · 보통 · 두껍게(한 변의 비율 — 360px에서 0 · 5 · 9 · 14px)
export const STICKER_DEFAULT: StickerOpts = { outline: 0.025, size: 360 };
export const OUTLINES = [0, 0.015, 0.025, 0.04];

// 카카오톡 이모티콘 규격 — 카카오 이모티콘 스튜디오 '이모티콘 유형별 이미지 가이드'(https://kakaoemoticonstudio.notion.site/image-guide, 2026-11-04 확인)
// 멈춰있는 이모티콘 360×360 PNG 150KB 이하 · 큰 이모티콘 540×540(제안 때 움직이지 않는 것은 PNG) 1MB 이하 · 멈춰있는 미니 180×180 PNG 100KB 이하
// · 아이콘 78×78 PNG 16KB 이하 · 모두 72dpi RGB, 배경 투명. 1000은 규격 없는 큰 스티커
export const STICKER_SIZES: { size: number; maxBytes?: number; ko: string; en: string }[] = [
  { size: 360, maxBytes: 150_000, ko: '카톡 이모티콘 360', en: 'Kakao emoticon 360' },
  { size: 540, maxBytes: 1_000_000, ko: '카톡 큰 이모티콘 540', en: 'Kakao big 540' },
  { size: 180, maxBytes: 100_000, ko: '카톡 미니 180', en: 'Kakao mini 180' },
  { size: 78, maxBytes: 16_000, ko: '카톡 아이콘 78', en: 'Kakao icon 78' },
  { size: 1000, ko: '크게 1000', en: 'Large 1000' },
];

// 물체만 잘라 dw×dh로 줄인(또는 늘린) 그림 — 자르기·줄이기를 풀 때 한 번에(큰 사진도 원본 크기 캔버스를 안 만듦)
async function subject(cutout: Blob, box: Box | null, fit: number): Promise<{ bmp: ImageBitmap; w: number; h: number }> {
  let [bx, by, bw, bh] = box ?? [0, 0, 0, 0, 0, 0];
  if (!box) { const b = await createImageBitmap(cutout); [bx, by, bw, bh] = [0, 0, b.width, b.height]; b.close(); }
  const k = fit / Math.max(bw, bh);
  const w = Math.max(1, Math.round(bw * k)), h = Math.max(1, Math.round(bh * k));
  const bmp = await createImageBitmap(cutout, bx, by, bw, bh, { resizeWidth: w, resizeHeight: h, resizeQuality: 'high' });
  return { bmp, w, h };
}

// 상품 사진: 한 변 size, 여백 pad(한 변의 비율) 안에 물체의 긴 쪽을 꽉 차게, 가운데. 바탕이 있으니 JPEG
// 물체가 사진 아래 끝에서 잘려 있으면(사람 상반신 등) 가운데 떠 있지 않게 아래에 붙임
async function product(cutout: Blob, box: Box | null, o: ProductOpts): Promise<Blob> {
  const S = o.size, pad = Math.round(S * o.pad), inner = Math.max(1, S - 2 * pad);
  const { bmp, w, h } = await subject(cutout, box, inner);
  const c = canvas(S, S), x = ctx2d(c);
  x.fillStyle = o.bg;
  x.fillRect(0, 0, S, S);
  const cutAtBottom = !!box && box[1] + box[3] >= box[5] - 1;
  x.drawImage(bmp, Math.round((S - w) / 2), cutAtBottom ? S - h : Math.round((S - h) / 2), w, h);   // 크기를 적어 둠: 줄이기 옵션을 무시하는 브라우저도 맞게
  bmp.close();
  try {
    return await encode(c, 'image/jpeg', 0.92);
  } finally {
    free(c);
  }
}

// 거리 변환(Felzenszwalb): 물체 밖 각 화소에서 가장 가까운 물체 화소까지 거리의 제곱
const INF = 1e20;
function dt1(f: Float32Array, n: number, d: Float32Array, v: Int32Array, z: Float32Array) {
  let k = 0;
  v[0] = 0; z[0] = -INF; z[1] = INF;
  for (let q = 1; q < n; q++) {
    let s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (s <= z[k]) { k--; s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
    k++; v[k] = q; z[k] = s; z[k + 1] = INF;
  }
  k = 0;
  for (let q = 0; q < n; q++) {
    while (z[k + 1] < q) k++;
    d[q] = (q - v[k]) * (q - v[k]) + f[v[k]];
  }
}
function distance2(inside: (i: number) => boolean, w: number, h: number): Float32Array {
  const g = new Float32Array(w * h), m = Math.max(w, h);
  const f = new Float32Array(m), d = new Float32Array(m), v = new Int32Array(m), z = new Float32Array(m + 1);
  for (let i = 0; i < w * h; i++) g[i] = inside(i) ? 0 : INF;
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) f[y] = g[y * w + x];
    dt1(f, h, d, v, z);
    for (let y = 0; y < h; y++) g[y * w + x] = d[y];
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) f[x] = g[y * w + x];
    dt1(f, w, d, v, z);
    for (let x = 0; x < w; x++) g[y * w + x] = d[x];
  }
  return g;
}

// 스티커: 투명 바탕, 물체 둘레에 흰 테두리(거리 변환으로 둥글고 고르게, 가장자리는 부드럽게).
// 작은 규격(360 등)은 두 배로 그려 줄여서 테두리 가장자리를 매끄럽게. 용량 상한을 넘으면 256색 PNG로
async function sticker(cutout: Blob, box: Box | null, o: StickerOpts): Promise<Blob> {
  const S = o.size, W = S < 720 ? S * 2 : S;
  const ow = Math.round(W * o.outline), gap = Math.round(W * 0.03);
  const { bmp, w, h } = await subject(cutout, box, Math.max(1, W - 2 * (ow + gap)));
  let c: Canvas = canvas(W, W);
  const x = ctx2d(c, { willReadFrequently: true });
  const ox = Math.round((W - w) / 2), oy = Math.round((W - h) / 2);
  if (ow > 0) {
    // 물체(알파 100 이상 — 옅은 머리카락 끝도 감싸게)에서 ow 안쪽을 흰색으로, 바깥 한 화소는 거리만큼 옅게
    x.drawImage(bmp, ox, oy, w, h);
    const img = x.getImageData(0, 0, W, W), p = img.data;
    const d2 = distance2(i => p[4 * i + 3] >= 100, W, W);
    for (let i = 0; i < W * W; i++) {
      const a = Math.min(1, Math.max(0, ow + 0.5 - Math.sqrt(d2[i])));
      p[4 * i] = p[4 * i + 1] = p[4 * i + 2] = 255;
      p[4 * i + 3] = a * 255;
    }
    x.putImageData(img, 0, 0);
  }
  x.drawImage(bmp, ox, oy, w, h);
  bmp.close();
  if (W !== S) {
    const s = canvas(S, S), sx = ctx2d(s, { willReadFrequently: true });
    sx.imageSmoothingQuality = 'high';
    sx.drawImage(c, 0, 0, S, S);
    free(c);
    c = s;
  }
  try {
    const png = await encode(c);
    const max = STICKER_SIZES.find(z => z.size === S)?.maxBytes;
    if (!max || png.size <= max) return png;
    const small = await png8(ctx2d(c, { willReadFrequently: true }).getImageData(0, 0, S, S));
    return small.size < png.size ? small : png;
  } finally {
    free(c);
  }
}

export async function render(cutout: Blob, box: Box | null, spec: Spec): Promise<Blob> {
  return spec.mode === 'product' ? product(cutout, box, spec.opts) : sticker(cutout, box, spec.opts);
}

// ── 256색 PNG(팔레트 + 투명도): 카톡 규격 용량(360px 150KB 등)을 넘을 때만 ──
// 색 고르기는 median cut(RGBA를 5·5·5·4비트로 묶어 센 뒤 상자를 나눔), 압축은 브라우저 CompressionStream('deflate' = zlib)
type Bucket = { keys: number[]; n: number };
function quantize(px: Uint8ClampedArray, max = 256): { palette: number[][]; index: Uint8Array } {
  const hist = new Map<number, number[]>();   // 묶은 색 → [개수, R합, G합, B합, A합]
  const keyOf = (i: number) => ((px[i] >> 3) << 14) | ((px[i + 1] >> 3) << 9) | ((px[i + 2] >> 3) << 4) | (px[i + 3] >> 4);
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] === 0) continue;
    const k = keyOf(i), h = hist.get(k);
    if (h) { h[0]++; h[1] += px[i]; h[2] += px[i + 1]; h[3] += px[i + 2]; h[4] += px[i + 3]; }
    else hist.set(k, [1, px[i], px[i + 1], px[i + 2], px[i + 3]]);
  }
  const ch = (k: number, c: number) => c === 0 ? (k >> 14) & 31 : c === 1 ? (k >> 9) & 31 : c === 2 ? (k >> 4) & 31 : (k & 15) * 2;
  const buckets: Bucket[] = [{ keys: [...hist.keys()], n: px.length }];
  while (buckets.length < max - 1) {   // 0번은 완전 투명
    let bi = -1, best = 0, bc = 0;
    buckets.forEach((b, i) => {
      if (b.keys.length < 2) return;
      for (let c = 0; c < 4; c++) {
        let lo = 99, hi = -1;
        for (const k of b.keys) { const v = ch(k, c); if (v < lo) lo = v; if (v > hi) hi = v; }
        const score = (hi - lo) * Math.sqrt(b.n);
        if (score > best) { best = score; bi = i; bc = c; }
      }
    });
    if (bi < 0) break;
    const b = buckets[bi];
    b.keys.sort((p, q) => ch(p, bc) - ch(q, bc));
    let acc = 0, cut = 0;
    const half = b.keys.reduce((s, k) => s + hist.get(k)![0], 0) / 2;
    for (; cut < b.keys.length - 1 && acc < half; cut++) acc += hist.get(b.keys[cut])![0];
    cut = Math.max(1, cut);
    const left = b.keys.slice(0, cut), right = b.keys.slice(cut);
    const count = (ks: number[]) => ks.reduce((s, k) => s + hist.get(k)![0], 0);
    buckets.splice(bi, 1, { keys: left, n: count(left) }, { keys: right, n: count(right) });
  }
  const palette: number[][] = [[0, 0, 0, 0]], map = new Map<number, number>();
  for (const b of buckets) {
    let n = 0, r = 0, g = 0, bl = 0, a = 0;
    for (const k of b.keys) { const h = hist.get(k)!; n += h[0]; r += h[1]; g += h[2]; bl += h[3]; a += h[4]; map.set(k, palette.length); }
    if (n) palette.push([Math.round(r / n), Math.round(g / n), Math.round(bl / n), Math.round(a / n)]);
  }
  const index = new Uint8Array(px.length / 4);
  for (let i = 0, j = 0; i < px.length; i += 4, j++) index[j] = px[i + 3] === 0 ? 0 : map.get(keyOf(i)) ?? 0;
  return { palette, index };
}

const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length), dv = new DataView(out.buffer);
  dv.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  let c = 0xffffffff;
  for (let i = 4; i < 8 + data.length; i++) c = CRC[(c ^ out[i]) & 255] ^ (c >>> 8);
  dv.setUint32(8 + data.length, (c ^ 0xffffffff) >>> 0);
  return out;
}
async function png8(img: ImageData): Promise<Blob> {
  const { width: w, height: h } = img;
  const { palette, index } = quantize(img.data);
  const raw = new Uint8Array((w + 1) * h);
  for (let y = 0; y < h; y++) raw.set(index.subarray(y * w, (y + 1) * w), y * (w + 1) + 1);   // 줄마다 필터 0
  const z = new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate'))).arrayBuffer());
  const ihdr = new Uint8Array(13), dv = new DataView(ihdr.buffer);
  dv.setUint32(0, w); dv.setUint32(4, h);
  ihdr.set([8, 3, 0, 0, 0], 8);   // 8비트 · 팔레트
  const plte = new Uint8Array(palette.length * 3), trns = new Uint8Array(palette.length);
  palette.forEach(([r, g, b, a], i) => { plte.set([r, g, b], i * 3); trns[i] = a; });
  const sig = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  return new Blob([sig, chunk('IHDR', ihdr), chunk('PLTE', plte), chunk('tRNS', trns), chunk('IDAT', z), chunk('IEND', new Uint8Array(0))] as BlobPart[], { type: 'image/png' });
}
