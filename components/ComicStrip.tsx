// components/ComicStrip.tsx
/* eslint-disable jsx-a11y/button-has-title */

import React, { useState } from 'react';
import { ImageStyle, GeneratedImage, ComicStripGenerationPhase, ComicStripPanelStatus, ImageModel, ComicStripTransitionStatus } from '../types';
import { ImageGrid } from './ImageGrid';
import { EmptyState } from './EmptyState';
import { LoadingState } from './LoadingState';
import { ChevronLeftIcon } from './icons/ChevronLeftIcon';
import { CheckIcon } from './icons/CheckIcon';
import { VideoPlayIcon } from './icons/VideoPlayIcon';
import { SparklesIcon } from './icons/SparklesIcon';

interface TransitionItemProps {
  index: number;
  status: ComicStripTransitionStatus;
  url: string | null;
}

const TransitionItem: React.FC<TransitionItemProps> = ({ index, status, url }) => {
    const handlePreview = () => {
        if (url) {
            window.open(url, '_blank');
        }
    };
    return (
        <div className="flex items-center justify-center my-4">
            <div className="w-full max-w-lg flex items-center justify-center gap-4 py-2 px-4 bg-slate-100 rounded-full border border-slate-200">
                <SparklesIcon className="w-5 h-5 text-purple-500" />
                <span className="text-sm font-semibold text-slate-600">AI 转场 {index + 1}</span>
                <div className="flex-grow border-t border-dashed border-slate-300"></div>
                {status === 'generating' && (
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-solid border-slate-400 border-r-transparent"></div>
                        <span>生成中...</span>
                    </div>
                )}
                 {status === 'completed' && url && (
                    <button onClick={handlePreview} className="flex items-center gap-1.5 text-sm text-indigo-600 bg-indigo-100 hover:bg-indigo-200 px-3 py-1 rounded-full transition-colors">
                        <VideoPlayIcon className="w-4 h-4" />
                        <span>播放转场</span>
                    </button>
                )}
                {status === 'completed' && !url && (
                    <span className="text-sm text-red-500">生成失败</span>
                )}
            </div>
        </div>
    );
};

interface ScriptEditorProps {
    images: GeneratedImage[];
    scripts: string[];
    onScriptChange: (index: number, newScript: string) => void;
    onBack: () => void;
    onGenerate: () => void;
    phase: ComicStripGenerationPhase;
    videoUrls: (string | null)[];
    panelStatuses: ComicStripPanelStatus[];
    onPreviewComicPanel: (index: number) => void;
    onRegeneratePanel: (index: number) => void;
    transitionUrls: (string | null)[];
    transitionStatuses: ComicStripTransitionStatus[];
    useSmartTransitions: boolean;
    onUseSmartTransitionsChange: (use: boolean) => void;
    isStitching: boolean;
    stitchingProgress: number;
    onStitchVideos: () => void;
}

const ScriptEditor: React.FC<ScriptEditorProps> = ({ 
    images, 
    scripts, 
    onScriptChange, 
    onBack, 
    onGenerate, 
    phase, 
    videoUrls, 
    panelStatuses, 
    onPreviewComicPanel, 
    onRegeneratePanel,
    transitionUrls,
    transitionStatuses,
    useSmartTransitions,
    onUseSmartTransitionsChange,
    isStitching,
    stitchingProgress,
    onStitchVideos,
}) => {
    const isGloballyGenerating = panelStatuses.some(s => s === 'generating') || transitionStatuses.some(s => s === 'generating');
    const isCompleted = phase === 'completed';

    const allPanelsGenerated = panelStatuses.every(s => s === 'completed') && videoUrls.every(v => v);
    const allTransitionsGenerated = transitionStatuses.every(s => s === 'completed') && transitionUrls.every(t => t);
    const allVideosGenerated = isCompleted && allPanelsGenerated && (!useSmartTransitions || allTransitionsGenerated);

    let mainActionText = '开始生成视频';
    if (isCompleted) {
        mainActionText = '重新生成全部';
    } else if (phase === 'generating_panels') {
        mainActionText = '生成画板中...';
    } else if (phase === 'generating_transitions') {
        mainActionText = '生成转场中...';
    }

    const items: { type: 'panel' | 'transition'; index: number }[] = [];
    images.forEach((image, index) => {
        items.push({ type: 'panel', index });
        if (index < images.length - 1 && useSmartTransitions) {
            items.push({ type: 'transition', index });
        }
    });

    return (
        <div className="container mx-auto px-4 py-12 animate-fade-in">
            <div className="max-w-5xl mx-auto">
                <div className="flex flex-col sm:flex-row justify-between items-center mb-8 gap-4">
                    <div>
                        <h2 className="text-3xl font-bold text-slate-800">
                            {isGloballyGenerating ? '正在生成视频...' : (isCompleted ? '预览与修改' : '编辑分镜脚本')}
                        </h2>
                        <p className="text-slate-500 mt-1">
                            {isGloballyGenerating ? 'AI 正在为您的连环画注入生命，请稍候。' : (isCompleted ? '视频已生成。您可以播放、修改脚本或重新生成。' : '审阅并修改 AI 生成的视频描述，或填写您自己的创意。')}
                        </p>
                    </div>
                    <div className="flex items-center gap-4 flex-wrap justify-end">
                        <button
                            onClick={onBack}
                            disabled={isGloballyGenerating || isStitching}
                            className="flex items-center gap-2 px-4 py-2 bg-slate-200 text-slate-700 font-semibold rounded-full hover:bg-slate-300 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            <ChevronLeftIcon className="w-5 h-5" />
                            <span>{isCompleted ? '完成' : '返回'}</span>
                        </button>
                        <button
                            onClick={onGenerate}
                            disabled={isGloballyGenerating || isStitching}
                            className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-full hover:bg-indigo-700 transition-transform transform hover:scale-105 disabled:bg-slate-400 disabled:cursor-not-allowed"
                        >
                            {mainActionText}
                        </button>
                        {allVideosGenerated && !isStitching && (
                            <button
                                onClick={onStitchVideos}
                                className="px-6 py-2 bg-green-600 text-white font-bold rounded-full hover:bg-green-700 transition-transform transform hover:scale-105"
                            >
                                一键拼接视频
                            </button>
                        )}
                        {isStitching && (
                            <div className="flex items-center gap-3 bg-slate-200 px-4 py-2 rounded-full">
                                <span className="text-sm font-semibold text-slate-700">拼接中... ({stitchingProgress}%)</span>
                                <div className="w-24 h-2 bg-slate-300 rounded-full overflow-hidden">
                                    <div 
                                        className="h-full bg-green-500 rounded-full transition-all"
                                        aria-hidden="true"
                                        data-width={stitchingProgress}
                                        style={{ width: `${stitchingProgress}%`}}
                                    ></div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
                
                {phase === 'editing' && (
                    <div className="flex items-center justify-center gap-4 p-4 mb-6 bg-slate-100 rounded-2xl border border-slate-200">
                        <span className="font-semibold text-slate-700">AI 智能转场</span>
                        <p className="text-sm text-slate-500 flex-grow">自动为每个镜头之间生成电影般的过渡效果。</p>
                        <button
                            type="button"
                            onClick={() => onUseSmartTransitionsChange(!useSmartTransitions)}
                            disabled={isGloballyGenerating || isStitching}
                            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 ${useSmartTransitions ? 'bg-indigo-600' : 'bg-gray-200'}`}
                        >
                            <span
                            aria-hidden="true"
                            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${useSmartTransitions ? 'translate-x-5' : 'translate-x-0'}`}
                            />
                        </button>
                    </div>
                )}


                <div className="space-y-4">
                    {items.map(item => {
                        if (item.type === 'panel') {
                            const { index } = item;
                            const image = images[index];
                            const status = panelStatuses[index] || 'queued';
                            const hasVideo = !!videoUrls[index];

                            return (
                                <div key={image.id} className={`grid md:grid-cols-2 gap-6 items-start bg-white p-4 rounded-2xl shadow-lg border transition-all duration-300 ${hasVideo ? 'border-green-300' : 'border-slate-200'}`}>
                                    <button
                                        type="button"
                                        title={hasVideo ? '预览该片段视频' : '图片预览'}
                                        className="relative aspect-video w-full bg-slate-100 rounded-xl overflow-hidden shadow-inner group text-left"
                                        onClick={() => hasVideo ? onPreviewComicPanel(index) : null}
                                        disabled={!hasVideo}
                                    >
                                        <img src={image.src} alt={`Panel ${index + 1}`} className="w-full h-full object-cover" />
                                        {status === 'generating' && (
                                            <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center text-white">
                                                <div className="animate-spin rounded-full h-8 w-8 border-4 border-solid border-white border-r-transparent"></div>
                                                <p className="mt-2 text-sm font-semibold">生成中...</p>
                                            </div>
                                        )}
                                        {hasVideo && (
                                            <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center text-white cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity">
                                                <VideoPlayIcon className="w-12 h-12" />
                                            </div>
                                        )}
                                    </button>
                                    <div className="flex flex-col h-full">
                                        <div className="flex justify-between items-center mb-2">
                                            <label htmlFor={`script-${index}`} className="block text-sm font-medium text-slate-600">
                                                第 {index + 1} 段视频描述
                                            </label>
                                            {status === 'completed' && hasVideo && (
                                                <span className="flex items-center gap-1.5 text-xs text-green-600 bg-green-100 px-2 py-1 rounded-full">
                                                    <CheckIcon className="w-4 h-4" />
                                                    已完成
                                                </span>
                                            )}
                                        </div>
                                        <textarea
                                            id={`script-${index}`}
                                            value={scripts[index] || ''}
                                            onChange={(e) => onScriptChange(index, e.target.value)}
                                            placeholder="输入该画面的动态描述..."
                                            rows={4}
                                            disabled={isGloballyGenerating || isStitching}
                                            className="w-full flex-grow px-4 py-3 bg-slate-50 border border-slate-300 rounded-lg shadow-sm transition duration-200 text-base focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-y disabled:bg-slate-100"
                                        />
                                        {status === 'completed' && (
                                            <button
                                                onClick={() => onRegeneratePanel(index)}
                                                disabled={isGloballyGenerating || isStitching}
                                                className="mt-2 w-full text-sm font-semibold text-indigo-600 bg-indigo-100 hover:bg-indigo-200 py-2 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                                            >
                                                重新生成此片段
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        } else { // type === 'transition'
                            const { index } = item;
                            return (
                                <TransitionItem
                                    key={`transition-${index}`}
                                    index={index}
                                    status={transitionStatuses[index] || 'queued'}
                                    url={transitionUrls[index] || null}
                                />
                            );
                        }
                    })}
                </div>
            </div>
        </div>
    );
};

interface ComicStripProps {
  onGenerate: () => void;
  isLoading: boolean;
  story: string;
  onStoryChange: (story: string) => void;
  style: ImageStyle;
  onStyleChange: (style: ImageStyle) => void;
  activeModel: ImageModel;
  onModelChange: (model: ImageModel) => void;
  images: GeneratedImage[];
  onImageClick: (index: number) => void;
  onToggleFavorite: (id: string) => void;
  onEditPanel: (index: number) => void;
  numberOfImages: number;
  onNumberOfImagesChange: (num: number) => void;
  onGenerateVideoScripts: () => void;
  videoGenerationPhase: ComicStripGenerationPhase;
  onPhaseChange: (phase: ComicStripGenerationPhase) => void;
  isGeneratingScripts: boolean;
  videoScripts: string[];
  onScriptChange: (index: number, newScript: string) => void;
  onStartVideoGeneration: () => void;
  videoUrls: (string | null)[];
  panelStatuses: ComicStripPanelStatus[];
  onPreviewComicPanel: (index: number) => void;
  onRegeneratePanel: (index: number) => void;
  useSmartTransitions: boolean;
  onUseSmartTransitionsChange: (use: boolean) => void;
  transitionUrls: (string | null)[];
  transitionStatuses: ComicStripTransitionStatus[];
  isStitching: boolean;
  stitchingProgress: number;
  onStitchVideos: () => void;
}

const StyleButton: React.FC<{
  value: ImageStyle;
  label: string;
  icon: string;
  isActive: boolean;
  onClick: () => void;
  disabled: boolean;
}> = ({ value, label, icon, isActive, onClick, disabled }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={`px-4 py-2 rounded-full text-sm font-semibold transition-all duration-200 flex items-center gap-2 border disabled:cursor-not-allowed disabled:opacity-60 ${
      isActive
        ? 'bg-slate-800 text-white border-slate-800 shadow-md'
        : 'bg-white/60 text-slate-700 border-transparent hover:bg-white/90 backdrop-blur-sm'
    }`}
  >
    <span className="text-lg">{icon}</span>
    {label}
  </button>
);

export const ComicStrip: React.FC<ComicStripProps> = ({
  onGenerate,
  isLoading,
  story,
  onStoryChange,
  style,
  onStyleChange,
  activeModel,
  onModelChange,
  images,
  onImageClick,
  onToggleFavorite,
  onEditPanel,
  numberOfImages,
  onNumberOfImagesChange,
  onGenerateVideoScripts,
  videoGenerationPhase,
  onPhaseChange,
  isGeneratingScripts,
  videoScripts,
  onScriptChange,
  onStartVideoGeneration,
  videoUrls,
  panelStatuses,
  onPreviewComicPanel,
  onRegeneratePanel,
  useSmartTransitions,
  onUseSmartTransitionsChange,
  transitionUrls,
  transitionStatuses,
  isStitching,
  stitchingProgress,
  onStitchVideos,
}) => {
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!story.trim()) {
      setFormError('请输入您的故事脚本。');
      return;
    }
    setFormError(null);
    onGenerate();
  };
  
  if (['editing', 'generating_panels', 'generating_transitions', 'completed'].includes(videoGenerationPhase)) {
      return (
          <ScriptEditor
              images={images}
              scripts={videoScripts}
              onScriptChange={onScriptChange}
              onBack={() => onPhaseChange('idle')}
              onGenerate={onStartVideoGeneration}
              phase={videoGenerationPhase}
              videoUrls={videoUrls}
              panelStatuses={panelStatuses}
              onPreviewComicPanel={onPreviewComicPanel}
              onRegeneratePanel={onRegeneratePanel}
              transitionUrls={transitionUrls}
              transitionStatuses={transitionStatuses}
              useSmartTransitions={useSmartTransitions}
              onUseSmartTransitionsChange={onUseSmartTransitionsChange}
              isStitching={isStitching}
              stitchingProgress={stitchingProgress}
              onStitchVideos={onStitchVideos}
          />
      );
  }

  const hasGeneratedVideos = images.length > 0 && videoUrls.some(url => url);

  return (
    <>
      <section className="w-full flex flex-col items-center justify-center py-12 md:py-16 bg-white border-b border-slate-200" aria-label="连环画生成">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-6xl font-extrabold text-slate-800 tracking-tight">
            故事成画，<span className="text-indigo-600">一键生成</span>
          </h1>
          <p className="mt-4 text-base md:text-lg text-slate-600 max-w-2xl mx-auto">
            输入您的故事脚本，选择一种艺术风格，即可生成一整套连环画。
          </p>
          <form onSubmit={handleSubmit} className="mt-10 max-w-4xl mx-auto">
            <div className="flex flex-col items-center gap-4">
              <textarea
                value={story}
                onChange={(e) => {
                  onStoryChange(e.target.value);
                  if (formError) setFormError(null);
                }}
                placeholder={`像写剧本一样描述您的故事，每个分镜占一行或一段：\n第一格：一只小猫坐在窗台上，看着窗外的雨。\n第二格：它看到一片叶子像小船一样漂在水坑里。\n第三格：小猫决定出门，去追逐那片叶子船。`}
                rows={8}
                className={`w-full px-6 py-4 bg-white border rounded-2xl shadow-lg transition duration-200 text-base resize-y ${
                  formError
                    ? 'border-red-500 focus:ring-2 focus:ring-red-500/50 focus:border-red-500'
                    : 'border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500'
                }`}
                disabled={isLoading}
              />
              {formError && <p className="text-sm text-red-600">{formError}</p>}
              
              <div className="w-full flex flex-col items-center gap-4 mt-4">
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
                    <span className="text-slate-600 text-sm font-medium">画板数量：</span>
                    <div className="flex items-center justify-center gap-2 bg-slate-100 p-1 rounded-full">
                        {[1, 2, 3, 4, 5, 6].map(num => (
                            <button
                                key={num}
                                type="button"
                                onClick={() => onNumberOfImagesChange(num)}
                                disabled={isLoading}
                                className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors duration-200 ${
                                    numberOfImages === num
                                        ? 'bg-white text-indigo-600 shadow-md'
                                        : 'bg-transparent text-slate-600 hover:bg-white/50'
                                }`}
                            >
                                {num}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
                  <span className="text-slate-600 text-sm font-medium">选择风格：</span>
                  <div className="flex flex-wrap items-center justify-center gap-3">
                    <StyleButton value={ImageStyle.ILLUSTRATION} label="插画风" icon="🏞️" isActive={style === ImageStyle.ILLUSTRATION} onClick={() => onStyleChange(ImageStyle.ILLUSTRATION)} disabled={isLoading} />
                    <StyleButton value={ImageStyle.CARTOON} label="卡通风" icon="🐰" isActive={style === ImageStyle.CARTOON} onClick={() => onStyleChange(ImageStyle.CARTOON)} disabled={isLoading} />
                    <StyleButton value={ImageStyle.CLAY} label="粘土风" icon="🗿" isActive={style === ImageStyle.CLAY} onClick={() => onStyleChange(ImageStyle.CLAY)} disabled={isLoading} />
                    <StyleButton value={ImageStyle.PHOTOREALISTIC} label="写实风" icon="📷" isActive={style === ImageStyle.PHOTOREALISTIC} onClick={() => onStyleChange(ImageStyle.PHOTOREALISTIC)} disabled={isLoading} />
                    <StyleButton value={ImageStyle.THREE_D_ANIMATION} label="3D动画" icon="🧸" isActive={style === ImageStyle.THREE_D_ANIMATION} onClick={() => onStyleChange(ImageStyle.THREE_D_ANIMATION)} disabled={isLoading} />
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
                  <span className="text-slate-600 text-sm font-medium">模型：</span>
                  <div className="flex items-center justify-center gap-2 bg-slate-100 p-1 rounded-full">
                    <button
                      type="button"
                      onClick={() => onModelChange(ImageModel.IMAGEN)}
                      disabled={isLoading}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors duration-200 border ${activeModel === ImageModel.IMAGEN ? 'bg-slate-700 text-white border-slate-700' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'}`}
                    >
                      Imagen 4.0
                    </button>
                    <button
                      type="button"
                      onClick={() => onModelChange(ImageModel.DOUBAO_4_0)}
                      disabled={isLoading}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors duration-200 border ${activeModel === ImageModel.DOUBAO_4_0 ? 'bg-slate-700 text-white border-slate-700' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'}`}
                    >
                      豆包 4.0
                    </button>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                className="bg-indigo-600 mt-4 text-white font-bold py-3 px-12 text-lg rounded-full hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-transform duration-200 transform hover:scale-105 disabled:bg-slate-400 disabled:cursor-not-allowed disabled:scale-100"
                disabled={isLoading}
              >
                {isLoading ? '生成中...' : '生成连环画'}
              </button>
            </div>
          </form>
        </div>
      </section>

      <main className="container mx-auto px-4 py-12">
        <div className="mt-4">
          {isLoading ? (
            <LoadingState title="正在为您绘制连环画..." message="AI 正在努力创作，这可能需要一点时间。" />
          ) : images.length > 0 ? (
            <>
              <div className="flex flex-col sm:flex-row justify-between items-center mb-8 gap-4">
                <h2 className="text-2xl font-bold text-slate-700">生成结果</h2>
                {!isLoading && (
                   <button
                    onClick={hasGeneratedVideos ? () => onPhaseChange('completed') : onGenerateVideoScripts}
                    disabled={isGeneratingScripts}
                    className={`${hasGeneratedVideos ? 'bg-slate-600 hover:bg-slate-700 focus:ring-slate-500' : 'bg-purple-600 hover:bg-purple-700 focus:ring-purple-500'} text-white font-bold py-2.5 px-6 rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 transition-transform duration-200 transform hover:scale-105 disabled:bg-slate-400 disabled:cursor-not-allowed`}
                  >
                    {isGeneratingScripts ? '分析画面中...' : (hasGeneratedVideos ? '查看分镜详情' : '🎬 生成故事视频')}
                  </button>
                )}
              </div>
              <ImageGrid 
                images={images} 
                onImageClick={onImageClick}
                onToggleFavorite={onToggleFavorite}
                videoUrls={videoUrls}
                onEdit={onEditPanel}
              />
            </>
          ) : (
            <EmptyState icon="📖" title="输入故事，开始创作" message="在上方输入您的故事脚本，让我为您生成连环画吧！" />
          )}
        </div>
      </main>
    </>
  );
};
