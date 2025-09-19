

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GeneratedImage, ImageModel } from '../types';
import { generateInpainting } from '../services/geminiService';
import { generateInpaintingWithVolcEngine } from '../services/volcengineService';
import { base64ToFile } from '../utils/imageUtils';

interface InpaintingModalProps {
  isOpen: boolean;
  onClose: () => void;
  image: GeneratedImage | null;
  apiKey: string | null;
  onComplete: (newImageSrc: string) => void;
  onApiKeyNeeded: () => void;
  activeModel?: ImageModel;
  volcengineApiKey?: string | null;
}

const BRUSH_COLOR = 'rgba(99, 102, 241, 0.6)';
const BRUSH_SIZES = { small: 3, medium: 8, large: 15 };

type Path = {
  size: number;
  points: { x: number; y: number }[];
};

const drawPaths = (ctx: CanvasRenderingContext2D, pathsToDraw: Path[]) => {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    pathsToDraw.forEach(path => {
        if (path.points.length < 1) return;
        ctx.strokeStyle = BRUSH_COLOR;
        ctx.lineWidth = path.size;
        ctx.beginPath();
        ctx.moveTo(path.points[0].x, path.points[0].y);
        path.points.slice(1).forEach(point => ctx.lineTo(point.x, point.y));
        ctx.stroke();
    });
};

export const InpaintingModal: React.FC<InpaintingModalProps> = ({ isOpen, onClose, image, apiKey, onComplete, onApiKeyNeeded, activeModel = ImageModel.IMAGEN, volcengineApiKey }) => {
  const [prompt, setPrompt] = useState('');
  const [brushSize, setBrushSize] = useState(BRUSH_SIZES.medium);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const isDrawing = useRef(false);
  
  const [paths, setPaths] = useState<Path[]>([]);
  const [currentPath, setCurrentPath] = useState<Path | null>(null);
  const [generatedResultSrc, setGeneratedResultSrc] = useState<string | null>(null);
  const [showOriginal, setShowOriginal] = useState(false);


  // Effect for loading image and setting up canvas dimensions
  useEffect(() => {
    if (!isOpen || !image) {
      setPaths([]);
      setCurrentPath(null);
      setPrompt('');
      setError(null);
      setGeneratedResultSrc(null);
      setShowOriginal(false);
      return;
    }
    
    const canvas = canvasRef.current;
    const imageEl = new Image();
    imageEl.crossOrigin = "anonymous";
    imageEl.src = image.src;
    imageRef.current = imageEl;
    
    imageEl.onload = () => {
        if (canvas && imageRef.current) {
            const imageToDraw = imageRef.current;
            const aspectRatio = imageToDraw.naturalWidth / imageToDraw.naturalHeight;
            const maxHeight = window.innerHeight * 0.75;
            const maxWidth = Math.min(window.innerWidth * 0.8, imageToDraw.naturalWidth, 800, maxHeight * aspectRatio);
            
            canvas.width = maxWidth;
            canvas.height = maxWidth / aspectRatio;

            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(imageToDraw, 0, 0, canvas.width, canvas.height);
            }
        }
    };
  }, [isOpen, image]);

  // Effect for redrawing canvas when state changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!isOpen || !canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const imageEl = imageRef.current;
    if (!imageEl || !imageEl.complete) return;

    if (generatedResultSrc) {
        // When showing a result, we don't want the brush strokes on the original
        const imageToDisplaySrc = showOriginal ? image!.src : generatedResultSrc;
        const displayImg = new Image();
        displayImg.src = imageToDisplaySrc;
        displayImg.onload = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(displayImg, 0, 0, canvas.width, canvas.height);
        };
    } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(imageEl, 0, 0, canvas.width, canvas.height);
        const allPaths = currentPath ? [...paths, currentPath] : paths;
        drawPaths(ctx, allPaths);
    }
  }, [isOpen, image, paths, currentPath, generatedResultSrc, showOriginal]);


  const getCanvasPoint = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    return {
        x: (clientX - rect.left) / rect.width * canvas.width,
        y: (clientY - rect.top) / rect.height * canvas.height,
    };
  };

  const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    if (isLoading || generatedResultSrc) return;
    isDrawing.current = true;
    const point = getCanvasPoint(e);
    if (!point) return;
    setCurrentPath({ size: brushSize, points: [point] });
  };

  const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing.current || isLoading || generatedResultSrc) return;
    e.preventDefault();
    const point = getCanvasPoint(e);
    if (!point) return;

    setCurrentPath(prev => {
        if (!prev) return null;
        return { ...prev, points: [...prev.points, point] };
    });
  };

  const handleMouseUp = () => {
    if (isDrawing.current && currentPath && currentPath.points.length > 0) {
        setPaths(prevPaths => [...prevPaths, currentPath]);
    }
    isDrawing.current = false;
    setCurrentPath(null);
  };

  const handleUndo = () => {
    setPaths(prevPaths => prevPaths.slice(0, -1));
  };

  const handleClear = () => {
    setPaths([]);
    setCurrentPath(null);
  };

  const createMaskFile = async (): Promise<File> => {
    if (!imageRef.current) throw new Error("Image reference not found");
    const { naturalWidth, naturalHeight } = imageRef.current;
    
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = naturalWidth;
    maskCanvas.height = naturalHeight;
    const ctx = maskCanvas.getContext('2d');
    if (!ctx) throw new Error("Could not get mask context");

    const scaleX = canvasRef.current ? naturalWidth / canvasRef.current.width : 1;
    const scaleY = canvasRef.current ? naturalHeight / canvasRef.current.height : 1;

    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);

    ctx.strokeStyle = 'white';
    ctx.fillStyle = 'white';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    paths.forEach(path => {
        if (path.points.length === 0) return;
        ctx.lineWidth = path.size * scaleX;
        
        if (path.points.length === 1) {
            ctx.beginPath();
            ctx.arc(path.points[0].x * scaleX, path.points[0].y * scaleY, (path.size * scaleX) / 2, 0, 2 * Math.PI);
            ctx.fill();
        } else {
            ctx.beginPath();
            ctx.moveTo(path.points[0].x * scaleX, path.points[0].y * scaleY);
            path.points.slice(1).forEach(p => ctx.lineTo(p.x * scaleX, p.y * scaleY));
            ctx.stroke();
        }
    });

    const maskDataUrl = maskCanvas.toDataURL('image/png');
    return base64ToFile(maskDataUrl, 'mask.png');
  };

  const handleGenerate = async () => {
    const needVolc = activeModel === ImageModel.DOUBAO_4_0;
    const keyToUse = needVolc ? volcengineApiKey : apiKey;
    if (!keyToUse) { onApiKeyNeeded(); return; }
    if (!image) { setError("没有可编辑的图片。"); return; }
    if (!prompt.trim()) { setError("请输入重绘指令。"); return; }
    if (paths.length === 0) { setError("请在图片上绘制您想修改的区域。"); return; }
    
    setIsLoading(true);
    setError(null);
    
    try {
        const [originalFile, maskFile] = await Promise.all([
            base64ToFile(image.src, 'original.png'),
            createMaskFile(),
        ]);
        
        let result: string[];
        if (needVolc) {
          const [origBase64, maskBase64] = await Promise.all([
            (async () => image.src)(),
            (async () => (await base64ToFile(await (async () => maskFile)() as File, 'mask.png')) && maskCanvasToDataUrl())
          ]);
          // 直接读取已有 base64：image.src 已为 data URL，mask 通过 createMaskFile 已是文件，转回 base64
          const maskDataUrl = await (async () => {
            const fr = new FileReader();
            return await new Promise<string>((resolve, reject) => {
              fr.onload = () => resolve(fr.result as string);
              fr.onerror = reject;
              fr.readAsDataURL(maskFile);
            });
          })();
          result = await generateInpaintingWithVolcEngine(prompt, image.src, maskDataUrl, keyToUse, '1024x1024');
        } else {
          result = await generateInpainting(prompt, originalFile, maskFile, keyToUse);
        }
        
        if (result.length > 0) {
            setGeneratedResultSrc(result[0]);
        } else {
            setError("AI未能生成图片，请重试。");
        }
    } catch (err) {
        setError(err instanceof Error ? err.message : '发生未知错误。');
    } finally {
        setIsLoading(false);
    }
  };
  
  const handleConfirm = () => {
    if (generatedResultSrc) {
      onComplete(generatedResultSrc);
    }
  };

  const handleTryAgain = () => {
    setGeneratedResultSrc(null);
    setShowOriginal(false);
    setError(null);
    setPaths([]);
    setCurrentPath(null);
    setPrompt('');
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-slate-800 rounded-2xl shadow-2xl p-4 md:p-6 max-w-6xl w-full text-white flex flex-col md:flex-row gap-6 max-h-[95vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex-grow flex flex-col items-center justify-center relative">
          <canvas
            ref={canvasRef}
            className={`rounded-lg max-w-full max-h-[80vh] ${isLoading ? 'cursor-not-allowed' : generatedResultSrc ? 'cursor-default' : 'cursor-crosshair'}`}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleMouseDown}
            onTouchMove={handleMouseMove}
            onTouchEnd={handleMouseUp}
          />
          {isLoading && (
            <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center rounded-lg">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-solid border-indigo-400 border-r-transparent"></div>
                <p className="mt-4 text-lg">正在重绘，请稍候...</p>
            </div>
          )}
        </div>
        
        <div className="w-full md:w-80 flex-shrink-0 flex flex-col gap-4">
          {generatedResultSrc ? (
            <>
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">确认结果</h2>
                <button onClick={onClose} className="text-slate-400 text-3xl leading-none hover:text-white">&times;</button>
              </div>
              <p className="text-sm text-slate-300">
                对结果满意吗？您可以确认保存，或者返回修改后重试。
              </p>
               <button onClick={() => setShowOriginal(prev => !prev)} className="w-full py-2 text-sm bg-slate-600 rounded-md hover:bg-slate-500">
                {showOriginal ? '显示重绘结果' : '显示原图'}
              </button>
               {error && (
                <div className="text-sm bg-red-900/50 border border-red-700 text-red-300 p-2 rounded-lg">{error}</div>
              )}
              <div className="mt-auto flex flex-col gap-3">
                <button onClick={handleConfirm} className="w-full bg-indigo-600 text-white font-bold py-3 px-8 rounded-full hover:bg-indigo-700 transition-transform transform hover:scale-105">
                    确认并保存
                </button>
                <button onClick={handleTryAgain} className="w-full bg-slate-600 text-white font-semibold py-3 px-8 rounded-full hover:bg-slate-500 transition-colors">
                    返回重试
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold">局部重绘</h2>
                  <button onClick={onClose} className="text-slate-400 text-3xl leading-none hover:text-white">&times;</button>
              </div>
              
              <div>
                  <label className="text-sm font-medium text-slate-300 mb-1 block">1. 涂抹要重绘的区域</label>
                  <p className="text-xs text-slate-400 mb-2">用画笔涂抹您想让 AI 重新生成的部分。</p>
                  <div className="bg-slate-700/50 p-2 rounded-lg flex items-center gap-2">
                      {Object.entries(BRUSH_SIZES).map(([name, size]) => (
                          <button key={name} onClick={() => setBrushSize(size)} className={`flex-1 py-2 text-xs rounded-md capitalize transition-colors ${brushSize === size ? 'bg-indigo-600' : 'bg-slate-600 hover:bg-slate-500'}`}>
                              {name}
                          </button>
                      ))}
                  </div>
                  <div className="flex gap-2 mt-2">
                      <button onClick={handleUndo} disabled={paths.length === 0 || isLoading} className="flex-1 py-2 text-sm bg-slate-600 rounded-md hover:bg-slate-500 disabled:opacity-50 disabled:cursor-not-allowed">撤销</button>
                      <button onClick={handleClear} disabled={paths.length === 0 || isLoading} className="flex-1 py-2 text-sm bg-slate-600 rounded-md hover:bg-slate-500 disabled:opacity-50 disabled:cursor-not-allowed">清除</button>
                  </div>
              </div>

              <div>
                  <label htmlFor="inpainting-prompt" className="text-sm font-medium text-slate-300 mb-1 block">2. 输入重绘指令</label>
                  <div className={`w-full p-2 bg-slate-700 border border-slate-600 rounded-lg transition-colors focus-within:border-indigo-500 ${isLoading ? 'bg-slate-800' : ''}`}>
                      <textarea
                          id="inpainting-prompt"
                          value={prompt}
                          onChange={e => setPrompt(e.target.value)}
                          placeholder="您想把涂抹区域变成什么？例如：一副太阳镜"
                          rows={4}
                          className="w-full bg-transparent border-none focus:outline-none focus:ring-0 text-white resize-none leading-relaxed"
                          disabled={isLoading}
                      />
                  </div>
              </div>
              
              {error && (
                  <div className="text-sm bg-red-900/50 border border-red-700 text-red-300 p-2 rounded-lg">{error}</div>
              )}

              <button
                  onClick={handleGenerate}
                  disabled={isLoading}
                  className="w-full mt-auto bg-indigo-600 text-white font-bold py-3 px-8 rounded-full hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-transform duration-200 transform hover:scale-105 disabled:bg-slate-500 disabled:cursor-not-allowed disabled:scale-100 text-lg"
              >
                  {isLoading ? '生成中...' : '✨ 开始重绘'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
