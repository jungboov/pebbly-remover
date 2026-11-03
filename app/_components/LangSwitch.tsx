"use client";

import { setLang, useLang } from '../_lib/lang';

// 켜진 말 표시는 CSS(html[lang])가 — 그려지기 전부터 맞게 보임
export function LangSwitch() {
  const lang = useLang();
  return (
    <div className="lang" role="group" aria-label="Language">
      <button type="button" data-l="ko" aria-pressed={lang === 'ko'} onClick={() => setLang('ko')}>KO</button>
      <i aria-hidden="true" />
      <button type="button" data-l="en" aria-pressed={lang === 'en'} onClick={() => setLang('en')}>EN</button>
    </div>
  );
}
