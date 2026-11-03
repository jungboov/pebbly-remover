"use client";

import { useEffect, useRef, useState } from 'react';
import { INTRO_KEY } from '../_lib/boot';
import { firstScene } from '../_lib/intro';

// 공용 번호 인트로 부품 (layout.tsx가 /pebbly-intro.js를 먼저 불러 둠 — 쓰는 법은 그 파일 맨 위 설명)
declare global {
  interface Window {
    pebblyIntro: (root: HTMLElement, o: { no: number; name: string; onDone?: (r: { skipped: boolean }) => void }) => { play(): unknown };
  }
}

// 처음 열 때 [ 01 ] 번호 인트로: [ 01 ] 상자 → 가운데에서 스파인으로 바뀌어 숫자 한 바퀴 → 01에 멈춘 뒤 pebbly remover → 사라짐
// 글꼴 기다림·누르면 넘어감·움직임 줄이기·안드로이드 설치 앱 첫 장면 크기는 부품이 함
// 탭마다 한 번만(sessionStorage, boot.ts 머리 스크립트가 data-intro="off"로 미리 숨김), ?intro를 붙이면 다시
// 첫 장면은 정적 HTML이라 스크립트 전에도 보임. 스크립트가 멈춰도 CSS가 8초 뒤 치움(intro-bail)
const SCENE = { __html: firstScene(1) };

export function Intro() {
  const ref = useRef<HTMLDivElement>(null);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    const root = ref.current;
    if (!root || document.documentElement.dataset.intro === 'off' || !window.pebblyIntro) { setGone(true); return; }
    if (root.dataset.played) return;   // 개발 모드(StrictMode)는 effect가 두 번 돎 — 부품엔 멈춤이 없어서 한 번만
    root.dataset.played = '1';
    try { sessionStorage.setItem(INTRO_KEY, '1'); } catch {}
    window.pebblyIntro(root, { no: 1, name: 'pebbly remover', onDone: () => setGone(true) }).play();
  }, []);

  if (gone) return null;
  return <div ref={ref} id="intro" className="pi" aria-hidden="true" dangerouslySetInnerHTML={SCENE} />;
}
