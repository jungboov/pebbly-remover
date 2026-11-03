import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // public/pebbly-intro.js는 _brand/intro 원본의 사본(sync.py가 맞춤)이라 여기서 검사하지 않음
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "scripts/**", "public/pebbly-intro.js"]),
]);

export default eslintConfig;
