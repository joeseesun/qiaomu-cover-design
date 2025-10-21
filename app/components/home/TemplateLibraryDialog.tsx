/**
 * 模板库对话框
 * 展示模板分类、网格、预览等功能
 */

'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Trash2, X } from 'lucide-react';
import { getTemplateManager, Template, TemplateCategory } from '@/lib/template-manager';
import { PRESET_TEMPLATES } from '@/lib/preset-templates';

interface TemplateLibraryDialogProps {
  open: boolean;
  onClose: () => void;
  onApplyTemplate: (templateId: string) => void;
}

export default function TemplateLibraryDialog({
  open,
  onClose,
  onApplyTemplate,
}: TemplateLibraryDialogProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<TemplateCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // 加载模板
  useEffect(() => {
    if (open) {
      const manager = getTemplateManager();

      // 🆕 每次打开都检查并添加缺失的预设模板
      manager.addPresetTemplates(PRESET_TEMPLATES);

      // 为预设模板生成缩略图
      const generateThumbnails = async () => {
        const allTemplates = manager.getAll();
        for (const template of allTemplates) {
          if (template.isPreset && !template.thumbnail) {
            try {
              const thumbnail = await manager.generateThumbnailFromJSON(
                template.canvasJSON,
                template.canvasSize.width,
                template.canvasSize.height
              );
              manager.update(template.id, { thumbnail });
            } catch (error) {
              console.error('❌ 生成缩略图失败:', error);
            }
          }
        }
        setTemplates(manager.getAll());
      };

      generateThumbnails();
    }
  }, [open]);

  // 过滤模板
  const filteredTemplates = templates.filter(template => {
    const matchCategory = selectedCategory === 'all' || template.category === selectedCategory;
    const matchSearch = template.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCategory && matchSearch;
  });

  // 获取所有分类
  const categories: (TemplateCategory | 'all')[] = [
    'all',
    '文字卡片',
    '图文混排',
    '九宫格',
    '知识分享',
    '情绪表达',
    '产品展示',
    '自定义',
  ];

  // 删除模板
  const handleDelete = (templateId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    const manager = getTemplateManager();
    const template = manager.getById(templateId);
    
    if (template?.isPreset) {
      alert('预设模板不能删除');
      return;
    }
    
    if (confirm('确定要删除这个模板吗？')) {
      manager.delete(templateId);
      setTemplates(manager.getAll());
    }
  };

  // 应用模板（点击后直接弹出确认对话框）
  const handleApply = (template: Template) => {
    if (confirm(`确定要使用「${template.name}」模板吗？\n\n当前画布内容将被替换。`)) {
      onApplyTemplate(template.id);
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-[1000px] max-h-[80vh] p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle className="flex items-center justify-between">
            <span>模板库</span>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </DialogTitle>
        </DialogHeader>

        <div className="flex h-[600px]">
          {/* 左侧分类导航 */}
          <div className="w-48 border-r bg-gray-50 p-4 overflow-y-auto">
            <div className="space-y-1">
              {categories.map(category => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                    selectedCategory === category
                      ? 'bg-blue-500 text-white'
                      : 'text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {category === 'all' ? '全部模板' : category}
                </button>
              ))}
            </div>
          </div>

          {/* 右侧模板展示 */}
          <div className="flex-1 flex flex-col">
            {/* 搜索栏 */}
            <div className="p-4 border-b">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="搜索模板..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* 模板网格 */}
            <div className="flex-1 overflow-y-auto p-4">
              {filteredTemplates.length === 0 ? (
                <div className="flex items-center justify-center h-full text-gray-400">
                  暂无模板
                </div>
              ) : (
                <div className="grid grid-cols-5 gap-4">
                  {filteredTemplates.map(template => (
                    <div
                      key={template.id}
                      className="group cursor-pointer"
                      onClick={() => handleApply(template)}
                    >
                      {/* 缩略图 */}
                      <div className="relative aspect-[3/4] bg-white rounded-lg overflow-hidden shadow-sm hover:shadow-xl transition-all duration-200 border border-gray-200 hover:border-blue-400">
                        {template.thumbnail ? (
                          <img
                            src={template.thumbnail}
                            alt={template.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                            {template.name}
                          </div>
                        )}

                        {/* 悬停遮罩 */}
                        <div className="absolute inset-0 bg-blue-500 bg-opacity-0 group-hover:bg-opacity-10 transition-all duration-200 flex items-center justify-center">
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-white px-4 py-2 rounded-full shadow-lg">
                            <span className="text-sm font-medium text-blue-600">点击使用</span>
                          </div>
                        </div>

                        {/* 删除按钮（仅自定义模板） */}
                        {!template.isPreset && (
                          <button
                            onClick={(e) => handleDelete(template.id, e)}
                            className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 z-10"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </div>

                      {/* 模板名称（独立显示在缩略图下方） */}
                      <div className="mt-2 text-center">
                        <div className="font-medium text-sm text-gray-900 truncate px-1">
                          {template.name}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {template.canvasSize.width} × {template.canvasSize.height}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

