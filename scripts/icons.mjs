// 앱 아이콘 [ 01 ]·공유 이미지를 그려 public/에 넣음 — npm run icons
// 아이콘 = 인트로 첫 장면(갤럭시 아이콘 모양 초타원 n=2.7 상자 안 [ 01 ], MuseoModerno 600 38)을 키운 것
//   icon-maskable.png(512)·apple-touch-icon.png(180): 검은 바탕을 꽉 채우고 장면을 3.2배(512 기준) — 홈 화면이 모서리를 깎음
//   icon-512.png·icon-192.png·favicon.ico: 상자 모양 그대로(바깥은 투명, 상자 안은 검게)
//   og-image.png(1200×630): 다 펼쳐진 로고 00 [ 01 ] 02 | pebbly remover ┐┘ + 한 줄 소개
// 글꼴을 브라우저가 그대로 그리도록 헤드리스 크롬으로 찍음 (CHROME=경로로 바꿀 수 있음), favicon.ico는 파이썬 Pillow로 묶음
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PUB = join(ROOT, 'public');
const NO = '01', NAME = 'pebbly remover';
const CHROME = process.env.CHROME || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
].find(existsSync);
if (!CHROME) throw new Error('크롬을 못 찾음 — CHROME=경로 로 알려 주세요');

// app/_lib/intro.ts의 superellipse와 같은 식
const superellipse = (a, b, n, cx = 0) => {
  let d = '';
  for (let i = 0; i < 64; i++) {
    const t = i / 32 * Math.PI, c = Math.cos(t), s = Math.sin(t);
    d += (i ? 'L' : 'M') + (cx + a * Math.sign(c) * Math.abs(c) ** (2 / n)).toFixed(1) + ' ' + (b * Math.sign(s) * Math.abs(s) ** (2 / n)).toFixed(1);
  }
  return d + 'Z';
};

const FONTS = `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=MuseoModerno:wght@400;500;600&display=block">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">`;
const page = (body, script = '') => `<!doctype html><html><head><meta charset="utf-8">${FONTS}
<style>html,body{margin:0;background:transparent}svg{display:block}text{font-family:MuseoModerno;fill:#fff;text-anchor:middle}</style></head>
<body>${body}<script>${script}</script></body></html>`;

// 첫 장면 (인트로 단위: 상자 가운데가 0,0)
const scene = (fill) => `<path d="${superellipse(59.5, 59.5, 2.7)}" fill="${fill}" stroke="#fff" stroke-width="7.5"/>`
  + `<text x=".15" y="13.4" font-size="38" font-weight="600" xml:space="preserve">[ ${NO} ]</text>`;
// 꽉 찬 것: 512px에 3.2배 → 160 단위 / 상자 모양: 바깥 테두리(59.5 + 3.75)에 1 여유
const full = (px) => page(`<svg width="${px}" height="${px}" viewBox="-80 -80 160 160"><rect x="-80" y="-80" width="160" height="160"/>${scene('none')}</svg>`);
const shape = (px) => page(`<svg width="${px}" height="${px}" viewBox="-64.5 -64.5 129 129">${scene('#000')}</svg>`);

// 공유 이미지: 인트로가 멈춘 장면(로고 360×120 단위) — 이름 폭을 재서 꺾쇠 자리·가운데 맞춤
const og = page(`<svg width="1200" height="630" viewBox="0 0 1200 630" style="background:#000">
  <g id="lock">
    <path d="M20 18H76M20 102H76" stroke="#fff" stroke-width="2.8" fill="none"/>
    <path d="M92 18V102" stroke="#fff" stroke-width="1.25" stroke-dasharray="4 4" fill="none"/>
    <path id="corner" stroke="#fff" stroke-width="2" fill="none"/>
    <text x="48" y="39" font-size="11" font-weight="500" opacity=".45">00</text>
    <text x="48" y="64" font-size="12.5" font-weight="600" xml:space="preserve">[ ${NO} ]</text>
    <text x="48" y="89" font-size="11" font-weight="500" opacity=".45">02</text>
    <text id="name" x="110" y="60" font-size="27" font-weight="400" dominant-baseline="central" style="text-anchor:start">${NAME}</text>
  </g>
  <text x="600" y="492" font-size="28" style="font-family:'Pretendard Variable',Pretendard,sans-serif;fill:#a3a3a3;letter-spacing:.01em">AI background remover · 100% in your browser</text>
  <text x="600" y="540" font-size="26" style="font-family:'Pretendard Variable',Pretendard,sans-serif;fill:#5f5f5f">브라우저에서 바로, 배경 지우기 — 업로드 없이</text>
</svg>`, `document.fonts.ready.then(() => {
  const W = 110 + document.getElementById('name').getComputedTextLength() + 14, LW = W + 34, k = 820 / LW;
  document.getElementById('corner').setAttribute('d', 'M' + W + ' 18H' + (W + 14) + 'V32M' + W + ' 102H' + (W + 14) + 'V88');
  document.getElementById('lock').setAttribute('transform', 'translate(' + (600 - LW * k / 2) + ' ' + (250 - 60 * k) + ') scale(' + k + ')');
});`);

const tmp = mkdtempSync(join(tmpdir(), 'pebbly-icons-'));
function shoot(html, file, w, h = w) {
  const src = join(tmp, file + '.html');
  writeFileSync(src, html);
  execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--default-background-color=00000000',
    `--window-size=${w},${h}`, '--virtual-time-budget=10000', `--screenshot=${join(PUB, file)}`, pathToFileURL(src).href], { stdio: 'ignore' });
  console.log('  ' + file);
}

console.log('public/');
shoot(full(512), 'icon-maskable.png', 512);
shoot(full(180), 'apple-touch-icon.png', 180);
shoot(shape(512), 'icon-512.png', 512);
shoot(shape(192), 'icon-192.png', 192);
shoot(og, 'og-image.png', 1200, 630);
shoot(shape(256), 'favicon-256.png', 256);
execFileSync('python', ['-I', '-c', `from PIL import Image
im = Image.open(r'${join(PUB, 'favicon-256.png')}').convert('RGBA')
im.save(r'${join(PUB, 'favicon.ico')}', sizes=[(16, 16), (32, 32), (48, 48)])`]);
rmSync(join(PUB, 'favicon-256.png'));   // ico로 묶고 나면 필요 없음
rmSync(tmp, { recursive: true });
console.log('  favicon.ico');
