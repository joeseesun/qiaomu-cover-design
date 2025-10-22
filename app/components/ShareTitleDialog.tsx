'use client';

import { useState } from 'react';
import { X } from 'lucide-react';

interface ShareTitleDialogProps {
  onConfirm: (title: string) => void;
  onCancel: () => void;
}

export default function ShareTitleDialog({ onConfirm, onCancel }: ShareTitleDialogProps) {
  const [title, setTitle] = useState('');
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm(title.trim() || '我的海报');
  };
  
  return (
    <>
      {/* 遮罩层 */}
      <div 
        className="fixed inset-0 bg-black/50 z-50"
        onClick={onCancel}
      />
      
      {/* 对话框 */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 z-50 mx-4">
        {/* 标题 */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-gray-900">设置分享标题</h3>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        
        {/* 表单 */}
        <form onSubmit={handleSubmit}>
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              标题（可选）
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="我的海报"
              maxLength={50}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            <p className="text-xs text-gray-500 mt-2">
              留空则使用默认标题
            </p>
          </div>
          
          {/* 按钮 */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-4 py-3 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium"
            >
              取消
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
            >
              确认分享
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

