// onnxruntime-web은 package.json exports에 타입을 안 적어 둬서 TypeScript가 못 찾음 → 꾸러미에 든 선언(types.d.ts)을 직접 불러옴
// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../../node_modules/onnxruntime-web/types.d.ts" />

// libheif-js: wasm을 품은 ES 모듈(공장 함수를 부르면 바로 쓸 수 있는 모듈)
declare module 'libheif-js/libheif-wasm/libheif-bundle.mjs' {
  const factory: () => unknown;
  export default factory;
}
