// 그리기 전에 도는 머리 스크립트(layout.tsx)와 저장 키 — 서버·브라우저 양쪽에서 쓰므로 "use client" 없이
export const LANG_KEY = 'pebbly-lang';          // pebblylabs.com 메인과 같은 키
export const INTRO_KEY = 'pebbly-remover-intro';

// 한/영: 저장한 말 → 없으면 브라우저 말(한국어면 ko, 아니면 en). 글자는 두 말을 다 그려 두고 CSS가 <html lang>에 맞춰 하나만 보임
// 인트로: 이번 탭에서 이미 봤으면 data-intro="off"로 숨김(?intro를 붙이면 다시)
// 설치 앱(안드로이드): data-splash — 정적 첫 장면을 부품과 같이 시스템 시작 화면 크기(1.73배)로 (안드로이드 11 이하는 부품이 곧 1배로 되돌림)
// 함수로 써 두고 글자로 바꿔 넣음 — 템플릿 문자열로 쓰면 빌드 압축기가 가운데를 잘라 먹음(SyntaxError)
function boot(langKey: string, introKey: string) {
  const h = document.documentElement, ko = /^ko/i.test(navigator.language);
  try {
    const l = localStorage.getItem(langKey);
    h.lang = l === 'ko' || l === 'en' ? l : ko ? 'ko' : 'en';
  } catch {
    h.lang = ko ? 'ko' : 'en';
  }
  try {
    if (sessionStorage.getItem(introKey) && !/[?&]intro/.test(location.search)) h.dataset.intro = 'off';
  } catch {}
  if (/Android/.test(navigator.userAgent) && matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches) h.dataset.splash = '1';
}
export const bootScript = '(' + boot.toString() + ')(' + JSON.stringify(LANG_KEY) + ',' + JSON.stringify(INTRO_KEY) + ')';
