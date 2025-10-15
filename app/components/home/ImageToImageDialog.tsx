// 图片转图片对话框
'use client';

import { useState, useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';

interface ImageToImageDialogProps {
  open: boolean;
  onClose: () => void;
  onGenerate: (prompt: string, size: '1K' | '2K' | '4K') => Promise<void>;
  imageCount: number; // 选中的图片/对象数量
}

export default function ImageToImageDialog({ 
  open, 
  onClose, 
  onGenerate,
  imageCount 
}: ImageToImageDialogProps) {
  const [prompt, setPrompt] = useState('');
  const [size, setSize] = useState<'1K' | '2K' | '4K'>('2K');
  const [isGenerating, setIsGenerating] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // 对话框打开时自动聚焦输入框
  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isGenerating) return;

    setIsGenerating(true);
    try {
      await onGenerate(prompt, size);
      setPrompt('');
      onClose();
    } catch (error) {
      console.error('生成失败:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Enter提交,Shift+Enter换行
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
    // Esc关闭
    if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 背景遮罩 */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      
      {/* 对话框内容 */}
      <div className="relative bg-white rounded-lg shadow-xl p-6 w-[560px]">
        <h2 className="text-lg font-semibold mb-4">
          AI 图片转换
          <span className="ml-2 text-sm text-gray-500">
            ({imageCount} 个对象)
          </span>
        </h2>
        
        <form onSubmit={handleSubmit}>
          {/* Prompt输入 */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              描述你想要的效果
            </label>
            <textarea
              ref={inputRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                imageCount > 1 
                  ? "例如: 将图1的服装换为图2的服装" 
                  : "例如: 生成狗狗趴在草地上的近景画面"
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              rows={4}
              disabled={isGenerating}
            />
            <p className="mt-1 text-xs text-gray-500">
              按 Enter 提交，Shift+Enter 换行，Esc 关闭
            </p>
          </div>

          {/* 尺寸选择 */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              图片尺寸
            </label>
            <div className="flex gap-2">
              {(['1K', '2K', '4K'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSize(s)}
                  disabled={isGenerating}
                  className={`flex-1 py-2 px-4 rounded-md border transition-colors ${
                    size === s
                      ? 'bg-blue-500 text-white border-blue-500'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* 按钮 */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isGenerating}
              className="flex-1 py-2 px-4 rounded-md border border-gray-300 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={!prompt.trim() || isGenerating}
              className="flex-1 py-2 px-4 rounded-md bg-blue-500 text-white hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  生成中...
                </>
              ) : (
                '生成图片'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

