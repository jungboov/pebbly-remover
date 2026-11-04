"use client";

import { useId } from 'react';
import type { CutSheet } from '../_hooks/useCutSheet';
import { roundRect, svgPath } from '../_lib/cutline';
import { DIE_IN, DIE_R, PAPERS } from '../_lib/sheet';
import { superellipse } from '../_lib/intro';
import { useLang } from '../_lib/lang';
import { IconPlus } from './Icons';
import { T } from './T';

const EMPTY_BOX = superellipse(30, 30, 2.7);

// 시트 보기: 종이(흰색) 위에 스티커 그림과 칼선(분홍) · 바깥 완칼(하늘색). 스티커를 누르면 그 그림 설정
export function CutView({ cut, page, onPage, onPick, onAdd }: { cut: CutSheet; page: number; onPage: (p: number) => void; onPick: (id: string) => void; onAdd: () => void }) {
  const ko = useLang() === 'ko';
  const uid = useId().replace(/:/g, '');
  const { items, geos, sheet, settings: s } = cut;
  const [W, H] = PAPERS[s.paper];
  const pages = sheet.pages.length, pg = sheet.pages[Math.min(page, Math.max(0, pages - 1))] ?? [];
  const ids = [...new Set(pg.map(p => p.id))];
  const byId = new Map(items.map(i => [i.id, i]));

  if (!items.length) {
    return (
      <section className="viewer">
        <button type="button" className="v-empty" onClick={onAdd}>
          <span className="v-empty-icon" aria-hidden="true">
            <svg viewBox="-33 -33 66 66"><path d={EMPTY_BOX} /></svg>
            <IconPlus size={26} />
          </span>
          <strong><T ko="그림을 끌어 놓거나 눌러서 고르세요" en="Drop images here, or click to choose" /></strong>
          <small><T ko="투명 PNG는 바로 칼선 · 사진은 네모 스티커(배경도 지울 수 있어요)" en="Transparent PNGs get a cut line right away · photos become rounded squares (or remove the background)" /></small>
        </button>
        {cut.importable.length > 0 && (
          <button type="button" className="cv-import" onClick={cut.importFromRemover}>
            <T ko={<>지운 사진 <span className="num">{cut.importable.length}</span>장 가져오기</>} en={<>Bring <span className="num">{cut.importable.length}</span> cutout{cut.importable.length > 1 ? 's' : ''}</>} />
          </button>
        )}
      </section>
    );
  }

  return (
    <section className="viewer cv">
      <div className="cv-frame">
        <svg className="cv-page" viewBox={`0 0 ${W} ${H}`} style={{ aspectRatio: `${W} / ${H}` }} role="img" aria-label={ko ? '스티커 시트 미리보기' : 'Sticker sheet preview'}>
          <defs>
            {ids.map((id, i) => <clipPath key={id} id={`${uid}c${i}`}><path clipRule="evenodd" d={svgPath(geos[id].geo.loops)} /></clipPath>)}
          </defs>
          <rect width={W} height={H} fill="#fff" />
          {pg.map((p, k) => {
            const g = geos[p.id]?.geo, it = byId.get(p.id);
            if (!g || !it) return null;
            return (
              <g key={k} transform={`translate(${p.x} ${p.y})`} className="cv-st" onClick={() => onPick(p.id)}>
                <g clipPath={`url(#${uid}c${ids.indexOf(p.id)})`}>
                  {it.preview && <image href={it.preview} x={g.art[0]} y={g.art[1]} width={g.art[2]} height={g.art[3]} preserveAspectRatio="none" />}
                </g>
                <path className="cv-cut" d={svgPath(g.loops)} />
              </g>
            );
          })}
          {s.die && pages > 0 && <path className="cv-die" d={svgPath([roundRect(DIE_IN, DIE_IN, W - 2 * DIE_IN, H - 2 * DIE_IN, DIE_R)])} />}
        </svg>
      </div>
      {cut.waiting > 0 && <span className="cv-chip cv-tl"><T ko={<>칼선 계산 중 <span className="num">{cut.waiting}</span></>} en={<>Tracing <span className="num">{cut.waiting}</span></>} /></span>}
      {sheet.tooBig.length > 0 && <span className="cv-chip cv-tl cv-warn"><T ko={<>종이보다 큰 그림 <span className="num">{sheet.tooBig.length}</span>개는 빠졌어요</>} en={<><span className="num">{sheet.tooBig.length}</span> too big for the paper</>} /></span>}
      <span className="cv-chip cv-br num">{s.paper === 'letter' ? 'Letter' : s.paper.toUpperCase()} · {pg.length}{ko ? '장' : ''}</span>
      {pages > 1 && (
        <div className="cv-pages">
          <button type="button" onClick={() => onPage(Math.max(0, page - 1))} disabled={page === 0} aria-label={ko ? '앞 시트' : 'Previous sheet'}>‹</button>
          <span className="num">{Math.min(page, pages - 1) + 1} / {pages}</span>
          <button type="button" onClick={() => onPage(Math.min(pages - 1, page + 1))} disabled={page >= pages - 1} aria-label={ko ? '다음 시트' : 'Next sheet'}>›</button>
        </div>
      )}
    </section>
  );
}

// 스티커 한 장 미리보기(그림 설정 창): 바둑판 위에 흰 테두리 + 그림 + 칼선
export function StickerPreview({ cut, id }: { cut: CutSheet; id: string }) {
  const uid = useId().replace(/:/g, '');
  const it = cut.items.find(i => i.id === id), g = cut.geos[id]?.geo;
  if (!it || !g) return <div className="ci-prev"><span className="ci-wait"><T ko="칼선 계산 중…" en="Tracing…" /></span></div>;
  const d = svgPath(g.loops), m = 3;
  return (
    <div className="ci-prev">
      <svg viewBox={`${-m} ${-m} ${g.w + 2 * m} ${g.h + 2 * m}`}>
        <defs><clipPath id={`${uid}k`}><path clipRule="evenodd" d={d} /></clipPath></defs>
        <path d={d} fill="#fff" fillRule="evenodd" />
        <g clipPath={`url(#${uid}k)`}>{it.preview && <image href={it.preview} x={g.art[0]} y={g.art[1]} width={g.art[2]} height={g.art[3]} preserveAspectRatio="none" />}</g>
        <path className="cv-cut" d={d} />
      </svg>
      <span className="cv-chip cv-br num">{g.w.toFixed(0)} × {g.h.toFixed(0)} mm</span>
    </div>
  );
}
