// 칼선 탭의 캔버스 일(캔버스 워커에서 — 못 쓰면 화면 스레드에서 같은 코드)
//  prepCut: 넣은 그림 준비 — 투명 PNG면 그림 부분만 잘라 'art', 투명이 없으면 사진('photo' = 네모 스티커, 배경을 지우면 art로)
//  geoOf: 칼선 계산(cutline.ts)
//  artFor: 인쇄용 그림(300dpi) — PNG 낱장(흰 테두리까지), SVG용 PNG, PDF용 RGB·투명값(압축)
//  sheetPng: 시트 한 장을 300dpi PNG로(DXF 짝 — 실루엣에서 그림을 찍을 때)
import { canvas, ctx2d, encode, free, type Canvas, type Ctx } from './canvas';
import { cutGeometry, gridFor, type CutOpts, type Geo } from './cutline';
import { chunk } from './post';

const MAX_SIDE = 2000;    // 준비한 그림 긴 변(300dpi로 169mm)
const PREVIEW = 640;      // 화면 미리보기 긴 변

export type Prep = { kind: 'art' | 'photo'; art: Blob; w: number; h: number; preview: Blob };

export async function prepCut(file: Blob): Promise<Prep> {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  const W = Math.max(1, Math.round(bmp.width * k)), H = Math.max(1, Math.round(bmp.height * k));
  const c = canvas(W, H), x = ctx2d(c, { willReadFrequently: true });
  x.imageSmoothingQuality = 'high';
  x.drawImage(bmp, 0, 0, W, H);
  bmp.close();
  const p = x.getImageData(0, 0, W, H).data;
  // 투명 그림인가: 반 넘게 투명한 화소가 2% 넘고, 가장자리 한 줄의 30% 넘게 투명
  let clear = 0, edge = 0, edgeClear = 0;
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) {
    for (let xx = 0; xx < W; xx++) {
      const a = p[4 * (y * W + xx) + 3];
      if (a < 128) clear++;
      if (y === 0 || y === H - 1 || xx === 0 || xx === W - 1) { edge++; if (a < 128) edgeClear++; }
      if (a >= 24) { if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
  }
  try {
    if (clear > W * H * 0.02 && edgeClear > edge * 0.3 && x1 >= 0) {
      const cw = x1 - x0 + 1, ch = y1 - y0 + 1, cc = canvas(cw, ch);
      ctx2d(cc).drawImage(c, x0, y0, cw, ch, 0, 0, cw, ch);
      const art = await encode(cc);
      const preview = await scaled(cc, cw, ch, 'image/png');
      free(cc);
      return { kind: 'art', art, w: cw, h: ch, preview };
    }
    const art = await encode(c, 'image/jpeg', 0.92);
    return { kind: 'photo', art, w: W, h: H, preview: await scaled(c, W, H, 'image/jpeg') };
  } finally {
    free(c);
  }
}

async function scaled(src: Canvas, w: number, h: number, type: string): Promise<Blob> {
  const k = Math.min(1, PREVIEW / Math.max(w, h));
  if (k === 1) return encode(src, type, 0.88);
  const c = canvas(Math.max(1, Math.round(w * k)), Math.max(1, Math.round(h * k))), x = ctx2d(c);
  x.imageSmoothingQuality = 'high';
  x.drawImage(src, 0, 0, c.width, c.height);
  try { return await encode(c, type, 0.88); } finally { free(c); }
}

export async function geoOf(art: Blob, aw: number, ah: number, o: CutOpts): Promise<Geo> {
  const g = gridFor(o, aw, ah);
  const bmp = await createImageBitmap(art);
  const c = canvas(g.gw, g.gh), x = ctx2d(c, { willReadFrequently: true });
  x.imageSmoothingQuality = 'high';
  x.drawImage(bmp, g.pad, g.pad, g.wMm * g.G, g.hMm * g.G);
  bmp.close();
  try {
    return cutGeometry(x.getImageData(0, 0, g.gw, g.gh).data, g, o);
  } finally {
    free(c);
  }
}

const pxOf = (mm: number, dpi: number) => Math.max(1, Math.round((mm / 25.4) * dpi));

// 칼선 고리를 캔버스 길로(mm → 화소)
function trace(x: Ctx, loops: number[][], s: number, ox = 0, oy = 0) {
  x.beginPath();
  for (const L of loops) {
    x.moveTo((L[0] + ox) * s, (L[1] + oy) * s);
    for (let i = 2; i + 5 < L.length; i += 6) x.bezierCurveTo((L[i] + ox) * s, (L[i + 1] + oy) * s, (L[i + 2] + ox) * s, (L[i + 3] + oy) * s, (L[i + 4] + ox) * s, (L[i + 5] + oy) * s);
    x.closePath();
  }
}

// 그림만 dpi로(아주 옅은 곳 — 10% 아래 — 은 지움: 흰 종이 위에 뿌옇게 찍히지 않게)
async function artPixels(art: Blob, geo: Geo, dpi: number): Promise<Canvas> {
  const w = pxOf(geo.art[2], dpi), h = pxOf(geo.art[3], dpi);
  const bmp = await createImageBitmap(art, { resizeWidth: w, resizeHeight: h, resizeQuality: 'high' });
  const c = canvas(w, h), x = ctx2d(c, { willReadFrequently: true });
  x.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  const d = x.getImageData(0, 0, w, h), p = d.data;
  for (let i = 3; i < p.length; i += 4) if (p[i] < 24) p[i] = 0;
  x.putImageData(d, 0, 0);
  return c;
}

// 300dpi를 PNG에 적음(pHYs: 1m당 화소) — 문서·커팅기 프로그램이 mm 크기로 엶
async function withDpi(png: Blob, dpi: number): Promise<Blob> {
  const b = new Uint8Array(await png.arrayBuffer()), dvb = new DataView(b.buffer);
  for (let o = 8; o + 8 <= b.length;) {   // 이미 적혀 있으면(브라우저 인코더가 넣음) 그대로
    const t = String.fromCharCode(b[o + 4], b[o + 5], b[o + 6], b[o + 7]);
    if (t === 'pHYs') return png;
    if (t === 'IDAT') break;
    o += 12 + dvb.getUint32(o);
  }
  const ppm = Math.round(dpi / 0.0254), d = new Uint8Array(9), dv = new DataView(d.buffer);
  dv.setUint32(0, ppm); dv.setUint32(4, ppm); d[8] = 1;
  return new Blob([b.subarray(0, 33), chunk('pHYs', d), b.subarray(33)] as BlobPart[], { type: 'image/png' });
}

const deflate = async (u: Uint8Array) =>
  new Uint8Array(await new Response(new Blob([u as BlobPart]).stream().pipeThrough(new CompressionStream('deflate'))).arrayBuffer());

export type PdfImage = { w: number; h: number; rgb: Uint8Array; alpha: Uint8Array };
export type ArtKind = 'png' | 'svg' | 'pdf';

// png: 스티커 낱장(칼선 안 흰색 + 그림, 칼선 밖 투명) · svg: 그림만 PNG · pdf: 그림만 RGB·투명값(zlib)
export async function artFor(art: Blob, geo: Geo, dpi: number, kind: ArtKind): Promise<Blob | PdfImage> {
  const a = await artPixels(art, geo, dpi);
  try {
    if (kind === 'svg') return await withDpi(await encode(a), dpi);
    if (kind === 'pdf') {
      const { width: w, height: h } = a, p = ctx2d(a).getImageData(0, 0, w, h).data;
      const rgb = new Uint8Array(w * h * 3), al = new Uint8Array(w * h);
      for (let i = 0; i < w * h; i++) {
        const t = p[4 * i + 3];
        al[i] = t;
        // 투명한 곳은 흰색(압축이 잘 되고 가장자리에 검은 테가 안 섞임)
        rgb[3 * i] = t ? p[4 * i] : 255; rgb[3 * i + 1] = t ? p[4 * i + 1] : 255; rgb[3 * i + 2] = t ? p[4 * i + 2] : 255;
      }
      return { w, h, rgb: await deflate(rgb), alpha: await deflate(al) };
    }
    const s = dpi / 25.4, W = pxOf(geo.w, dpi), H = pxOf(geo.h, dpi);
    const c = canvas(W, H), x = ctx2d(c);
    try {
      trace(x, geo.loops, s);
      x.fillStyle = '#fff';
      x.fill('evenodd');
      x.save();
      trace(x, geo.loops, s);
      x.clip('evenodd');
      x.drawImage(a, geo.art[0] * s, geo.art[1] * s, geo.art[2] * s, geo.art[3] * s);
      x.restore();
      return await withDpi(await encode(c), dpi);
    } finally {
      free(c);
    }
  } finally {
    free(a);
  }
}

export type SheetArt = { art: Blob; geo: Geo; at: [number, number][] };

// 시트 한 장 PNG(dpi): 흰 종이 위에 스티커(칼선 안 흰색 + 그림) — 칼선은 안 그림
export async function sheetPng(paper: [number, number], items: SheetArt[], dpi: number): Promise<Blob> {
  const s = dpi / 25.4, c = canvas(pxOf(paper[0], dpi), pxOf(paper[1], dpi)), x = ctx2d(c);
  try {
    x.fillStyle = '#fff';
    x.fillRect(0, 0, c.width, c.height);
    for (const it of items) {
      const a = await artPixels(it.art, it.geo, dpi);
      for (const [px, py] of it.at) {
        x.save();
        trace(x, it.geo.loops, s, px, py);
        x.clip('evenodd');
        x.drawImage(a, (px + it.geo.art[0]) * s, (py + it.geo.art[1]) * s, it.geo.art[2] * s, it.geo.art[3] * s);
        x.restore();
      }
      free(a);
    }
    return await withDpi(await encode(c), dpi);
  } finally {
    free(c);
  }
}
