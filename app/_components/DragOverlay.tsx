import { T } from './T';

// 끌어 오는 동안 화면 전체에 점선 테두리
export function DragOverlay({ isDragging, cut = false }: { isDragging: boolean; cut?: boolean }) {
  return (
    <div className="drop" data-on={isDragging} aria-hidden={!isDragging}>
      <div className="drop-msg">
        {cut ? <T ko="놓으면 칼선을 그려요" en="Drop to add cut lines" /> : <T ko="놓으면 바로 배경을 지워요" en="Drop to remove backgrounds" />}
      </div>
    </div>
  );
}
