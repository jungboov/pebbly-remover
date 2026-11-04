# 01 · pebbly remover

브라우저 안에서 AI로 이미지 배경을 지우는 웹앱 — 업로드·서버 없이 이 기기에서만.
pebbly labs 넘버링 01(홀수 = 온라인). 예전 이름은 pixel remover(toolkit.pebblylabs.com/pixel-remover).

- 주소: remover.pebblylabs.com (pebblylabs.com/01 → 여기)
- 기능: 여러 장(한 번에 10장까지 줄 세워 한 장씩) 배경 지우기 · 원본/결과 비교 막대 · 썸네일 골라 ZIP·낱장 받기 · 지금 결과 받기 · 한/영 · PNG·JPEG·WebP 말고도 브라우저가 여는 그림(GIF·AVIF·BMP)
- 만들기(옆 칸 맨 위, 설정은 이 브라우저에 기억 — `app/_lib/outSettings.ts`):
  - 배경 지우기: 투명 PNG(원래 그대로)
  - 상품 사진: 고른 색 바탕(흰색·연회색·검정·직접) · 정사각형 1000/1500/2000 · 모든 사진 같은 여백(0~30%) → JPEG. 사진 아래 끝에서 잘린 물체는 아래에 붙임
  - 스티커: 흰 테두리(없음·얇게·보통·두껍게) · 투명 PNG · 카톡 규격 크기(이모티콘 360, 큰 이모티콘 540, 미니 180, 아이콘 78) + 크게 1000. 규격 용량을 넘으면 256색 PNG로
    (규격 출처: 카카오 이모티콘 스튜디오 [이모티콘 유형별 이미지 가이드](https://kakaoemoticonstudio.notion.site/image-guide), 2026-11-04 확인 — 360 PNG 150KB · 540 1MB · 180 100KB · 78 16KB, 72dpi RGB, 투명 배경)
  - 상품 사진·스티커는 원본 + 모델 마스크(1024²)에서 다시 그림: 아주 옅은 곳(10% 아래) 지우기 · 가장 큰 덩어리의 2%보다 작은 조각(워터마크·티끌) 지우기 · 속 채우기(윤곽 안 반투명을 불투명으로, 켜고 끔 — 유리처럼 비쳐야 하면 끔)
  - 모드·설정을 바꾸면 다 지운 사진을 바로 다시 그림(모델은 다시 안 돌림, 캔버스 워커에서 — 화면 안 멈춤)
- 받기 설정(줄여서 받기, `app/_lib/shrink.ts` · `app/_components/DownloadSheet.tsx`): 받기 버튼 위 한 줄 → 아래에서 올라오는 시트
  - 형식 그대로·PNG·WebP·JPG(JPG는 투명한 곳을 흰색으로) · 크기 긴 변 원본·2048·1080·직접(상품 사진은 상품 사진 크기를 따름, 원본보다 크게는 안 늘림)
  - 용량 그대로·품질(50~100)·목표 용량(500KB·1MB·2MB·직접 — 품질을 반씩 좁혀 맞추고, PNG는 256색, 그래도 넘으면 크기를 줄임)
  - 위치 정보 지우기(기본 켬: 다시 저장하면 사진 정보가 다 빠짐). 끄면 원본 JPG의 사진 정보(EXIF·GPS)를 결과 JPG에 다시 붙임(방향 값은 1)
  - 고른 사진의 전·후 용량을 시트에서 미리 셈(캔버스 워커, 다 센 것은 받을 때 그대로). 스티커는 카톡 규격 그대로라 없음
- 아이폰 사진(HEIC·HEIF): 기기가 풀 수 있으면 그대로, 아니면 [libheif-js](https://github.com/catdad-experiments/libheif-js) 1.23.5(LGPL-3.0, libheif)로 풀어 JPG(0.95)로 바꾼 뒤 지움(`app/_lib/heic.ts`). HEIC가 들어올 때만 따로 받는 조각(wasm 1.46MB, 압축 약 0.4MB)
  - 시험해 보고 안 넣은 것(2026-11-04): BiRefNet_lite(MIT, 114MB) — 물건은 더 꽉 차게 잡지만 브라우저 onnxruntime(1.21·1.31)에서 GPU는 셰이더 버퍼 한도(16)·CPU는 메모리(4GB) 때문에 1024로 못 돌림. 주인공 하나만 남기기·확대해 한 번 더 지우기는 사진마다 들쭉날쭉해서 뺌
- 지우기: ISNet fp16 모델(88MB — IMG.LY가 공개한 [@imgly/background-removal-data](https://github.com/imgly/background-removal-js) 1.7.0, 그쪽 CDN) + onnxruntime-web 1.21.0 wasm(이 사이트에서, Cloudflare brotli로 CPU 2.3MB · GPU 5.0MB)
  - 모델: fp32 176MB와 결과 같음. quint8 44MB는 배경과 색이 비슷한 사진에서 깨져서 안 씀
  - 라이브러리(@imgly/background-removal) 없이 직접 부름(`app/_lib/model.ts`): 받은 파일을 Cache Storage에 남겨 다음 방문부턴 망 없이, 설명 파일 한 번만. wasm은 빌드가 `_next/static/media`에 넣음(imgly CDN은 안 줄여서 12·23MB)
  - GPU(WebGPU): 크롬 계열 PC에서 f16 셰이더가 되면(1024 한 장 이 PC RTX 4060 0.1초 · CPU 16스레드 2.3초). 폰·사파리·파이어폭스는 실기기로 못 봐서 CPU — 주소에 `?gpu=1`/`?gpu=0`으로 시험. 열다가·지우다가 안 되면 CPU로
  - 줄이기·늘리기·합치기는 캔버스로(`app/_lib/pipeline.ts`) — 큰 사진도 빠름. 5천만 화소 넘는 사진은 줄여서(못 만들면 1,677만). 지운 결과와 물체 상자를 남겨 후처리(`app/_lib/post.ts`)가 다시 그림
  - 미리 받기: PC(마우스)는 인트로가 끝나고 쉴 때, 폰·데이터 절약은 ＋를 누르거나 끌어 올 때부터
  - 썸네일·상품 사진·스티커는 따로 캔버스 워커(`app/_lib/canvas.worker.ts`)가 — 큰 원본을 화면 스레드에서 풀고 그리면 멈춤
  - 여러 코어: `public/_headers`의 교차 출처 격리(COOP·COEP) 머리글이 있어야 스레드가 켜짐(없으면 1스레드, 이 PC에서 2장 18초 → 3.7초). 밖에서 불러오는 것을 더하면 그쪽이 `Cross-Origin-Resource-Policy: cross-origin`(또는 CORS)을 보내는지 확인
  - 웹 워커에서 지움(`app/_lib/remover.worker.ts`) — 지우는 동안에도 화면이 안 멈춤.
    워커에서 못 그리는 브라우저(OffscreenCanvas 없음)거나 워커에서 모델을 못 열면 화면 스레드로(같은 코드, 지우는 동안 화면이 멈춤) — `app/_lib/engine.ts`

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
- `app/page.tsx` 화면 틀 · `app/_hooks/useBatchProcessor.ts` 처리 줄·받기 · `app/_components/` 부품
- `app/_lib/engine.ts` 지우기를 워커/화면 스레드 어디서 돌릴지 · `app/_lib/remover.worker.ts` 워커 · `app/_lib/model.ts` 모델 받기·열기(GPU/CPU) · `app/_lib/pipeline.ts` 한 장 처리(줄이기·합치기) · `app/_lib/post.ts` 상품 사진·스티커 · `app/_lib/canvas.worker.ts`·`canvasJobs.ts` 썸네일·후처리 워커 · `app/_components/ModeBar.tsx` 만들기 칸
- `app/_components/Intro.tsx` 번호 인트로(부품 부름) · `app/_lib/intro.ts` 정적 첫 장면 · `app/_lib/boot.ts` 그리기 전 스크립트(한/영·인트로·설치 앱 첫 장면) · `app/_lib/lang.ts` 한/영
- `scripts/og-image.mjs` 공유 이미지
