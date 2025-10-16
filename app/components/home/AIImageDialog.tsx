'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Sparkles, Plus, Pencil, Trash2, X } from 'lucide-react';
import { getQuickPromptsManager, QuickPrompt } from '@/lib/quick-prompts';

interface AIImageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerate: (prompt: string, size: string) => Promise<void>;
}

// 尺寸选项（总像素数必须 ≥ 921600）
const sizeOptions = [
  { label: '1:1 (1024x1024)', value: '1024x1024', ratio: '1:1', pixels: 1048576 },
  { label: '4:3 (1152x864)', value: '1152x864', ratio: '4:3', pixels: 995328 },
  { label: '3:4 (864x1152)', value: '864x1152', ratio: '3:4', pixels: 995328 },
  { label: '16:9 (1280x720)', value: '1280x720', ratio: '16:9', pixels: 921600 },
  { label: '9:16 (720x1280)', value: '720x1280', ratio: '9:16', pixels: 921600 },
];

export function AIImageDialog({ open, onOpenChange, onGenerate }: AIImageDialogProps) {
  const [prompt, setPrompt] = useState('');
  const [size, setSize] = useState('1024x1024'); // 默认 1:1
  const [isGenerating, setIsGenerating] = useState(false);
  const [quickPrompts, setQuickPrompts] = useState<QuickPrompt[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [newPromptText, setNewPromptText] = useState('');

  // 加载快速提示词
  useEffect(() => {
    const manager = getQuickPromptsManager();
    setQuickPrompts(manager.getAll());
  }, []);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      alert('请输入提示词');
      return;
    }

    setIsGenerating(true);
    try {
      await onGenerate(prompt, size);
      setPrompt(''); // 清空输入
      onOpenChange(false); // 关闭对话框
    } catch (error) {
      console.error('生成图片失败:', error);
      alert(`生成图片失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Cmd/Ctrl + Enter 生成
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleGenerate();
    }
  };

  // 添加快速提示词
  const handleAddPrompt = () => {
    if (!newPromptText.trim()) return;
    const manager = getQuickPromptsManager();
    manager.add(newPromptText);
    setQuickPrompts(manager.getAll());
    setNewPromptText('');
    setIsAdding(false);
  };

  // 更新快速提示词
  const handleUpdatePrompt = (id: string) => {
    if (!editingText.trim()) return;
    const manager = getQuickPromptsManager();
    manager.update(id, editingText);
    setQuickPrompts(manager.getAll());
    setEditingId(null);
    setEditingText('');
  };

  // 删除快速提示词
  const handleDeletePrompt = (id: string) => {
    const manager = getQuickPromptsManager();
    manager.delete(id);
    setQuickPrompts(manager.getAll());
  };

  // 开始编辑
  const startEdit = (prompt: QuickPrompt) => {
    setEditingId(prompt.id);
    setEditingText(prompt.text);
  };

  // 取消编辑
  const cancelEdit = () => {
    setEditingId(null);
    setEditingText('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-gray-700" />
            AI 生成图片
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* 尺寸选择 */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              图片尺寸
            </label>
            <div className="grid grid-cols-5 gap-2">
              {sizeOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setSize(option.value)}
                  disabled={isGenerating}
                  className={`px-3 py-2 text-xs rounded border transition-colors ${
                    size === option.value
                      ? 'bg-gray-900 text-white border-gray-900'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-gray-900'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {option.ratio}
                </button>
              ))}
            </div>
            <div className="text-xs text-muted-foreground">
              当前选择：{sizeOptions.find(o => o.value === size)?.label}
            </div>
          </div>

          {/* 提示词输入 */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              提示词
              <span className="text-muted-foreground ml-2 text-xs">
                (Cmd/Ctrl + Enter 生成)
              </span>
            </label>
            <Textarea
              placeholder="描述你想要生成的图片，例如：星际穿越，黑洞，电影大片..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={5}
              className="resize-none"
              disabled={isGenerating}
            />
          </div>

          {/* 快速提示词 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-muted-foreground">
                快速提示词（点击使用）
              </label>
              <button
                onClick={() => setIsAdding(true)}
                disabled={isGenerating}
                className="text-xs px-2 py-1 rounded border border-gray-300 hover:bg-gray-50 transition-colors flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="h-3 w-3" />
                新增
              </button>
            </div>

            <div className="grid grid-cols-1 gap-2 max-h-[200px] overflow-y-auto">
              {/* 新增输入框 */}
              {isAdding && (
                <div className="flex gap-2 p-2 border border-gray-300 rounded bg-gray-50">
                  <input
                    type="text"
                    value={newPromptText}
                    onChange={(e) => setNewPromptText(e.target.value)}
                    placeholder="输入新的提示词..."
                    className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-900"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddPrompt();
                      if (e.key === 'Escape') {
                        setIsAdding(false);
                        setNewPromptText('');
                      }
                    }}
                  />
                  <button
                    onClick={handleAddPrompt}
                    className="px-2 py-1 text-xs bg-gray-900 text-white rounded hover:bg-gray-800"
                  >
                    保存
                  </button>
                  <button
                    onClick={() => {
                      setIsAdding(false);
                      setNewPromptText('');
                    }}
                    className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-100"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}

              {/* 提示词列表 */}
              {quickPrompts.map((promptItem) => (
                <div
                  key={promptItem.id}
                  className="group relative"
                >
                  {editingId === promptItem.id ? (
                    // 编辑模式
                    <div className="flex gap-2 p-2 border border-gray-300 rounded bg-gray-50">
                      <input
                        type="text"
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-900"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleUpdatePrompt(promptItem.id);
                          if (e.key === 'Escape') cancelEdit();
                        }}
                      />
                      <button
                        onClick={() => handleUpdatePrompt(promptItem.id)}
                        className="px-2 py-1 text-xs bg-gray-900 text-white rounded hover:bg-gray-800"
                      >
                        保存
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-100"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    // 显示模式
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setPrompt(promptItem.text)}
                        disabled={isGenerating}
                        className="flex-1 text-left text-xs p-2 rounded border border-border hover:bg-accent hover:text-accent-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {promptItem.text.length > 80 ? promptItem.text.substring(0, 80) + '...' : promptItem.text}
                      </button>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => startEdit(promptItem)}
                          disabled={isGenerating}
                          className="p-1 text-gray-600 hover:text-gray-900 disabled:opacity-50"
                          title="编辑"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => handleDeletePrompt(promptItem.id)}
                          disabled={isGenerating}
                          className="p-1 text-red-600 hover:text-red-800 disabled:opacity-50"
                          title="删除"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 生成按钮 */}
          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isGenerating}
            >
              取消
            </Button>
            <Button
              onClick={handleGenerate}
              disabled={isGenerating || !prompt.trim()}
              className="bg-gray-900 hover:bg-gray-800 text-white border border-gray-900"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  生成中...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  生成图片
                </>
              )}
            </Button>
          </div>

          {/* 提示信息 */}
          {isGenerating && (
            <div className="text-sm text-muted-foreground text-center py-2">
              正在生成图片，请稍候...（通常需要 10-30 秒）
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

