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
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* 对话框内容 */}
      <div className="relative bg-white rounded-xl shadow-2xl w-[600px] overflow-hidden">
        {/* 标题栏 */}
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h2 className="text-base font-semibold text-gray-900">
            AI 图片转换
            <span className="ml-2 text-sm font-normal text-gray-500">
              已选择 {imageCount} 个对象
            </span>
          </h2>
        </div>

        {/* 内容区 */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Prompt输入 */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              描述转换效果
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
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900 resize-none text-sm placeholder:text-gray-400"
              rows={4}
              disabled={isGenerating}
            />
            <p className="mt-2 text-xs text-gray-500">
              Enter 提交 · Shift+Enter 换行 · Esc 关闭
            </p>
          </div>

          {/* 尺寸选择 */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              输出尺寸
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['1K', '2K', '4K'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSize(s)}
                  disabled={isGenerating}
                  className={`py-2.5 px-4 rounded-lg border text-sm font-medium transition-all ${
                    size === s
                      ? 'bg-gray-900 text-white border-gray-900 shadow-sm'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-gray-900 hover:bg-gray-50'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* 按钮组 */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isGenerating}
              className="flex-1 py-2.5 px-4 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={!prompt.trim() || isGenerating}
              className="flex-1 py-2.5 px-4 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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

