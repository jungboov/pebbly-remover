# 01 · pebbly remover

브라우저 안에서 AI로 이미지 배경을 지우는 웹앱 — 업로드·서버 없이 이 기기에서만.
pebbly labs 넘버링 01(홀수 = 온라인). 예전 이름은 pixel remover(toolkit.pebblylabs.com/pixel-remover).

- 주소: remover.pebblylabs.com (pebblylabs.com/01 → 여기)
- 기능: 여러 장(한 번에 10장까지 줄 세워 한 장씩) 배경 지우기 · 원본/결과 비교 막대 · 썸네일 골라 ZIP·낱장 받기 · 지금 결과 받기 · 한/영 · PNG·JPEG·WebP 말고도 브라우저가 여는 그림(GIF·AVIF·BMP)
- 지우기: [@imgly/background-removal](https://github.com/imgly/background-removal-js) — isnet_fp16 모델(88MB, fp32 176MB와 결과 같음. quint8 44MB는 배경과 색이 비슷한 사진에서 깨져서 안 씀) + wasm 12MB를 처음에 그쪽 CDN에서 받아 브라우저가 보관
  - 여러 코어: `public/_headers`의 교차 출처 격리(COOP·COEP) 머리글이 있어야 스레드가 켜짐(없으면 1스레드, 이 PC에서 2장 18초 → 3.7초). 밖에서 불러오는 것을 더하면 그쪽이 `Cross-Origin-Resource-Policy: cross-origin`(또는 CORS)을 보내는지 확인
  - 지우는 동안(사진 한 장에 2초쯤) 화면이 멈춤 — 라이브러리가 CPU에선 화면 스레드에서만 돌아서. 아예 안 멈추게 하려면 웹 워커로 옮겨야 함

## 화면 (pebbly labs 브랜드)
- 온라인 제품은 평면: 검은 바탕에 흰 선 (색은 미러와 같은 값, `app/globals.css`)
- 로고: 세로 스파인 `00 [ 01 ] 02` | 점선 | `pebbly remover` | 꺾쇠 — MuseoModerno(이름 400·스파인 500·[ 01 ] 600), 한글 Pretendard
- 처음 열 때 [ 01 ] 번호 인트로: 공용 부품 `public/pebbly-intro.js`(`_brand/intro/pebbly-intro.js`의 사본 — 고치지 말고 원본을 고친 뒤 `python _brand/intro/sync.py`가 사본과 layout.tsx의 `?v=`를 맞춤). 탭마다 한 번 · `?intro`로 다시
- 앱 아이콘: 브랜드 생성기 결과 그대로(`node _brand/icons/make.js 01` → `_brand/icons/01/`, 둥근 네모 테 안 `[ 01 ]`). 주소의 `?v=`는 파일 해시 — 바꾸면 layout.tsx·manifest도 같이
- 공유 이미지: `npm run og`(헤드리스 크롬)

## 개발
```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # out/ 에 정적 파일
```

## 배포 (Cloudflare Workers — 정적 파일만)
- Git 연결(jungboov/pebbly-remover, main): 빌드 명령 `npm run build`, 배포 명령 `npx wrangler deploy` — `wrangler.jsonc`가 `out/`을 올림
- Node 22(`.nvmrc`). 빌드는 `next build --webpack`(배경 지우기 라이브러리 때문에 Turbopack 대신)
- 사용자 지정 도메인 `remover.pebblylabs.com` (Worker › 설정 › 도메인 및 경로)

## 폴더
- `app/page.tsx` 화면 틀 · `app/_hooks/useBatchProcessor.ts` 지우기·받기 · `app/_components/` 부품
- `app/_components/Intro.tsx` 번호 인트로(부품 부름) · `app/_lib/intro.ts` 정적 첫 장면 · `app/_lib/boot.ts` 그리기 전 스크립트(한/영·인트로·설치 앱 첫 장면) · `app/_lib/lang.ts` 한/영
- `scripts/og-image.mjs` 공유 이미지
