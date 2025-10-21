/**
 * 保存为模板对话框
 */

'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TemplateCategory } from '@/lib/template-manager';

interface SaveTemplateDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (name: string, category: TemplateCategory) => void;
}

export default function SaveTemplateDialog({
  open,
  onClose,
  onSave,
}: SaveTemplateDialogProps) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<TemplateCategory>('自定义');

  const handleSave = () => {
    if (!name.trim()) {
      alert('请输入模板名称');
      return;
    }

    onSave(name.trim(), category);
    setName('');
    setCategory('自定义');
    onClose();
  };

  const handleClose = () => {
    setName('');
    setCategory('自定义');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>保存为模板</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* 模板名称 */}
          <div className="space-y-2">
            <Label htmlFor="template-name">模板名称 *</Label>
            <Input
              id="template-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：简约红色卡片"
              autoFocus
            />
          </div>

          {/* 模板分类 */}
          <div className="space-y-2">
            <Label>模板分类</Label>
            <div className="grid grid-cols-2 gap-2">
              {(['自定义', '文字卡片', '图文混排', '九宫格', '知识分享', '情绪表达', '产品展示'] as TemplateCategory[]).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`px-3 py-2 text-sm rounded-md border transition-colors ${
                    category === cat
                      ? 'bg-blue-500 text-white border-blue-500'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={handleClose}>
            取消
          </Button>
          <Button onClick={handleSave}>
            保存
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

