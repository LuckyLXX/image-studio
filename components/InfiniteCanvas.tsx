import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ImageUploader } from './ImageUploader';
import { generateInpainting } from '../services/geminiService';
import { generateInpaintingWithVolcEngine } from '../services/volcengineService';
import { ImageModel } from '../types';
import { fileToBase64, base64ToFile } from '../utils/imageUtils';
import { DownloadIcon } from './icons/DownloadIcon';
import { XMarkIcon } from './icons/XMarkIcon';
import { PlusIcon } from './icons/PlusIcon';
import { MinusIcon } from './icons/MinusIcon';
import { FitScreenIcon } from './icons/FitScreenIcon';
import { CheckIcon } from './icons/CheckIcon';
import { ChevronLeftIcon, ChevronRightIcon, ChevronUpIcon, ChevronDownIcon } from './icons/ChevronIcons';


interface InfiniteCanvasProps {
  apiKey: string | null;
  onApiKeyNeeded: () => void;
  onResult: (prompt: string, finalImage: string, sourceFile: File) => Promise<void>;
  initialPrompt: string;
  onPromptChange: (newPrompt: string) => void;
  initialStartFile: File | null;
  onStartFileChange: (file: File | null) => void;
  isLoading: boolean;
  onGenerationStart: () => void;
  onGenerationEnd: () => void;
  activeModel?: ImageModel;
  volcengineApiKey?: string | null;
  onModelChange?: (model: ImageModel) => void;
}

type Direction = 'N' | 'E' | 'S' | 'W';

interface Expansion {
  direction: Direction;
  size: number; // in world pixels (image coordinate space)
}

interface ViewTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
}

const MAX_DIMENSION = 20480;

export const InfiniteCanvas: React.FC<InfiniteCanvasProps> = ({
  apiKey,
  onApiKeyNeeded,
  onResult,
  initialPrompt,
  onPromptChange,
  initialStartFile,
  onStartFileChange,
  isLoading,
  onGenerationStart,
  onGenerationEnd,
  activeModel = ImageModel.IMAGEN,
  volcengineApiKey,
  onModelChange,
}) => {
  const [startFile, setStartFile] = useState<File | null>(initialStartFile);
  const [currentImage, setCurrentImage] = useState<HTMLImageElement | null>(null);
  const [undoStack, setUndoStack] = useState<string[]>([]);
  const [redoStack, setRedoStack] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [hasFinished, setHasFinished] = useState(false);

  const [activeExpansion, setActiveExpansion] = useState<Expansion | null>(null);
  const [showSizeHint, setShowSizeHint] = useState(false);
  const dragStateRef = useRef<{ direction: Direction; start: { x: number; y: number }; maxDelta: number } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);

  const [viewTransform, setViewTransform] = useState<ViewTransform>({ scale: 1, offsetX: 0, offsetY: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const panState = useRef({ isPanning: false, startX: 0, startY: 0, startOffsetX: 0, startOffsetY: 0 });

  const fitToScreen = useCallback((image: HTMLImageElement | null) => {
    const container = canvasContainerRef.current;
    if (!container || !image) return;
    
    const { width, height } = container.getBoundingClientRect();
    if (width === 0 || height === 0) return; // Safeguard
    const scale = Math.min(width / image.width, height / image.height) * 0.95; // 95% padding
    const offsetX = (width - image.width * scale) / 2;
    const offsetY = (height - image.height * scale) / 2;
    
    setViewTransform({ scale, offsetX, offsetY });
  }, []);

  const resetState = useCallback(() => {
    setUndoStack([]);
    setRedoStack([]);
    setError(null);
    setActiveExpansion(null);
    dragStateRef.current = null;
    setHasFinished(false);
    if (startFile) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          setCurrentImage(img);
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(startFile);
    } else {
      setCurrentImage(null);
    }
  }, [startFile]);

  // Effect for a robust initial fit using ResizeObserver.
  // This ensures that the image is fitted correctly even if the
  // container's layout takes time to settle, which is common on mobile.
  useEffect(() => {
    const container = canvasContainerRef.current;
    if (!container || !currentImage) return;

    const resizeObserver = new ResizeObserver((entries) => {
      if (entries[0].contentRect.width > 0 && entries[0].contentRect.height > 0) {
        fitToScreen(currentImage);
        // Disconnect after the first successful fit to avoid overriding user's pan/zoom.
        resizeObserver.disconnect();
      }
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, [currentImage, fitToScreen]);

  useEffect(() => {
    setStartFile(initialStartFile);
    resetState();
  }, [initialStartFile, resetState]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = canvasContainerRef.current;
    const ctx = canvas?.getContext('2d');
    
    if (!ctx || !container) return;

    const { width, height } = container.getBoundingClientRect();
    canvas!.width = width;
    canvas!.height = height;

    ctx.clearRect(0, 0, width, height);
    if(currentImage) {
        ctx.save();
        ctx.translate(viewTransform.offsetX, viewTransform.offsetY);
        ctx.scale(viewTransform.scale, viewTransform.scale);
        ctx.drawImage(currentImage, 0, 0);
        ctx.restore();
    }
  }, [currentImage, viewTransform]);

  const handleDragStart = (direction: Direction, e: React.MouseEvent | React.TouchEvent) => {
    if (isLoading || activeExpansion || panState.current.isPanning || !currentImage) return;
    e.preventDefault();
    e.stopPropagation();
    const startX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const startY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const imageRect = {
        x: viewTransform.offsetX,
        y: viewTransform.offsetY,
        width: currentImage.width * viewTransform.scale,
        height: currentImage.height * viewTransform.scale,
    };
    
    const canvas = canvasRef.current;
    if (!canvas) return;

    let maxDelta = Infinity;
    if (direction === 'N') maxDelta = imageRect.y;
    else if (direction === 'S') maxDelta = canvas.height - (imageRect.y + imageRect.height);
    else if (direction === 'W') maxDelta = imageRect.x;
    else if (direction === 'E') maxDelta = canvas.width - (imageRect.x + imageRect.width);
    
    dragStateRef.current = {
      direction,
      start: { x: startX, y: startY },
      maxDelta: Math.max(0, maxDelta)
    };
    setIsDragging(true);
  };

  useEffect(() => {
    if (!isDragging) {
        return;
    }

    const handleDragMove = (e: MouseEvent | TouchEvent) => {
        if (!dragStateRef.current || !currentImage) return;
        e.preventDefault();
        const { direction, start, maxDelta } = dragStateRef.current;
        
        const currentX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const currentY = 'touches' in e ? e.touches[0].clientY : e.clientY;
        
        let delta = 0;
        if (direction === 'N') delta = start.y - currentY;
        else if (direction === 'S') delta = currentY - start.y;
        else if (direction === 'W') delta = start.x - currentX;
        else if (direction === 'E') delta = currentX - start.x;

        const constrainedDelta = Math.min(delta, maxDelta);
        const newScreenSize = Math.max(0, Math.round(constrainedDelta));
        
        let minScreenSize = 0;
        if (direction === 'N' || direction === 'S') {
            minScreenSize = (currentImage.height / 7) * viewTransform.scale;
        } else { // 'W' or 'E'
            minScreenSize = (currentImage.width / 7) * viewTransform.scale;
        }

        setShowSizeHint(newScreenSize > 0 && newScreenSize < minScreenSize);
        
        const newWorldSize = newScreenSize / viewTransform.scale;
        setActiveExpansion({ direction, size: newWorldSize });
    };

    const handleDragEnd = () => {
        setShowSizeHint(false);
        setActiveExpansion(currentExpansion => {
            if (!currentExpansion || !currentImage) return null;

            let minWorldSize = 0;
            if (currentExpansion.direction === 'N' || currentExpansion.direction === 'S') {
                minWorldSize = currentImage.height / 7;
            } else { // 'W' or 'E'
                minWorldSize = currentImage.width / 7;
            }

            if (currentExpansion.size < minWorldSize) {
                return null;
            }
            return currentExpansion;
        });
        dragStateRef.current = null;
        setIsDragging(false);
    };

    window.addEventListener('mousemove', handleDragMove);
    window.addEventListener('mouseup', handleDragEnd);
    window.addEventListener('touchmove', handleDragMove, { passive: false });
    window.addEventListener('touchend', handleDragEnd);

    return () => {
        window.removeEventListener('mousemove', handleDragMove);
        window.removeEventListener('mouseup', handleDragEnd);
        window.removeEventListener('touchmove', handleDragMove);
        window.removeEventListener('touchend', handleDragEnd);
    };
  }, [isDragging, viewTransform.scale, currentImage]);

  const handleZoom = useCallback((factor: number, centerX: number, centerY: number) => {
    setViewTransform(prev => {
        const newScale = Math.max(0.01, Math.min(prev.scale * factor, 10));
        const worldMouseX = (centerX - prev.offsetX) / prev.scale;
        const worldMouseY = (centerY - prev.offsetY) / prev.scale;
        
        const newOffsetX = centerX - worldMouseX * newScale;
        const newOffsetY = centerY - worldMouseY * newScale;
        
        return { scale: newScale, offsetX: newOffsetX, offsetY: newOffsetY };
    });
  }, []);

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    if (isLoading) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    handleZoom(zoomFactor, mouseX, mouseY);
  }, [isLoading, handleZoom]);
  
  const handleCanvasPanMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!panState.current.isPanning) return;
    
    if ('touches' in e) {
      e.preventDefault();
    }

    const currentX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const currentY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const dx = currentX - panState.current.startX;
    const dy = currentY - panState.current.startY;
    setViewTransform({
        scale: viewTransform.scale,
        offsetX: panState.current.startOffsetX + dx,
        offsetY: panState.current.startOffsetY + dy,
    });
  }, [viewTransform.scale]);

  const handleCanvasPanEnd = useCallback(() => {
    if (panState.current.isPanning) {
        panState.current.isPanning = false;
        if(canvasContainerRef.current) canvasContainerRef.current.style.cursor = 'grab';
    }
  }, []);

  useEffect(() => {
    const container = canvasContainerRef.current;
    if (container) {
      container.addEventListener('wheel', handleWheel, { passive: false });
      window.addEventListener('mousemove', handleCanvasPanMove);
      window.addEventListener('mouseup', handleCanvasPanEnd);
      window.addEventListener('touchmove', handleCanvasPanMove, { passive: false });
      window.addEventListener('touchend', handleCanvasPanEnd);
    }
    return () => {
      if (container) container.removeEventListener('wheel', handleWheel);
      window.removeEventListener('mousemove', handleCanvasPanMove);
      window.removeEventListener('mouseup', handleCanvasPanEnd);
      window.removeEventListener('touchmove', handleCanvasPanMove);
      window.removeEventListener('touchend', handleCanvasPanEnd);
    };
  }, [handleWheel, handleCanvasPanMove, handleCanvasPanEnd]);
  
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (dragStateRef.current || e.button !== 0) return;
    if (isLoading || isDragging) return;

    panState.current = {
        isPanning: true,
        startX: e.clientX,
        startY: e.clientY,
        startOffsetX: viewTransform.offsetX,
        startOffsetY: viewTransform.offsetY,
    };
    if(canvasContainerRef.current) canvasContainerRef.current.style.cursor = 'grabbing';
  };
  
  const handleCanvasTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    if (dragStateRef.current) return;
    if (isLoading || isDragging) return;

    const touch = e.touches[0];
    panState.current = {
      isPanning: true,
      startX: touch.clientX,
      startY: touch.clientY,
      startOffsetX: viewTransform.offsetX,
      startOffsetY: viewTransform.offsetY,
    };
  };

  const handleGenerate = async () => {
    const needVolc = activeModel === ImageModel.DOUBAO_4_0;
    const keyToUse = needVolc ? volcengineApiKey : apiKey;
    if (!keyToUse) { onApiKeyNeeded(); return; }
    if (!currentImage || !activeExpansion) { setError("无效的操作。"); return; }
    if (!initialPrompt.trim()) { setError("请输入您的创意指令。"); return; }
    
    const { direction, size } = activeExpansion;
    const expansionSize = Math.round(size);

    if (expansionSize <= 0) {
        setError("扩展区域太小。");
        setActiveExpansion(null);
        return;
    }
    
    const newTotalWidth = currentImage.width + (direction === 'E' || direction === 'W' ? expansionSize : 0);
    const newTotalHeight = currentImage.height + (direction === 'N' || direction === 'S' ? expansionSize : 0);

    if (newTotalWidth > MAX_DIMENSION || newTotalHeight > MAX_DIMENSION) {
        setError(`图片尺寸不能超过 ${MAX_DIMENSION}px。`);
        setActiveExpansion(null);
        return;
    }

    onGenerationStart();
    setError(null);
    setActiveExpansion(null);

    const oldImage = currentImage;
    const oldW = oldImage.width;
    const oldH = oldImage.height;

    let dx = 0, dy = 0;
    if (direction === 'N') dy = expansionSize;
    if (direction === 'W') dx = expansionSize;

    try {
      const combinedCanvas = document.createElement('canvas');
      combinedCanvas.width = newTotalWidth;
      combinedCanvas.height = newTotalHeight;
      combinedCanvas.getContext('2d')?.drawImage(oldImage, dx, dy);
      const originalFile = await base64ToFile(combinedCanvas.toDataURL('image/png'), 'original.png');
      
      const maskCanvas = document.createElement('canvas');
      maskCanvas.width = newTotalWidth;
      maskCanvas.height = newTotalHeight;
      const maskCtx = maskCanvas.getContext('2d');
      if (!maskCtx) throw new Error("Could not create mask context.");

      maskCtx.fillStyle = 'black';
      maskCtx.fillRect(0, 0, newTotalWidth, newTotalHeight);
      maskCtx.fillStyle = 'white';
      
      switch (direction) {
        case 'N': maskCtx.fillRect(dx, 0, oldW, expansionSize); break;
        case 'S': maskCtx.fillRect(dx, oldH + dy, oldW, expansionSize); break;
        case 'W': maskCtx.fillRect(0, dy, expansionSize, oldH); break;
        case 'E': maskCtx.fillRect(oldW + dx, dy, expansionSize, oldH); break;
      }
      const maskFile = await base64ToFile(maskCanvas.toDataURL('image/png'), 'mask.png');
      
      const outpaintingPrompt = `Task: Outpainting. Using the provided mask, fill the masked (white) area of the original image with content that seamlessly extends the existing image, following this description: "${initialPrompt}". Maintain the original image's style and content and ensure a natural transition.`;
      let result: string[];
      if (needVolc) {
        // 读回 base64
        const origDataUrl = combinedCanvas.toDataURL('image/png');
        const maskDataUrl = maskCanvas.toDataURL('image/png');
        result = await generateInpaintingWithVolcEngine(outpaintingPrompt, origDataUrl, maskDataUrl, keyToUse, '1024x1024');
      } else {
        result = await generateInpainting(outpaintingPrompt, originalFile, maskFile, keyToUse);
      }

      if (result.length > 0) {
        setUndoStack(prev => [...prev, oldImage.src]);
        setRedoStack([]);
        const newImg = new Image();
        newImg.onload = () => setCurrentImage(newImg);
        newImg.src = result[0];
        setHasFinished(false);
      } else {
        setError("AI未能生成图片，请重试。");
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : '发生未知错误。');
    } finally {
      onGenerationEnd();
    }
  };

  const handlePrevious = () => {
    if (undoStack.length === 0 || !currentImage) return;
    const lastState = undoStack[undoStack.length - 1];
    setUndoStack(undoStack.slice(0, -1));
    setRedoStack(prev => [currentImage.src, ...prev]);
    const img = new Image();
    img.onload = () => {
      setCurrentImage(img);
    };
    img.src = lastState;
    setHasFinished(false);
  };

  const handleNext = () => {
    if (redoStack.length === 0 || !currentImage) return;
    const nextState = redoStack[0];
    setRedoStack(redoStack.slice(1));
    setUndoStack(prev => [...prev, currentImage.src]);
    const img = new Image();
    img.onload = () => {
      setCurrentImage(img);
    };
    img.src = nextState;
    setHasFinished(false);
  };

  const handleFinish = async () => {
    if (!currentImage || !startFile) return;
    onGenerationStart();
    try {
      await onResult(initialPrompt, currentImage.src, startFile);
      setHasFinished(true);
    } catch (err) {
      setError("保存失败。");
    } finally {
      onGenerationEnd();
    }
  };
  
  const handleDownload = () => {
    if (!currentImage) return;
    const link = document.createElement('a');
    link.href = currentImage.src;
    link.download = `infinite-canvas-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileChange = (files: File[]) => {
    const file = files[0] || null;
    setStartFile(file);
    onStartFileChange(file);
    onPromptChange('');
    if (!file) {
      setCurrentImage(null);
    }
  };
  
  if (!startFile) {
    return (
      <section className="w-full flex flex-col items-center justify-center py-12 md:py-16 bg-slate-50 border-b border-slate-200">
        <div className="container mx-auto px-4 text-center">
            <h1 className="text-4xl md:text-6xl font-extrabold text-slate-800 tracking-tight">
                打破画框，<span className="text-indigo-600">延展想象</span>
            </h1>
            <p className="mt-4 text-base md:text-lg text-slate-600 max-w-2xl mx-auto">
                上传一张图片作为起点，然后向任意方向拖拽，让 AI 为您无缝延展画面，创造超越边界的宏大场景。
            </p>
            <div className="max-w-2xl mx-auto mt-10 bg-white p-6 md:p-8 rounded-2xl shadow-xl border border-slate-200">
                <ImageUploader files={[]} onFilesChange={handleFileChange} maxFiles={1} />
            </div>
        </div>
      </section>
    );
  }

  const imageDisplayRect = currentImage ? {
      x: viewTransform.offsetX,
      y: viewTransform.offsetY,
      width: currentImage.width * viewTransform.scale,
      height: currentImage.height * viewTransform.scale,
  } : null;

  return (
    <div className="w-full bg-slate-100">
        <div className="container mx-auto px-4 py-8">
            <div className="flex flex-col lg:flex-row gap-8">
                {/* Canvas Area */}
                <div className="flex-grow flex flex-col bg-slate-800 rounded-2xl shadow-lg overflow-hidden min-h-[60vh] lg:min-h-[75vh]">
                    <div
                        ref={canvasContainerRef}
                        className="relative w-full flex-grow overflow-hidden"
                        style={{ cursor: 'grab' }}
                        onMouseDown={handleCanvasMouseDown}
                        onTouchStart={handleCanvasTouchStart}
                    >
                        <canvas ref={canvasRef} className="absolute top-0 left-0" />
                        
                        {showSizeHint && (
                            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-yellow-400/90 text-yellow-900 text-xs px-3 py-1.5 rounded-full font-semibold shadow-lg animate-fade-in z-30 backdrop-blur-sm pointer-events-none">
                                建议拉拽更大
                            </div>
                        )}

                        {imageDisplayRect && (
                          <>
                            {!isLoading && !activeExpansion && (
                              <>
                                <DragHandle direction="N" rect={imageDisplayRect} onDragStart={handleDragStart} />
                                <DragHandle direction="S" rect={imageDisplayRect} onDragStart={handleDragStart} />
                                <DragHandle direction="W" rect={imageDisplayRect} onDragStart={handleDragStart} />
                                <DragHandle direction="E" rect={imageDisplayRect} onDragStart={handleDragStart} />
                              </>
                            )}
                            {activeExpansion && (
                              <ExpansionOverlay
                                  expansion={activeExpansion}
                                  rect={imageDisplayRect}
                                  scale={viewTransform.scale}
                              />
                            )}
                          </>
                        )}

                        {isLoading && (
                            <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center rounded-lg z-40">
                                <div className="animate-spin rounded-full h-12 w-12 border-4 border-solid border-indigo-400 border-r-transparent"></div>
                                <p className="mt-4 text-lg text-white">正在扩展画布...</p>
                            </div>
                        )}

                        <ZoomControls
                          onZoomIn={() => {
                            const container = canvasContainerRef.current;
                            if (!container) return;
                            const { width, height } = container.getBoundingClientRect();
                            handleZoom(1.2, width / 2, height / 2);
                          }}
                          onZoomOut={() => {
                            const container = canvasContainerRef.current;
                            if (!container) return;
                            const { width, height } = container.getBoundingClientRect();
                            handleZoom(0.8, width / 2, height / 2);
                          }}
                          onFit={() => fitToScreen(currentImage)}
                          onDownload={handleDownload}
                          canDownload={!!currentImage}
                        />
                    </div>
                </div>
                {/* Control Panel */}
                <div className="w-full lg:w-96 flex-shrink-0 bg-white p-6 rounded-2xl shadow-lg border border-slate-200 flex flex-col gap-4">
                    <h2 className="text-xl font-bold text-slate-800">控制面板</h2>
                    <div className="flex items-center justify-center gap-2 bg-slate-100 p-1 rounded-full">
                      <button
                        type="button"
                        onClick={() => onModelChange && onModelChange(ImageModel.IMAGEN)}
                        disabled={isLoading}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors duration-200 border ${activeModel === ImageModel.IMAGEN ? 'bg-slate-700 text-white border-slate-700' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'}`}
                        title="使用 Imagen 4.0"
                      >
                        Imagen 4.0
                      </button>
                      <button
                        type="button"
                        onClick={() => onModelChange && onModelChange(ImageModel.DOUBAO_4_0)}
                        disabled={isLoading}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors duration-200 border ${activeModel === ImageModel.DOUBAO_4_0 ? 'bg-slate-700 text-white border-slate-700' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'}`}
                        title="使用豆包 4.0"
                      >
                        豆包 4.0
                      </button>
                    </div>
                    <div>
                      <label htmlFor="ic-prompt" className="block text-sm font-medium text-slate-700 mb-1">创意指令</label>
                      <textarea
                          id="ic-prompt"
                          value={initialPrompt}
                          onChange={(e) => {
                              onPromptChange(e.target.value);
                              if (error) setError(null);
                          }}
                          placeholder="描述您想在扩展区域看到的内容..."
                          rows={6}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg shadow-sm transition duration-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                          disabled={isLoading}
                      />
                    </div>
                    
                    {activeExpansion && (
                        <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg space-y-3 animate-fade-in">
                            <div className="flex justify-between items-center">
                                <p className="text-sm font-semibold text-indigo-800">扩展画布</p>
                                <span className="text-sm font-medium text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full tabular-nums">
                                    {Math.round(activeExpansion.size)} px
                                </span>
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => {
                                        setActiveExpansion(null);
                                        setShowSizeHint(false);
                                        setError(null);
                                    }}
                                    className="w-full flex items-center justify-center gap-2 bg-slate-200 text-slate-700 font-semibold py-2.5 px-4 rounded-full hover:bg-slate-300 transition-colors"
                                >
                                <XMarkIcon className="w-5 h-5"/>
                                <span>取消</span>
                                </button>
                                <button
                                    onClick={handleGenerate}
                                    className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white font-bold py-2.5 px-4 rounded-full hover:bg-indigo-700 transition-colors"
                                >
                                    <CheckIcon className="w-5 h-5"/>
                                    <span>生成</span>
                                </button>
                            </div>
                        </div>
                    )}

                    {error && <div className="text-sm bg-red-100 border border-red-300 text-red-700 p-3 rounded-lg">{error}</div>}
                    
                    <div className="mt-auto space-y-3">
                         <div className="grid grid-cols-2 gap-3">
                            <button onClick={handlePrevious} disabled={isLoading || undoStack.length === 0 || hasFinished} className="w-full flex items-center justify-center gap-2 bg-slate-200 text-slate-700 font-semibold py-2.5 px-4 rounded-full hover:bg-slate-300 transition-colors disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed">
                                <ChevronLeftIcon className="w-5 h-5" />
                                <span>上一步</span>
                            </button>
                            <button onClick={handleNext} disabled={isLoading || redoStack.length === 0 || hasFinished} className="w-full flex items-center justify-center gap-2 bg-slate-200 text-slate-700 font-semibold py-2.5 px-4 rounded-full hover:bg-slate-300 transition-colors disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed">
                                <ChevronRightIcon className="w-5 h-5" />
                                <span>下一步</span>
                            </button>
                         </div>
                        <button
                          onClick={handleFinish}
                          disabled={isLoading || !currentImage || undoStack.length === 0 || hasFinished}
                          className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white font-bold py-3 px-8 rounded-full hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-transform duration-200 transform hover:scale-105 disabled:bg-slate-400 disabled:cursor-not-allowed disabled:scale-100"
                        >
                            <CheckIcon className="w-5 h-5"/>
                            <span>{hasFinished ? '已完成' : '完成画布'}</span>
                        </button>
                        <button onClick={() => handleFileChange([])} className="w-full text-center text-sm text-slate-500 hover:text-red-600 hover:underline mt-2">
                            开始新创作
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
  );
};


const ZoomControls: React.FC<{ onZoomIn: () => void; onZoomOut: () => void; onFit: () => void; onDownload: () => void; canDownload: boolean; }> = ({ onZoomIn, onZoomOut, onFit, onDownload, canDownload }) => {
    const ControlButton: React.FC<{ onClick: () => void, title: string, children: React.ReactNode }> = ({ onClick, title, children }) => (
        <button
            onClick={onClick}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            title={title}
            className="w-9 h-9 flex items-center justify-center bg-slate-700/80 text-white rounded-md hover:bg-slate-600/90 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-400"
        >
            {children}
        </button>
    );
    return (
        <div className="absolute bottom-4 right-4 z-30 flex flex-col gap-1.5">
            <div className="bg-slate-800/50 backdrop-blur-sm p-1.5 rounded-lg shadow-lg flex flex-col gap-1.5">
                <ControlButton onClick={onZoomIn} title="放大"><PlusIcon className="w-5 h-5" /></ControlButton>
                <ControlButton onClick={onFit} title="适应屏幕"><FitScreenIcon className="w-5 h-5" /></ControlButton>
                <ControlButton onClick={onZoomOut} title="缩小"><MinusIcon className="w-5 h-5" /></ControlButton>
            </div>
            {canDownload && (
                 <div className="bg-slate-800/50 backdrop-blur-sm p-1.5 rounded-lg shadow-lg">
                    <ControlButton onClick={onDownload} title="下载"><DownloadIcon className="w-5 h-5" /></ControlButton>
                </div>
            )}
        </div>
    );
};

interface Rect { x: number; y: number; width: number; height: number; }

const DragHandle: React.FC<{ direction: Direction, rect: Rect, onDragStart: (dir: Direction, e: React.MouseEvent | React.TouchEvent) => void }> = ({ direction, rect, onDragStart }) => {
    const handleSize = 32;
    const style: React.CSSProperties = {
        position: 'absolute',
        width: `${handleSize}px`,
        height: `${handleSize}px`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    };
    let classes = 'z-20 bg-slate-800/60 text-white rounded-full transition-all duration-200 backdrop-blur-sm border-2 border-white/30 shadow-lg hover:bg-indigo-500 hover:scale-110';
    let icon: React.ReactNode;

    switch(direction) {
        case 'N':
            style.top = rect.y - handleSize / 2;
            style.left = rect.x + rect.width / 2 - handleSize / 2;
            classes += ' cursor-ns-resize';
            icon = <ChevronUpIcon className="w-5 h-5" />;
            break;
        case 'S':
            style.top = rect.y + rect.height - handleSize / 2;
            style.left = rect.x + rect.width / 2 - handleSize / 2;
            classes += ' cursor-ns-resize';
            icon = <ChevronDownIcon className="w-5 h-5" />;
            break;
        case 'W':
            style.top = rect.y + rect.height / 2 - handleSize / 2;
            style.left = rect.x - handleSize / 2;
            classes += ' cursor-ew-resize';
            icon = <ChevronLeftIcon className="w-5 h-5" />;
            break;
        case 'E':
            style.top = rect.y + rect.height / 2 - handleSize / 2;
            style.left = rect.x + rect.width - handleSize / 2;
            classes += ' cursor-ew-resize';
            icon = <ChevronRightIcon className="w-5 h-5" />;
            break;
    }

    return (
        <div
            style={style}
            className={classes}
            onMouseDown={(e) => onDragStart(direction, e)}
            onTouchStart={(e) => onDragStart(direction, e)}
        >
            {icon}
        </div>
    );
};
  
const ExpansionOverlay: React.FC<{ expansion: Expansion, rect: Rect, scale: number }> = ({ expansion, rect, scale }) => {
    const { direction, size: worldSize } = expansion;
    const size = worldSize * scale;
    const style: React.CSSProperties = {
        position: 'absolute',
        pointerEvents: 'none',
    };

    switch (direction) {
        case 'N': style.top = rect.y - size; style.left = rect.x; style.width = rect.width; style.height = size; break;
        case 'S': style.bottom = `calc(100% - ${rect.y + rect.height + size}px)`; style.left = rect.x; style.width = rect.width; style.height = size; break;
        case 'W': style.left = rect.x - size; style.top = rect.y; style.height = rect.height; style.width = size; break;
        case 'E': style.right = `calc(100% - ${rect.x + rect.width + size}px)`; style.top = rect.y; style.height = rect.height; style.width = size; break;
    }

    return (
        <div style={style} className="z-10 bg-indigo-500/20 border-2 border-dashed border-indigo-400 animate-fade-in" />
    );
};