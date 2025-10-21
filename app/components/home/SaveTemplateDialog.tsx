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

  const handleSave = () => {
    if (!name.trim()) {
      alert('请输入模板名称');
      return;
    }

    // 固定使用"自定义"分类
    onSave(name.trim(), '自定义');
    setName('');
    onClose();
  };

  const handleClose = () => {
    setName('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>另存为模板</DialogTitle>
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
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSave();
              }}
            />
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

