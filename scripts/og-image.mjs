// 공유 이미지 public/og-image.png(1200×630)를 그림 — npm run og
// 인트로가 멈춘 장면: 로고 00 [ 01 ] 02 | pebbly remover ┐┘ + 한 줄 소개. 글꼴을 브라우저가 그대로 그리도록 헤드리스 크롬으로 찍음 (CHROME=경로로 바꿀 수 있음)
// 앱 아이콘(favicon·apple-touch·192·512·maskable)은 브랜드 생성기 것을 그대로 씀: node _brand/icons/make.js 01 → _brand/icons/01/
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'og-image.png');
const NO = '01', NAME = 'pebbly remover';
const CHROME = process.env.CHROME || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
].find(existsSync);
if (!CHROME) throw new Error('크롬을 못 찾음 — CHROME=경로 로 알려 주세요');

// 로고 360×120 단위 — 이름 폭을 재서 꺾쇠 자리·가운데 맞춤
const html = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=MuseoModerno:wght@400;500;600&display=block">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
<style>html,body{margin:0;background:#000}svg{display:block}text{font-family:MuseoModerno;fill:#fff;text-anchor:middle}</style></head>
<body><svg width="1200" height="630" viewBox="0 0 1200 630">
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
</svg><script>document.fonts.ready.then(() => {
  const W = 110 + document.getElementById('name').getComputedTextLength() + 14, LW = W + 34, k = 820 / LW;
  document.getElementById('corner').setAttribute('d', 'M' + W + ' 18H' + (W + 14) + 'V32M' + W + ' 102H' + (W + 14) + 'V88');
  document.getElementById('lock').setAttribute('transform', 'translate(' + (600 - LW * k / 2) + ' ' + (250 - 60 * k) + ') scale(' + k + ')');
});</script></body></html>`;

const tmp = mkdtempSync(join(tmpdir(), 'pebbly-og-'));
const src = join(tmp, 'og.html');
writeFileSync(src, html);
execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--window-size=1200,630',
  '--virtual-time-budget=10000', `--screenshot=${OUT}`, pathToFileURL(src).href], { stdio: 'ignore' });
rmSync(tmp, { recursive: true });
console.log('public/og-image.png');
