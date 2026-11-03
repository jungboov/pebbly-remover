"use client";

import { useBatchProcessor } from './_hooks/useBatchProcessor';
import { Brand } from './_components/Brand';
import { LangSwitch } from './_components/LangSwitch';
import { Viewer } from './_components/Viewer';
import { StatusBar } from './_components/StatusBar';
import { ThumbnailStrip } from './_components/ThumbnailStrip';
import { ControlRow } from './_components/ControlRow';
import { DragOverlay } from './_components/DragOverlay';
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
          compareSlider={compareSlider}
          onCompareChange={setCompareSlider}
          onFileInputClick={() => fileInputRef.current?.click()}
          onDownloadCurrent={handleDownloadCurrent}
        />
        <div className="side">
          <StatusBar
            modelStatus={modelStatus}
            modelProgress={modelProgress}
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
            onAdd={() => fileInputRef.current?.click()}
            selectedCount={selectedCount}
            completedCount={completedCount}
            allCompletedSelected={allCompletedSelected}
            onSelectAll={selectAll}
            onDeselectAll={deselectAll}
          />
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
        accept="image/*"
        onChange={(e) => {
          if (e.target.files) handleFiles(e.target.files);
          e.target.value = '';
        }}
      />
    </main>
  );
}
