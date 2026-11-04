"use client";

import { useSyncExternalStore } from 'react';
import { PRODUCT_DEFAULT, STICKER_DEFAULT, type Mode, type ProductOpts, type StickerOpts } from './post';
import { DL_DEFAULT, type DlOpts } from './shrink';

// 만들기 설정(모드·상품 사진·스티커·받기 설정) — 이 브라우저에 기억. 처음 그릴 때(정적 HTML)는 기본값, 그다음 저장한 값(lang.ts와 같은 방식)
export type OutSettings = { mode: Mode; product: ProductOpts; sticker: StickerOpts; dl: DlOpts };
const KEY = 'pebbly-remover-out';
const DEFAULTS: OutSettings = { mode: 'cut', product: PRODUCT_DEFAULT, sticker: STICKER_DEFAULT, dl: DL_DEFAULT };
const MODES: Mode[] = ['cut', 'product', 'sticker'];
const subs = new Set<() => void>();
let cur: OutSettings | null = null;

const read = (): OutSettings => {
  if (cur) return cur;
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || 'null');
    cur = v ? {
      mode: MODES.includes(v.mode) ? v.mode : 'cut',
      product: { ...PRODUCT_DEFAULT, ...v.product },
      sticker: { ...STICKER_DEFAULT, ...v.sticker },
      dl: { ...DL_DEFAULT, ...v.dl },
    } : DEFAULTS;
  } catch {
    cur = DEFAULTS;
  }
  return cur;
};
const subscribe = (fn: () => void) => { subs.add(fn); return () => { subs.delete(fn); }; };

export function setOutSettings(patch: Partial<OutSettings>) {
  cur = { ...read(), ...patch };
  try { localStorage.setItem(KEY, JSON.stringify(cur)); } catch {}
  subs.forEach(f => f());
}

export function useOutSettings(): OutSettings {
  return useSyncExternalStore(subscribe, read, () => DEFAULTS);
}
