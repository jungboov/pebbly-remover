"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import JSZip from 'jszip';
import { createEngine, type Engine } from '../_lib/engine';
import { makeThumb, renderOutput } from '../_lib/canvasJobs';
import type { Box, Mode, ProductOpts, StickerOpts, Spec } from '../_lib/post';
import { setOutSettings, useOutSettings } from '../_lib/outSettings';

export interface BatchItem {
  id: string;
  original: string;
  thumb?: string;   // 썸네일용 작은 그림 — 만들기 전엔 빈 칸(원본 10장을 그대로 띄우면 풀고 그리느라 화면이 멈춤), 못 만들면 original
  processed: string | null;   // 지운 결과(투명 PNG) 주소
  cutout?: Blob;              // 그 파일 — 상품 사진·스티커로 다시 그릴 때
  box?: Box | null;           // 물체가 있는 상자(결과 화소)
  status: 'pending' | 'processing' | 'completed' | 'error';
  progress: number;
  fileName: string;
  startedAt?: number;
  completedAt?: number;
}

// 한 번에 기다릴 수 있는 사진 수(처리 중 + 줄 선 것)
export const MAX_BATCH = 10;

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function formatTimestamp(d: Date): string {
  return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}-${pad2(d.getHours())}${pad2(d.getMinutes())}${pad2(d.getSeconds())}`;
}

// 받는 파일 이름: 지우기 pebbly-remover-이름.png · 상품 사진 …-product.jpg · 스티커 …-sticker360.png
function singleFileName(originalName: string, spec: Spec | null): string {
  const base = originalName.replace(/\.[^/.]+$/, '');
  if (spec?.mode === 'product') return `pebbly-remover-${base}-product.jpg`;
  if (spec?.mode === 'sticker') return `pebbly-remover-${base}-sticker${spec.opts.size}.png`;
  return `pebbly-remover-${base}.png`;
}


export function useBatchProcessor() {
  const [batchItems, setBatchItems] = useState<BatchItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [compareSlider, setCompareSlider] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [modelStatus, setModelStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [modelProgress, setModelProgress] = useState(0);
  const [modelMB, setModelMB] = useState(88);   // 첫 진행 소식 전(모델 크기, model.ts가 받는 대로 고침)
  const { mode, product, sticker } = useOutSettings();   // 만들기 설정(이 브라우저에 기억)
  const setMode = (m: Mode) => setOutSettings({ mode: m });
  const setProduct = (o: ProductOpts) => setOutSettings({ product: o });
  const setSticker = (o: StickerOpts) => setOutSettings({ sticker: o });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastCompletedIdRef = useRef<string | null>(null);

  // 처리 줄: 한 장씩(스레드는 그 한 장에 다 씀). 원본 파일은 여기 — 비우면 지워져서 줄에 남은 것·처리 중이던 것을 버림
  const filesRef = useRef(new Map<string, File>());
  const queueRef = useRef<string[]>([]);
  const runningRef = useRef(false);
  const currentRef = useRef<string | null>(null);
  const thumbsRef = useRef<Promise<void>>(Promise.resolve());

  // 지우기는 웹 워커에서(engine.ts — 안 되는 브라우저는 화면 스레드). 처음 쓸 때 만듦
  // 진행: 모델 받기(받은 바이트 / 모델+wasm 전체) · 지금 사진(풀기 10 → 모델 입력 20 → 마스크 80 → 다 됨 100)
  const engineRef = useRef<Engine | null>(null);
  const modelFailedRef = useRef(false);
  const getEngine = useCallback(() => (engineRef.current ??= createEngine(
    (loaded, total) => {
      setModelProgress(Math.min(100, Math.round((loaded / total) * 100)));
      setModelMB(Math.round(total / 1e6));
    },
    p => {
      const id = currentRef.current;
      if (id) setBatchItems(prev => prev.some(i => i.id === id && i.progress !== p) ? prev.map(i => i.id === id ? { ...i, progress: p } : i) : prev);
    },
  )), []);

  // 미리 열기: 사진을 넣기 전에 모델을 받아 열어 두면 첫 장을 바로 지움(실패는 여기선 조용히 — 사진을 넣으면 runQueue가 다시 해서 오류를 보여 줌)
  // PC(마우스)는 인트로가 끝나고 쉴 때 바로, 폰·데이터 절약 모드는 넣으려는 뜻을 보일 때(＋·보기 창을 누름, 끌어 옴) — 보러만 온 폰에서 100MB를 쓰지 않게
  const warmUp = useCallback(() => { getEngine().preload().catch(() => {}); }, [getEngine]);
  useEffect(() => {
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
    if (saveData || !matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    let t = 0;
    const wait = () => {
      if (document.getElementById('intro')) { t = window.setTimeout(wait, 500); return; }
      if ('requestIdleCallback' in window) requestIdleCallback(warmUp, { timeout: 3000 });
      else warmUp();
    };
    t = window.setTimeout(wait, 500);
    return () => clearTimeout(t);
  }, [warmUp]);

  const patchItem = (id: string, patch: Partial<BatchItem>) =>
    setBatchItems(prev => prev.map(i => i.id === id ? { ...i, ...patch } : i));

  const runQueue = async () => {
    if (runningRef.current) return;   // 이미 도는 줄이 새로 넣은 것까지 가져감
    runningRef.current = true;
    try {
      // 모델부터: 못 받으면 모델 오류(사진은 그대로 기다림) — 사진 하나가 실패하면 그 사진만 오류
      // 지난번에 못 받았으면(다시 · 사진을 더 넣음) 처음부터(받아 둔 조각은 저장소에 있어서 남은 것만 받음)
      if (modelFailedRef.current) {
        modelFailedRef.current = false;
        setModelProgress(0);
      }
      setModelStatus(prev => prev === 'ready' ? prev : 'loading');
      try {
        await getEngine().preload();
      } catch (e) {
        console.error("모델 오류:", e);
        modelFailedRef.current = true;
        setModelStatus('error');
        return;
      }
      setModelStatus('ready');

      while (queueRef.current.length > 0) {
        const id = queueRef.current.shift()!;
        const file = filesRef.current.get(id);
        if (!file) continue;
        currentRef.current = id;
        patchItem(id, { status: 'processing', progress: 0, startedAt: Date.now() });
        try {
          const { blob, box } = await getEngine().run(file);
          if (!filesRef.current.has(id)) continue;   // 처리 중에 비움
          const url = URL.createObjectURL(blob);
          lastCompletedIdRef.current = id;
          patchItem(id, { processed: url, cutout: blob, box, status: 'completed', progress: 100, completedAt: Date.now() });
        } catch (e) {
          console.error("처리 오류:", e);
          if (filesRef.current.has(id)) patchItem(id, { status: 'error' });
        }
      }
    } finally {
      currentRef.current = null;
      runningRef.current = false;
    }
  };

  // On completion: set as viewer + auto-add to download selection
  useEffect(() => {
    const lastId = lastCompletedIdRef.current;
    if (!lastId) return;
    const idx = batchItems.findIndex(i => i.id === lastId);
    if (idx === -1 || batchItems[idx].status !== 'completed') return;

    setSelectedIds(prev => {
      if (prev.has(lastId)) return prev;
      const next = new Set(prev);
      next.add(lastId);
      return next;
    });

    // Show the result alone first (slider=0). User slides to compare.
    // Without this, a fresh result mounts at 50% split which can read as
    // "two images overlapping" before the user understands the slider.
    setCompareSlider(0);

    setSelectedIndex(prevSel => {
      if (prevSel === null) return idx;
      const currentSelected = batchItems[prevSel];
      if (!currentSelected || currentSelected.status === 'pending' || currentSelected.status === 'processing') {
        return idx;
      }
      return prevSel;
    });

    lastCompletedIdRef.current = null;
  }, [batchItems]);

  // 다시: 모델을 새로 받고(runQueue가 새 설정으로), 못 지운 사진도 다시 줄에
  const handleRetryModel = () => {
    const again = batchItems.filter(i => i.status === 'error' && !queueRef.current.includes(i.id)).map(i => i.id);
    if (again.length > 0) {
      queueRef.current.push(...again);
      setBatchItems(prev => prev.map(i => again.includes(i.id) ? { ...i, status: 'pending', progress: 0 } : i));
    }
    runQueue();
  };

  const handleFiles = (files: FileList | File[]) => {
    const startIdx = batchItems.length;
    // 끌어 놓기로 들어온 이미지 아닌 파일은 거름
    let filesArray = Array.from(files).filter(f => f.type.startsWith('image/'));
    const room = MAX_BATCH - queueRef.current.length - (currentRef.current ? 1 : 0);
    if (filesArray.length > room) {
      console.warn(`한 번에 ${MAX_BATCH}장까지 — 초과분 ${filesArray.length - Math.max(room, 0)}장 무시됨.`);
      filesArray = filesArray.slice(0, Math.max(room, 0));
    }
    if (filesArray.length === 0) return;
    const newItems: BatchItem[] = filesArray.map(file => {
      const id = crypto.randomUUID();
      filesRef.current.set(id, file);
      return { id, original: URL.createObjectURL(file), processed: null, status: 'pending', progress: 0, fileName: file.name };
    });
    queueRef.current.push(...newItems.map(i => i.id));
    setBatchItems(prev => [...prev, ...newItems]);
    if (selectedIndex === null) setSelectedIndex(startIdx);
    runQueue();
    for (const it of newItems) {
      thumbsRef.current = thumbsRef.current.then(async () => {
        const file = filesRef.current.get(it.id);
        const thumb = file && await makeThumb(file);
        if (!filesRef.current.has(it.id)) { if (thumb) URL.revokeObjectURL(thumb); return; }   // 그새 비움
        patchItem(it.id, { thumb: thumb ?? it.original });
      });
    }
  };

  // 끌어 놓기: 한 번만 붙이고, 놓을 때는 그때의 handleFiles를 부름
  const handleFilesRef = useRef(handleFiles);
  useEffect(() => { handleFilesRef.current = handleFiles; });
  useEffect(() => {
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(true);
      warmUp();   // 끌어 오는 동안 모델 미리 받기(여러 번 불러도 한 번만 받음)
    };
    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.relatedTarget === null) setIsDragging(false);
    };
    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      if (e.dataTransfer && e.dataTransfer.files.length > 0) {
        handleFilesRef.current(e.dataTransfer.files);
      }
    };

    window.addEventListener("dragover", handleDragOver);
    window.addEventListener("dragleave", handleDragLeave);
    window.addEventListener("drop", handleDrop);
    return () => {
      window.removeEventListener("dragover", handleDragOver);
      window.removeEventListener("dragleave", handleDragLeave);
      window.removeEventListener("drop", handleDrop);
    };
  }, [warmUp]);

  const toggleSelection = (id: string) => {
    const item = batchItems.find(i => i.id === id);
    if (!item || item.status !== 'completed') return;
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    const completedIds = batchItems
      .filter(i => i.status === 'completed')
      .map(i => i.id);
    setSelectedIds(new Set(completedIds));
  };

  const deselectAll = () => setSelectedIds(new Set());

  // 상품 사진·스티커: 지운 결과에서 캔버스 워커가 다시 그림(모델은 안 돌림). 지금 설정의 결과만 기억 — 설정을 바꾸면 버림
  const spec: Spec | null = useMemo(
    () => (mode === 'product' ? { mode, opts: product } : mode === 'sticker' ? { mode, opts: sticker } : null),
    [mode, product, sticker],
  );
  const specKey = spec ? JSON.stringify(spec) : 'cut';
  const outRef = useRef<{ key: string; done: Map<string, { blob: Blob; url: string }>; pending: Map<string, Promise<Blob>> }>({ key: 'cut', done: new Map(), pending: new Map() });
  const [outUrls, setOutUrls] = useState<{ key: string; urls: Record<string, string> }>({ key: 'cut', urls: {} });
  useEffect(() => {
    if (outRef.current.key === specKey) return;
    for (const o of outRef.current.done.values()) URL.revokeObjectURL(o.url);
    outRef.current = { key: specKey, done: new Map(), pending: new Map() };
  }, [specKey]);

  const getOutput = async (item: BatchItem): Promise<Blob | null> => {
    if (!item.cutout) return null;
    if (!spec) return item.cutout;
    const out = outRef.current;
    if (out.key !== specKey) return renderOutput(item.cutout, item.box ?? null, spec);   // 설정이 막 바뀜(기억은 다음 그림부터)
    const hit = out.done.get(item.id);
    if (hit) return hit.blob;
    let p = out.pending.get(item.id);
    if (!p) {
      p = renderOutput(item.cutout, item.box ?? null, spec);
      out.pending.set(item.id, p);
      p.then(blob => {
        if (outRef.current !== out) return;
        const url = URL.createObjectURL(blob);
        out.done.set(item.id, { blob, url });
        setOutUrls(prev => ({ key: out.key, urls: prev.key === out.key ? { ...prev.urls, [item.id]: url } : { [item.id]: url } }));
      }, () => {}).finally(() => out.pending.delete(item.id));
    }
    return p;
  };

  const getSelectedItems = () =>
    batchItems.filter(i => i.status === 'completed' && i.processed && selectedIds.has(i.id));

  const handleDownloadZip = async () => {
    const items = getSelectedItems();
    if (items.length === 0) return;
    setIsDownloading(true);
    try {
      const { saveAs } = await (await import('file-saver')).default;
      const zip = new JSZip();
      for (const item of items) {
        const blob = await getOutput(item);
        if (blob) zip.file(singleFileName(item.fileName, spec), blob);
      }
      // 사진은 이미 압축돼 있어서 ZIP은 담기만(STORE) — 다시 압축하면 시간만 듦
      const content = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
      saveAs(content, `pebbly-remover-${spec ? spec.mode + '-' : ''}${formatTimestamp(new Date())}.zip`);
    } catch (error) {
      console.error("ZIP 다운로드 실패:", error);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDownloadIndividual = async () => {
    const items = getSelectedItems();
    if (items.length === 0) return;
    setIsDownloading(true);
    try {
      const { saveAs } = await (await import('file-saver')).default;
      for (const item of items) {
        const blob = await getOutput(item);
        if (!blob) continue;
        saveAs(blob, singleFileName(item.fileName, spec));
        // brief pause so the browser actually fires each download dialog
        await new Promise(r => setTimeout(r, 180));
      }
    } catch (error) {
      console.error("개별 다운로드 실패:", error);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDownloadCurrent = async () => {
    if (selectedIndex === null) return;
    const item = batchItems[selectedIndex];
    if (!item || item.status !== 'completed' || !item.processed) return;
    try {
      const { saveAs } = await (await import('file-saver')).default;
      const blob = await getOutput(item);
      if (blob) saveAs(blob, singleFileName(item.fileName, spec));
    } catch (error) {
      console.error("현재 결과 다운로드 실패:", error);
    }
  };

  // 비우기: 줄에 남은 것도 버림(처리 중인 한 장은 끝나면 버려짐)
  const handleClearCache = () => {
    queueRef.current = [];
    filesRef.current.clear();
    batchItems.forEach(item => {
      URL.revokeObjectURL(item.original);
      if (item.thumb && item.thumb !== item.original) URL.revokeObjectURL(item.thumb);
      if (item.processed) URL.revokeObjectURL(item.processed);
    });
    for (const o of outRef.current.done.values()) URL.revokeObjectURL(o.url);
    outRef.current = { key: specKey, done: new Map(), pending: new Map() };
    setBatchItems([]);
    setSelectedIndex(null);
    setSelectedIds(new Set());
  };

  const selectedItem = useMemo(() =>
    selectedIndex !== null ? batchItems[selectedIndex] : null
  , [batchItems, selectedIndex]);

  const selCutout = selectedItem?.cutout;
  useEffect(() => {
    if (!spec || !selectedItem?.cutout || outRef.current.key !== specKey || outRef.current.done.has(selectedItem.id)) return;
    const item = selectedItem;
    const t = setTimeout(() => { getOutput(item).catch(e => console.error('결과 만들기 오류:', e)); }, 120);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [specKey, selectedItem?.id, selCutout]);
  // 지금 보기 창에 띄울 결과: 지우기는 투명 PNG, 상품 사진·스티커는 다시 그린 것(아직이면 null)
  const selectedOutput = !selectedItem?.processed ? null
    : !spec ? selectedItem.processed
    : outUrls.key === specKey ? outUrls.urls[selectedItem.id] ?? null : null;

  const batchStatus: 'idle' | 'processing' | 'ready' = useMemo(() => {
    if (batchItems.length === 0) return 'idle';
    const active = batchItems.some(i => i.status === 'pending' || i.status === 'processing');
    return active ? 'processing' : 'ready';
  }, [batchItems]);

  const batchStats = useMemo(() => {
    const total = batchItems.length;
    const completed = batchItems.filter(i => i.status === 'completed').length;
    const active = batchItems.filter(i => i.status === 'processing').length;
    const timedItems = batchItems.filter(i => i.status === 'completed' && i.startedAt != null && i.completedAt != null);
    const avgMs = timedItems.length > 0
      ? timedItems.reduce((sum, i) => sum + (i.completedAt! - i.startedAt!), 0) / timedItems.length
      : 0;
    const remaining = batchItems.filter(i => i.status === 'pending' || i.status === 'processing').length;
    const etaMs = avgMs * remaining;
    const totalTimeMs = timedItems.length > 0
      ? Math.max(...timedItems.map(i => i.completedAt!)) - Math.min(...timedItems.map(i => i.startedAt!))
      : 0;
    return { total, completed, active, avgMs, etaMs, remaining, totalTimeMs };
  }, [batchItems]);

  const overallPercentage = useMemo(() => {
    if (batchItems.length === 0) return 0;
    const sum = batchItems.reduce((acc, i) => {
      if (i.status === 'completed') return acc + 100;
      if (i.status === 'processing') return acc + (i.progress || 0);
      return acc;
    }, 0);
    return Math.round(sum / batchItems.length);
  }, [batchItems]);

  const completedCount = useMemo(
    () => batchItems.filter(i => i.status === 'completed').length,
    [batchItems]
  );

  const selectedCount = selectedIds.size;

  const allCompletedSelected = useMemo(() => {
    if (completedCount === 0) return false;
    return batchItems.every(i => i.status !== 'completed' || selectedIds.has(i.id));
  }, [batchItems, selectedIds, completedCount]);

  return {
    batchItems,
    selectedIndex,
    setSelectedIndex,
    selectedIds,
    selectedCount,
    completedCount,
    allCompletedSelected,
    toggleSelection,
    selectAll,
    deselectAll,
    compareSlider,
    setCompareSlider,
    isDragging,
    isDownloading,
    modelStatus,
    modelProgress,
    modelMB,
    warmUp,
    mode,
    setMode,
    product,
    setProduct,
    sticker,
    setSticker,
    selectedOutput,
    selectedItem,
    batchStatus,
    batchStats,
    overallPercentage,
    fileInputRef,
    handleFiles,
    handleDownloadZip,
    handleDownloadIndividual,
    handleDownloadCurrent,
    handleClearCache,
    handleRetryModel,
  };
}
