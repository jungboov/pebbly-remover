// 후처리: 지운 사진을 상품 사진·스티커로 다시 그림 — 모델은 다시 안 돌림
// 원본 사진 + 모델 마스크(1024²)에서: 마스크를 다듬고(작은 조각 지우기·속 채우기) 물체만 잘라 원본 화소로 그림(옅은 곳 색이 안 깨지게)
// 캔버스 워커(canvas.worker.ts)에서 돌아서 화면이 안 멈춤(워커를 못 쓰면 화면 스레드에서 같은 코드)
import { canvas, ctx2d, encode, free, type Canvas } from './canvas';

export type Mode = 'cut' | 'product' | 'sticker';
// 상품 사진: 고른 색 바탕 · 정사각형 · 모든 사진 같은 여백(한 변의 비율) · 속 채우기
export type ProductOpts = { bg: string; size: number; pad: number; fill: boolean };
// 스티커: 흰 테두리(한 변의 비율, 0이면 없음) · 크기(STICKER_SIZES) · 속 채우기
export type StickerOpts = { outline: number; size: number; fill: boolean };
export type Spec = { mode: 'product'; opts: ProductOpts } | { mode: 'sticker'; opts: StickerOpts };
// 다시 그릴 재료: 원본 사진 파일 · 모델 마스크(1024×1024, 0~255, 사진 전체를 비율 무시하고 늘린 자리) · 원본 크기
export type Src = { file: Blob; mask: Uint8Array; size: [w: number, h: number] };

export const PRODUCT_DEFAULT: ProductOpts = { bg: '#ffffff', size: 1000, pad: 0.08, fill: true };
export const PRODUCT_SIZES = [1000, 1500, 2000];
// 테두리: 없음 · 얇게 · 보통 · 두껍게(한 변의 비율 — 360px에서 0 · 5 · 9 · 14px)
export const STICKER_DEFAULT: StickerOpts = { outline: 0.025, size: 360, fill: true };
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

const M = 1024;   // 마스크 한 변

// 거리 변환(Felzenszwalb): 각 화소에서 가장 가까운 '안' 화소까지 거리의 제곱
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

// 덩어리 나누기(4방향): 칸마다 덩어리 번호(-1 = 밖), 덩어리마다 넓이
function components(bin: Uint8Array, w: number, h: number): { lab: Int32Array; area: number[] } {
  const lab = new Int32Array(w * h).fill(-1), q = new Int32Array(w * h), area: number[] = [];
  for (let i = 0; i < w * h; i++) {
    if (!bin[i] || lab[i] >= 0) continue;
    const id = area.length;
    let qh = 0, qt = 0;
    q[qt++] = i; lab[i] = id;
    while (qh < qt) {
      const j = q[qh++], x = j % w;
      if (x > 0 && bin[j - 1] && lab[j - 1] < 0) { lab[j - 1] = id; q[qt++] = j - 1; }
      if (x < w - 1 && bin[j + 1] && lab[j + 1] < 0) { lab[j + 1] = id; q[qt++] = j + 1; }
      if (j >= w && bin[j - w] && lab[j - w] < 0) { lab[j - w] = id; q[qt++] = j - w; }
      if (j < w * (h - 1) && bin[j + w] && lab[j + w] < 0) { lab[j + w] = id; q[qt++] = j + w; }
    }
    area.push(qt);
  }
  return { lab, area };
}

// 마스크 다듬기 — 상품 사진·스티커는 '물건 하나'라서
//  1) 작은 조각 지우기: 가장 큰 덩어리의 2%보다 작은 조각(워터마크·티끌)과 그 옅은 둘레(6칸)를 지움 — 옅어도 큰 덩어리 곁에 있는 것은 남김
//  2) 속 채우기(fill): 윤곽 안쪽 깊은 곳(3~8칸 안부터)의 반투명을 불투명으로 — 보석·투명 끈처럼 모델이 애매하게 본 곳. 진짜 구멍(0.2 아래)은 그대로
// 돌려주는 것: 다듬은 마스크 + 물체 상자(0~1 비율, 없으면 null)
export type Refined = { a: Uint8Array; rel: [x0: number, y0: number, x1: number, y1: number] | null };
export function refineMask(mask: Uint8Array, fill: boolean): Refined {
  // 0) 아주 옅은 곳(약 10% 아래)은 0으로 — 흰 바탕 위에서 물체 둘레에 뿌옇게 남던 것
  const n = M * M, a = Uint8Array.from(mask, v => (v < 24 ? 0 : v)), bin = new Uint8Array(n);
  for (let i = 0; i < n; i++) bin[i] = a[i] >= 51 ? 1 : 0;
  const { lab, area } = components(bin, M, M);
  if (area.length) {
    const big = Math.max(...area), small = area.map(s => s < big * 0.02);
    if (small.some(Boolean)) {
      const keep = distance2(i => lab[i] >= 0 && !small[lab[i]], M, M), drop = distance2(i => lab[i] >= 0 && small[lab[i]], M, M);
      for (let i = 0; i < n; i++) if (drop[i] < keep[i] && drop[i] <= 36) { a[i] = 0; bin[i] = 0; }
    }
    if (fill) {
      // 채우는 정도는 깊이(윤곽에서 3~8칸) × 진하기(0.2 → 0, 0.6 → 1)로 이어지게 — 문턱을 넘은 곳만 갑자기 채우면 얼룩덜룩해짐
      const din = distance2(i => !bin[i], M, M);   // 안에서 윤곽까지
      for (let i = 0; i < n; i++) {
        if (!bin[i]) continue;
        const d = Math.sqrt(din[i]), depth = d >= 8 ? 1 : d <= 3 ? 0 : (d - 3) / 5;
        const s = depth * Math.min(1, (a[i] - 51) / 102) * 255;
        if (s > a[i]) a[i] = s;
      }
    }
  }
  let x0 = M, y0 = M, x1 = -1, y1 = -1;
  for (let i = 0; i < n; i++) {
    if (a[i] <= 10) continue;
    const x = i % M, y = (i - x) / M;
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  return { a, rel: x1 < 0 ? null : [x0 / M, y0 / M, (x1 + 1) / M, (y1 + 1) / M] };
}

// 물체만 잘라 S×S 캔버스에 놓음(긴 쪽이 fit, 가로 가운데 · 세로는 가운데 또는 아래 끝): 원본 화소 × 다듬은 마스크
// 자르기·줄이기는 풀 때 한 번에(큰 사진도 원본 크기 캔버스를 안 만듦). 물체가 사진 아래 끝에서 잘려 있으면(사람 상반신 등) bottom이면 아래에 붙임
async function layer(src: Src, r: Refined, S: number, fit: number, bottom: boolean): Promise<Canvas> {
  const [W, H] = src.size, [x0, y0, x1, y1] = r.rel ?? [0, 0, 1, 1];
  const sx = Math.floor(x0 * W), sy = Math.floor(y0 * H), sw = Math.max(1, Math.ceil(x1 * W) - sx), sh = Math.max(1, Math.ceil(y1 * H) - sy);
  const k = fit / Math.max(sw, sh), w = Math.max(1, Math.round(sw * k)), h = Math.max(1, Math.round(sh * k));
  const ox = Math.round((S - w) / 2), oy = bottom && y1 >= 1 - 2 / M ? S - h : Math.round((S - h) / 2);
  const bmp = await createImageBitmap(src.file, sx, sy, sw, sh, { resizeWidth: w, resizeHeight: h, resizeQuality: 'high' });
  const mc = canvas(M, M), md = new ImageData(M, M), p = md.data;
  for (let i = 0; i < M * M; i++) p[4 * i + 3] = r.a[i];
  ctx2d(mc).putImageData(md, 0, 0);
  const c = canvas(S, S), x = ctx2d(c, { willReadFrequently: true });
  x.drawImage(bmp, ox, oy, w, h);   // 크기를 적어 둠: 줄이기 옵션을 무시하는 브라우저도 맞게
  bmp.close();
  x.globalCompositeOperation = 'destination-in';
  x.imageSmoothingQuality = 'high';
  x.drawImage(mc, x0 * M, y0 * M, (x1 - x0) * M, (y1 - y0) * M, ox, oy, w, h);
  x.globalCompositeOperation = 'source-over';
  free(mc);
  return c;
}

// 상품 사진: 한 변 size, 여백 pad(한 변의 비율) 안에 물체의 긴 쪽을 꽉 차게. 바탕이 있으니 JPEG
async function product(src: Src, r: Refined, o: ProductOpts): Promise<Blob> {
  const S = o.size, inner = Math.max(1, S - 2 * Math.round(S * o.pad));
  const c = await layer(src, r, S, inner, true), x = ctx2d(c);
  x.globalCompositeOperation = 'destination-over';
  x.fillStyle = o.bg;
  x.fillRect(0, 0, S, S);
  try {
    return await encode(c, 'image/jpeg', 0.92);
  } finally {
    free(c);
  }
}

// 스티커: 투명 바탕, 물체 둘레에 흰 테두리(거리 변환으로 둥글고 고르게, 가장자리는 부드럽게).
// 작은 규격(360 등)은 두 배로 그려 줄여서 테두리 가장자리를 매끄럽게. 용량 상한을 넘으면 256색 PNG로
async function sticker(src: Src, r: Refined, o: StickerOpts): Promise<Blob> {
  const S = o.size, W = S < 720 ? S * 2 : S;
  const ow = Math.round(W * o.outline), gap = Math.round(W * 0.03);
  let c: Canvas = await layer(src, r, W, Math.max(1, W - 2 * (ow + gap)), false);
  const x = ctx2d(c, { willReadFrequently: true });
  if (ow > 0) {
    // 물체(알파 100 이상 — 옅은 머리카락 끝도 감싸게)에서 ow 안쪽을 흰색으로, 바깥 한 화소는 거리만큼 옅게 → 물체 밑에 깖
    const p = x.getImageData(0, 0, W, W).data;
    const d2 = distance2(i => p[4 * i + 3] >= 100, W, W);
    const ring = new ImageData(W, W), q = ring.data;
    for (let i = 0; i < W * W; i++) {
      q[4 * i] = q[4 * i + 1] = q[4 * i + 2] = 255;
      q[4 * i + 3] = Math.min(1, Math.max(0, ow + 0.5 - Math.sqrt(d2[i]))) * 255;
    }
    const rc = canvas(W, W);
    ctx2d(rc).putImageData(ring, 0, 0);
    x.globalCompositeOperation = 'destination-over';
    x.drawImage(rc, 0, 0);
    x.globalCompositeOperation = 'source-over';
    free(rc);
  }
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

// 다듬은 마스크는 사진·속 채우기마다 한 번만(설정을 바꿔 가며 다시 그릴 때 거리 변환을 또 안 하게) — 최근 12개
const refinedCache = new Map<string, Refined>();
export async function render(src: Src, spec: Spec, key = ''): Promise<Blob> {
  const ck = `${key}|${spec.opts.fill}`;
  let r = key ? refinedCache.get(ck) : undefined;
  if (!r) {
    r = refineMask(src.mask, spec.opts.fill);
    if (key) {
      refinedCache.set(ck, r);
      if (refinedCache.size > 12) refinedCache.delete(refinedCache.keys().next().value!);
    }
  }
  return spec.mode === 'product' ? product(src, r, spec.opts) : sticker(src, r, spec.opts);
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
