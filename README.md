# 01 · pebbly remover

브라우저 안에서 AI로 이미지 배경을 지우는 웹앱 — 업로드·서버 없이 이 기기에서만.
pebbly labs 넘버링 01(홀수 = 온라인). 예전 이름은 pixel remover(toolkit.pebblylabs.com/pixel-remover).

- 주소: remover.pebblylabs.com (pebblylabs.com/01 → 여기)
- 기능: 여러 장(한 번에 10장, 2장씩 동시에) 배경 지우기 · 원본/결과 비교 막대 · 썸네일 골라 ZIP·낱장 받기 · 지금 결과 받기 · 한/영
- 지우기: [@imgly/background-removal](https://github.com/imgly/background-removal-js) (isnet 모델, CPU 1스레드 — 모델은 처음에 그쪽 CDN에서 받아 브라우저가 보관)

## 화면 (pebbly labs 브랜드)
- 온라인 제품은 평면: 검은 바탕에 흰 선 (색은 미러와 같은 값, `app/globals.css`)
- 로고: 세로 스파인 `00 [ 01 ] 02` | 점선 | `pebbly remover` | 꺾쇠 — MuseoModerno(이름 400·스파인 500·[ 01 ] 600), 한글 Pretendard
- 처음 열 때 [ 01 ] 번호 인트로(`_brand/intro/pebbly-intro.html` 부품을 옮김, 탭마다 한 번 · `?intro`로 다시)
- 앱 아이콘: 갤럭시 아이콘 모양(초타원 n=2.7) 상자 안 `[ 01 ]` — `npm run icons`로 다시 그림(헤드리스 크롬 + Pillow)

## 개발
```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # out/ 에 정적 파일
```

## 배포 (Cloudflare Pages)
- 빌드 명령 `npm run build`, 출력 폴더 `out`, 환경 변수 `NODE_VERSION=22`
- 사용자 지정 도메인 `remover.pebblylabs.com`

## 폴더
- `app/page.tsx` 화면 틀 · `app/_hooks/useBatchProcessor.ts` 지우기·받기 · `app/_components/` 부품
- `app/_lib/intro.ts` 번호 인트로 · `app/_lib/boot.ts` 그리기 전 스크립트(한/영·인트로) · `app/_lib/lang.ts` 한/영
- `scripts/icons.mjs` 아이콘·공유 이미지
