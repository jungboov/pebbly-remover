/* pebbly 번호 인트로 — 원본은 _brand/intro/pebbly-intro.js. 제품 폴더의 사본은 고치지 말고, 원본을 고친 뒤 sync.py로 복사
   [ NN ] 상자(= 앱 아이콘, 첫 장면) → 화면 가운데에서 스파인으로 바뀜 → 숫자 릴이 한 바퀴(100칸, 00 포함) 돌아 NN에 멈춤
   → 스파인이 왼쪽으로 비켜나며 점선·이름·꺾쇠가 나타남 → 사라짐 (2026-11-03 사용자가 고른 순서. late: false면 예전처럼 이름이 먼저)
   모든 움직임을 시각 t(ms) 하나로 계산(render) — 화면에서는 play()가 requestAnimationFrame으로, 미리보기 GIF는 render(t)로 장면을 뽑음

   pebblyIntro(root, { no: 3, name: 'pebbly mirror', onDone }).play()
     no       번호 0~99                        name     로고 이름
     size     (w, h) => 로고 폭(px)            기본: 화면 폭 84% · 세로 1.1배 · 1000px 중 작은 것
     splash   첫 장면 배율. 'auto'(기본) = 안드로이드 12+에 설치한 앱이면 1.73(시스템 시작 화면이 아이콘을 띄우는 크기, 폴드8 녹화로 잼)
     skip     누르거나 키를 누르면 바로 사라짐(기본 true). 누름은 root 밖으로 안 넘김(제품의 밀기·두 번 탭과 안 섞이게)
     T        시간 표(ms) 일부만 바꿀 때        onStart  펼쳐지기 시작할 때      onDone   다 사라진 뒤(기본: root를 지움)
     late     숫자가 멈춘 뒤 이름(기본 true). false = 예전 순서(펼쳐질 때 이름까지 다 나오고 스파인 칸에서 숫자가 돎)
     keep     끝까지 보면 사라지지 않고 멈춘 로고를 남긴 채 onDone({ skipped: false }) — 다음 화면이 같은 자리 로고를 이어받을 때(기본 false)
              누르거나 키로 넘기면 keep이어도 사라진 뒤 onDone({ skipped: true })
   색은 root의 color(선·글자)와 background — 기본은 검은 바탕 흰 선, 제품 CSS가 덮어써도 됨(기본 스타일은 :where라 이김)
   움직임 줄이기를 켠 기기는 다 펼친 모습만 1.5초. 글꼴은 최대 1.5초 기다렸다 시작(다른 글꼴로 번쩍이지 않게) */
function pebblyIntro(root, opts = {}) {
  const { no = 0, name = 'pebbly labs', size = (w, h) => Math.min(w * .84, h * 1.1, 1000), splash = 'auto', skip = true,
    late = true, keep = false, onStart, onDone = () => root.remove() } = opts;
  // late: 스파인이 화면 가운데에서 숫자를 돌리고, 멈춘 뒤 왼쪽으로 비켜나며 점선·이름·꺾쇠가 나타남(reveal). 마지막 장면 자리는 두 순서가 같음
  const T = Object.assign({ hold: 400, morph: 800, gap: 120, spin: 1700, reveal: late ? 700 : 0, rest: 700, out: 600 }, opts.T);
  const SPIN = T.hold + T.morph + T.gap, SHOWN = SPIN + T.spin + T.reveal;   // 숫자가 돌기 시작 · 다 나타남
  T.total = SHOWN + T.rest + T.out;
  const NN = String(no).padStart(2, '0'), ROW = 25, id = 'pi' + (pebblyIntro.n = (pebblyIntro.n || 0) + 1);
  if (!document.getElementById('pebbly-intro-css')) {
    const st = document.createElement('style'); st.id = 'pebbly-intro-css';
    st.textContent = `:where(.pebbly-intro){position:fixed;inset:0;z-index:1000;background:#000;color:#fff;font-family:MuseoModerno,sans-serif;cursor:pointer;-webkit-tap-highlight-color:transparent}
.pebbly-intro>svg{display:block;width:100%;height:100%}.pebbly-intro path{fill:none;stroke:currentColor}.pebbly-intro text{fill:currentColor;text-anchor:middle}
.pebbly-intro .pi-mid{font-weight:600;font-size:12.5px}.pebbly-intro .pi-dim{font-weight:500;font-size:11px;opacity:.45}
.pebbly-intro .pi-name{font-weight:400;font-size:27px;dominant-baseline:central;text-anchor:start}`;
    document.head.appendChild(st);
  }
  // 릴: NN-1, NN, NN+1 … (100칸 뒤 다시 NN) — 00이면 99 00 01 … 99 00 01
  const nums = []; for (let i = 0; i <= 102; i++) nums.push(String((no - 1 + i + 100) % 100).padStart(2, '0'));
  const reel = cls => `<g class="pi-reel ${cls}">${nums.map((v, i) => `<text x="48" y="${64 + i * ROW}">${v}</text>`).join('')}</g>`;
  // 로고 단위(높이 120, 폭은 이름 따라 — pebbly labs ≈ 360): 스파인 위아래 막대·[ NN ] 칸·점선·이름·꺾쇠. 화면 가운데가 0,0
  root.classList.add('pebbly-intro'); root.style.pointerEvents = '';
  root.innerHTML = `<svg><defs>
    <clipPath id="${id}-cd"><rect x="20" y="22" width="56" height="30"/><rect x="20" y="69" width="56" height="29"/></clipPath>
    <clipPath id="${id}-cm"><rect x="20" y="52" width="56" height="17"/></clipPath>
    <linearGradient id="${id}-g" x1="0" y1="20" x2="0" y2="100" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#000"/><stop offset=".2" stop-color="#fff"/><stop offset=".8" stop-color="#fff"/><stop offset="1" stop-color="#000"/></linearGradient>
    <mask id="${id}-m"><rect x="20" y="20" width="56" height="80" fill="url(#${id}-g)"/></mask></defs>
    <svg x="50%" y="50%" overflow="visible"><g class="pi-lock">
      <path class="pi-bars" d="M20 18H76M20 102H76" stroke-width="2.8"/>
      <path class="pi-late" d="M92 18V102" stroke-width="1.25" stroke-dasharray="4 4"/><path class="pi-late pi-corner" stroke-width="2"/>
      <g class="pi-slot"><text x="48" y="64" class="pi-mid" xml:space="preserve">[ <tspan fill-opacity="0">${NN}</tspan> ]</text>
        <g clip-path="url(#${id}-cd)" mask="url(#${id}-m)">${reel('pi-dim')}</g><g clip-path="url(#${id}-cm)">${reel('pi-mid')}</g></g>
      <g class="pi-word"><text x="110" y="60" class="pi-name">${name}</text></g>
    </g><path class="pi-box" stroke-width="7.5"/><text class="pi-t0 pi-mid" xml:space="preserve">[ ${NN} ]</text></svg></svg>`;
  const q = s => root.querySelector(s), lock = q('.pi-lock'), box = q('.pi-box'), t0 = q('.pi-t0'), reels = root.querySelectorAll('.pi-reel');
  const bars = q('.pi-bars'), rest = root.querySelectorAll('.pi-late'), word = q('.pi-word'), slot = q('.pi-slot');
  // 이름 폭에 맞춰 꺾쇠 자리 (글꼴이 온 뒤 다시 잼)
  let LW = 360;
  const measure = () => { const W = 110 + q('.pi-name').getComputedTextLength() + 14; LW = W + 34; q('.pi-corner').setAttribute('d', `M${W} 18H${W + 14}V32M${W} 102H${W + 14}V88`); };
  // 상자: 초타원 |x/a|^n + |y/b|^n = 1 — 앱 아이콘 모양(n 2.7)에서 거의 네모(n 16)인 스파인 테두리로
  const sq = (a, b, n, cx) => { let d = ''; for (let i = 0; i < 64; i++) { const t = i / 32 * Math.PI, c = Math.cos(t), s = Math.sin(t);
    d += (i ? 'L' : 'M') + (cx + a * Math.sign(c) * Math.abs(c) ** (2 / n)).toFixed(1) + ' ' + (b * Math.sign(s) * Math.abs(s) ** (2 / n)).toFixed(1); } return d + 'Z'; };
  const io = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  // 릴 감속: cubic-bezier(.12,.62,.22,1)
  const bez = (x1, y1, x2, y2) => x => { let t = x; for (let i = 0; i < 8; i++) { const f = 3 * x1 * t * (1 - t) ** 2 + 3 * x2 * t * t * (1 - t) + t ** 3 - x, d = 3 * x1 * (1 - t) ** 2 + 6 * (x2 - x1) * t * (1 - t) + 3 * (1 - x2) * t * t; if (Math.abs(d) < 1e-6) break; t -= f / d; } t = Math.min(1, Math.max(0, t)); return 3 * y1 * t * (1 - t) ** 2 + 3 * y2 * t * t * (1 - t) + t ** 3; };
  const roll = bez(.12, .62, .22, 1), part = (p, a, b) => Math.max(0, Math.min(1, (p - a) / (b - a)));
  // 첫 장면 배율: 안드로이드 12+ 설치 앱은 시스템 시작 화면이 아이콘을 크게 띄우므로 그 크기에서 시작해야 넘어갈 때 상자가 갑자기 줄지 않음
  let s = typeof splash === 'number' ? splash : 1, started = 0;
  if (splash === 'auto' && /Android/.test(navigator.userAgent) && matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches) {
    s = 1.73;
    if (navigator.userAgentData) navigator.userAgentData.getHighEntropyValues(['platformVersion'])
      .then(v => { if (!started && parseInt(v.platformVersion) < 12) { s = 1; render(0); } }).catch(() => {});
  }
  function render(t) {
    const k = size(root.clientWidth, root.clientHeight) / LW;
    // late: 스파인 가운데(48)가 화면 가운데 → 숫자가 멈추면 로고 전체가 가운데로 오도록 왼쪽으로 비켜남
    const r = late ? io(part(t, SPIN + T.spin, SHOWN)) : 1, lx = -48 * k + (48 - LW / 2) * k * r;
    lock.setAttribute('transform', `translate(${lx} ${-60 * k}) scale(${k})`);
    const p = part(t, T.hold, T.hold + T.morph), e = io(p);
    const A = { a: 59.5 * s, b: 59.5 * s, n: 2.7, sw: 7.5 * s, tx: .15 * s, ty: 13.4 * s, fs: 38 * s, x: 0 }, B = { a: 28 * k, b: 42 * k, n: 16, sw: 2.8 * k, tx: 0, ty: 4 * k, fs: 12.5 * k, x: lx + 48 * k };
    const v = key => A[key] + (B[key] - A[key]) * e;
    box.setAttribute('d', sq(v('a'), v('b'), v('n'), v('x'))); box.setAttribute('stroke-width', v('sw')); box.style.opacity = 1 - part(p, .6, 1);   // 끝 무렵 옆선이 사라지고
    bars.style.opacity = part(p, .55, 1);                                       // 위아래 막대만 남음
    const show = late ? part(t, SPIN + T.spin + T.reveal * .25, SHOWN) : 0;
    rest.forEach(n => { n.style.opacity = late ? show : part(p, .45, 1); });    // 점선·꺾쇠
    word.style.opacity = late ? show : part(p, .62, 1);                         // 이름은 상자가 비켜난 뒤에(late: 숫자가 멈춘 뒤에)
    t0.style.display = p >= 1 ? 'none' : ''; slot.style.opacity = p >= 1 ? 1 : 0;   // 다 오면 굴러가는 [ NN ]으로 바꿔 끼움(같은 자리·크기)
    t0.setAttribute('x', v('x') + v('tx')); t0.setAttribute('y', v('ty')); t0.style.fontSize = v('fs') + 'px';
    const i = 1 + 100 * roll(part(t, SPIN, SPIN + T.spin));
    reels.forEach(g => g.setAttribute('transform', `translate(0 ${(-i * ROW).toFixed(2)})`));
    root.style.opacity = 1 - part(t, T.total - T.out, T.total);
  }
  measure(); render(0);

  // 재생: 끝까지 가거나 누르면(skipAt) 사라짐 → onDone. keep이면 끝까지 갔을 때 사라지기 전 장면(멈춘 로고)에서 멈춤
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches, LANDED = late ? SHOWN : T.hold + T.morph, END = keep ? T.total - T.out : T.total;
  let raf = 0, skipAt = 0, ended = false, begun = false;
  const press = e => { e.stopPropagation(); done(); }, stop = e => e.stopPropagation();
  function frame(now) {
    const el = now - started, t = still ? (el < 1500 ? LANDED : T.total - T.out + el - 1500) : el;
    render(Math.min(t, END));
    if (!begun && t >= T.hold) { begun = true; if (onStart) onStart(); }
    const fade = skipAt ? part(now - skipAt, 0, T.out) : 0;
    if (fade) root.style.opacity = Math.min(+root.style.opacity, 1 - fade);
    if (fade || (!keep && t > T.total - T.out)) root.style.pointerEvents = 'none';
    if (fade >= 1) return finish(true);
    if (t >= END && !skipAt) return finish(false);
    raf = requestAnimationFrame(frame);
  }
  function start() { if (raf || ended) return; started = performance.now(); raf = requestAnimationFrame(frame); }
  function finish(skipped) {
    ended = true; cancelAnimationFrame(raf);
    root.removeEventListener('pointerdown', press); root.removeEventListener('pointerup', stop); removeEventListener('keydown', done);
    onDone({ skipped });
  }
  function done() { if (ended || skipAt) return; skipAt = performance.now(); start(); }
  function play() {
    if (skip) { root.addEventListener('pointerdown', press); root.addEventListener('pointerup', stop); addEventListener('keydown', done); }
    const fonts = document.fonts ? Promise.all([document.fonts.load("600 12px MuseoModerno", '[ 0123456789 ]'), document.fonts.load("500 12px MuseoModerno", '0123456789'),
      document.fonts.load("400 27px MuseoModerno", name)]).catch(() => {}) : Promise.resolve();
    Promise.race([fonts, new Promise(r => setTimeout(r, 1500))]).then(() => { if (!ended && !raf) { measure(); start(); } });
    return api;
  }
  const api = { render, play, done, measure, T };
  return api;
}
