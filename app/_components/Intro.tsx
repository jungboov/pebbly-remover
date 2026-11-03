"use client";

import { useEffect, useRef, useState } from 'react';
import { INTRO_KEY } from '../_lib/boot';
import { firstScene, pebblyIntro } from '../_lib/intro';

// 처음 열 때 [ 01 ] 번호 인트로 — 첫 장면(앱 아이콘과 같은 상자)은 정적 HTML이라 스크립트 전에도 보임
// 탭마다 한 번만(sessionStorage, boot.ts 머리 스크립트가 data-intro="off"로 미리 숨김), ?intro를 붙이면 다시
// 누르면 바로 넘어감. 움직임 줄이기를 켠 기기는 다 펼쳐진 로고만 잠깐. 스크립트가 멈춰도 CSS가 8초 뒤 치움(intro-bail)
const SCENE = { __html: firstScene(1) };

export function Intro() {
  const ref = useRef<HTMLDivElement>(null);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    const root = ref.current;
    if (!root || document.documentElement.dataset.intro === 'off') { setGone(true); return; }
    try { sessionStorage.setItem(INTRO_KEY, '1'); } catch {}

    let raf = 0, alive = true;
    const timers: number[] = [];
    const finish = (fade = 0) => {
      if (!alive) return;
      alive = false;
      cancelAnimationFrame(raf);
      root.style.transition = `opacity ${fade}ms`;
      root.style.opacity = '0';
      root.style.pointerEvents = 'none';
      timers.push(window.setTimeout(() => setGone(true), fade));
    };
    root.addEventListener('pointerdown', () => finish(400));

    // 글꼴이 늦게 와서 다른 글꼴로 번쩍이지 않게 기다렸다가(최대 1.5초) 시작
    const fonts = Promise.all([
      document.fonts.load("500 12px 'MuseoModerno'", '0123456789'),
      document.fonts.load("600 12px 'MuseoModerno'", '[]0123456789 '),
      document.fonts.load("400 27px 'MuseoModerno'", 'pebbly remover'),
    ]).catch(() => {});
    Promise.race([fonts, new Promise(r => setTimeout(r, 1500))]).then(() => {
      if (!alive) return;
      const intro = pebblyIntro(root, { no: 1, name: 'pebbly remover' });
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
        intro.render(intro.T.total - intro.T.out - intro.T.rest);
        timers.push(window.setTimeout(() => finish(600), 1500));
        return;
      }
      const t0 = performance.now();
      const step = (now: number) => {
        if (!alive) return;
        const t = now - t0;
        intro.render(t);
        if (t < intro.T.total) raf = requestAnimationFrame(step);
        else finish();
      };
      intro.render(0);
      raf = requestAnimationFrame(step);
    });

    return () => { alive = false; cancelAnimationFrame(raf); timers.forEach(clearTimeout); };
  }, []);

  if (gone) return null;
  return <div ref={ref} id="intro" className="pi" aria-hidden="true" dangerouslySetInnerHTML={SCENE} />;
}
