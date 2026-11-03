"use client";

import { useSyncExternalStore } from 'react';
import { LANG_KEY } from './boot';

// 한/영 (처음 값은 boot.ts 머리 스크립트가 <html lang>에 정해 둠)
export type Lang = 'ko' | 'en';
const EVENT = 'pebbly-lang';

const read = (): Lang => (document.documentElement.lang === 'ko' ? 'ko' : 'en');
const subscribe = (fn: () => void) => {
  window.addEventListener(EVENT, fn);
  return () => window.removeEventListener(EVENT, fn);
};

export function setLang(l: Lang) {
  document.documentElement.lang = l;
  try { localStorage.setItem(LANG_KEY, l); } catch {}
  window.dispatchEvent(new Event(EVENT));
}

// 글자 말고 aria-label·title처럼 속성에 넣을 말이 필요할 때
export function useLang(): Lang {
  return useSyncExternalStore(subscribe, read, () => 'en');
}
