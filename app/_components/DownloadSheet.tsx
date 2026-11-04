"use client";

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { Mode } from '../_lib/post';
import { DL_SIDES, DL_TARGETS, type DlFormat, type DlOpts, type DlSize } from '../_lib/shrink';
import { useLang } from '../_lib/lang';
import { Seg, Switch } from './Controls';
import { T } from './T';

type Estimate = (onStep: (done: number, total: number, before: number, after: number) => void, alive: () => boolean) => Promise<void>;

const mb = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1e3))} KB`);
const FORMATS: { v: DlFormat; ko: string; en: string }[] = [
  { v: 'auto', ko: '그대로', en: 'Same' }, { v: 'png', ko: 'PNG', en: 'PNG' }, { v: 'webp', ko: 'WebP', en: 'WebP' }, { v: 'jpg', ko: 'JPG', en: 'JPG' },
];

// 받기 설정 한 줄 요약: 형식 · 크기 · 용량 · 사진 정보
export function dlSummary(o: DlOpts, mode: Mode, ko: boolean) {
  const f = FORMATS.find(x => x.v === o.format)!;
  const size = mode === 'product' ? null : o.side ? `${ko ? '긴 변' : 'long'} ${o.side}` : ko ? '원본' : 'original';
  const amount = o.size === 'quality' ? `${ko ? '품질' : 'q'} ${Math.round(o.quality * 100)}` : o.size === 'target' ? `≤ ${mb(o.target)}` : null;
  return [ko ? f.ko : f.en, size, amount, o.strip ? (ko ? '위치 정보 지움' : 'no location') : (ko ? '사진 정보 남김' : 'keep info')].filter(Boolean).join(' · ');
}

interface SheetProps {
  mode: Mode;
  value: DlOpts;
  onChange: (o: DlOpts) => void;
  count: number;
  rev: string;          // 고른 사진·만들기 설정이 바뀌면 다시 셈
  estimate: Estimate;
  onZip: () => void;
  onFiles: () => void;
  busy: boolean;
  onClose: () => void;
}

// 받기 설정(아래에서 올라오는 시트 · PC는 옆 칸 위): 형식 · 크기(긴 변, 상품 사진은 상품 사진 크기를 따름) · 용량 · 사진 정보
// 바꾸면 고른 사진의 전·후 용량을 다시 셈(캔버스 워커에서 한 장씩) — 다 센 것은 받을 때 그대로 씀
export function DownloadSheet({ mode, value: o, onChange, count, rev, estimate, onZip, onFiles, busy, onClose }: SheetProps) {
  const ko = useLang() === 'ko';
  const set = (p: Partial<DlOpts>) => onChange({ ...o, ...p });
  const [sum, setSum] = useState<{ done: number; total: number; before: number; after: number } | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const customSide = o.side !== 0 && !DL_SIDES.includes(o.side);
  const customTarget = !DL_TARGETS.includes(o.target);
  const pngOnly = o.format === 'png' || (o.format === 'auto' && mode === 'cut');
  const key = JSON.stringify(o) + rev;

  useEffect(() => {
    let alive = true;
    const t = setTimeout(() => {
      estimate((done, total, before, after) => setSum({ done, total, before, after }), () => alive).catch(() => {});
    }, 250);
    return () => { alive = false; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    boxRef.current?.focus();
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);

  const fresh = sum && sum.total === count;
  const pct = fresh && sum.before > 0 ? Math.round((1 - sum.after / sum.before) * 100) : 0;

  return (
    <div className="cs-back" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="cs dl" role="dialog" aria-modal="true" aria-label={ko ? '받기 설정' : 'Download settings'} tabIndex={-1} ref={boxRef}>
        <div className="cs-head">
          <strong><T ko="받기 설정" en="Download settings" /></strong>
          <button type="button" className="cs-x" onClick={onClose} aria-label={ko ? '닫기' : 'Close'}>
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
          </button>
        </div>

        <div className="dl-opts">
          <div className="opt">
            <span className="opt-k"><T ko="형식" en="Format" /></span>
            <Seg label={ko ? '형식' : 'Format'} value={o.format} onPick={(v) => set({ format: v })}
              items={FORMATS.map(f => ({ v: f.v, node: ko ? f.ko : f.en }))} />
          </div>
          {o.format === 'jpg' && mode === 'cut' && <p className="dl-note"><T ko="JPG는 투명이 없어서 투명한 곳을 흰색으로 채워요" en="JPG has no transparency — transparent areas become white" /></p>}

          {mode !== 'product' && (
            <div className="opt">
              <span className="opt-k"><T ko="크기" en="Size" /></span>
              <Seg label={ko ? '크기(긴 변)' : 'Size (long side)'} value={customSide ? -1 : o.side} onPick={(v) => set({ side: v === -1 ? (customSide ? o.side : 1600) : v })}
                items={[...DL_SIDES.map(z => ({ v: z, node: z ? <span className="num">{z}</span> : <T ko="원본" en="Original" /> })), { v: -1, node: <T ko="직접" en="Custom" /> }]} />
            </div>
          )}
          {mode !== 'product' && customSide && (
            <div className="opt">
              <span className="opt-k" />
              <label className="dl-num"><input type="number" inputMode="numeric" min={64} max={8192} step={10} value={o.side}
                onChange={(e) => { const v = Math.round(Number(e.target.value)); if (v >= 64 && v <= 8192) set({ side: v }); }}
                aria-label={ko ? '긴 변 px' : 'Long side in px'} /><span>px</span></label>
              <span className="opt-hint"><T ko="긴 변 · 원본보다 크게는 안 늘려요" en="Long side · never upscaled" /></span>
            </div>
          )}

          <div className="opt">
            <span className="opt-k"><T ko="용량" en="File size" /></span>
            <Seg<DlSize> label={ko ? '용량' : 'File size'} value={o.size} onPick={(v) => set({ size: v })}
              items={[{ v: 'keep', node: <T ko="그대로" en="Same" /> }, { v: 'quality', node: <T ko="품질" en="Quality" /> }, { v: 'target', node: <T ko="목표 용량" en="Target" /> }]} />
          </div>
          {o.size === 'quality' && (pngOnly
            ? <p className="dl-note"><T ko="PNG는 화질이 그대로라 품질이 없어요 — 줄이려면 WebP·JPG나 목표 용량(256색)" en="PNG is lossless — use WebP/JPG or a target size (256 colors)" /></p>
            : (
              <div className="opt">
                <span className="opt-k" />
                <input className="rng" type="range" min="50" max="100" step="1" value={Math.round(o.quality * 100)}
                  style={{ '--p': `${((o.quality * 100 - 50) / 50) * 100}%` } as CSSProperties}
                  onChange={(e) => set({ quality: Number(e.target.value) / 100 })} aria-label={ko ? '품질' : 'Quality'} />
                <span className="opt-v num">{Math.round(o.quality * 100)}</span>
              </div>
            ))}
          {o.size === 'target' && (
            <div className="opt">
              <span className="opt-k" />
              <Seg label={ko ? '목표 용량' : 'Target size'} value={customTarget ? -1 : o.target} onPick={(v) => set({ target: v === -1 ? (customTarget ? o.target : 300_000) : v })}
                items={[...DL_TARGETS.map(z => ({ v: z, node: <span className="num">{mb(z)}</span> })), { v: -1, node: <T ko="직접" en="Custom" /> }]} />
            </div>
          )}
          {o.size === 'target' && customTarget && (
            <div className="opt">
              <span className="opt-k" />
              <label className="dl-num"><input type="number" inputMode="numeric" min={20} max={50000} step={10} value={Math.round(o.target / 1000)}
                onChange={(e) => { const v = Math.round(Number(e.target.value)); if (v >= 20 && v <= 50000) set({ target: v * 1000 }); }}
                aria-label={ko ? '목표 용량 KB' : 'Target size in KB'} /><span>KB</span></label>
              <span className="opt-hint"><T ko="한 장마다" en="per image" /></span>
            </div>
          )}

          <div className="opt">
            <span className="opt-k"><T ko="위치 정보" en="Location" /></span>
            <span className="opt-hint"><T ko={o.strip ? '찍은 곳·기기·시각 정보 지우기' : '원본 사진 정보 남기기(JPG로 받을 때)'} en={o.strip ? 'Remove place, device and time info' : 'Keep original photo info (JPG)'} /></span>
            <Switch on={o.strip} onChange={(v) => set({ strip: v })} label={ko ? '위치 정보 지우기' : 'Remove location info'} />
          </div>
        </div>

        <div className="dl-sum" aria-live="polite">
          {count === 0 ? <span><T ko="받을 사진을 골라 주세요" en="Select images to download" /></span>
            : fresh ? (
              <>
                <span><span className="num">{count}</span><T ko="장" en=" images" /> · <span className="num">{mb(sum.before)}</span> →</span>
                <b className="num">{sum.done < sum.total ? '…' : mb(sum.after)}</b>
                {sum.done < sum.total
                  ? <span className="num dl-pct">{sum.done}/{sum.total}</span>
                  : <span className="num dl-pct" data-up={pct < 0}>{pct >= 0 ? `−${pct}%` : `+${-pct}%`}</span>}
              </>
            ) : <span><T ko="용량 세는 중…" en="Measuring…" /></span>}
        </div>

        <div className="cs-foot">
          <button type="button" className="btn btn-ghost dl-files" onClick={onFiles} disabled={count === 0 || busy}><T ko="낱장" en="Files" /></button>
          <button type="button" className="btn btn-main dl-zip" onClick={onZip} disabled={count === 0 || busy}>
            {busy ? <T ko="묶는 중…" en="Zipping…" /> : <><T ko="ZIP으로 받기" en="Download ZIP" /> <span className="num">({count})</span></>}
          </button>
        </div>
      </div>
    </div>
  );
}
