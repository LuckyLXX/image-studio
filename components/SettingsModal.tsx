// components/SettingsModal.tsx

import React, { useState, useEffect } from 'react';
import { ApiProvider } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (geminiKey: string, volcengineKey: string) => void;
  currentGeminiKey: string | null;
  currentVolcengineKey: string | null;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onSave,
  currentGeminiKey,
  currentVolcengineKey,
}) => {
  const [geminiKey, setGeminiKey] = useState('');
  const [volcengineKey, setVolcengineKey] = useState('');
  const [activeTab, setActiveTab] = useState<ApiProvider>(ApiProvider.GEMINI);

  useEffect(() => {
    if (isOpen) {
      setGeminiKey(currentGeminiKey || '');
      setVolcengineKey(currentVolcengineKey || '');
      setActiveTab(ApiProvider.GEMINI);
    }
  }, [isOpen, currentGeminiKey, currentVolcengineKey]);

  const handleSave = () => {
    onSave(geminiKey, volcengineKey);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <h2 className="text-2xl font-bold mb-4">API 密钥设置</h2>

        {/* 标签页导航 */}
        <div className="flex border-b border-gray-200 mb-4">
          <button
            className={`flex-1 py-2 px-4 text-center font-medium ${
              activeTab === ApiProvider.GEMINI
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab(ApiProvider.GEMINI)}
          >
            Google Gemini
          </button>
          <button
            className={`flex-1 py-2 px-4 text-center font-medium ${
              activeTab === ApiProvider.VOLCENGINE
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab(ApiProvider.VOLCENGINE)}
          >
            火山引擎
          </button>
        </div>

        {/* Gemini API 设置 */}
        {activeTab === ApiProvider.GEMINI && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Google Gemini API Key
              </label>
              <textarea
                value={geminiKey}
                onChange={(e) => setGeminiKey(e.target.value)}
                placeholder="请输入您的 Gemini API Key"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={3}
              />
              <p className="mt-2 text-sm text-gray-500">
                获取地址：{' '}
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  Google AI Studio
                </a>
              </p>
            </div>
          </div>
        )}

        {/* 火山引擎 API 设置 */}
        {activeTab === ApiProvider.VOLCENGINE && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                火山引擎 API Key
              </label>
              <textarea
                value={volcengineKey}
                onChange={(e) => setVolcengineKey(e.target.value)}
                placeholder="请输入您的火山引擎豆包 API Key"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={3}
              />
              <p className="mt-2 text-sm text-gray-500">
                获取地址：{' '}
                <a
                  href="https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  火山引擎控制台
                </a>
              </p>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
              <p className="text-sm text-blue-800">
                <strong>注意：</strong>火山引擎豆包模型目前支持图解百科、文生图和连环画功能。
              </p>
            </div>
          </div>
        )}

        {/* 按钮组 */}
        <div className="flex justify-end space-x-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={(!geminiKey && !volcengineKey) || (activeTab === ApiProvider.GEMINI && !geminiKey) || (activeTab === ApiProvider.VOLCENGINE && !volcengineKey)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
};