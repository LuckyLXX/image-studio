
import React, { useState } from 'react';
import { ImageStyle, ImageModel } from '../types';

interface IllustratedWikiProps {
  prompt: string;
  onPromptChange: (prompt: string) => void;
  onGenerate: () => void;
  isLoading: boolean;
  activeStyle: ImageStyle;
  onStyleChange: (style: ImageStyle) => void;
  activeModel: ImageModel;
  onModelChange: (model: ImageModel) => void;
}

export const IllustratedWiki: React.FC<IllustratedWikiProps> = ({ 
  prompt, 
  onPromptChange, 
  onGenerate, 
  isLoading, 
  activeStyle, 
  onStyleChange,
  activeModel,
  onModelChange
}) => {
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) {
      setFormError('请输入您想了解的概念或问题。');
      return;
    }
    onGenerate();
  };

  const StyleButton = ({ value, label, icon }: { value: ImageStyle; label: string; icon: string }) => (
    <button
      type="button"
      onClick={() => onStyleChange(value)}
      disabled={isLoading}
      className={`px-4 py-2 rounded-full text-sm font-semibold transition-all duration-200 flex items-center gap-2 border disabled:cursor-not-allowed disabled:opacity-60 ${
        activeStyle === value
          ? 'bg-slate-800 text-white border-slate-800 shadow-md'
          : 'bg-white/60 text-slate-700 border-transparent hover:bg-white/90 backdrop-blur-sm'
      }`}
    >
      <span className="text-lg">{icon}</span>
      {label}
    </button>
  );

  const ModelButton = ({ value, label }: { value: ImageModel; label: string; }) => (
    <button
      type="button"
      onClick={() => onModelChange(value)}
      disabled={isLoading}
      className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors duration-200 border disabled:cursor-not-allowed disabled:opacity-60 ${
        activeModel === value
          ? 'bg-slate-700 text-white border-slate-700'
          : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="w-full max-w-4xl mx-auto text-center">
      <h1 className="text-4xl md:text-6xl font-extrabold text-slate-800 tracking-tight">
        一图胜千言，<span className="text-indigo-600">知识变简单</span>
      </h1>
      <p className="mt-4 text-base md:text-lg text-slate-600 max-w-2xl mx-auto">
        输入您想了解的概念或问题，我会为您生成多张图文卡片来详细解释
      </p>
      
      <form onSubmit={handleSubmit} className="mt-10">
        <div className="relative max-w-2xl mx-auto">
          <input
            type="text"
            value={prompt}
            onChange={(e) => {
              onPromptChange(e.target.value);
              if (formError) {
                setFormError(null);
              }
            }}
            placeholder="例如：什么是人工智能？"
            className={`w-full px-6 py-4 bg-white border rounded-full shadow-lg transition duration-200 text-lg ${
              formError 
                ? 'border-red-500 focus:ring-2 focus:ring-red-500/50 focus:border-red-500' 
                : 'border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500'
            }`}
            disabled={isLoading}
            aria-invalid={formError ? true : undefined}
            aria-describedby={formError ? 'prompt-error' : undefined}
          />
          <button
            type="submit"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 bg-indigo-600 text-white font-bold py-2.5 px-8 rounded-full hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-transform duration-200 transform hover:scale-105 disabled:bg-slate-400 disabled:cursor-not-allowed disabled:scale-100"
            disabled={isLoading}
          >
            {isLoading ? '生成中...' : '生成图解'}
          </button>
        </div>

        {formError && (
          <p id="prompt-error" className="mt-2 text-sm text-red-600" role="alert">
            {formError}
          </p>
        )}
        
        <div className={`max-w-2xl mx-auto flex flex-col items-center gap-4 ${formError ? 'mt-4' : 'mt-6'}`}>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
            <span className="text-slate-600 text-sm font-medium">生成风格：</span>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <StyleButton value={ImageStyle.ILLUSTRATION} label="插画风" icon="🏞️" />
              <StyleButton value={ImageStyle.CLAY} label="粘土风" icon="🗿" />
              <StyleButton value={ImageStyle.DOODLE} label="涂鸦风" icon="🎨" />
              <StyleButton value={ImageStyle.CARTOON} label="卡通风" icon="🐰" />
              <StyleButton value={ImageStyle.WATERCOLOR} label="水彩风" icon="🖌️" />
            </div>
          </div>
          <div className="flex items-center justify-center gap-3">
            <span className="text-slate-600 text-sm font-medium">模型：</span>
            <div className="flex items-center justify-center gap-2 bg-slate-100 p-1 rounded-full">
              <ModelButton value={ImageModel.IMAGEN} label="Imagen 4.0" />
              <ModelButton value={ImageModel.NANO_BANANA} label="Nano-Banana" />
              <ModelButton value={ImageModel.DOUBAO_4_0} label="豆包 4.0" />
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};
