// 칼선 계산(스티커 한 장): 그림 투명값 → 작은 조각 지우기 · 구멍 메우기 → 간격만큼 넓히기(거리 변환) → 오목한 곳 둥글게(닫기 1mm)
// → 외곽선(마칭 스퀘어, 거리 값에서 소수 화소로) → 고르게(이동 평균 — 픽셀 그림 계단이 만든 잔물결을 폄) → 점 줄이기(RDP 0.05mm)
// → 곡선(Catmull-Rom → 3차 베지에, 점 사이가 고르지 않아도 넘치지 않게 거리 비례 접선)
// 단위는 mm. 그림을 G화소/mm 격자에 그려서 계산하고 결과는 스티커 상자(칼선 바깥 상자) 기준 mm로
import { components, distance2 } from './post';

// 스티커 긴 변(mm, 칼선 상자) · 칼선 간격(mm, 그림에서 칼선까지) · 구멍 메우기
export type CutOpts = { size: number; gap: number; holes: boolean };
export type Geo = {
  w: number; h: number;                       // 스티커(칼선 상자) mm
  art: [x: number, y: number, w: number, h: number];   // 그림 자리(스티커 상자 기준 mm)
  loops: number[][];                          // 닫힌 곡선마다 [x0,y0, c1x,c1y, c2x,c2y, x,y, …] mm
  len: number;                                // 칼선 길이 mm
};
export const CLOSE_MM = 1;   // 오목한 곳 반지름 — 칼이 못 돌아가는 좁은 틈·뾰족한 안쪽을 메움(인쇄소 최소 3R은 바깥 모서리)

// 격자 크기: 긴 변이 1000칸쯤(50mm면 10칸/mm = 0.1mm)
export function gridFor(o: CutOpts, aw: number, ah: number) {
  const G = Math.min(10, 1000 / (o.size + 4));
  const artMm = Math.max(3, o.size - 2 * o.gap), k = artMm / Math.max(aw, ah);
  const wMm = aw * k, hMm = ah * k;
  const pad = Math.ceil((o.gap + CLOSE_MM) * G) + 3;
  return { G, wMm, hMm, pad, gw: Math.ceil(wMm * G) + 2 * pad, gh: Math.ceil(hMm * G) + 2 * pad };
}

// rgba: 격자(gw×gh)에 그림을 (pad, pad)부터 wMm×hMm 크기로 그린 화소
export function cutGeometry(rgba: Uint8ClampedArray, g: ReturnType<typeof gridFor>, o: CutOpts): Geo {
  const { G, pad, gw: w, gh: h } = g, n = w * h;
  // 1) 반 넘게 불투명한 곳 — 가장 큰 덩어리의 2%보다 작은 조각(티끌)은 뺌
  const bin = new Uint8Array(n);
  for (let i = 0; i < n; i++) bin[i] = rgba[4 * i + 3] >= 128 ? 1 : 0;
  const { lab, area } = components(bin, w, h);
  if (area.length > 1) {
    const big = Math.max(...area);
    for (let i = 0; i < n; i++) if (lab[i] >= 0 && area[lab[i]] < big * 0.02) bin[i] = 0;
  }
  // 2) 구멍 메우기: 가장자리에서 닿지 않는 빈 곳은 채움
  if (o.holes) fillHoles(bin, w, h);
  // 3) 넓히기: 그림까지 거리 ≤ 간격 + 닫기. 화소 중심끼리 거리라 실제 가장자리는 0.5칸 안쪽 — 그만큼 바로잡음
  const r = (o.gap + CLOSE_MM) * G + 0.5;
  const d = distance2(i => bin[i] === 1, w, h);
  const D = new Uint8Array(n);
  for (let i = 0; i < n; i++) D[i] = d[i] <= r * r ? 1 : 0;
  // 4) 닫기: 넓힌 곳 밖까지 거리 − 닫기 반지름 = 칼선까지 남은 거리(안이 +)
  const e = distance2(i => D[i] === 0, w, h);
  const f = new Float32Array(n), s = CLOSE_MM * G + 0.5;
  for (let i = 0; i < n; i++) f[i] = Math.sqrt(e[i]) - s;
  if (o.holes) {
    // 넓히다가 둘러싸인 빈 곳(떨어진 글자 사이 등)도 메움
    const R = new Uint8Array(n);
    for (let i = 0; i < n; i++) R[i] = f[i] > 0 ? 1 : 0;
    const before = R.slice();
    fillHoles(R, w, h);
    for (let i = 0; i < n; i++) if (R[i] && !before[i]) f[i] = 1;
  }
  // 5) 외곽선 → mm(그림 왼쪽 위 기준) → 점 줄이기 → 곡선
  const toMm = (v: number) => (v + 0.5 - pad) / G;
  const loops: number[][] = [];
  let len = 0, x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const sigma = Math.min(0.5, o.gap * 0.25) * G;   // 고르게 펴는 폭(칸) — 간격이 좁으면 그림을 파고들지 않게 작게
  for (const raw of contours(f, w, h)) {
    const pts = smooth(raw, sigma).map(v => toMm(v));
    if (Math.abs(polyArea(pts)) < 1) continue;   // 1mm²보다 작은 고리는 버림
    const simple = rdp(pts, 0.05);
    if (simple.length < 8) continue;
    len += polyLen(pts);
    for (let i = 0; i < simple.length; i += 2) {
      x0 = Math.min(x0, simple[i]); x1 = Math.max(x1, simple[i]);
      y0 = Math.min(y0, simple[i + 1]); y1 = Math.max(y1, simple[i + 1]);
    }
    loops.push(simple);
  }
  if (!loops.length) {   // 그림이 비었음: 그림 상자를 네모로
    const sq = [0, 0, g.wMm, 0, g.wMm, g.hMm, 0, g.hMm];
    loops.push(sq); x0 = 0; y0 = 0; x1 = g.wMm; y1 = g.hMm; len = polyLen(sq);
  }
  const out = loops.map(L => bezier(L.map((v, i) => v - (i % 2 ? y0 : x0))));
  return { w: x1 - x0, h: y1 - y0, art: [-x0, -y0, g.wMm, g.hMm], loops: out, len };
}

// 가장자리에서 4방향으로 닿는 빈 곳만 남기고 나머지 빈 곳은 1로
function fillHoles(bin: Uint8Array, w: number, h: number) {
  const out = new Uint8Array(w * h), q = new Int32Array(w * h);
  let qt = 0;
  const push = (i: number) => { if (!bin[i] && !out[i]) { out[i] = 1; q[qt++] = i; } };
  for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
  for (let qh = 0; qh < qt; qh++) {
    const j = q[qh], x = j % w;
    if (x > 0) push(j - 1);
    if (x < w - 1) push(j + 1);
    if (j >= w) push(j - w);
    if (j < w * (h - 1)) push(j + w);
  }
  for (let i = 0; i < w * h; i++) if (!out[i]) bin[i] = 1;
}

// 마칭 스퀘어: f>0이 안. 칸(화소 넷)마다 경계 조각을 '안이 늘 같은 쪽'이 되게 이어 닫힌 고리로 [x,y,x,y…] (화소 번호 좌표)
// 변 번호: 가로 변 (x,y)-(x+1,y) = 2(yw+x), 세로 변 (x,y)-(x,y+1) = 2(yw+x)+1
// 칸 모양(왼위 8 · 오위 4 · 오아래 2 · 왼아래 1) → [나가는 변, 들어가는 변] 쌍. T 위 · R 오른 · B 아래 · L 왼
const TABLE: Record<number, string[]> = {
  1: ['LB'], 2: ['BR'], 3: ['LR'], 4: ['RT'], 5: ['LT', 'RB'], 6: ['BT'], 7: ['LT'],
  8: ['TL'], 9: ['TB'], 10: ['TR', 'BL'], 11: ['TR'], 12: ['RL'], 13: ['RB'], 14: ['BL'],
};
function contours(f: Float32Array, w: number, h: number): number[][] {
  const pos = new Map<number, [number, number]>(), next = new Map<number, number>();
  const point = (e: number): [number, number] => {
    const c = e >> 1, x = c % w, y = (c - x) / w;
    const a = f[c], b = e & 1 ? f[c + w] : f[c + 1], t = a / (a - b);
    return e & 1 ? [x, y + t] : [x + t, y];
  };
  for (let y = 0; y < h - 1; y++) {
    for (let x = 0; x < w - 1; x++) {
      const i = y * w + x;
      const c = (f[i] > 0 ? 8 : 0) | (f[i + 1] > 0 ? 4 : 0) | (f[i + w + 1] > 0 ? 2 : 0) | (f[i + w] > 0 ? 1 : 0);
      if (c === 0 || c === 15) continue;
      const E = { T: 2 * i, B: 2 * (i + w), L: 2 * i + 1, R: 2 * (i + 1) + 1 } as Record<string, number>;
      for (const pr of TABLE[c]) {
        const a = E[pr[0]], b = E[pr[1]];
        if (!pos.has(a)) pos.set(a, point(a));
        if (!pos.has(b)) pos.set(b, point(b));
        next.set(a, b);
      }
    }
  }
  const loops: number[][] = [], seen = new Set<number>();
  for (const start of next.keys()) {
    if (seen.has(start)) continue;
    const L: number[] = [];
    let k: number | undefined = start;
    while (k !== undefined && !seen.has(k)) {
      seen.add(k);
      const p = pos.get(k)!;
      L.push(p[0], p[1]);
      k = next.get(k);
    }
    if (L.length >= 6) loops.push(L);
  }
  return loops;
}

const polyLen = (p: number[]) => {
  let s = 0;
  for (let i = 0; i < p.length; i += 2) {
    const j = (i + 2) % p.length;
    s += Math.hypot(p[j] - p[i], p[j + 1] - p[i + 1]);
  }
  return s;
};
const polyArea = (p: number[]) => {
  let s = 0;
  for (let i = 0; i < p.length; i += 2) {
    const j = (i + 2) % p.length;
    s += p[i] * p[j + 1] - p[j] * p[i + 1];
  }
  return s / 2;
};

// 닫힌 꺾은선을 이동 평균으로 세 번(≈ 가우스, 폭 sigma칸) — 점 간격은 약 1칸
function smooth(p: number[], sigma: number): number[] {
  const n = p.length / 2, k = Math.round(sigma);
  if (k < 1 || n < 4 * k) return p;
  let a = p.slice(), b = new Array<number>(p.length);
  for (let pass = 0; pass < 3; pass++) {
    for (const c of [0, 1]) {
      let sum = 0;
      for (let j = -k; j <= k; j++) sum += a[2 * ((j + n) % n) + c];
      for (let i = 0; i < n; i++) {
        b[2 * i + c] = sum / (2 * k + 1);
        sum += a[2 * ((i + k + 1) % n) + c] - a[2 * ((i - k + n) % n) + c];
      }
    }
    [a, b] = [b, a];
  }
  return a;
}

// 닫힌 꺾은선 줄이기(Ramer–Douglas–Peucker): eps(mm)보다 덜 벗어나는 점은 뺌 — 첫 점과 가장 먼 점에서 둘로 나눠서
function rdp(p: number[], eps: number): number[] {
  const n = p.length / 2;
  let far = 0, best = -1;
  for (let i = 1; i < n; i++) {
    const d = Math.hypot(p[2 * i] - p[0], p[2 * i + 1] - p[1]);
    if (d > best) { best = d; far = i; }
  }
  const keep = new Uint8Array(n);
  keep[0] = keep[far] = 1;
  const stack: [number, number][] = [[0, far], [far, n]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    if (b - a < 2) continue;
    const ax = p[2 * a], ay = p[2 * a + 1], bx = p[2 * (b % n)], by = p[2 * (b % n) + 1];
    const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1e-9;
    let mi = -1, md = eps;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs(dx * (p[2 * i + 1] - ay) - dy * (p[2 * i] - ax)) / L;
      if (d > md) { md = d; mi = i; }
    }
    if (mi >= 0) { keep[mi] = 1; stack.push([a, mi], [mi, b]); }
  }
  const out: number[] = [];
  for (let i = 0; i < n; i++) if (keep[i]) out.push(p[2 * i], p[2 * i + 1]);
  return out;
}

// 닫힌 Catmull-Rom → 3차 베지에: [x0,y0, (c1, c2, 끝) × n]
// 접선 = (다음 − 앞) / (두 거리 합), 조절점은 그 조각 길이의 1/3 — 긴 직선 옆 짧은 곡선(사진 네모의 모서리)에서도 넘치거나 꼬이지 않음
function bezier(p: number[]): number[] {
  const n = p.length / 2, P = (i: number, c: number) => p[2 * ((i % n + n) % n) + c];
  const D = (i: number) => Math.hypot(P(i + 1, 0) - P(i, 0), P(i + 1, 1) - P(i, 1)) || 1e-9;   // i → i+1
  const T = (i: number, c: number) => (P(i + 1, c) - P(i - 1, c)) / (D(i - 1) + D(i));
  const out = [P(0, 0), P(0, 1)];
  for (let i = 0; i < n; i++) {
    const L = D(i) / 3;
    for (const c of [0, 1]) out.push(P(i, c) + T(i, c) * L);
    for (const c of [0, 1]) out.push(P(i + 1, c) - T(i + 1, c) * L);
    out.push(P(i + 1, 0), P(i + 1, 1));
  }
  return out;
}

// 곡선 → 꺾은선(DXF·화면 히트용): 조각마다 조절점 길이 0.5mm당 한 칸
export function flatten(loop: number[]): number[] {
  const out = [loop[0], loop[1]];
  for (let i = 2; i + 5 < loop.length; i += 6) {
    const x0 = loop[i - 2], y0 = loop[i - 1], [c1x, c1y, c2x, c2y, x, y] = loop.slice(i, i + 6);
    const L = Math.hypot(c1x - x0, c1y - y0) + Math.hypot(c2x - c1x, c2y - c1y) + Math.hypot(x - c2x, y - c2y);
    const m = Math.max(1, Math.min(24, Math.ceil(L / 0.5)));
    for (let s = 1; s <= m; s++) {
      const t = s / m, u = 1 - t;
      out.push(u * u * u * x0 + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t * t * t * x, u * u * u * y0 + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t * t * t * y);
    }
  }
  out.length -= 2;   // 끝점 = 첫 점
  return out;
}

// SVG path(mm, ox·oy만큼 옮김)
export function svgPath(loops: number[][], ox = 0, oy = 0, fx = (v: number) => +v.toFixed(3)): string {
  let s = '';
  for (const L of loops) {
    s += `M${fx(L[0] + ox)} ${fx(L[1] + oy)}`;
    for (let i = 2; i + 5 < L.length; i += 6) s += `C${fx(L[i] + ox)} ${fx(L[i + 1] + oy)} ${fx(L[i + 2] + ox)} ${fx(L[i + 3] + oy)} ${fx(L[i + 4] + ox)} ${fx(L[i + 5] + oy)}`;
    s += 'Z';
  }
  return s;
}

// 둥근 네모(시트 바깥 완칼): 곡선 고리 하나
export function roundRect(x: number, y: number, w: number, h: number, r: number): number[] {
  const k = 0.5523 * r, X = x + w, Y = y + h;
  return [x + r, y,
    X - r, y, X - r, y, X - r, y, X - r + k, y, X, y + r - k, X, y + r,
    X, Y - r, X, Y - r, X, Y - r, X, Y - r + k, X - r + k, Y, X - r, Y,
    x + r, Y, x + r, Y, x + r, Y, x + r - k, Y, x, Y - r + k, x, Y - r,
    x, y + r, x, y + r, x, y + r, x, y + r - k, x + r - k, y, x + r, y];
}
