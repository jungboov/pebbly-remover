"use client";

import { useSyncExternalStore } from 'react';
import { PRODUCT_DEFAULT, STICKER_DEFAULT, type Mode, type ProductOpts, type StickerOpts } from './post';
import { DL_DEFAULT, type DlOpts } from './shrink';
import type { Paper } from './sheet';
import type { Format, Preset } from './cutExport';

// 만들기 설정(탭·모드·상품 사진·스티커·받기 설정·칼선) — 이 브라우저에 기억. 처음 그릴 때(정적 HTML)는 기본값, 그다음 저장한 값(lang.ts와 같은 방식)
export type Tool = 'remove' | 'cut';
// 칼선 탭: 칼선 간격 mm · 종이 · 한 장 가득 · 바깥 완칼 · 받을 형식 · 칼선 틀 · 그림·반칼·완칼 나눠 받기 · 새 그림 크기(긴 변 mm)
export type CutSettings = { gap: number; paper: Paper; full: boolean; die: boolean; format: Format; preset: Preset; split: boolean; size: number };
export const CUT_DEFAULT: CutSettings = { gap: 2.5, paper: 'a4', full: false, die: true, format: 'pdf', preset: 'cutcontour', split: false, size: 50 };
export type OutSettings = { tool: Tool; mode: Mode; product: ProductOpts; sticker: StickerOpts; dl: DlOpts; cut: CutSettings };
const KEY = 'pebbly-remover-out';
const DEFAULTS: OutSettings = { tool: 'remove', mode: 'cut', product: PRODUCT_DEFAULT, sticker: STICKER_DEFAULT, dl: DL_DEFAULT, cut: CUT_DEFAULT };
const MODES: Mode[] = ['cut', 'product', 'sticker'];
const subs = new Set<() => void>();
let cur: OutSettings | null = null;

const read = (): OutSettings => {
  if (cur) return cur;
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || 'null');
    cur = v ? {
      tool: v.tool === 'cut' ? 'cut' : 'remove',
      mode: MODES.includes(v.mode) ? v.mode : 'cut',
      product: { ...PRODUCT_DEFAULT, ...v.product },
      sticker: { ...STICKER_DEFAULT, ...v.sticker },
      dl: { ...DL_DEFAULT, ...v.dl },
      cut: { ...CUT_DEFAULT, ...v.cut },
    } : DEFAULTS;
  } catch {
    cur = DEFAULTS;
  }
  return cur;
};
const subscribe = (fn: () => void) => { subs.add(fn); return () => { subs.delete(fn); }; };

export const getOutSettings = read;

export function setOutSettings(patch: Partial<OutSettings>) {
  cur = { ...read(), ...patch };
  try { localStorage.setItem(KEY, JSON.stringify(cur)); } catch {}
  subs.forEach(f => f());
}

export function useOutSettings(): OutSettings {
  return useSyncExternalStore(subscribe, read, () => DEFAULTS);
}
