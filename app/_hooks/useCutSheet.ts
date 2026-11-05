"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import JSZip from 'jszip';
import { cutGeo, cutPrep, decodeHeic } from '../_lib/canvasJobs';
import { isHeic } from '../_lib/heic';
import { pack } from '../_lib/sheet';
import { DIE_IN, DIE_R, PAPERS } from '../_lib/sheet';
import type { Geo } from '../_lib/cutline';
import { buildFiles } from '../_lib/cutExport';
import { setOutSettings, useOutSettings, type CutSettings } from '../_lib/outSettings';
import type { BatchItem } from './useBatchProcessor';

// 칼선 탭의 그림 하나: art = 그림 부분만 자른 투명 PNG(또는 사진 JPEG — 네모 스티커)
export interface CutItem {
  id: string;
  name: string;
  status: 'prep' | 'ready' | 'removing' | 'error';
  kind?: 'art' | 'photo';
  art?: Blob;
  aw: number;
  ah: number;
  preview?: string;     // 화면용(긴 변 640px)
  count: number;
  size: number;         // 스티커 긴 변 mm
  holes: boolean;
  from?: string;        // 지우기 탭에서 가져온 사진 id
  progress?: number;    // 배경 지우는 중
}

export const MAX_CUT = 30;
export const SIZES = [30, 50, 70];

type Remover = {
  removeForCut: (file: File) => { id: string; done: Promise<Blob> } | null;   // 줄이 꽉 차면 null
  progressOf: (id: string) => number | undefined;
};

const geoKey = (it: CutItem, gap: number) => `${it.size}|${gap}|${it.holes}|${it.art?.size ?? 0}|${it.aw}x${it.ah}`;

export function useCutSheet(remover: Remover, batchItems: BatchItem[]) {
  const { cut: s } = useOutSettings();
  const set = (p: Partial<CutSettings>) => setOutSettings({ cut: { ...s, ...p } });
  const [raw, setItems] = useState<CutItem[]>([]);
  // 배경 지우는 중인 사진의 진행은 지우기 탭 줄에서 바로 읽음
  const items = raw.map(i => (i.status === 'removing' && i.from ? { ...i, progress: remover.progressOf(i.from) ?? 0 } : i));
  // 그림마다 마지막으로 계산한 칼선(geo null = 그 설정으로는 계산 실패). 열쇠가 지금 설정과 다르면 새로 계산하는 동안 앞 칼선을 보여 줌
  const [geos, setGeos] = useState<Record<string, { key: string; geo: Geo | null }>>({});
  const [busy, setBusy] = useState(false);
  const [geoTick, setGeoTick] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const liveRef = useRef(new Set<string>());   // 비우면 하던 일의 결과를 버림
  const geoRun = useRef(false);   // 칼선 계산은 한 번에 하나(게이지를 끄는 동안 지난 값의 일이 쌓이지 않게)

  const patch = (id: string, p: Partial<CutItem>) => setItems(prev => prev.map(i => i.id === id ? { ...i, ...p } : i));

  // 준비(캔버스 워커): 투명 그림이면 art, 아니면 사진
  const prepare = useCallback(async (id: string, file: Blob, extra: Partial<CutItem> = {}) => {
    try {
      const src = isHeic(file as File) ? await decodeHeic(file) : file;
      const p = await cutPrep(src);
      if (!liveRef.current.has(id)) return;
      setItems(prev => prev.map(i => {
        if (i.id !== id) return i;
        if (i.preview) URL.revokeObjectURL(i.preview);
        return { ...i, ...extra, status: 'ready', kind: p.kind, art: p.art, aw: p.w, ah: p.h, preview: URL.createObjectURL(p.preview) };
      }));
    } catch (e) {
      console.error('칼선 준비 오류:', e);
      if (liveRef.current.has(id)) patch(id, { status: 'error' });
    }
  }, []);

  const add = (name: string, file: Blob, from?: string) => {
    const id = crypto.randomUUID();
    liveRef.current.add(id);
    setItems(prev => [...prev, { id, name, status: 'prep', aw: 1, ah: 1, count: 1, size: s.size, holes: true, from }]);
    prepare(id, file);
    return id;
  };

  const handleFiles = (files: FileList | File[]) => {
    const room = MAX_CUT - items.length;
    const list = Array.from(files).filter(f => f.type.startsWith('image/') || isHeic(f)).slice(0, Math.max(0, room));
    for (const f of list) add(f.name, f);
  };

  // 지우기 탭에서 지운 사진 가져오기(지운 결과 = 투명 PNG)
  const importable = batchItems.filter(b => b.status === 'completed' && b.cutout && !items.some(i => i.from === b.id));
  const importFromRemover = () => {
    for (const b of importable.slice(0, Math.max(0, MAX_CUT - items.length))) add(b.fileName, b.cutout!, b.id);
  };

  // 사진(투명 없음)의 배경 지우기: 지우기 탭의 줄에 넣고(모델을 받음) 끝나면 그 결과로 바꿈
  const removeBg = async (id: string) => {
    const it = items.find(i => i.id === id);
    if (!it?.art || it.kind !== 'photo') return;
    const job = remover.removeForCut(new File([it.art], it.name.replace(/\.[^/.]+$/, '') + '.jpg', { type: 'image/jpeg' }));
    if (!job) return;
    patch(id, { status: 'removing', progress: 0, from: job.id });
    try {
      const blob = await job.done;
      if (!liveRef.current.has(id)) return;
      await prepare(id, blob, { from: job.id, kind: 'art' });
    } catch (e) {
      console.error('배경 지우기 오류:', e);
      if (liveRef.current.has(id)) patch(id, { status: 'ready' });
    }
  };
  const update = (id: string, p: Partial<Pick<CutItem, 'count' | 'size' | 'holes'>>) => patch(id, p);
  const removeItem = (id: string) => {
    liveRef.current.delete(id);
    setItems(prev => {
      const it = prev.find(i => i.id === id);
      if (it?.preview) URL.revokeObjectURL(it.preview);
      return prev.filter(i => i.id !== id);
    });
  };
  const clear = () => {
    for (const it of items) if (it.preview) URL.revokeObjectURL(it.preview);
    liveRef.current.clear();
    setItems([]);
    setGeos({});
  };

  // 칼선 계산: 크기·간격·구멍 메우기가 바뀐 그림만, 캔버스 워커에서 한 장씩 차례로.
  // 하나 끝나면 그때의 설정으로 다음 것을 고름 → 게이지를 끄는 동안에도 일은 늘 하나뿐이고 손을 떼면 곧 맞춰짐
  useEffect(() => {
    if (geoRun.current) return;
    const need = items.filter(it => (it.status === 'ready' || it.status === 'removing') && it.art && geos[it.id]?.key !== geoKey(it, s.gap));
    const it = need.find(i => !geos[i.id]) ?? need[0];   // 칼선이 아직 없는 그림 먼저
    if (!it?.art) return;
    const id = it.id, key = geoKey(it, s.gap);
    geoRun.current = true;
    cutGeo(it.art, it.aw, it.ah, { size: it.size, gap: s.gap, holes: it.holes })
      .then(geo => geo, e => { console.error('칼선 계산 오류:', e); return null; })
      .then(geo => {
        geoRun.current = false;
        if (liveRef.current.has(id)) setGeos(prev => ({ ...prev, [id]: { key, geo } }));
        setGeoTick(t => t + 1);
      });
  }, [items, s.gap, geos, geoTick]);

  // 시트에는 칼선이 있는 그림(새로 계산 중이면 앞 칼선으로). 받기는 다 맞춰진 뒤에만(waiting 0)
  const fresh = (it: CutItem) => geos[it.id]?.key === geoKey(it, s.gap);
  const shown = items.filter(it => it.art && geos[it.id]?.geo);
  const ready = shown.filter(fresh);
  const waiting = items.filter(it => it.status !== 'error' && !fresh(it)).length;
  const packKey = shown.map(it => `${it.id}:${it.count}:${geos[it.id].key}`).join(',');
  const sheet = useMemo(
    () => pack(shown.map(it => ({ id: it.id, w: geos[it.id].geo!.w, h: geos[it.id].geo!.h, count: it.count })), s.paper, s.full),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [packKey, s.paper, s.full],
  );
  const kissMm = sheet.pages.reduce((a, pg) => a + pg.reduce((b, p) => b + (geos[p.id]?.geo?.len ?? 0), 0), 0);
  const [PW, PH] = PAPERS[s.paper];
  const dieMm = s.die ? sheet.pages.length * (2 * (PW - 2 * DIE_IN + PH - 2 * DIE_IN) - (8 - 2 * Math.PI) * DIE_R) : 0;
  const placed = sheet.pages.reduce((a, pg) => a + pg.length, 0);

  const download = async () => {
    if (busy || waiting) return;
    const list = ready.filter(it => s.format === 'png' || sheet.pages.some(pg => pg.some(p => p.id === it.id)));
    if (!list.length) return;
    setBusy(true);
    try {
      const files = await buildFiles({
        items: list.map(it => ({ id: it.id, name: it.name, art: it.art!, geo: geos[it.id].geo!, size: it.size })),
        pages: sheet.pages, paper: s.paper, die: s.die, preset: s.preset, split: s.split, format: s.format,
      });
      const { saveAs } = await (await import('file-saver')).default;
      if (files.length === 1) saveAs(files[0].blob, files[0].name);
      else {
        const zip = new JSZip();
        for (const f of files) zip.file(f.name, f.blob);
        const z = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
        const d = new Date(), p = (n: number) => String(n).padStart(2, '0');
        saveAs(z, `pebbly-sticker-${s.format}-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}.zip`);
      }
    } catch (e) {
      console.error('인쇄 파일 오류:', e);
    } finally {
      setBusy(false);
    }
  };

  return {
    settings: s, set, items, geos, ready, waiting, sheet, kissMm, dieMm, placed, busy,
    fileInputRef, handleFiles, importable, importFromRemover, removeBg, update, removeItem, clear, download,
  };
}

export type CutSheet = ReturnType<typeof useCutSheet>;
