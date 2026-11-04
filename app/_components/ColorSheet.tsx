"use client";

import { useEffect, useRef, useState } from 'react';
import { useLang } from '../_lib/lang';
import { T } from './T';

interface ColorSheetProps {
  value: string;                 // #rrggbb
  onChange: (hex: string) => void;
  onClose: () => void;
}

// 상품 사진에 어울리는 바탕(옅은 무채색·파스텔 + 어두운 둘)
const PRESETS: { c: string; ko: string; en: string }[] = [
  { c: '#f6f1e7', ko: '크림', en: 'Cream' },
  { c: '#e8dfd0', ko: '샌드', en: 'Sand' },
  { c: '#d6d1c8', ko: '스톤', en: 'Stone' },
  { c: '#f2dedb', ko: '블러시', en: 'Blush' },
  { c: '#f7e0cc', ko: '피치', en: 'Peach' },
  { c: '#f6efc9', ko: '버터', en: 'Butter' },
  { c: '#dcefe4', ko: '민트', en: 'Mint' },
  { c: '#d9e2d0', ko: '세이지', en: 'Sage' },
  { c: '#dde9f3', ko: '스카이', en: 'Sky' },
  { c: '#e6e1f2', ko: '라벤더', en: 'Lavender' },
  { c: '#2a2a2a', ko: '차콜', en: 'Charcoal' },
  { c: '#1d2535', ko: '네이비', en: 'Navy' },
];

const clamp = (v: number) => Math.min(1, Math.max(0, v));
const hex2 = (v: number) => Math.round(v * 255).toString(16).padStart(2, '0');
function hsvToHex(h: number, s: number, v: number) {
  const f = (n: number) => { const k = (n + h / 60) % 6; return v - v * s * Math.max(0, Math.min(k, 4 - k, 1)); };
  return `#${hex2(f(5))}${hex2(f(3))}${hex2(f(1))}`;
}
function hexToHsv(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16), r = (n >> 16 & 255) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, g, b), d = mx - Math.min(r, g, b);
  const h = d === 0 ? 0 : mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, mx === 0 ? 0 : d / mx, mx];
}
const HEX = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i;
const normHex = (s: string) => {
  const m = s.trim().match(HEX);
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].split('').map(c => c + c).join('') : m[1];
  return '#' + h.toLowerCase();
};

// 끌기: 누른 곳부터, 손을 뗄 때까지 칸 밖으로 나가도 따라감(포인터 붙잡기)
function useDrag(onMove: (x: number, y: number) => void) {
  const ref = useRef<HTMLDivElement>(null);
  const move = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    onMove(clamp((e.clientX - r.left) / r.width), clamp((e.clientY - r.top) / r.height));
  };
  return {
    ref,
    onPointerDown: (e: React.PointerEvent) => { e.currentTarget.setPointerCapture(e.pointerId); move(e); },
    onPointerMove: (e: React.PointerEvent) => { if (e.currentTarget.hasPointerCapture(e.pointerId)) move(e); },
  };
}

// 바탕색 고르기: 폰은 아래에서 올라오는 시트, PC는 가운데 창. 추천 색 · 채도/밝기 칸 · 색조 막대 · #코드
// 고르는 대로 바로 바꿈(보기 창이 따라 그림) — 닫기는 바깥 누르기·완료·Esc
export function ColorSheet({ value, onChange, onClose }: ColorSheetProps) {
  const lang = useLang(), ko = lang === 'ko';
  const [hsv, setHsv] = useState<[number, number, number]>(() => hexToHsv(value));
  const [text, setText] = useState(value.toUpperCase());
  const boxRef = useRef<HTMLDivElement>(null);
  const [h, s, v] = hsv;

  const set = (next: [number, number, number]) => {
    setHsv(next);
    const hex = hsvToHex(...next);
    setText(hex.toUpperCase());
    onChange(hex);
  };
  const pick = (hex: string) => { setHsv(hexToHsv(hex)); setText(hex.toUpperCase()); onChange(hex); };
  const sv = useDrag((x, y) => set([h, x, 1 - y]));
  const hue = useDrag((x) => set([x * 360, s, v]));

  useEffect(() => {
    boxRef.current?.focus();
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);

  return (
    <div className="cs-back" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="cs" role="dialog" aria-modal="true" aria-label={ko ? '바탕색' : 'Background color'} tabIndex={-1} ref={boxRef}>
        <div className="cs-head">
          <strong><T ko="바탕색" en="Background" /></strong>
          <span className="cs-now" style={{ background: value }} aria-hidden="true" />
          <button type="button" className="cs-x" onClick={onClose} aria-label={ko ? '닫기' : 'Close'}>
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
          </button>
        </div>

        <div className="cs-presets" role="radiogroup" aria-label={ko ? '추천 색' : 'Suggested colors'}>
          {PRESETS.map(p => (
            <button key={p.c} type="button" role="radio" aria-checked={value === p.c} data-on={value === p.c} title={ko ? p.ko : p.en}
              aria-label={ko ? p.ko : p.en} style={{ background: p.c }} onClick={() => pick(p.c)} />
          ))}
        </div>

        <div className="cs-sv" {...sv} style={{ background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${hsvToHex(h, 1, 1)})` }}
          role="slider" aria-label={ko ? '채도와 밝기' : 'Saturation and brightness'} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(s * 100)} aria-valuetext={text}>
          <i style={{ left: `${s * 100}%`, top: `${(1 - v) * 100}%`, background: value }} />
        </div>
        <div className="cs-hue" {...hue} role="slider" aria-label={ko ? '색조' : 'Hue'} aria-valuemin={0} aria-valuemax={360} aria-valuenow={Math.round(h)}>
          <i style={{ left: `${(h / 360) * 100}%`, background: hsvToHex(h, 1, 1) }} />
        </div>

        <div className="cs-foot">
          <label className="cs-hex">
            <span>#</span>
            {/* 치는 동안은 여섯 자리가 다 차야 바꿈(세 자리에서 짧은 코드로 튀지 않게), 세 자리 짧은 코드는 다 쳤을 때(엔터·칸 벗어남) */}
            <input value={text.replace('#', '')} maxLength={6} spellCheck={false} autoCapitalize="off" autoComplete="off" inputMode="text"
              aria-label={ko ? '색 코드' : 'Hex code'}
              onChange={(e) => {
                const raw = e.target.value.replace(/[^0-9a-f]/gi, '').toUpperCase();
                setText('#' + raw);
                if (raw.length === 6) { const hx = normHex(raw)!; setHsv(hexToHsv(hx)); onChange(hx); }
              }}
              onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
              onBlur={() => {
                const hx = normHex(text);
                if (hx && hx !== value) { setHsv(hexToHsv(hx)); onChange(hx); setText(hx.toUpperCase()); }
                else setText(value.toUpperCase());
              }} />
          </label>
          <button type="button" className="btn btn-main cs-done" onClick={onClose}><T ko="완료" en="Done" /></button>
        </div>
      </div>
    </div>
  );
}
