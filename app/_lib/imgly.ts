// 배경 지우기 라이브러리(@imgly/background-removal) 설정 — 워커(remover.worker.ts)와 화면 스레드(engine.ts) 양쪽에서 씀
import type { Config } from '@imgly/background-removal';

// 모델: isnet_fp16 — isnet(fp32, 176MB)과 결과가 같고(사진 4장 비교, 가장자리 평균 차이 0.06/255) 받는 양이 절반.
// isnet_quint8(44MB)은 배경과 색이 비슷한 사진에서 배경이 남고 물체에 구멍이 나서 안 씀
// 처음 받는 양 = 모델 88.2MB + onnxruntime wasm 11.8MB (staticimgly CDN, 브라우저가 1년 보관)
export const MODEL_MB = 100;
export const MODEL_BYTES = 99_998_062;

export type Progress = (key: string, current: number, total: number) => void;

// attempt: imgly가 설정별로 모델 받기를 기억해 둠(실패도) → 다시 받을 때 값을 바꿔서 새로 받게
// progress: imgly는 처음 받은 설정의 progress만 계속 부름 → 늘 같은 함수를 넘길 것
export function makeConfig(attempt: number, progress: Progress) {
  return { model: 'isnet_fp16', device: 'cpu', progress, attempt } as Config & { attempt: number };
}

// imgly는 PNG·JPEG·WebP만 받음 → 그 밖(GIF·AVIF·BMP…)은 형식을 지워서 넘기면 브라우저가 풀어 줌(createImageBitmap)
const DIRECT = /^image\/(png|jpe?g|webp)$/;
export const toSource = (file: Blob): Blob => DIRECT.test(file.type) ? file : new Blob([file], { type: 'application/octet-stream' });
