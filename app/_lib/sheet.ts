// 스티커 시트 자동 배치: 종이 안에 줄줄이(상자 쌓기) — 줄마다 가운데 맞춤
// 시트 바깥 완칼은 종이 4mm 안쪽 둥근 네모(R4 — 인쇄소 최소 3R), 반칼은 거기서 4mm 더 안쪽(레드프린팅: 재단선에서 3mm 이상), 반칼끼리 5mm(와우프레스)
export type Paper = 'a4' | 'a5' | 'letter';
export const PAPERS: Record<Paper, [number, number]> = { a4: [210, 297], a5: [148, 210], letter: [215.9, 279.4] };
export const DIE_IN = 4, DIE_R = 4, INNER = 4, GAP = 5;
const M = DIE_IN + INNER;

export type Place = { id: string; x: number; y: number };   // 스티커 상자 왼쪽 위(mm, 종이 기준)
export type Sticker = { id: string; w: number; h: number; count: number };

// full: 개수 대신 첫 장이 찰 때까지 차례로 되풀이(한 장만)
export function pack(list: Sticker[], paper: Paper, full: boolean): { pages: Place[][]; tooBig: string[] } {
  const [PW, PH] = PAPERS[paper], UW = PW - 2 * M, UH = PH - 2 * M;
  const tooBig = list.filter(s => s.w > UW + 1e-6 || s.h > UH + 1e-6).map(s => s.id);
  const ok = list.filter(s => !tooBig.includes(s.id) && (full || s.count > 0));
  const pages: Place[][] = [];
  if (!ok.length) return { pages, tooBig };

  type Row = { y: number; h: number; items: { s: Sticker; x: number }[]; w: number };
  let rows: Row[] = [];
  const flush = () => {
    if (!rows.length) return;
    const page: Place[] = [];
    for (const r of rows) {
      const dx = (UW - r.w) / 2;
      for (const it of r.items) page.push({ id: it.s.id, x: M + dx + it.x, y: M + r.y + (r.h - it.s.h) / 2 });
    }
    pages.push(page);
    rows = [];
  };
  // 한 장 놓기: 지금 줄 끝 → 새 줄 → (full이 아니면) 새 종이. 못 놓으면 false
  const place = (s: Sticker, newPage: boolean): boolean => {
    const r = rows[rows.length - 1];
    if (r) {
      const x = r.w + GAP;
      if (x + s.w <= UW + 1e-6 && r.y + Math.max(r.h, s.h) <= UH + 1e-6) {
        r.items.push({ s, x }); r.w = x + s.w; r.h = Math.max(r.h, s.h);
        return true;
      }
      const y = r.y + r.h + GAP;
      if (y + s.h <= UH + 1e-6) { rows.push({ y, h: s.h, items: [{ s, x: 0 }], w: s.w }); return true; }
      if (!newPage) return false;
      flush();
    }
    rows.push({ y: 0, h: s.h, items: [{ s, x: 0 }], w: s.w });
    return true;
  };
  if (full) {
    for (let i = 0, miss = 0; miss < ok.length && i < 2000; i++) {
      if (place(ok[i % ok.length], false)) miss = 0; else miss++;
    }
  } else {
    for (const s of ok) for (let k = 0; k < s.count; k++) place(s, true);
  }
  flush();
  return { pages, tooBig };
}
