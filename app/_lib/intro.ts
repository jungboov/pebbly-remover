// pebbly 번호 인트로 — _brand/intro/pebbly-intro.html 부품을 그대로 옮김
// [ NN ] 상자 → 스파인으로 펼쳐짐 → 숫자 릴이 한 바퀴(100칸, 00 포함) 돌아 NN에 멈춤 → 사라짐
// 모든 움직임을 시각 t(ms) 하나로 계산(render) — 화면에서는 requestAnimationFrame으로 부름

// 초타원 |x/a|^n + |y/b|^n = 1 (갤럭시 아이콘 모양 n=2.7 → 거의 네모 n=16), cx는 가운데 x
export const superellipse = (a: number, b: number, n: number, cx = 0) => {
  let d = '';
  for (let i = 0; i < 64; i++) {
    const t = i / 32 * Math.PI, c = Math.cos(t), s = Math.sin(t);
    d += (i ? 'L' : 'M') + (cx + a * Math.sign(c) * Math.abs(c) ** (2 / n)).toFixed(1) + ' ' + (b * Math.sign(s) * Math.abs(s) ** (2 / n)).toFixed(1);
  }
  return d + 'Z';
};

// 첫 장면: 앱 아이콘과 같은 [ NN ] 상자 (아이콘 = 이 장면 3.2배). 스크립트 전에도 보이게 정적 HTML로도 씀
export const firstScene = (no: number) => {
  const NN = String(no).padStart(2, '0');
  return `<svg><svg x="50%" y="50%" overflow="visible"><path class="box" d="${superellipse(59.5, 59.5, 2.7)}" stroke-width="7.5"/>`
    + `<text class="t0 mid" x=".15" y="13.4" style="font-size:38px" xml:space="preserve">[ ${NN} ]</text></svg></svg>`;
};

export function pebblyIntro(root: HTMLElement, { no = 0, name = 'pebbly labs' } = {}) {
  const NN = String(no).padStart(2, '0'), ROW = 25;
  // 릴: NN-1, NN, NN+1 … (100칸 뒤 다시 NN) — 00이면 99 00 01 … 99 00 01
  const nums: string[] = [];
  for (let i = 0; i <= 102; i++) nums.push(String((no - 1 + i + 100) % 100).padStart(2, '0'));
  const reel = (cls: string) => `<g class="reel ${cls}">${nums.map((v, i) => `<text x="48" y="${64 + i * ROW}">${v}</text>`).join('')}</g>`;
  root.innerHTML = `<svg><defs>
    <clipPath id="pi-cd"><rect x="20" y="22" width="56" height="30"/><rect x="20" y="69" width="56" height="29"/></clipPath>
    <clipPath id="pi-cm"><rect x="20" y="52" width="56" height="17"/></clipPath>
    <linearGradient id="pi-g" x1="0" y1="20" x2="0" y2="100" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#000"/><stop offset=".2" stop-color="#fff"/><stop offset=".8" stop-color="#fff"/><stop offset="1" stop-color="#000"/></linearGradient>
    <mask id="pi-m"><rect x="20" y="20" width="56" height="80" fill="url(#pi-g)"/></mask></defs>
    <svg x="50%" y="50%" overflow="visible"><g id="pi-lock">
      <path class="bars" d="M20 18H76M20 102H76" stroke-width="2.8"/>
      <path class="late" d="M92 18V102" stroke-width="1.25" stroke-dasharray="4 4"/><path class="late corner" stroke-width="2"/>
      <g class="slot"><text x="48" y="64" class="mid" xml:space="preserve">[ <tspan fill-opacity="0">${NN}</tspan> ]</text>
        <g clip-path="url(#pi-cd)" mask="url(#pi-m)">${reel('dim')}</g><g clip-path="url(#pi-cm)">${reel('mid')}</g></g>
      <g class="word"><text x="110" y="60" class="name" style="text-anchor:start">${name}</text></g>
    </g><path class="box" stroke-width="7.5"/><text class="t0 mid" xml:space="preserve">[ ${NN} ]</text></svg></svg>`;
  const q = <T extends Element = SVGElement>(s: string) => root.querySelector(s) as unknown as T;
  const lock = q('#pi-lock'), box = q('.box'), t0 = q<SVGTextElement>('.t0'), reels = root.querySelectorAll('.reel');
  // 이름 폭에 맞춰 꺾쇠 자리
  const nw = q<SVGTextElement>('.name').getComputedTextLength(), W = 110 + nw + 14, LW = W + 34;
  q('.corner').setAttribute('d', `M${W} 18H${W + 14}V32M${W} 102H${W + 14}V88`);
  const io = (t: number) => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  // 릴 감속: CSS cubic-bezier(.12,.62,.22,1) (미러 인트로와 같은 곡선)
  const bez = (x1: number, y1: number, x2: number, y2: number) => (x: number) => {
    let t = x;
    for (let i = 0; i < 8; i++) {
      const cx = 3 * x1 * t * (1 - t) ** 2 + 3 * x2 * t * t * (1 - t) + t ** 3 - x, d = 3 * x1 * (1 - t) ** 2 + 6 * (x2 - x1) * t * (1 - t) + 3 * (1 - x2) * t * t;
      if (Math.abs(d) < 1e-6) break;
      t -= cx / d;
    }
    t = Math.min(1, Math.max(0, t));
    return 3 * y1 * t * (1 - t) ** 2 + 3 * y2 * t * t * (1 - t) + t ** 3;
  };
  const roll = bez(.12, .62, .22, 1), part = (p: number, a: number, b: number) => Math.max(0, Math.min(1, (p - a) / (b - a)));
  const T = { hold: 400, morph: 800, gap: 120, spin: 1700, rest: 700, out: 600, total: 0 };
  T.total = T.hold + T.morph + T.gap + T.spin + T.rest + T.out;
  type Shape = { a: number; b: number; n: number; sw: number; tx: number; ty: number; fs: number; x: number };
  function render(t: number) {
    const w = root.clientWidth, h = root.clientHeight, k = Math.min(w * .84, h * 1.1, 1000) / LW;
    lock.setAttribute('transform', `translate(${-LW * k / 2} ${-60 * k}) scale(${k})`);
    const p = part(t, T.hold, T.hold + T.morph), e = io(p);   // 스파인 가운데(48) 화면 자리
    const A: Shape = { a: 59.5, b: 59.5, n: 2.7, sw: 7.5, tx: .15, ty: 13.4, fs: 38, x: 0 };
    const B: Shape = { a: 28 * k, b: 42 * k, n: 16, sw: 2.8 * k, tx: 0, ty: 4 * k, fs: 12.5 * k, x: (48 - LW / 2) * k };
    const v = (key: keyof Shape) => A[key] + (B[key] - A[key]) * e;
    box.setAttribute('d', superellipse(v('a'), v('b'), v('n'), v('x'))); box.setAttribute('stroke-width', String(v('sw'))); box.style.opacity = String(1 - part(p, .6, 1));
    q('.bars').style.opacity = String(part(p, .55, 1));
    root.querySelectorAll<SVGElement>('.late').forEach(n => { n.style.opacity = String(part(p, .45, 1)); });
    q('.word').style.opacity = String(part(p, .62, 1));
    const landed = p >= 1;
    t0.style.display = landed ? 'none' : ''; q('.slot').style.opacity = landed ? '1' : '0';
    t0.setAttribute('x', String(v('x') + v('tx'))); t0.setAttribute('y', String(v('ty'))); t0.style.fontSize = v('fs') + 'px';
    const r = part(t, T.hold + T.morph + T.gap, T.hold + T.morph + T.gap + T.spin), i = 1 + 100 * roll(r);
    reels.forEach(g => g.setAttribute('transform', `translate(0 ${(-i * ROW).toFixed(2)})`));
    root.style.opacity = String(1 - part(t, T.total - T.out, T.total));
  }
  return { render, T };
}
