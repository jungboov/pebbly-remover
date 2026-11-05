"use client";

import { useEffect, useRef, useState } from 'react';
import { SIZES, type CutItem, type CutSheet } from '../_hooks/useCutSheet';
import type { Format, Preset } from '../_lib/cutExport';
import type { Paper } from '../_lib/sheet';
import { useLang } from '../_lib/lang';
import { Seg, Switch } from './Controls';
import { IconPlus } from './Icons';
import { Ruler } from './Ruler';
import { StickerPreview } from './CutView';
import { T } from './T';

const GAP_MIN = 0.5, GAP_MAX = 10;   // 칼선 간격 mm(그림에서 칼선까지)
const m =(mm: number) => `${(mm / 1000).toFixed(2)} m`;

// 그림 하나(썸네일): 개수 · 준비 중 · 배경 지우는 중 · 오류
function Badge({ it, full }: { it: CutItem; full: boolean }) {
  if (it.status === 'prep') return <span className="th-pct num">…</span>;
  if (it.status === 'removing') return <span className="th-pct num">{it.progress ?? 0}%</span>;
  if (it.status === 'error') return <span className="th-err">!</span>;
  return full ? null : <span className="th-count num">{it.count}</span>;
}

// 칼선 탭 옆 칸: (PC) 그림 목록 · (폰) 썸네일 줄 · 시트 설정 · 길이 · 받기
export function CutList({ cut, onPick, onAdd }: { cut: CutSheet; onPick: (id: string) => void; onAdd: () => void }) {
  const ko = useLang() === 'ko';
  return (
    <div className="cut-list">
      {cut.items.map(it => (
        <button type="button" key={it.id} className="cl-item" onClick={() => onPick(it.id)} data-state={it.status}>
          <i className="cl-th">{it.preview && <img src={it.preview} alt="" />}</i>
          <span className="cl-name">{it.name.replace(/\.[^/.]+$/, '')}
            <small className="num">
              {it.status === 'prep' ? (ko ? '준비 중…' : 'Preparing…')
                : it.status === 'removing' ? `${ko ? '배경 지우는 중' : 'Removing'} ${it.progress ?? 0}%`
                : it.status === 'error' ? (ko ? '열지 못했어요' : "Couldn't open")
                : `${it.size} mm${cut.settings.full ? '' : ` · ×${it.count}`}${it.kind === 'photo' ? (ko ? ' · 사진' : ' · photo') : ''}`}
            </small>
          </span>
        </button>
      ))}
      <button type="button" className="cl-add" onClick={onAdd}><IconPlus size={16} /><T ko="PNG·사진 넣기" en="Add PNG or photo" /></button>
    </div>
  );
}

export function CutSide({ cut, onPick, onAdd, onPrint }: { cut: CutSheet; onPick: (id: string) => void; onAdd: () => void; onPrint: () => void }) {
  const ko = useLang() === 'ko';
  const s = cut.settings;
  return (
    <div className="side cut-side">
      <div className="thumbs cut-strip">
        <button type="button" onClick={onAdd} aria-label={ko ? '그림 더하기' : 'Add images'} className="thumb thumb-add"><IconPlus size={22} /></button>
        {cut.items.map(it => (
          <button type="button" key={it.id} className="thumb cut-th" onClick={() => onPick(it.id)} aria-label={it.name} data-state={it.status}>
            {it.preview && <img src={it.preview} alt="" />}
            <Badge it={it} full={s.full} />
          </button>
        ))}
      </div>
      {cut.items.length > 0 && cut.importable.length > 0 && (
        <button type="button" className="cv-import cv-import-row" onClick={cut.importFromRemover}>
          <T ko={<>지운 사진 <span className="num">{cut.importable.length}</span>장 가져오기</>} en={<>Bring <span className="num">{cut.importable.length}</span> cutout{cut.importable.length > 1 ? 's' : ''}</>} />
        </button>
      )}

      <div className="opts">
        <div className="opt">
          <span className="opt-k"><T ko="칼선 간격" en="Offset" /></span>
          {/* 줄자: 밀면 가운데 숫자가, 숫자를 치면 눈금이 따라옴(값은 s.gap 하나) */}
          <Ruler value={s.gap} min={GAP_MIN} max={GAP_MAX} step={0.1} unit="mm" onChange={(v) => cut.set({ gap: v })} label={ko ? '칼선 간격(그림에서 칼선까지)' : 'Offset from the art to the cut line'} />
          <span className="opt-u">mm</span>
        </div>
        <div className="opt">
          <span className="opt-k"><T ko="종이" en="Paper" /></span>
          <Seg<Paper> label={ko ? '종이' : 'Paper'} value={s.paper} onPick={(v) => cut.set({ paper: v })}
            items={[{ v: 'a4', node: 'A4' }, { v: 'a5', node: 'A5' }, { v: 'letter', node: 'Letter' }]} />
        </div>
        <div className="opt">
          <span className="opt-k"><T ko="채우기" en="Fill" /></span>
          <Seg label={ko ? '채우기' : 'Fill'} value={s.full ? 1 : 0} onPick={(v) => cut.set({ full: v === 1 })}
            items={[{ v: 0, node: <T ko="개수대로" en="By count" /> }, { v: 1, node: <T ko="한 장 가득" en="Fill a sheet" /> }]} />
        </div>
        <div className="opt">
          <span className="opt-k"><T ko="바깥 완칼" en="Die cut" /></span>
          <span className="opt-hint"><T ko="시트 둘레 둥근 선(종이 4mm 안쪽)" en="Rounded line 4 mm inside the paper" /></span>
          <Switch on={s.die} onChange={(v) => cut.set({ die: v })} label={ko ? '바깥 완칼' : 'Die cut around the sheet'} />
        </div>
      </div>

      <div className="cut-info">
        {cut.placed > 0 ? (
          <>
            <span><T ko="시트" en="Sheets" /> <b className="num">{cut.sheet.pages.length}</b> · <T ko="스티커" en="stickers" /> <b className="num">{cut.placed}</b></span>
            <span><T ko="반칼" en="Kiss" /> <b className="num">{m(cut.kissMm)}</b>{s.die && <> · <T ko="완칼" en="die" /> <b className="num">{m(cut.dieMm)}</b></>}</span>
          </>
        ) : <span><T ko="칼선끼리 5mm, 완칼에서 4mm 안쪽에 앉혀요" en="5 mm between cut lines, 4 mm inside the sheet cut" /></span>}
      </div>

      <div className="actions cut-acts">
        <button type="button" className="btn btn-main" onClick={onPrint} disabled={cut.placed === 0 && !(s.format === 'png' && cut.ready.length > 0)}>
          <T ko="인쇄 파일 받기" en="Print files" /><span aria-hidden="true">›</span>
        </button>
        <button type="button" className="btn btn-ghost" onClick={cut.clear}><T ko="비우기" en="Clear" /></button>
      </div>
    </div>
  );
}

// mm 숫자 칸: 치는 동안은 글자 그대로 두고 범위 안의 값이면 바로 반영, 다 치면(칸을 떠나거나 엔터) 범위 밖 값은 끝값으로
function MmInput({ value, min, max, step, onChange, label }: { value: number; min: number; max: number; step: number; onChange: (v: number) => void; label: string }) {
  const [txt, setTxt] = useState<string | null>(null);
  const r = (v: number) => Math.round(v * 10) / 10;
  return (
    <label className="dl-num"><input type="number" inputMode="decimal" min={min} max={max} step={step} value={txt ?? String(value)} aria-label={label}
      onChange={(e) => { const t = e.target.value, v = Number(t); setTxt(t); if (t.trim() && v >= min && v <= max) onChange(r(v)); }}
      onBlur={() => { const v = Number(txt); if (txt?.trim() && Number.isFinite(v)) onChange(r(Math.min(max, Math.max(min, v)))); setTxt(null); }}
      onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} /><span>mm</span></label>
  );
}

function useSheetKeys(onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus();
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);
  return ref;
}

// 그림 하나 설정(아래에서 올라오는 창): 미리보기 · 개수 · 크기 · 구멍 메우기 · (사진이면) 배경 지우기 · 빼기
export function CutItemSheet({ cut, id, onClose }: { cut: CutSheet; id: string; onClose: () => void }) {
  const ko = useLang() === 'ko';
  const ref = useSheetKeys(onClose);
  const it = cut.items.find(i => i.id === id);
  if (!it) return null;
  const custom = !SIZES.includes(it.size);
  return (
    <div className="cs-back" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="cs dl cut-item" role="dialog" aria-modal="true" aria-label={it.name} tabIndex={-1} ref={ref}>
        <div className="cs-head">
          <strong className="ci-name">{it.name.replace(/\.[^/.]+$/, '')}</strong>
          <button type="button" className="cs-x" onClick={onClose} aria-label={ko ? '닫기' : 'Close'}>
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
          </button>
        </div>
        <StickerPreview cut={cut} id={id} />
        {it.kind === 'photo' && (it.status === 'removing'
          ? <div className="ci-chip"><T ko={<>배경 지우는 중 <span className="num">{it.progress ?? 0}%</span></>} en={<>Removing background <span className="num">{it.progress ?? 0}%</span></>} /></div>
          : <div className="ci-chip"><span><T ko="배경이 있는 사진이라 네모로 잘라요" en="A photo with a background — cut as a rounded square" /></span>
              <button type="button" onClick={() => cut.removeBg(id)}><T ko="배경 지우기" en="Remove background" /></button></div>)}
        <div className="dl-opts">
          <div className="opt">
            <span className="opt-k"><T ko="개수" en="Count" /></span>
            <span className="opt-hint">{cut.settings.full ? <T ko="한 장 가득이라 개수는 안 써요" en="Ignored while filling a sheet" /> : <T ko="시트에 몇 장" en="How many on the sheet" />}</span>
            <span className="stepper" aria-disabled={cut.settings.full}>
              <button type="button" onClick={() => cut.update(id, { count: Math.max(0, it.count - 1) })} disabled={cut.settings.full || it.count <= 0} aria-label={ko ? '하나 빼기' : 'One less'}>−</button>
              <b className="num">{it.count}</b>
              <button type="button" onClick={() => cut.update(id, { count: Math.min(99, it.count + 1) })} disabled={cut.settings.full} aria-label={ko ? '하나 더' : 'One more'}>+</button>
            </span>
          </div>
          <div className="opt">
            <span className="opt-k"><T ko="크기" en="Size" /></span>
            <Seg label={ko ? '크기(긴 변)' : 'Size (long side)'} value={custom ? -1 : it.size} onPick={(v) => cut.update(id, { size: v === -1 ? (custom ? it.size : 40) : v })}
              items={[...SIZES.map(z => ({ v: z, node: <span className="num">{z}</span> })), { v: -1, node: <T ko="직접" en="Custom" /> }]} />
            <span className="opt-u">mm</span>
          </div>
          {custom && (
            <div className="opt">
              <span className="opt-k" />
              <MmInput value={it.size} min={10} max={190} step={1} onChange={(v) => cut.update(id, { size: Math.round(v) })} label={ko ? '긴 변 mm' : 'Long side in mm'} />
              <span className="opt-hint"><T ko="스티커 긴 변(칼선까지)" en="Long side, to the cut line" /></span>
            </div>
          )}
          <div className="opt">
            <span className="opt-k"><T ko="구멍" en="Holes" /></span>
            <span className="opt-hint"><T ko="그림 속 빈 곳은 메워서 안 잘라요" en="Fill inner holes instead of cutting them" /></span>
            <Switch on={it.holes} onChange={(v) => cut.update(id, { holes: v })} label={ko ? '구멍 메우기' : 'Fill holes'} />
          </div>
        </div>
        <div className="cs-foot">
          <button type="button" className="btn btn-ghost dl-files" onClick={() => { cut.removeItem(id); onClose(); }}><T ko="빼기" en="Remove" /></button>
          <button type="button" className="btn btn-main dl-zip" onClick={onClose}><T ko="다 됐어요" en="Done" /></button>
        </div>
      </div>
    </div>
  );
}

const FORMATS: { v: Format; label: string }[] = [{ v: 'pdf', label: 'PDF' }, { v: 'svg', label: 'SVG' }, { v: 'dxf', label: 'DXF' }, { v: 'png', label: 'PNG' }];

// 인쇄 파일(아래에서 올라오는 창): 형식 · 칼선 틀 · 나눠 받기 · 요약 · 받기
export function PrintSheet({ cut, onClose }: { cut: CutSheet; onClose: () => void }) {
  const ko = useLang() === 'ko';
  const ref = useSheetKeys(onClose);
  const s = cut.settings, f = s.format;
  const label = FORMATS.find(x => x.v === f)!.label;
  return (
    <div className="cs-back" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="cs dl" role="dialog" aria-modal="true" aria-label={ko ? '인쇄 파일' : 'Print files'} tabIndex={-1} ref={ref}>
        <div className="cs-head">
          <strong><T ko="인쇄 파일" en="Print files" /></strong>
          <button type="button" className="cs-x" onClick={onClose} aria-label={ko ? '닫기' : 'Close'}>
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
          </button>
        </div>
        <div className="dl-opts">
          <div className="opt">
            <span className="opt-k"><T ko="형식" en="Format" /></span>
            <Seg<Format> label={ko ? '형식' : 'Format'} value={f} onPick={(v) => cut.set({ format: v })} items={FORMATS.map(x => ({ v: x.v, node: x.label }))} />
          </div>
          <p className="dl-note">
            {f === 'pdf' ? <T ko="인쇄소용 — 그림 · 반칼 · 완칼이 다른 층, 그림은 300dpi" en="For print shops — art, kiss cut and sheet cut on separate layers, art at 300 dpi" />
              : f === 'svg' ? <T ko="크리컷·잉크스케이프용 — mm 크기 그대로, 그림은 안에 넣음" en="For Cricut and Inkscape — real mm size, art embedded" />
              : f === 'dxf' ? <T ko="실루엣 무료판용 — 칼선 DXF + 같은 크기 시트 PNG(300dpi). 열 때 '있는 그대로'로" en="For Silhouette Basic — cut-line DXF plus a same-size sheet PNG (300 dpi). Import 'as is'" />
              : <T ko="크리컷 사진 올리기용 — 흰 테두리까지 그린 스티커 낱장(300dpi), 바깥 가장자리를 따라 잘라요" en="For Cricut upload — one PNG per sticker with the white border (300 dpi); it cuts along the outer edge" />}
          </p>
          {(f === 'pdf' || f === 'svg') && (
            <>
              <div className="opt">
                <span className="opt-k"><T ko="칼선 틀" en="Cut style" /></span>
                <Seg<Preset> label={ko ? '칼선 틀' : 'Cut line style'} value={s.preset} onPick={(v) => cut.set({ preset: v })}
                  items={[{ v: 'cutcontour', node: 'CutContour' }, { v: 'm100', node: 'M100' }, { v: 'k100', node: 'K100' }]} />
              </div>
              <p className="dl-note">
                {s.preset === 'cutcontour' ? <T ko="별색 CutContour 0.25pt · 겹쳐찍기(완칼은 별색 DieCut)" en="Spot color CutContour 0.25 pt, overprint (sheet cut: DieCut)" />
                  : s.preset === 'm100' ? <T ko="M100 선 0.5pt — 와우프레스 등 국내 인쇄소" en="M100 line 0.5 pt — common at Korean print shops" />
                  : <T ko="K100 선 0.5pt — 애즈랜드 등" en="K100 line 0.5 pt" />}
              </p>
            </>
          )}
          {(f === 'svg' || f === 'dxf') && (
            <div className="opt">
              <span className="opt-k"><T ko="나눠 받기" en="Split" /></span>
              <span className="opt-hint"><T ko="그림 · 반칼 · 완칼을 파일 따로(커팅기는 칼 깊이가 하나)" en="Art, kiss and sheet cut as separate files" /></span>
              <Switch on={s.split} onChange={(v) => cut.set({ split: v })} label={ko ? '나눠 받기' : 'Split files'} />
            </div>
          )}
        </div>
        <div className="dl-sum" aria-live="polite">
          {f === 'png'
            ? <span><T ko="스티커" en="Stickers" /> <b className="num">{cut.ready.length}</b><T ko="장 · 낱장 PNG 300dpi" en=" · one PNG each, 300 dpi" /></span>
            : <span>{s.paper === 'letter' ? 'Letter' : s.paper.toUpperCase()} <b className="num">{cut.sheet.pages.length}</b><T ko="장" en=" sheets" /> · <T ko="스티커" en="stickers" /> <b className="num">{cut.placed}</b> · <T ko="반칼" en="kiss" /> <span className="num">{m(cut.kissMm)}</span></span>}
        </div>
        <div className="cs-foot">
          <button type="button" className="btn btn-main dl-zip" onClick={cut.download} disabled={cut.busy || cut.waiting > 0 || (f === 'png' ? cut.ready.length === 0 : cut.placed === 0)}>
            {cut.busy ? <T ko="만드는 중…" en="Building…" /> : cut.waiting > 0 ? <T ko="칼선 계산 중…" en="Tracing…" /> : <T ko={`${label} 받기`} en={`Download ${label}`} />}
          </button>
        </div>
      </div>
    </div>
  );
}
