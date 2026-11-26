
// libheif-js: wasm을 품은 ES 모듈(공장 함수를 부르면 바로 쓸 수 있는 모듈)
declare module 'libheif-js/libheif-wasm/libheif-bundle.mjs' {
  const factory: () => unknown;
  export default factory;
}
