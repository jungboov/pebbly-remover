"use client";

import type { BatchItem } from '../_hooks/useBatchProcessor';
import { useLang } from '../_lib/lang';
import { IconCheck, IconPlus } from './Icons';
import { T } from './T';

interface ThumbnailStripProps {
  items: BatchItem[];
  selectedIndex: number | null;
  selectedIds: Set<string>;
  onSelect: (idx: number, id: string) => void;
  onAdd: () => void;
  selectedCount: number;
  completedCount: number;
  allCompletedSelected: boolean;
  onSelectAll: () => void;
  onDeselectAll: () => void;
}

// 썸네일: 누르면 크게 보고, 다 된 것은 받을 목록에 넣고 빼기(체크)
export function ThumbnailStrip({
  items,
  selectedIndex,
  selectedIds,
  onSelect,
  onAdd,
  selectedCount,
  completedCount,
  allCompletedSelected,
  onSelectAll,
  onDeselectAll,
}: ThumbnailStripProps) {
  const lang = useLang();

  return (
    <div className="strip">
      <div className="strip-bar">
        <span>
          <T ko="이미지" en="Images" /> <span className="num">{items.length}</span>
          {completedCount > 0 && (
            <span className="strip-sel"> · <T ko="선택" en="selected" /> <span className="num">{selectedCount}/{completedCount}</span></span>
          )}
        </span>
        {completedCount > 0 && (
          <button type="button" onClick={allCompletedSelected ? onDeselectAll : onSelectAll}>
            {allCompletedSelected ? <T ko="선택 해제" en="Deselect all" /> : <T ko="모두 선택" en="Select all" />}
          </button>
        )}
      </div>

      <div className="thumbs">
        <button
          type="button"
          onClick={onAdd}
          aria-label={lang === 'ko' ? '이미지 더하기' : 'Add images'}
          className="thumb thumb-add"
        >
          <IconPlus size={22} />
        </button>
        {items.map((item, idx) => {
          const isViewerActive = selectedIndex === idx;
          const isSelected = selectedIds.has(item.id);
          const isCompleted = item.status === 'completed';

          return (
            <div
              key={item.id}
              onClick={() => onSelect(idx, item.id)}
              role={isCompleted ? 'checkbox' : undefined}
              aria-checked={isCompleted ? isSelected : undefined}
              aria-label={item.fileName}
              data-state={item.status}
              data-sel={isCompleted && isSelected}
              data-view={isViewerActive}
              className="thumb"
            >
              <img src={item.original} alt="" />

              {isViewerActive && <span className="th-view" aria-label={lang === 'ko' ? '보는 중' : 'Currently viewing'} />}

              {isCompleted && isSelected && <span className="th-check"><IconCheck size={12} /></span>}

              {item.status === 'processing' && (
                <>
                  <span className="th-pct num">{item.progress}%</span>
                  <span className="th-bar"><i style={{ width: `${item.progress}%` }} /></span>
                </>
              )}

              {item.status === 'error' && <span className="th-err">!</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
