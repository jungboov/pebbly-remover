"use client";

import type { Mode, ProductOpts, StickerOpts } from '../_lib/post';
import { OUTLINES, PRODUCT_SIZES, STICKER_SIZES } from '../_lib/post';
import { useLang } from '../_lib/lang';
import { T } from './T';

interface ModeBarProps {
  mode: Mode;
  onMode: (m: Mode) => void;
  product: ProductOpts;
  onProduct: (o: ProductOpts) => void;
  sticker: StickerOpts;
  onSticker: (o: StickerOpts) => void;
}

const BGS = ['#ffffff', '#f2f2f2', '#000000'];

// 만들기: 지우기(투명 PNG) · 상품 사진(고른 색 · 정사각형 · 같은 여백, JPEG) · 스티커(흰 테두리 · 카톡 규격, 투명 PNG)
// 바꾸면 다 지운 사진도 바로 다시 그림(모델은 안 다시 돌림)
export function ModeBar({ mode, onMode, product, onProduct, sticker, onSticker }: ModeBarProps) {
  const lang = useLang();
  const tab = (m: Mode, ko: string, en: string) => (
    <button type="button" role="tab" aria-selected={mode === m} data-on={mode === m} onClick={() => onMode(m)}>
      <T ko={ko} en={en} />
    </button>
  );

  return (
    <div className="modes">
      <div className="mode-tabs" role="tablist" aria-label={lang === 'ko' ? '만들기' : 'Output'}>
        {tab('cut', '배경 지우기', 'Remove BG')}
        {tab('product', '상품 사진', 'Product')}
        {tab('sticker', '스티커', 'Sticker')}
      </div>

      {mode === 'product' && (
        <div className="opts">
          <div className="opt">
            <span className="opt-k"><T ko="바탕" en="Background" /></span>
            <div className="swatches">
              {BGS.map(c => (
                <button key={c} type="button" className="sw" style={{ background: c }} data-on={product.bg === c}
                  onClick={() => onProduct({ ...product, bg: c })} aria-label={c} title={c} />
              ))}
              <label className="sw sw-pick" data-on={!BGS.includes(product.bg)} style={BGS.includes(product.bg) ? undefined : { background: product.bg }}
                title={lang === 'ko' ? '색 고르기' : 'Pick a color'}>
                <input type="color" value={product.bg} onChange={(e) => onProduct({ ...product, bg: e.target.value })}
                  aria-label={lang === 'ko' ? '바탕색 고르기' : 'Pick background color'} />
              </label>
            </div>
          </div>
          <div className="opt">
            <span className="opt-k"><T ko="여백" en="Padding" /></span>
            <input type="range" min="0" max="30" step="1" value={Math.round(product.pad * 100)}
              onChange={(e) => onProduct({ ...product, pad: Number(e.target.value) / 100 })}
              aria-label={lang === 'ko' ? '여백' : 'Padding'} />
            <span className="opt-v num">{Math.round(product.pad * 100)}%</span>
          </div>
          <div className="opt">
            <span className="opt-k"><T ko="크기" en="Size" /></span>
            <div className="chips">
              {PRODUCT_SIZES.map(z => (
                <button key={z} type="button" data-on={product.size === z} onClick={() => onProduct({ ...product, size: z })}>
                  <span className="num">{z}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {mode === 'sticker' && (
        <div className="opts">
          <div className="opt">
            <span className="opt-k"><T ko="테두리" en="Outline" /></span>
            <div className="chips">
              {OUTLINES.map((o, i) => (
                <button key={o} type="button" data-on={sticker.outline === o} onClick={() => onSticker({ ...sticker, outline: o })}>
                  {[<T key="0" ko="없음" en="None" />, <T key="1" ko="얇게" en="Thin" />, <T key="2" ko="보통" en="Medium" />, <T key="3" ko="두껍게" en="Thick" />][i]}
                </button>
              ))}
            </div>
          </div>
          <div className="opt">
            <span className="opt-k"><T ko="크기" en="Size" /></span>
            <select value={sticker.size} onChange={(e) => onSticker({ ...sticker, size: Number(e.target.value) })}
              aria-label={lang === 'ko' ? '스티커 크기' : 'Sticker size'}>
              {STICKER_SIZES.map(z => <option key={z.size} value={z.size}>{lang === 'ko' ? z.ko : z.en} × {z.size}</option>)}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
