"use client";

import type { CSSProperties, ReactNode } from 'react';

// 나눔 버튼(모드 탭과 같은 모양, 작게): 고른 칸은 흰 바탕
export function Seg<V extends string | number>({ items, value, onPick, label }: { items: { v: V; node: ReactNode }[]; value: V; onPick: (v: V) => void; label: string }) {
  return (
    <div className="seg" role="radiogroup" aria-label={label} style={{ '--n': items.length } as CSSProperties}>
      {items.map(it => (
        <button key={String(it.v)} type="button" role="radio" aria-checked={value === it.v} data-on={value === it.v} onClick={() => onPick(it.v)}>
          {it.node}
        </button>
      ))}
    </div>
  );
}

// 켜고 끄기
export function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} className="switch" data-on={on} onClick={() => onChange(!on)}>
      <i />
    </button>
  );
}
