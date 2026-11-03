// 배경 지우기 모델: ISNet fp16 — IMG.LY가 공개한 파일(@imgly/background-removal-data 1.7.0, staticimgly CDN)을 onnxruntime-web으로 직접 돌림
// (예전엔 @imgly/background-removal 라이브러리를 통째로 썼는데, 같은 설명 파일을 세 번씩 받고 받은 파일을 브라우저 저장소에 안 남겨서
//  파일 받기·실행은 여기서 직접, 사진 줄이기·늘리기·합치기는 pipeline.ts가 캔버스로)
// 워커(remover.worker.ts)와 화면 스레드(engine.ts, 워커를 못 쓸 때) 양쪽에서 씀
import type { InferenceSession } from 'onnxruntime-web';

const BASE = 'https://staticimgly.com/@imgly/background-removal-data/1.7.0/dist/';
// 받은 파일은 Cache Storage에 — 조각 이름이 내용 해시라 안 바뀜(모델 판을 바꾸면 이 이름도 바꿀 것). 다음 방문부턴 망 없이 바로
const CACHE = 'pebbly-remover-model-1.7.0';
export const SIZE = 1024;   // 모델 입력·마스크 크기

export type Device = 'cpu' | 'gpu';
export type Prefer = 'auto' | Device;
export type Progress = (loaded: number, total: number) => void;
export type Model = { device: Device; segment: (input: Float32Array) => Promise<Float32Array> };
type Entry = { size: number; chunks: { name: string; offsets: [number, number] }[] };

// GPU는 1024 한 장 0.1초(이 PC RTX 4060, CPU 16스레드는 2.3초)라 되면 GPU로, 안 되면 CPU.
// wasm은 그쪽에 맞는 것 하나만 받음: CPU 11.8MB · GPU(jsep) 23.0MB
const FILES = {
  model: '/models/isnet_fp16',
  cpu: ['/onnxruntime-web/ort-wasm-simd-threaded.wasm', '/onnxruntime-web/ort-wasm-simd-threaded.mjs'],
  gpu: ['/onnxruntime-web/ort-wasm-simd-threaded.jsep.wasm', '/onnxruntime-web/ort-wasm-simd-threaded.jsep.mjs'],
} as const;

async function get(url: string, size?: number): Promise<Uint8Array> {
  const cache = typeof caches === 'undefined' ? null : await caches.open(CACHE).catch(() => null);
  const hit = await cache?.match(url).catch(() => undefined);
  if (hit) {
    const b = new Uint8Array(await hit.arrayBuffer());
    if (size === undefined || b.length === size) return b;
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`model: ${res.status} ${url}`);
  const b = new Uint8Array(await res.arrayBuffer());
  if (size !== undefined && b.length !== size) throw new Error(`model: size ${url}`);
  cache?.put(url, new Response(b)).catch(() => {});   // 저장 공간이 모자라면 그냥 다음에 또 받음
  return b;
}

let manifest: Promise<Record<string, Entry>> | null = null;
const entries = (): Promise<Record<string, Entry>> =>
  (manifest ??= get(BASE + 'resources.json').then(b => JSON.parse(new TextDecoder().decode(b))).catch(e => { manifest = null; throw e; }));

async function load(key: string, tick: (n: number) => void): Promise<Uint8Array> {
  const e = (await entries())[key];
  if (!e) throw new Error(`model: no ${key}`);
  const out = new Uint8Array(e.size);
  await Promise.all(e.chunks.map(async c => {
    const b = await get(BASE + c.name, c.offsets[1] - c.offsets[0]);
    out.set(b, c.offsets[0]);
    tick(b.length);
  }));
  return out;
}

// GPU를 쓸지: 크롬 계열 PC에서 f16 셰이더가 되는 진짜 GPU일 때만(폰·사파리·파이어폭스는 아직 실기기로 못 봐서 CPU) — ?gpu=1 / ?gpu=0으로 시험
type Adapter = { features: { has(f: string): boolean }; info?: { isFallbackAdapter?: boolean } };
type Nav = { gpu?: { requestAdapter(): Promise<Adapter | null> }; userAgentData?: { mobile: boolean; brands: { brand: string }[] } };
async function gpuUsable(prefer: Prefer): Promise<boolean> {
  if (prefer === 'cpu') return false;
  const nav = navigator as unknown as Nav, ua = nav.userAgentData;
  if (!nav.gpu) return false;
  if (prefer === 'auto' && (!ua || ua.mobile || !ua.brands.some(b => b.brand === 'Chromium'))) return false;
  const a = await nav.gpu.requestAdapter().catch(() => null);
  return !!a && a.features.has('shader-f16') && !a.info?.isFallbackAdapter;
}

async function open(device: Device, onProgress: Progress): Promise<Model> {
  const man = await entries();
  const [wasmKey, mjsKey] = FILES[device];
  const total = man[FILES.model].size + man[wasmKey].size + man[mjsKey].size;
  let loaded = 0;
  const tick = (n: number) => onProgress((loaded += n), total);
  onProgress(0, total);
  const [model, wasm, mjs] = await Promise.all([load(FILES.model, tick), load(wasmKey, tick), load(mjsKey, tick)]);

  const ort = device === 'gpu' ? await import('onnxruntime-web/webgpu') : await import('onnxruntime-web/wasm');
  // 스레드: 코어 수만큼(이 PC 16 → 2.3초, 8 → 2.7초, 4 → 4.0초). 교차 출처 격리가 없으면 onnxruntime이 1로 내림
  ort.env.wasm.numThreads = Math.min(16, navigator.hardwareConcurrency || 4);
  ort.env.wasm.wasmPaths = {
    wasm: URL.createObjectURL(new Blob([wasm as BlobPart], { type: 'application/wasm' })),
    mjs: URL.createObjectURL(new Blob([mjs as BlobPart], { type: 'text/javascript' })),
  };
  // CPU는 parallel: 지운 뒤 남는 메모리가 sequential보다 200MB 적음(782 → 583MB, 속도는 같음 — 예전 라이브러리도 이렇게 씀)
  const session: InferenceSession = await ort.InferenceSession.create(model, {
    executionProviders: [device === 'gpu' ? 'webgpu' : 'wasm'],
    graphOptimizationLevel: 'all',
    ...(device === 'cpu' && { executionMode: 'parallel' as const }),
  });
  const [inName] = session.inputNames, [outName] = session.outputNames;
  return {
    device,
    async segment(input) {
      const r = await session.run({ [inName]: new ort.Tensor('float32', input, [1, 3, SIZE, SIZE]) });
      return r[outName].data as Float32Array;
    },
  };
}

// 모델 열기: GPU가 되면 GPU로, 열다가 안 되면 CPU로. 지우다가 GPU가 실패해도(장치 잃음 등) CPU로 바꿔 그 장부터 다시
export async function openModel(prefer: Prefer, onProgress: Progress): Promise<Model> {
  let m: Model | null = null;
  if (await gpuUsable(prefer)) {
    m = await open('gpu', onProgress).catch(e => { console.warn('GPU로 못 열어서 CPU로:', e); return null; });
  }
  let cur = m ?? (await open('cpu', onProgress));
  if (cur.device === 'cpu') return cur;
  return {
    get device() { return cur.device; },
    async segment(input) {
      try {
        return await cur.segment(input);
      } catch (e) {
        if (cur.device !== 'gpu') throw e;
        console.warn('GPU로 못 지워서 CPU로:', e);
        cur = await open('cpu', () => {});
        return cur.segment(input);
      }
    },
  };
}
