import React from 'react';
import { KeyIcon } from './icons/KeyIcon';
import { SettingsIcon } from './icons/SettingsIcon';
import { AppMode } from '../types';
import { BookOpenIcon } from './icons/BookOpenIcon';

interface HeaderProps {
  onApiKeyClick: (() => void) | undefined; // 修改类型以允许undefined
  onImportExportClick: () => void;
  onSettingsClick: () => void;
  appMode: AppMode;
  onModeChange: (mode: AppMode) => void;
  isLoading: boolean;
}

const ModeButton: React.FC<{
  label: string;
  isActive: boolean;
  onClick: () => void;
  disabled: boolean;
}> = ({ label, isActive, onClick, disabled }) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-3 sm:px-4 py-1.5 rounded-full transition-all duration-300 text-xs sm:text-sm font-semibold whitespace-nowrap ${
        isActive
          ? 'bg-white text-indigo-600 shadow-md'
          : 'bg-transparent text-slate-600 hover:bg-white/50'
      } disabled:opacity-60 disabled:cursor-not-allowed`}
    >
      {label}
    </button>
  );
};

export const Header: React.FC<HeaderProps> = ({ onApiKeyClick, onImportExportClick, onSettingsClick, appMode, onModeChange, isLoading }) => {
  const titles = {
    wiki: { icon: '💡', text: '图解百科' },
    textToImage: { icon: '✨', text: '以文生图' },
    imageToImage: { icon: '🖼️', text: '以图生图' },
    video: { icon: '🎬', text: '图生视频' },
    infiniteCanvas: { icon: '🌌', text: '无限画布' },
    comicStrip: { icon: <BookOpenIcon className="w-6 h-6" />, text: '连环画本' },
  };

  const { icon, text } = titles[appMode];

  const Title = () => (
    <h1 className="text-lg sm:text-xl font-bold text-slate-800 flex items-center gap-2">
      <span className="text-xl sm:text-2xl">{icon}</span>
      <span>{text}</span>
    </h1>
  );

  const ApiKeyButton = () => (
     <button
        onClick={onApiKeyClick}
        className="p-2 rounded-full text-slate-600 hover:bg-slate-200 hover:text-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        aria-label="设置 API Key"
      >
        <KeyIcon className="w-6 h-6" />
      </button>
  );

  // 新增导入导出按钮
  const ImportExportButton = () => (
    <button
      onClick={onImportExportClick}
      className="p-2 rounded-full text-slate-600 hover:bg-slate-200 hover:text-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
      aria-label="导入/导出数据"
    >
      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
      </svg>
    </button>
  );

  // 新增设置按钮
  const SettingsButton = () => (
    <button
      onClick={onSettingsClick}
      className="p-2 rounded-full text-slate-600 hover:bg-slate-200 hover:text-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
      aria-label="设置"
    >
      <SettingsIcon className="w-6 h-6" />
    </button>
  );

  const ModeSwitcher = () => (
    <div className="flex items-center bg-slate-200/80 p-1 rounded-full overflow-x-auto">
      <ModeButton label="图解百科" isActive={appMode === 'wiki'} onClick={() => onModeChange('wiki')} disabled={isLoading} />
      <ModeButton label="连环画本" isActive={appMode === 'comicStrip'} onClick={() => onModeChange('comicStrip')} disabled={isLoading} />
      <ModeButton label="无限画布" isActive={appMode === 'infiniteCanvas'} onClick={() => onModeChange('infiniteCanvas')} disabled={isLoading} />
      <ModeButton label="以文生图" isActive={appMode === 'textToImage'} onClick={() => onModeChange('textToImage')} disabled={isLoading} />
      <ModeButton label="以图生图" isActive={appMode === 'imageToImage'} onClick={() => onModeChange('imageToImage')} disabled={isLoading} />
      <ModeButton label="图生视频" isActive={appMode === 'video'} onClick={() => onModeChange('video')} disabled={isLoading} />
    </div>
  );

  return (
    <header className="bg-white/90 backdrop-blur-sm sticky top-0 z-30 border-b border-slate-200">
      <div className="container mx-auto px-4 py-3">
        {/* Desktop Layout */}
        <div className="hidden md:flex items-center justify-between">
          <div className="flex-1 flex justify-start">
            <Title />
          </div>
          <div className="flex-shrink-0">
            <ModeSwitcher />
          </div>
          <div className="flex-1 flex justify-end gap-2">
            <SettingsButton />
            <ImportExportButton />
            {/* 只有在非环境变量API Key的情况下才显示API Key按钮 */}
            {onApiKeyClick && (
              <ApiKeyButton />
            )}
          </div>
        </div>
        
        {/* Mobile Layout */}
        <div className="md:hidden">
          <div className="flex items-center justify-between">
            <Title />
            <div className="flex gap-1">
              <SettingsButton />
              <ImportExportButton />
              {/* 只有在非环境变量API Key的情况下才显示API Key按钮 */}
              {onApiKeyClick && (
                <ApiKeyButton />
              )}
            </div>
          </div>
          <div className="mt-3 flex justify-center">
            <ModeSwitcher />
          </div>
        </div>
      </div>
    </header>
  );
};