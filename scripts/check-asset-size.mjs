// 빌드 뒤(postbuild) 확인: Cloudflare Workers 정적 파일은 한 파일 25MiB까지만 올라감 — 넘으면 배포가 실패하니 여기서 미리 멈춤
// (2026-11-26 onnxruntime-web 1.31의 .asyncify.wasm 27.4MiB 때문에 배포가 한 번 실패했음)
import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const LIMIT = 25 * 1024 * 1024;
const big = [];
const walk = (d) => {
  for (const f of readdirSync(d)) {
    const p = join(d, f), s = statSync(p);
    if (s.isDirectory()) walk(p);
    else if (s.size > LIMIT) big.push(`${relative('out', p)} ${(s.size / 1048576).toFixed(2)}MiB`);
  }
};
walk('out');
if (big.length) {
  console.error(`25MiB 넘는 파일이 있어 Cloudflare에 못 올림:\n  ${big.join('\n  ')}`);
  process.exit(1);
}
console.log('파일 크기 확인: 모두 25MiB 이하');
