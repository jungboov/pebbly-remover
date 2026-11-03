"use client";

import { useState } from 'react';
import type { BatchItem } from '../_hooks/useBatchProcessor';
import type { Mode } from '../_lib/post';
import { superellipse } from '../_lib/intro';
import { useLang } from '../_lib/lang';
import { IconDown, IconPlus, IconSlide } from './Icons';
import { T } from './T';

interface ViewerProps {
  selectedItem: BatchItem | null;
  mode: Mode;
  output: string | null;   // 지금 모드의 결과(상품 사진·스티커는 다시 그린 것, 아직이면 null)
  compareSlider: number;
  onCompareChange: (v: number) => void;
  onFileInputClick: () => void;
  onDownloadCurrent: () => void;
}

// 빈 화면 상자: 앱 아이콘과 같은 초타원(n=2.7)
const EMPTY_BOX = superellipse(30, 30, 2.7);

// 비교 막대(지우기만): 막대 왼쪽은 원본, 오른쪽은 결과. 0이면 결과만 (처음엔 결과부터 보여 주고 밀어서 비교)
// 상품 사진·스티커는 틀이 원본과 달라서 비교 막대 없이 결과만 — 다시 그리는 동안은 지운 결과를 흐리게
export function Viewer({ selectedItem, mode, output, compareSlider, onCompareChange, onFileInputClick, onDownloadCurrent }: ViewerProps) {
  const lang = useLang();
  const [ratio, setRatio] = useState(1);
  const canDownloadCurrent = selectedItem?.status === 'completed' && !!selectedItem.processed;
  const s = compareSlider;
  const post = mode !== 'cut' && !!selectedItem?.processed;
  const rendering = post && !output;
  const src = post ? output ?? selectedItem!.processed! : selectedItem?.processed || selectedItem?.original;

  return (
    <section className="viewer">
      {canDownloadCurrent && (
        <button
          type="button"
          className="v-save"
          onClick={(e) => { e.stopPropagation(); onDownloadCurrent(); }}
          aria-label={lang === 'ko' ? '이 결과 받기' : 'Download this result'}
          title={lang === 'ko' ? '이 결과 받기' : 'Download this result'}
        >
          <IconDown size={20} />
        </button>
      )}

      {!selectedItem ? (
        <button type="button" className="v-empty" onClick={onFileInputClick}>
          <span className="v-empty-icon" aria-hidden="true">
            <svg viewBox="-33 -33 66 66"><path d={EMPTY_BOX} /></svg>
            <IconPlus size={26} />
          </span>
          <strong><T ko="이미지를 끌어 놓거나 눌러서 고르세요" en="Drop images here, or click to choose" /></strong>
          <small><T ko="배경은 이 기기 안에서만 지워져요 · 한 번에 10장까지" en="Removed right on your device · up to 10 at a time" /></small>
        </button>
      ) : (
        <div className="v-frame">
          <div className="v-pic" style={{ '--r': ratio } as React.CSSProperties}>
            <img
              src={src}
              className={selectedItem.status === 'processing' || rendering ? 'v-busy' : undefined}
              onLoad={(e) => {
                const im = e.currentTarget;
                if (im.naturalWidth && im.naturalHeight) setRatio(im.naturalWidth / im.naturalHeight);
              }}
              alt={lang === 'ko' ? '결과 미리보기' : 'Result preview'}
            />

            {selectedItem.processed && !post && (
              <>
                <img src={selectedItem.original} className="v-orig" style={{ clipPath: `inset(0 ${100 - s}% 0 0)` }} alt="" />
                <div className="v-line" style={{ left: `${s}%` }} aria-hidden="true">
                  <span className="v-knob"><IconSlide size={18} /></span>
                </div>
                <span className="v-tag v-tag-l" data-on={s > 12} aria-hidden="true"><T ko="원본" en="Original" /></span>
                <span className="v-tag v-tag-r" data-on={s < 88} aria-hidden="true"><T ko="결과" en="Result" /></span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={s}
                  onChange={(e) => onCompareChange(Number(e.target.value))}
                  className="v-range"
                  aria-label={lang === 'ko' ? '원본과 결과 비교' : 'Compare original and result'}
                />
              </>
            )}

            {selectedItem.status === 'processing' && (
              <div className="v-work">
                <span className="v-pct">[ {selectedItem.progress}<small>%</small> ]</span>
                <span className="v-work-label"><T ko="배경 지우는 중" en="Removing background" /></span>
              </div>
            )}

            {selectedItem.status === 'error' && (
              <div className="v-work v-err">
                <span className="v-work-label"><T ko="이 이미지는 지우지 못했어요" en="Couldn't process this image" /></span>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
