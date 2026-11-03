"use client";

import { useState, useRef, useEffect, useMemo } from 'react';
import { removeBackground, Config } from '@imgly/background-removal';
import JSZip from 'jszip';

export interface BatchItem {
  id: string;
  original: string;
  processed: string | null;
  status: 'pending' | 'processing' | 'completed' | 'error';
  progress: number;
  fileName: string;
  startedAt?: number;
  completedAt?: number;
}

export type UserPlan = 'free' | 'pro' | 'pro_plus';

export const PLAN_LIMITS: Record<UserPlan, { concurrency: number; maxBatch: number }> = {
  free: { concurrency: 2, maxBatch: 10 },
  pro: { concurrency: 4, maxBatch: 50 },
  pro_plus: {
    concurrency:
      typeof navigator !== 'undefined'
        ? Math.min(navigator.hardwareConcurrency || 4, 8)
        : 4,
    maxBatch: Infinity,
  },
};

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function formatTimestamp(d: Date): string {
  return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}-${pad2(d.getHours())}${pad2(d.getMinutes())}${pad2(d.getSeconds())}`;
}

function singleFileName(originalName: string): string {
  const base = originalName.replace(/\.[^/.]+$/, '');
  return `pebbly-remover-${base}.png`;
}

export function useBatchProcessor() {
  const currentPlan: UserPlan = 'free';
  const { concurrency, maxBatch } = PLAN_LIMITS[currentPlan];

  const [batchItems, setBatchItems] = useState<BatchItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [compareSlider, setCompareSlider] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [modelStatus, setModelStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [modelProgress, setModelProgress] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastCompletedIdRef = useRef<string | null>(null);

  const processNextInQueue = async (items: BatchItem[]) => {
    const config: Partial<Config> & { numThreads?: number } = {
      model: 'isnet',
      device: 'cpu',
      numThreads: 1,
    };

    setModelStatus(prev => (prev === 'idle' || prev === 'error') ? 'loading' : prev);

    const queue: BatchItem[] = [...items];

    const processOne = async (item: BatchItem) => {
      const startedAt = Date.now();
      setBatchItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'processing', startedAt } : i));
      try {
        const resultBlob = await removeBackground(item.original, {
          ...config,
          progress: (key, current, total) => {
            const p = Math.round((current / total) * 100);
            const isModelPhase = /fetch|download|compute/i.test(key);
            if (isModelPhase) {
              setModelProgress(p);
              return;
            }
            setBatchItems(prev => prev.map(i => i.id === item.id ? { ...i, progress: p } : i));
            if (p >= 30) {
              setModelStatus(prev => prev === 'loading' ? 'ready' : prev);
            }
          }
        });
        const url = URL.createObjectURL(resultBlob);
        const completedAt = Date.now();
        lastCompletedIdRef.current = item.id;
        setBatchItems(prev => prev.map(i => i.id === item.id ? { ...i, processed: url, status: 'completed', progress: 100, completedAt } : i));
        setModelStatus(prev => prev === 'loading' ? 'ready' : prev);
      } catch (e) {
        console.error("처리 오류:", e);
        setBatchItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'error' } : i));
        setModelStatus(prev => prev === 'loading' ? 'error' : prev);
      }
    };

    const worker = async () => {
      while (queue.length > 0) {
        const next = queue.shift();
        if (next) await processOne(next);
      }
    };

    await Promise.all(Array.from({ length: concurrency }, () => worker()));
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

  const handleRetryModel = () => {
    setModelStatus('idle');
    setModelProgress(0);
    const toRetry = batchItems.filter(i => i.status === 'pending' || i.status === 'error');
    if (toRetry.length > 0) {
      setTimeout(() => processNextInQueue(toRetry), 100);
    }
  };

  const handleFiles = (files: FileList | File[]) => {
    const startIdx = batchItems.length;
    // 끌어 놓기로 들어온 이미지 아닌 파일은 거름
    let filesArray = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (filesArray.length === 0) return;
    if (filesArray.length > maxBatch) {
      console.warn(`배치 크기 초과 (${filesArray.length} > ${maxBatch}). 초과분 ${filesArray.length - maxBatch}개 무시됨.`);
      filesArray = filesArray.slice(0, maxBatch);
    }
    const newItems: BatchItem[] = filesArray.map(file => ({
      id: crypto.randomUUID(),
      original: URL.createObjectURL(file),
      processed: null,
      status: 'pending',
      progress: 0,
      fileName: file.name
    }));
    setBatchItems(prev => [...prev, ...newItems]);
    if (selectedIndex === null) setSelectedIndex(startIdx);
    setTimeout(() => processNextInQueue(newItems), 100);
  };

  useEffect(() => {
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(true);
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
        handleFiles(e.dataTransfer.files);
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
  }, [batchItems]);

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
        const response = await fetch(item.processed!);
        const blob = await response.blob();
        zip.file(singleFileName(item.fileName), blob);
      }
      const content = await zip.generateAsync({ type: 'blob' });
      saveAs(content, `pebbly-remover-${formatTimestamp(new Date())}.zip`);
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
        const response = await fetch(item.processed!);
        const blob = await response.blob();
        saveAs(blob, singleFileName(item.fileName));
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
      const response = await fetch(item.processed);
      const blob = await response.blob();
      saveAs(blob, singleFileName(item.fileName));
    } catch (error) {
      console.error("현재 결과 다운로드 실패:", error);
    }
  };

  const handleClearCache = () => {
    batchItems.forEach(item => {
      URL.revokeObjectURL(item.original);
      if (item.processed) URL.revokeObjectURL(item.processed);
    });
    setBatchItems([]);
    setSelectedIndex(null);
    setSelectedIds(new Set());
  };

  const selectedItem = useMemo(() =>
    selectedIndex !== null ? batchItems[selectedIndex] : null
  , [batchItems, selectedIndex]);

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
    const etaMs = avgMs > 0 ? (avgMs * remaining) / Math.max(concurrency, 1) : 0;
    const totalTimeMs = timedItems.length > 0
      ? Math.max(...timedItems.map(i => i.completedAt!)) - Math.min(...timedItems.map(i => i.startedAt!))
      : 0;
    return { total, completed, active, avgMs, etaMs, remaining, totalTimeMs };
  }, [batchItems, concurrency]);

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
    concurrency,
    maxBatch,
  };
}
