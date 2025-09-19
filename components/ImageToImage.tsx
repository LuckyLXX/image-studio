
import React, { useState, useEffect, useMemo } from 'react';
import { GeneratedImage, AspectRatio, InspirationStrength, ImageModel } from '../types';
import { generateFromImageAndPrompt, generateWithStyleInspiration } from '../services/geminiService';
import { generateImageToImageWithVolcEngine, generateImageFusionWithVolcEngine } from '../services/volcengineService';
import { ImageUploader } from './ImageUploader';
import { LoadingState } from './LoadingState';
import { ImageGrid } from './ImageGrid';
import { EmptyState } from './EmptyState';
import { ImagePreview } from './ImagePreview';
import { InpaintingModal } from './InpaintingModal';
import { resizeImage, base64ToFile, fileToBase64 } from '../utils/imageUtils';
import { DownloadIcon } from './icons/DownloadIcon';
import { SparklesIcon } from './icons/SparklesIcon';
import { VideoIcon } from './icons/VideoIcon';
import { EditIcon } from './icons/EditIcon';
import { StarIcon } from './icons/StarIcon';
import { SquareIcon, RectangleHorizontalIcon, RectangleVerticalIcon } from './icons/AspectRatioIcons';

interface ImageToImageProps {
  apiKey: string | null;
  onApiKeyNeeded: () => void;
  onGenerationStart: () => void;
  onGenerationEnd: () => void;
  onResult: (prompt: string, images: GeneratedImage[], sourceFile: File, mode: 'edit' | 'inspiration', settings: { numImages?: number, aspectRatio?: AspectRatio, strength?: InspirationStrength }) => Promise<void>;
  prompt: string;
  onPromptChange: (newPrompt: string) => void;
  generatedImages: GeneratedImage[];
  onNavigateToVideo: (sourceImageSrc: string, sourcePrompt: string) => void;
  isLoading: boolean;
  onImageUpdate: (imageId: string, newSrc: string) => void;
  initialStartFile?: File | null;
  onStartFileChange?: (file: File | null) => void;
  i2iMode: 'edit' | 'inspiration';
  onI2iModeChange: (mode: 'edit' | 'inspiration') => void;
  inspirationAspectRatio: AspectRatio;
  onInspirationAspectRatioChange: (ratio: AspectRatio) => void;
  inspirationStrength: InspirationStrength;
  onInspirationStrengthChange: (strength: InspirationStrength) => void;
  onToggleFavorite: (imageId: string) => void;
  activeModel: ImageModel;
  onModelChange: (model: ImageModel) => void;
}

const ModeButton: React.FC<{
  label: string;
  icon: React.ReactNode;
  isActive: boolean;
  onClick: () => void;
  disabled: boolean;
}> = ({ label, icon, isActive, onClick, disabled }) => (
    <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={`w-full px-4 py-2 rounded-full transition-all duration-300 text-sm font-semibold whitespace-nowrap flex items-center justify-center gap-2 ${
          isActive
            ? 'bg-indigo-600 text-white shadow-md'
            : 'bg-transparent text-slate-600 hover:bg-slate-100'
        } disabled:cursor-not-allowed disabled:opacity-60`}
    >
        {icon}
        {label}
    </button>
);

export const ImageToImage: React.FC<ImageToImageProps> = ({ 
  apiKey, 
  onApiKeyNeeded, 
  onGenerationStart,
  onGenerationEnd,
  onResult,
  prompt,
  onPromptChange,
  generatedImages,
  onNavigateToVideo,
  isLoading,
  onImageUpdate,
  initialStartFile,
  onStartFileChange,
  i2iMode,
  onI2iModeChange,
  inspirationAspectRatio,
  onInspirationAspectRatioChange,
  inspirationStrength,
  onInspirationStrengthChange,
  onToggleFavorite,
  activeModel,
  onModelChange
}) => {
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editingImage, setEditingImage] = useState<GeneratedImage | null>(null);
  const [previewState, setPreviewState] = useState<{ type: 'uploaded' | 'generated', index: number } | null>(null);
  const [isComparing, setIsComparing] = useState(false);

  const strengthOptions: { value: InspirationStrength; label: string; description: string; }[] = [
    { value: 'low', label: '弱', description: '轻度借鉴风格' },
    { value: 'medium', label: '中', description: '明显风格倾向' },
    { value: 'high', label: '强', description: '严格遵循风格' },
    { value: 'veryHigh', label: '极强', description: '复刻画面风格' },
  ];

  const uploadedFileUrls = useMemo(() => 
    uploadedFiles.map(file => URL.createObjectURL(file)), 
    [uploadedFiles]
  );
  
  useEffect(() => {
    return () => {
        uploadedFileUrls.forEach(url => URL.revokeObjectURL(url));
    };
  }, [uploadedFileUrls]);
  
  useEffect(() => {
    if (initialStartFile) {
        setUploadedFiles([initialStartFile]);
    } else {
        setUploadedFiles([]);
    }
  }, [initialStartFile]);
  
  const handleFilesChange = (newFiles: File[]) => {
      setUploadedFiles(newFiles);
      if (onStartFileChange) {
          onStartFileChange(newFiles.length > 0 ? newFiles[0] : null);
      }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey) {
      onApiKeyNeeded();
      return;
    }
    if (uploadedFiles.length === 0) {
        setError(i2iMode === 'inspiration' ? '请上传一张参考图。' : '请至少上传一张图片。');
        return;
    }
    if (!prompt.trim()) {
        setError(i2iMode === 'inspiration' ? '请输入您的新主题。' : '请输入您的创意指令。');
        return;
    }

    setError(null);
    onGenerationStart();
    setPreviewState(null);

    try {
      let imageUrls: string[];
      let resultSettings: { strength?: InspirationStrength } = {};

      if (i2iMode === 'inspiration') {
        if (activeModel === ImageModel.DOUBAO_4_0) {
          // 豆包4.0：多图融合/风格启发（上限15张）
          const filesCapped = uploadedFiles.slice(0, 15);
          // 尺寸较大的图片会导致请求体过大，先做等比压缩到 1600px 边长
          const base64Array = await Promise.all(filesCapped.map(async (file) => {
            try {
              const imgData = await fileToBase64(file);
              return imgData;
            } catch (e) {
              return await fileToBase64(file);
            }
          }));
          imageUrls = await generateImageFusionWithVolcEngine(prompt, base64Array, apiKey);
        } else {
          imageUrls = await generateWithStyleInspiration(uploadedFiles[0], prompt, apiKey, inspirationStrength);
        }
        resultSettings = { strength: inspirationStrength };
      } else {
        if (activeModel === ImageModel.DOUBAO_4_0) {
          const base64 = await fileToBase64(uploadedFiles[0]);
          imageUrls = await generateImageToImageWithVolcEngine(prompt, base64, apiKey);
        } else {
          imageUrls = await generateFromImageAndPrompt(prompt, uploadedFiles, apiKey);
        }
      }
      
      const resizedImageUrls = await Promise.all(
        imageUrls.map(src => resizeImage(src))
      );

      const imagesWithIds = resizedImageUrls.map((src, index) => ({
        id: `${Date.now()}-${index}`,
        src,
        isFavorite: false,
      }));
      
      await onResult(prompt, imagesWithIds, uploadedFiles[0], i2iMode, resultSettings);

    } catch (err) {
      setError(err instanceof Error ? err.message : '发生未知错误。');
    } finally {
      onGenerationEnd();
    }
  };
  
  const handleDownload = () => {
    if (previewState === null || previewState.type !== 'generated') return;
    const { src } = generatedImages[previewState.index];
    const link = document.createElement('a');
    link.href = src;
    link.download = `以图生图-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleContinueWithImage = async () => {
    if (previewState === null || previewState.type !== 'generated') return;
    const { src } = generatedImages[previewState.index];
    try {
        const newFile = await base64ToFile(src, `continued-creation-${Date.now()}.png`);
        handleFilesChange([newFile]);
        setPreviewState(null);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
        setError(err instanceof Error ? err.message : '无法使用此图片继续创作。');
    }
  };

  const handleGenerateVideo = () => {
    if (previewState === null || previewState.type !== 'generated') return;
    const { src } = generatedImages[previewState.index];
    onNavigateToVideo(src, prompt);
  };
  
  const handleInpaintingComplete = async (newImageSrc: string) => {
    if (!editingImage) return;
    try {
      const resizedSrc = await resizeImage(newImageSrc);
      onImageUpdate(editingImage.id, resizedSrc);
      setEditingImage(null); // Close modal
    } catch (err) {
      setError("处理编辑后的图片失败。");
      setEditingImage(null);
    }
  };

  const handlePreviewUploaded = (index: number) => {
    setPreviewState({ type: 'uploaded', index });
  };
  
  const handlePreviewGenerated = (index: number) => {
    setPreviewState({ type: 'generated', index });
    setIsComparing(false);
  };

  const previewImages = useMemo(() => {
    if (!previewState) return null;
    if (previewState.type === 'generated') return generatedImages;
    if (previewState.type === 'uploaded') {
      return uploadedFiles.map((file, i) => ({
        id: `uploaded-${file.name}-${i}`,
        src: uploadedFileUrls[i],
        isFavorite: false,
      }));
    }
    return null;
  }, [previewState, generatedImages, uploadedFiles, uploadedFileUrls]);


  const previewActions = useMemo(() => {
    if (previewState?.type !== 'generated') return [];
    const currentImage = generatedImages[previewState.index];
    
    return [
        {
            label: '收藏',
            icon: <StarIcon className="w-5 h-5" />,
            onClick: () => {
                if (currentImage) {
                    onToggleFavorite(currentImage.id);
                }
            },
            isActive: !!currentImage?.isFavorite,
        },
        {
            label: '局部重绘',
            icon: <EditIcon className="w-5 h-5" />,
            onClick: () => {
                if (previewState !== null) {
                  setEditingImage(generatedImages[previewState.index]);
                  setPreviewState(null);
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
        }
    ];
  }, [previewState, generatedImages, onToggleFavorite]);
  
  return (
    <>
      <section className="w-full flex flex-col items-center justify-center py-12 md:py-16 bg-slate-50 border-b border-slate-200">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-6xl font-extrabold text-slate-800 tracking-tight">
            一图万变，<span className="text-indigo-600">创意接力</span>
          </h1>
          <p className="mt-4 text-base md:text-lg text-slate-600 max-w-2xl mx-auto">
            {i2iMode === 'edit' ? '上传您的图片，输入创意指令，即可进行编辑或二次创作。' : '上传一张参考图，输入全新主题，借鉴其风格生成新图片。'}
          </p>
          
          <div className="max-w-5xl mx-auto mt-10 text-left bg-white p-6 md:p-8 rounded-2xl shadow-xl border border-slate-200">
            <div className="flex flex-col gap-8">
              <div className="flex justify-center">
                  <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-full w-full max-w-xs">
                      <ModeButton label="编辑创作" icon={<EditIcon className="w-4 h-4" />} isActive={i2iMode === 'edit'} onClick={() => onI2iModeChange('edit')} disabled={isLoading} />
                      <ModeButton label="灵感启发" icon={<SparklesIcon className="w-4 h-4" />} isActive={i2iMode === 'inspiration'} onClick={() => onI2iModeChange('inspiration')} disabled={isLoading} />
                  </div>
              </div>

              <div className="flex justify-center">
                <div className="flex items-center justify-center gap-2 bg-slate-100 p-1 rounded-full w-full max-w-xs">
                  <button
                    type="button"
                    onClick={() => onModelChange(ImageModel.IMAGEN)}
                    disabled={isLoading}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors duration-200 border ${activeModel === ImageModel.IMAGEN ? 'bg-slate-700 text-white border-slate-700' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'}`}
                    title="使用 Imagen 4.0"
                  >
                    Imagen 4.0
                  </button>
                  <button
                    type="button"
                    onClick={() => onModelChange(ImageModel.DOUBAO_4_0)}
                    disabled={isLoading}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors duration-200 border ${activeModel === ImageModel.DOUBAO_4_0 ? 'bg-slate-700 text-white border-slate-700' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'}`}
                    title="使用豆包 4.0"
                  >
                    豆包 4.0
                  </button>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-8 items-stretch">
                
                {/* Left Column: Uploader & Settings */}
                <div className="flex flex-col gap-8">
                  <div>
                    <h2 className="text-xl font-bold text-slate-700 mb-3">{i2iMode === 'inspiration' ? '1. 上传参考图（可多张）' : '1. 上传图片'}</h2>
                    <ImageUploader files={uploadedFiles} onFilesChange={handleFilesChange} disabled={isLoading} maxFiles={i2iMode === 'inspiration' ? 5 : 5} onPreviewClick={handlePreviewUploaded} />
                    {i2iMode === 'inspiration' && (
                      <p className="mt-2 text-xs text-slate-500">最多可选 15 张（豆包4.0 限制）。当前已选 {uploadedFiles.length} 张。</p>
                    )}
                  </div>
                   {i2iMode === 'inspiration' && (
                    <div className="animate-fade-in">
                      <h3 className="text-xl font-bold text-slate-700 mb-3">2. 风格化强度</h3>
                      <p className="text-sm text-slate-500 mb-4">控制生成图片与参考图风格的相似程度。</p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {strengthOptions.map(opt => (
                            <button
                                key={opt.value}
                                type="button"
                                onClick={() => onInspirationStrengthChange(opt.value)}
                                disabled={isLoading}
                                title={opt.description}
                                className={`px-3 py-2 rounded-lg text-center transition-all ${
                                    inspirationStrength === opt.value
                                        ? 'bg-indigo-100 text-indigo-700 border-indigo-300 ring-2 ring-indigo-200'
                                        : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                                } border disabled:opacity-60`}
                            >
                                <span className="font-semibold text-sm">{opt.label}</span>
                            </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Right Column: Prompt & Generate Button */}
                <div className="flex flex-col">
                    <h2 className="text-xl font-bold text-slate-700 mb-3">{i2iMode === 'inspiration' ? '3. 输入新主题' : '2. 输入创意指令'}</h2>
                    <textarea
                        value={prompt}
                        onChange={(e) => onPromptChange(e.target.value)}
                        placeholder={i2iMode === 'inspiration' ? '例如：一只戴着皇冠的狮子' : '例如：为图片中的人物戴上一副太阳镜'}
                        className="w-full flex-grow px-4 py-3 bg-slate-50 border border-slate-300 rounded-lg shadow-sm transition duration-200 text-base focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
                        rows={10}
                        disabled={isLoading}
                    />
                     <button
                        type="button"
                        onClick={handleGenerate}
                        className="w-full mt-4 bg-indigo-600 text-white font-bold py-3 px-8 rounded-full hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-transform duration-200 transform hover:scale-105 disabled:bg-slate-400 disabled:cursor-not-allowed disabled:scale-100 text-lg"
                        disabled={isLoading}
                    >
                        {isLoading ? '生成中...' : '✨ 生成图片'}
                    </button>
                </div>

              </div>
              {error && <p className="mt-4 text-center text-red-600">{error}</p>}
            </div>
          </div>
        </div>
      </section>

      <main className="container mx-auto px-4 py-12">
        <div className="mt-4">
          {isLoading ? (
            <LoadingState title="AI 正在创作中..." message="请稍候，您的新图片即将呈现。" />
          ) : generatedImages.length > 0 ? (
            <ImageGrid
              images={generatedImages}
              onImageClick={handlePreviewGenerated}
              onToggleFavorite={onToggleFavorite}
            />
          ) : (
            <EmptyState icon="🖼️" title="上传图片，开始创作" message="在上方上传图片并输入指令，让我为您生成新的创意图片吧！" />
          )}
        </div>
      </main>

      <ImagePreview 
        images={previewImages}
        currentIndex={previewState?.index ?? null}
        onClose={() => setPreviewState(null)}
        onChange={(newIndex) => {
          setPreviewState(p => p ? { ...p, index: newIndex } : null);
          setIsComparing(false);
        }}
        actions={isComparing ? [] : previewActions}
        sourceImageSrc={previewState?.type === 'generated' && uploadedFiles.length > 0 ? uploadedFileUrls[0] : undefined}
        isComparing={isComparing}
        onToggleCompare={() => setIsComparing(p => !p)}
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
