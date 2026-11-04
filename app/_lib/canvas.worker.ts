// 캔버스 워커: 썸네일 · 후처리(상품 사진·스티커 다시 그리기) · 받기 설정(줄여서 저장) · HEIC 풀기
// 화면 스레드 밖, 모델 워커와도 따로(모델이 지우는 동안에도 바로)
// 받는 말: { id, op: 'thumb', file } · { id, op: 'render', src, spec, key } · { id, op: 'shrink', blob, opts, original, bg } · { id, op: 'heic', file }
// 보내는 말: { id, blob?, error? }
import { thumbOf } from './thumb';
import { render, type Spec, type Src } from './post';
import { shrink, type DlOpts } from './shrink';
import { heicToJpeg } from './heic';

const scope = self as unknown as { postMessage(m: unknown): void; onmessage: ((e: MessageEvent) => void) | null };

type Msg = { id: number } & (
  | { op: 'thumb'; file: Blob }
  | { op: 'render'; src: Src; spec: Spec; key: string }
  | { op: 'shrink'; blob: Blob; opts: DlOpts; original: Blob | null; bg: string }
  | { op: 'heic'; file: Blob }
);

scope.onmessage = async (e) => {
  const m = e.data as Msg;
  try {
    const blob = m.op === 'thumb' ? await thumbOf(m.file)
      : m.op === 'render' ? await render(m.src, m.spec, m.key)
      : m.op === 'shrink' ? await shrink(m.blob, m.opts, m.original, m.bg)
      : await heicToJpeg(m.file);
    scope.postMessage({ id: m.id, blob });
  } catch (err) {
    scope.postMessage({ id: m.id, error: err instanceof Error ? err.message : String(err) });
  }
};
