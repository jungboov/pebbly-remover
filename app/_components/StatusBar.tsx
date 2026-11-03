import { T } from './T';

interface StatusBarProps {
  modelStatus: 'idle' | 'loading' | 'ready' | 'error';
  modelProgress: number;
  modelMB: number;
  batchStatus: 'idle' | 'processing' | 'ready';
  batchStats: {
    completed: number;
    total: number;
    active: number;
    avgMs: number;
    etaMs: number;
    totalTimeMs: number;
  };
  overallPercentage: number;
  onRetryModel: () => void;
}

function formatSec(ms: number) {
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatEta(ms: number) {
  return ms <= 0 ? '—' : `~${Math.ceil(ms / 1000)}s`;
}

// 진행 줄: 로고 점선(스티치) 위를 흰 선이 채움
function Gauge({ value }: { value: number }) {
  const v = Math.max(0, Math.min(100, value));
  return <span className="gauge" aria-hidden="true"><i style={{ width: `${v}%` }} /></span>;
}

export function StatusBar({
  modelStatus,
  modelProgress,
  modelMB,
  batchStatus,
  batchStats,
  overallPercentage,
  onRetryModel,
}: StatusBarProps) {
  if (modelStatus === 'loading') {
    return (
      <div className="status" data-state="busy" aria-live="polite">
        <span className="dot" />
        <span className="st-label"><T ko="모델 준비 중" en="Loading model" /></span>
        <span className="st-dim"><span className="num">{modelProgress}%</span> · {modelMB} MB</span>
        <Gauge value={modelProgress} />
      </div>
    );
  }

  if (modelStatus === 'error') {
    return (
      <div className="status" data-state="error" aria-live="polite">
        <span className="dot" />
        <span className="st-label"><T ko="모델을 못 불러왔어요" en="Model failed to load" /></span>
        <span className="st-dim st-grow"><T ko="네트워크나 캐시 문제" en="network or cache issue" /></span>
        <button type="button" className="st-retry" onClick={onRetryModel}><T ko="다시" en="Retry" /></button>
      </div>
    );
  }

  if (batchStatus === 'idle') {
    return (
      <div className="status" data-state="idle" aria-live="polite">
        <span className="dot" />
        <span className="st-label"><T ko="대기" en="Idle" /></span>
        <span className="num st-dim">0/0</span>
        <Gauge value={0} />
        <span className="st-dim"><T ko="이미지를 넣어 주세요" en="add images" /></span>
      </div>
    );
  }

  if (batchStatus === 'processing') {
    return (
      <div className="status" data-state="busy" aria-live="polite">
        <span className="dot" />
        <span className="st-label"><T ko="지우는 중" en="Processing" /></span>
        <span className="num">{batchStats.completed}/{batchStats.total}</span>
        <Gauge value={overallPercentage} />
        <span className="num st-dim"><T ko="남은 시간" en="ETA" /> {formatEta(batchStats.etaMs)}</span>
      </div>
    );
  }

  return (
    <div className="status" data-state="done" aria-live="polite">
      <span className="dot" />
      <span className="st-label"><T ko="완료" en="Done" /></span>
      <span className="num">{batchStats.completed}/{batchStats.total}</span>
      <Gauge value={100} />
      <span className="num st-dim">{batchStats.totalTimeMs > 0 ? formatSec(batchStats.totalTimeMs) : '—'}</span>
    </div>
  );
}
