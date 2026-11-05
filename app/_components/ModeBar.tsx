"use client";

import { useState } from 'react';
import type { Mode, ProductOpts, StickerOpts } from '../_lib/post';
import { OUTLINE_MAX, PRODUCT_SIZES, STICKER_SIZES } from '../_lib/post';
import { useLang } from '../_lib/lang';
import { ColorSheet } from './ColorSheet';
import { Seg, Switch } from './Controls';
import { IconPlus } from './Icons';
import { Ruler } from './Ruler';
import { T } from './T';

interface ModeBarProps {
  mode: Mode;
  onMode: (m: Mode) => void;
  product: ProductOpts;
  onProduct: (o: ProductOpts) => void;
  sticker: StickerOpts;
  onSticker: (o: StickerOpts) => void;
}

const BGS: { c: string; ko: string; en: string }[] = [
  { c: '#ffffff', ko: '흰색', en: 'White' },
  { c: '#f2f2f2', ko: '연회색', en: 'Light' },
  { c: '#000000', ko: '검정', en: 'Black' },
];

// 만들기: 지우기(투명 PNG) · 상품 사진(고른 색 · 정사각형 · 같은 여백, JPEG) · 스티커(흰 테두리 · 카톡 규격, 투명 PNG)
// 바꾸면 다 지운 사진도 바로 다시 그림(모델은 안 다시 돌림)
export function ModeBar({ mode, onMode, product, onProduct, sticker, onSticker }: ModeBarProps) {
  const lang = useLang();
  const ko = lang === 'ko';
  const custom = !BGS.some(b => b.c === product.bg);
  const [picking, setPicking] = useState(false);   // 바탕색 고르기 창
  const pad = Math.round(product.pad * 100);
  const fillRow = (on: boolean, set: (v: boolean) => void) => (
    <div className="opt">
      <span className="opt-k"><T ko="속 채우기" en="Solid fill" /></span>
      <span className="opt-hint"><T ko="반투명한 속을 불투명하게" en="Make see-through insides solid" /></span>
      <Switch on={on} onChange={set} label={ko ? '속 채우기' : 'Solid fill'} />
    </div>
  );

  return (
    <div className="modes">
      <div className="mode-tabs" role="tablist" aria-label={ko ? '만들기' : 'Output'}>
        {([['cut', '배경 지우기', 'Remove BG'], ['product', '상품 사진', 'Product'], ['sticker', '스티커', 'Sticker']] as const).map(([m, k, e]) => (
          <button key={m} type="button" role="tab" aria-selected={mode === m} data-on={mode === m} onClick={() => onMode(m)}>
            <T ko={k} en={e} />
          </button>
        ))}
      </div>

      {mode === 'product' && (
        <div className="opts">
          <div className="opt opt-col">
            <span className="opt-k"><T ko="바탕" en="Background" /></span>
            <div className="bg-tiles" role="radiogroup" aria-label={ko ? '바탕색' : 'Background color'}>
              {BGS.map(b => (
                <button key={b.c} type="button" role="radio" aria-checked={product.bg === b.c} className="bg-tile" data-on={product.bg === b.c}
                  onClick={() => onProduct({ ...product, bg: b.c })}>
                  <i style={{ background: b.c }} />
                  <span>{ko ? b.ko : b.en}</span>
                </button>
              ))}
              <button type="button" role="radio" aria-checked={custom} className="bg-tile" data-on={custom}
                onClick={() => { if (!custom) onProduct({ ...product, bg: '#f6f1e7' }); setPicking(true); }}>
                <i className="bg-pick" style={custom ? { background: product.bg, borderStyle: 'solid' } : undefined}>
                  {!custom && <IconPlus size={14} />}
                </i>
                <span className={custom ? 'num' : undefined}>{custom ? product.bg.toUpperCase() : ko ? '직접' : 'Custom'}</span>
              </button>
            </div>
          </div>
          <div className="opt">
            <span className="opt-k"><T ko="여백" en="Padding" /></span>
            <Ruler value={pad} min={0} max={30} step={1} unit="%" onChange={(v) => onProduct({ ...product, pad: v / 100 })} label={ko ? '여백(한 변의 %)' : 'Padding (% of the side)'} />
            <span className="opt-u">%</span>
          </div>
          <div className="opt">
            <span className="opt-k"><T ko="크기" en="Size" /></span>
            <Seg label={ko ? '크기' : 'Size'} value={product.size} onPick={(v) => onProduct({ ...product, size: v })}
              items={PRODUCT_SIZES.map(z => ({ v: z, node: <span className="num">{z}</span> }))} />
          </div>
          {fillRow(product.fill, (v) => onProduct({ ...product, fill: v }))}
          {picking && <ColorSheet value={product.bg} onChange={(c) => onProduct({ ...product, bg: c })} onClose={() => setPicking(false)} />}
        </div>
      )}

      {mode === 'sticker' && (
        <div className="opts">
          <div className="opt">
            <span className="opt-k"><T ko="테두리" en="Outline" /></span>
            <Ruler value={Math.round(sticker.outline * 1000) / 10} min={0} max={OUTLINE_MAX} step={0.1} unit="%" onChange={(v) => onSticker({ ...sticker, outline: Math.round(v * 10) / 1000 })}
              label={ko ? '흰 테두리(한 변의 %, 0이면 없음)' : 'White outline (% of the side, 0 = none)'} />
            <span className="opt-u">%</span>
          </div>
          <div className="opt">
            <span className="opt-k"><T ko="크기" en="Size" /></span>
            <div className="sel">
              <select value={sticker.size} onChange={(e) => onSticker({ ...sticker, size: Number(e.target.value) })}
                aria-label={ko ? '스티커 크기' : 'Sticker size'}>
                {STICKER_SIZES.map(z => <option key={z.size} value={z.size}>{ko ? z.ko : z.en} × {z.size}</option>)}
              </select>
            </div>
          </div>
          {fillRow(sticker.fill, (v) => onSticker({ ...sticker, fill: v }))}
        </div>
      )}
    </div>
  );
}
