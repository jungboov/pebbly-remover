"use client";

import { useBatchProcessor } from './_hooks/useBatchProcessor';
import { Brand } from './_components/Brand';
import { LangSwitch } from './_components/LangSwitch';
import { Viewer } from './_components/Viewer';
import { StatusBar } from './_components/StatusBar';
import { ThumbnailStrip } from './_components/ThumbnailStrip';
import { ControlRow } from './_components/ControlRow';
import { DragOverlay } from './_components/DragOverlay';
import { ModeBar } from './_components/ModeBar';
import { DownloadSheet, dlSummary } from './_components/DownloadSheet';
import { useState } from 'react';
import { useLang } from './_lib/lang';
import { T } from './_components/T';

// 화면: 머리(로고 · 한/영) / 보기 창 / 옆(상태 · 썸네일 · 받기) / 바닥 글
// 폰은 위에서 아래로 한 줄, PC(900px 이상)는 보기 창 옆에 340px 칸
export default function Home() {
  const {
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
    dl,
    setDl,
    estimate,
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
  } = useBatchProcessor();
  // 파일 고르기를 열면 그동안 모델을 미리 받기 시작(폰은 이때가 처음)
  const pickFiles = () => { warmUp(); fileInputRef.current?.click(); };
  const ko = useLang() === 'ko';
  const [dlOpen, setDlOpen] = useState(false);   // 받기 설정 창

  return (
    <main className="app">
      <DragOverlay isDragging={isDragging} />

      <header className="head">
        <Brand />
        <LangSwitch />
      </header>

      <div className="work">
        <Viewer
          selectedItem={selectedItem}
          mode={mode}
          output={selectedOutput}
          compareSlider={compareSlider}
          onCompareChange={setCompareSlider}
          onFileInputClick={pickFiles}
          onDownloadCurrent={handleDownloadCurrent}
        />
        <div className="side">
          <ModeBar mode={mode} onMode={setMode} product={product} onProduct={setProduct} sticker={sticker} onSticker={setSticker} />
          <StatusBar
            modelStatus={modelStatus}
            modelProgress={modelProgress}
            modelMB={modelMB}
            batchStatus={batchStatus}
            batchStats={batchStats}
            overallPercentage={overallPercentage}
            onRetryModel={handleRetryModel}
          />
          <ThumbnailStrip
            items={batchItems}
            selectedIndex={selectedIndex}
            selectedIds={selectedIds}
            onSelect={(idx, id) => {
              setSelectedIndex(idx);
              setCompareSlider(0);
              toggleSelection(id);
            }}
            onAdd={pickFiles}
            selectedCount={selectedCount}
            completedCount={completedCount}
            allCompletedSelected={allCompletedSelected}
            onSelectAll={selectAll}
            onDeselectAll={deselectAll}
          />
          {/* 받기 설정(줄여서 받기): 스티커는 카톡 규격 그대로라 없음 */}
          {mode === 'sticker' ? (
            <div className="dl-row" data-off="true"><span><T ko="받기 설정" en="Download settings" /></span><em><T ko="카톡 규격 그대로(PNG)" en="Kakao spec as is (PNG)" /></em></div>
          ) : (
            <button type="button" className="dl-row" onClick={() => setDlOpen(true)} aria-haspopup="dialog">
              <span><T ko="받기 설정" en="Download settings" /></span>
              <em>{dlSummary(dl, mode, ko)}<i aria-hidden="true">›</i></em>
            </button>
          )}
          {dlOpen && mode !== 'sticker' && (
            <DownloadSheet mode={mode} value={dl} onChange={setDl} count={selectedCount}
              rev={`${mode}|${JSON.stringify(product)}|${[...selectedIds].join(',')}`} estimate={estimate}
              onZip={handleDownloadZip} onFiles={handleDownloadIndividual} busy={isDownloading} onClose={() => setDlOpen(false)} />
          )}
          <ControlRow
            selectedCount={selectedCount}
            isDownloading={isDownloading}
            onDownloadZip={handleDownloadZip}
            onDownloadIndividual={handleDownloadIndividual}
            onClear={handleClearCache}
          />
        </div>
      </div>

      <footer className="foot">
        <span><T ko="100% 내 기기에서 · 업로드 없음 · 서버 없음" en="100% local · No upload · Zero server" /></span>
        <span className="foot-links">
          <a href="mailto:hello@pebblylabs.com">hello@pebblylabs.com</a>
          <a href="https://paypal.me/pebblylabs" target="_blank" rel="noopener noreferrer"><T ko="후원하기" en="Support" /></a>
        </span>
      </footer>

      <input
        type="file"
        ref={fileInputRef}
        hidden
        multiple
        accept="image/*,.heic,.heif"
        onChange={(e) => {
          if (e.target.files) handleFiles(e.target.files);
          e.target.value = '';
        }}
      />
    </main>
  );
}
