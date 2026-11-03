import { IconDown } from './Icons';
import { T } from './T';

interface ControlRowProps {
  selectedCount: number;
  isDownloading: boolean;
  onDownloadZip: () => void;
  onDownloadIndividual: () => void;
  onClear: () => void;
}

export function ControlRow({
  selectedCount,
  isDownloading,
  onDownloadZip,
  onDownloadIndividual,
  onClear,
}: ControlRowProps) {
  const disabled = selectedCount === 0 || isDownloading;
  const count = <span className="num"> ({selectedCount})</span>;

  return (
    <div className="actions">
      <button type="button" className="btn btn-main" onClick={onDownloadZip} disabled={disabled}>
        <IconDown size={18} />
        {isDownloading ? <T ko="묶는 중…" en="Zipping…" /> : <><T ko="ZIP 받기" en="ZIP" />{count}</>}
      </button>
      <button type="button" className="btn" onClick={onDownloadIndividual} disabled={disabled}>
        {isDownloading ? <T ko="저장 중…" en="Saving…" /> : <><T ko="낱장 받기" en="Files" />{count}</>}
      </button>
      <button type="button" className="btn btn-ghost" onClick={onClear}>
        <T ko="비우기" en="Clear" />
      </button>
    </div>
  );
}
