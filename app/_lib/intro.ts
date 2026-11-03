// [ 01 ] 인트로 첫 장면 — 움직임은 공용 부품(public/pebbly-intro.js, _brand/intro 원본의 사본)이 그림
// 부품이 도는 건 하이드레이션 뒤라, 그 전에도 첫 장면이 보이게 정적 HTML로 그려 둠. 부품의 render(0)과 같은 자리·크기
// (안드로이드 설치 앱은 시스템 시작 화면이 아이콘을 1.73배로 띄움 → boot.ts가 data-splash를 달면 CSS가 같은 배율로 키움)

// 초타원 |x/a|^n + |y/b|^n = 1 (갤럭시 아이콘 모양 n=2.7), cx는 가운데 x
export const superellipse = (a: number, b: number, n: number, cx = 0) => {
  let d = '';
  for (let i = 0; i < 64; i++) {
    const t = i / 32 * Math.PI, c = Math.cos(t), s = Math.sin(t);
    d += (i ? 'L' : 'M') + (cx + a * Math.sign(c) * Math.abs(c) ** (2 / n)).toFixed(1) + ' ' + (b * Math.sign(s) * Math.abs(s) ** (2 / n)).toFixed(1);
  }
  return d + 'Z';
};

export const firstScene = (no: number) => {
  const NN = String(no).padStart(2, '0');
  return `<svg><svg x="50%" y="50%" overflow="visible"><g class="pi-first"><path d="${superellipse(59.5, 59.5, 2.7)}" stroke-width="7.5"/>`
    + `<text x=".15" y="13.4" font-size="38" font-weight="600" xml:space="preserve">[ ${NN} ]</text></g></svg></svg>`;
};
