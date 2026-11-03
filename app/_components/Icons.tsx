// 흰 선 아이콘 (미러 .ico와 같은 둥근 끝 선)
const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

export const IconPlus = (p: { size?: number }) => (
  <svg {...base} width={p.size ?? 24} height={p.size ?? 24}><path d="M12 5v14M5 12h14" /></svg>
);

export const IconDown = (p: { size?: number }) => (
  <svg {...base} width={p.size ?? 24} height={p.size ?? 24}><path d="M12 4v11M7 10.5l5 5 5-5M5 19.5h14" /></svg>
);

export const IconSlide = (p: { size?: number }) => (
  <svg {...base} width={p.size ?? 24} height={p.size ?? 24}><path d="M9 7l-5 5 5 5M15 7l5 5-5 5" /></svg>
);

export const IconCheck = (p: { size?: number }) => (
  <svg {...base} strokeWidth={2.4} width={p.size ?? 24} height={p.size ?? 24}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
);
