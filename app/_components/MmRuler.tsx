"use client";

import { useEffect, useRef, useState } from 'react';

// mm 줄자: 로고 스파인 00 [ 01 ] 02를 눕힌 꼴 — 가운데 [ 값 ]은 그대로 있고 눈금이 움직임
// 좌우로 밀기(튕기면 더 감) · 휠 · 키보드 ←→(0.1) PageUp/Down(1) Home/End · 가운데 숫자를 누르면 바로 치기
// 값은 0.1mm 단위. 밀거나 칠 때마다 onChange — 받는 쪽(칼선 계산)은 한 번에 하나씩 하므로 자주 불러도 됨
const PX = 80;   // 1mm = 80px(0.1mm = 8px)

const r1 = (x: number) => Math.round(x * 10) / 10;
const fmt = (x: number) => x.toFixed(1);

export function MmRuler({ value, min, max, onChange, label }: { value: number; min: number; max: number; onChange: (v: number) => void; label: string }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const live = useRef({ value, onChange });   // 끄는 중·튕기는 중에 최신 값으로 셈
  useEffect(() => { live.current = { value, onChange }; });
  const [txt, setTxt] = useState<string | null>(null);   // 가운데 숫자: 치는 동안만 글자 그대로
  const drag = useRef<{ x: number; v0: number; moved: boolean; id: number; hist: [number, number][] } | null>(null);
  const raf = useRef(0);
  const cancel = useRef(false);   // Esc: 친 것을 버리고 칸을 떠남

  const clamp = (x: number) => Math.min(max, Math.max(min, x));
  const put = (x: number) => { const v = clamp(r1(x)); if (v !== live.current.value) { live.current.value = v; live.current.onChange(v); } };

  // 휠은 기본 동작(쪽 넘김)을 막아야 해서 passive 아닌 리스너로
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    let acc = 0;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      acc += Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      while (Math.abs(acc) >= 25) { const s = Math.sign(acc); put(live.current.value + s * 0.1); acc -= s * 25; }
    };
    el.addEventListener('wheel', wheel, { passive: false });
    return () => { el.removeEventListener('wheel', wheel); cancelAnimationFrame(raf.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [min, max]);

  const onDown = (e: React.PointerEvent) => {
    cancelAnimationFrame(raf.current);
    boxRef.current?.classList.remove('fling');
    drag.current = { x: e.clientX, v0: live.current.value, moved: false, id: e.pointerId, hist: [[e.clientX, performance.now()]] };
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current, el = boxRef.current;
    if (!d || !el || e.pointerId !== d.id) return;
    const dx = e.clientX - d.x;
    if (!d.moved) {
      if (Math.abs(dx) <= 4) return;
      d.moved = true;
      el.setPointerCapture(e.pointerId);
      el.classList.add('drag');
      (document.activeElement as HTMLElement | null)?.blur();
    }
    d.hist.push([e.clientX, performance.now()]);
    if (d.hist.length > 6) d.hist.shift();
    put(d.v0 - dx / PX);
  };
  const onUp = (e: React.PointerEvent) => {
    const d = drag.current, el = boxRef.current;
    if (!d || !el || e.pointerId !== d.id) return;
    drag.current = null;
    el.classList.remove('drag');
    if (!d.moved) return;
    const [x0, t0] = d.hist[0], [x1, t1] = d.hist[d.hist.length - 1];
    let vel = t1 > t0 ? (x1 - x0) / (t1 - t0) : 0;   // px/ms
    if (Math.abs(vel) < 0.3 || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    el.classList.add('fling');
    let pos = live.current.value, last = performance.now();
    const step = (now: number) => {
      const dt = now - last; last = now;
      pos -= vel * dt / PX; vel *= Math.pow(0.93, dt / 16);
      put(pos);
      if (pos <= min || pos >= max || Math.abs(vel) < 0.02) { el.classList.remove('fling'); return; }
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
  };
  const onKey = (e: React.KeyboardEvent) => {
    if ((e.target as HTMLElement).tagName === 'INPUT') return;
    const k = ({ ArrowRight: 0.1, ArrowUp: 0.1, ArrowLeft: -0.1, ArrowDown: -0.1, PageUp: 1, PageDown: -1 } as Record<string, number>)[e.key];
    if (k) { e.preventDefault(); put(live.current.value + k); }
    else if (e.key === 'Home') { e.preventDefault(); put(min); }
    else if (e.key === 'End') { e.preventDefault(); put(max); }
  };

  const W = (max - min) * PX;
  const labels = [];
  for (let n = Math.ceil(min); n <= max; n++) labels.push(n);
  return (
    <div className="rl" ref={boxRef} tabIndex={0} role="slider" aria-label={label} aria-valuemin={min} aria-valuemax={max} aria-valuenow={value} aria-valuetext={`${fmt(value)} mm`}
      onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onKeyDown={onKey}>
      <div className="rl-s" style={{ transform: `translateX(${-(value - min) * PX}px)` }} aria-hidden="true">
        <i className="rl-t" style={{ width: W + 1 }} />
        <i className="rl-T" style={{ width: W + 1 }} />
        {labels.map(n => <span key={n} className="rl-n" style={{ left: (n - min) * PX }}>{n}</span>)}
      </div>
      <span className="rl-x" aria-hidden="true" />
      <label className="rl-c">
        <span aria-hidden="true">[</span>
        <input type="text" inputMode="decimal" value={txt ?? fmt(value)} aria-label={`${label} mm`}
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => { const t = e.target.value, v = Number(t.replace(',', '.')); setTxt(t); if (t.trim() && v >= min && v <= max) put(v); }}
          onBlur={() => { const v = Number((txt ?? '').replace(',', '.')); if (!cancel.current && txt?.trim() && Number.isFinite(v)) put(v); cancel.current = false; setTxt(null); }}
          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); else if (e.key === 'Escape') { cancel.current = true; e.currentTarget.blur(); } }} />
        <span aria-hidden="true">]</span>
      </label>
    </div>
  );
}
