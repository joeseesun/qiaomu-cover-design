'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Sparkles } from 'lucide-react';

interface AIImageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerate: (prompt: string) => Promise<void>;
}

export function AIImageDialog({ open, onOpenChange, onGenerate }: AIImageDialogProps) {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      alert('请输入提示词');
      return;
    }

    setIsGenerating(true);
    try {
      await onGenerate(prompt);
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

  // 示例提示词
  const examplePrompts = [
    '星际穿越，黑洞，黑洞里冲出一辆快支离破碎的复古列车，抢视觉冲击力，电影大片，末日既视感',
    '赛博朋克城市，霓虹灯，雨夜，未来感，科幻，高清，电影质感',
    '中国风，水墨画，山水，云雾缭绕，意境深远，古典美学',
    '宇宙星空，星云，璀璨星河，深邃，神秘，壮观',
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-500" />
            AI 生成图片
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
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
              rows={6}
              className="resize-none"
              disabled={isGenerating}
            />
          </div>

          {/* 示例提示词 */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">
              示例提示词（点击使用）
            </label>
            <div className="grid grid-cols-1 gap-2">
              {examplePrompts.map((example, index) => (
                <button
                  key={index}
                  onClick={() => setPrompt(example)}
                  disabled={isGenerating}
                  className="text-left text-xs p-2 rounded border border-border hover:bg-accent hover:text-accent-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {example.length > 80 ? example.substring(0, 80) + '...' : example}
                </button>
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

