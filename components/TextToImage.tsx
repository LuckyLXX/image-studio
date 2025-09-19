
import React, { useState } from 'react';
import { GeneratedImage, AspectRatio, ImageModel } from '../types';
import { LoadingState } from './LoadingState';
import { ImageGrid } from './ImageGrid';
import { EmptyState } from './EmptyState';
import { ImagePreview } from './ImagePreview';
import { InpaintingModal } from './InpaintingModal';
import { PromptBuilder } from './PromptBuilder';
import { resizeImage } from '../utils/imageUtils';
import { DownloadIcon } from './icons/DownloadIcon';
import { SparklesIcon } from './icons/SparklesIcon';
import { VideoIcon } from './icons/VideoIcon';
import { EditIcon } from './icons/EditIcon';
import { SquareIcon, RectangleHorizontalIcon, RectangleVerticalIcon } from './icons/AspectRatioIcons';
import { StarIcon } from './icons/StarIcon';

interface TextToImageProps {
  apiKey: string | null;
  onApiKeyNeeded: () => void;
  onGenerate: () => void;
  prompt: string;
  onPromptChange: (newPrompt: string) => void;
  generatedImages: GeneratedImage[];
  onNavigateToImageToImage: (sourceImageSrc: string) => void;
  onNavigateToVideo: (sourceImageSrc: string, sourcePrompt: string) => void;
  isLoading: boolean;
  onImageUpdate: (imageId: string, newSrc: string) => void;
  numberOfImages: number;
  onNumberOfImagesChange: (num: number) => void;
  aspectRatio: AspectRatio;
  onAspectRatioChange: (ratio: AspectRatio) => void;
  selectedKeywords: string[];
  onToggleKeyword: (keyword: string) => void;
  onToggleFavorite: (imageId: string) => void;
  activeModel: ImageModel;
  onModelChange: (model: ImageModel) => void;
}

const SettingButton: React.FC<{
  label: string;
  isActive: boolean;
  onClick: () => void;
  disabled: boolean;
  children?: React.ReactNode;
}> = ({ label, isActive, onClick, disabled, children }) => (
    <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        title={label}
        className={`w-full px-3 sm:px-4 py-2 rounded-lg transition-all duration-300 text-sm font-semibold whitespace-nowrap flex items-center justify-center gap-2 ${
          isActive
            ? 'bg-slate-800 text-white shadow'
            : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-300'
        } disabled:cursor-not-allowed disabled:opacity-60`}
    >
        {children}
    </button>
);


export const TextToImage: React.FC<TextToImageProps> = ({
  apiKey,
  onApiKeyNeeded,
  onGenerate,
  prompt,
  onPromptChange,
  generatedImages,
  onNavigateToImageToImage,
  onNavigateToVideo,
  isLoading,
  onImageUpdate,
  numberOfImages,
  onNumberOfImagesChange,
  aspectRatio,
  onAspectRatioChange,
  selectedKeywords,
  onToggleKeyword,
  onToggleFavorite,
  activeModel,
  onModelChange,
}) => {
  const [error, setError] = useState<string | null>(null);
  const [previewImageIndex, setPreviewImageIndex] = useState<number | null>(null);
  const [editingImage, setEditingImage] = useState<GeneratedImage | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) {
      setError('请输入您的创意指令。');
      return;
    }
    setError(null);
    onGenerate();
  };

  const handleDownload = () => {
    if (previewImageIndex === null) return;
    const { src, id } = generatedImages[previewImageIndex];
    const link = document.createElement('a');
    link.href = src;
    link.download = `以文生图-${id}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleContinueWithImage = () => {
    if (previewImageIndex === null) return;
    const { src } = generatedImages[previewImageIndex];
    onNavigateToImageToImage(src);
  };

  const handleGenerateVideo = () => {
    if (previewImageIndex === null) return;
    const { src } = generatedImages[previewImageIndex];
    onNavigateToVideo(src, prompt);
  };

  const handleInpaintingComplete = async (newImageSrc: string) => {
    if (!editingImage) return;
    try {
      const resizedSrc = await resizeImage(newImageSrc);
      onImageUpdate(editingImage.id, resizedSrc);
      setEditingImage(null);
    } catch (err) {
      setError("处理编辑后的图片失败。");
      setEditingImage(null);
    }
  };

  const currentImage = previewImageIndex !== null ? generatedImages[previewImageIndex] : null;

  const handleToggleFavoriteInPreview = () => {
    if (currentImage) {
      onToggleFavorite(currentImage.id);
    }
  };

  const previewActions = [
    {
        label: '收藏',
        icon: <StarIcon className="w-5 h-5" />,
        onClick: handleToggleFavoriteInPreview,
        isActive: !!currentImage?.isFavorite
    },
    {
      label: '局部重绘',
      icon: <EditIcon className="w-5 h-5" />,
      onClick: () => {
        if (previewImageIndex !== null) {
          setEditingImage(generatedImages[previewImageIndex]);
          setPreviewImageIndex(null);
        }
      },
    },
    {
      label: '二次创作',
      icon: <SparklesIcon className="w-5 h-5" />,
      onClick: handleContinueWithImage,
    },
    {
      label: '生成视频',
      icon: <VideoIcon className="w-5 h-5" />,
      onClick: handleGenerateVideo,
    },
    {
      label: '下载',
      icon: <DownloadIcon className="w-5 h-5" />,
      onClick: handleDownload,
    },
  ];

  return (
    <>
      <section className="w-full flex flex-col items-center justify-center py-12 md:py-16 bg-white border-b border-slate-200">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-6xl font-extrabold text-slate-800 tracking-tight">
            妙笔生画，<span className="text-indigo-600">想象无界</span>
          </h1>
          <p className="mt-4 text-base md:text-lg text-slate-600 max-w-2xl mx-auto">
            输入您的创意指令，即可生成新的视觉杰作。
          </p>
          <form onSubmit={handleSubmit} className="mt-10 max-w-4xl mx-auto">
            <div className="flex flex-col items-center gap-4">
                <textarea
                  value={prompt}
                  onChange={(e) => {
                    onPromptChange(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="例如：一只穿着宇航服的猫在月球上，背景是地球升起，写实风格，4k高清"
                  rows={4}
                  className={`w-full px-6 py-4 bg-white border rounded-2xl shadow-lg transition duration-200 text-lg resize-y ${
                    error
                      ? 'border-red-500 focus:ring-2 focus:ring-red-500/50 focus:border-red-500'
                      : 'border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500'
                  }`}
                  disabled={isLoading}
                />

                <PromptBuilder
                  onToggleKeyword={onToggleKeyword}
                  selectedKeywords={selectedKeywords}
                  disabled={isLoading}
                />
                
                <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-4 text-left mt-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-600 mb-2">图片数量</label>
                         <div className="grid grid-cols-4 gap-2">
                           {[1, 2, 3, 4].map(num => (
                               <SettingButton key={num} label={`${num}张`} isActive={numberOfImages === num} onClick={() => onNumberOfImagesChange(num)} disabled={isLoading}>
                                 <span>{num}</span>
                               </SettingButton>
                           ))}
                        </div>
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-slate-600 mb-2">图片比例</label>
                         <div className="grid grid-cols-3 gap-2">
                            <SettingButton label="方形 1:1" isActive={aspectRatio === '1:1'} onClick={() => onAspectRatioChange('1:1')} disabled={isLoading}>
                                <SquareIcon className="w-5 h-5" />
                                <span>1:1</span>
                            </SettingButton>
                             <SettingButton label="横屏 16:9" isActive={aspectRatio === '16:9'} onClick={() => onAspectRatioChange('16:9')} disabled={isLoading}>
                                <RectangleHorizontalIcon className="w-5 h-5" />
                                <span>16:9</span>
                            </SettingButton>
                             <SettingButton label="竖屏 9:16" isActive={aspectRatio === '9:16'} onClick={() => onAspectRatioChange('9:16')} disabled={isLoading}>
                                <RectangleVerticalIcon className="w-5 h-5" />
                                <span>9:16</span>
                            </SettingButton>
                        </div>
                    </div>
                </div>

        <div className="w-full text-left mt-2">
          <label className="block text-sm font-medium text-slate-600 mb-2">生成模型</label>
          <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-full w-max">
            <SettingButton label="Imagen 4.0" isActive={activeModel === ImageModel.IMAGEN} onClick={() => onModelChange(ImageModel.IMAGEN)} disabled={isLoading}>
              <span>Imagen 4.0</span>
            </SettingButton>
            <SettingButton label="Nano-Banana" isActive={activeModel === ImageModel.NANO_BANANA} onClick={() => onModelChange(ImageModel.NANO_BANANA)} disabled={isLoading}>
              <span>Nano-Banana</span>
            </SettingButton>
            <SettingButton label="豆包 4.0" isActive={activeModel === ImageModel.DOUBAO_4_0} onClick={() => onModelChange(ImageModel.DOUBAO_4_0)} disabled={isLoading}>
              <span>豆包 4.0</span>
            </SettingButton>
          </div>
        </div>

                 {error && <p className="text-sm text-red-600">{error}</p>}
                <button
                  type="submit"
                  className="bg-indigo-600 mt-4 text-white font-bold py-3 px-12 text-lg rounded-full hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-transform duration-200 transform hover:scale-105 disabled:bg-slate-400 disabled:cursor-not-allowed disabled:scale-100"
                  disabled={isLoading}
                >
                  {isLoading ? '生成中...' : '生成图片'}
                </button>
            </div>
          </form>
        </div>
      </section>

      <main className="container mx-auto px-4 py-12">
        {error && !prompt.trim() && (
            <div className="mb-8 text-center bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg" role="alert">
                <strong className="font-bold">错误：</strong>
                <span className="block sm:inline">{error}</span>
            </div>
        )}

        <div className="mt-4">
          {isLoading ? (
            <LoadingState title="正在为您生成新的杰作..." message="AI 正在努力创作，这可能需要一点时间。" />
          ) : generatedImages.length > 0 ? (
            <ImageGrid 
              images={generatedImages} 
              onImageClick={setPreviewImageIndex}
              onToggleFavorite={onToggleFavorite}
            />
          ) : (
            <EmptyState icon="✨" title="输入描述，开始创作" message="在上方输入您的想法，让我为您生成图片吧！" />
          )}
        </div>
      </main>

      <ImagePreview
        images={generatedImages}
        currentIndex={previewImageIndex}
        onClose={() => setPreviewImageIndex(null)}
        onChange={setPreviewImageIndex}
        actions={previewActions}
      />

      <InpaintingModal
        isOpen={!!editingImage}
        onClose={() => setEditingImage(null)}
        image={editingImage}
        apiKey={apiKey}
        onComplete={handleInpaintingComplete}
        onApiKeyNeeded={onApiKeyNeeded}
      />
    </>
  );
};
