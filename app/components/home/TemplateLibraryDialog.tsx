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
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);

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

  // 应用模板
  const handleApply = (templateId: string) => {
    onApplyTemplate(templateId);
    onClose();
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
                <div className="grid grid-cols-4 gap-3">
                  {filteredTemplates.map(template => (
                    <div
                      key={template.id}
                      className="group relative border rounded-lg overflow-hidden cursor-pointer hover:shadow-lg transition-shadow bg-white"
                      onClick={() => setPreviewTemplate(template)}
                    >
                      {/* 缩略图 */}
                      <div className="aspect-[3/4] bg-gray-100 flex items-center justify-center">
                        {template.thumbnail ? (
                          <img
                            src={template.thumbnail}
                            alt={template.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="text-gray-400 text-xs">
                            {template.name}
                          </div>
                        )}
                      </div>

                      {/* 模板信息 */}
                      <div className="p-2">
                        <div className="font-medium text-xs text-gray-900 truncate">
                          {template.name}
                        </div>
                        <div className="text-[10px] text-gray-500 mt-0.5">
                          {template.canvasSize.width} × {template.canvasSize.height}
                        </div>
                      </div>

                      {/* 删除按钮（仅自定义模板） */}
                      {!template.isPreset && (
                        <button
                          onClick={(e) => handleDelete(template.id, e)}
                          className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 预览对话框 */}
        {previewTemplate && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-[600px] w-full mx-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">{previewTemplate.name}</h3>
                <button
                  onClick={() => setPreviewTemplate(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* 预览图 */}
              <div className="mb-4 border rounded-lg overflow-hidden bg-gray-100">
                <div className="aspect-[3/4] flex items-center justify-center">
                  {previewTemplate.thumbnail ? (
                    <img
                      src={previewTemplate.thumbnail}
                      alt={previewTemplate.name}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="text-gray-400">暂无预览</div>
                  )}
                </div>
              </div>

              {/* 模板信息 */}
              <div className="mb-4 text-sm text-gray-600">
                <div>分类：{previewTemplate.category}</div>
                <div>
                  尺寸：{previewTemplate.canvasSize.width} × {previewTemplate.canvasSize.height}
                </div>
                <div>类型：{previewTemplate.isPreset ? '预设模板' : '自定义模板'}</div>
              </div>

              {/* 操作按钮 */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setPreviewTemplate(null)}
                  className="flex-1"
                >
                  取消
                </Button>
                <Button
                  onClick={() => {
                    handleApply(previewTemplate.id);
                    setPreviewTemplate(null);
                  }}
                  className="flex-1"
                >
                  使用此模板
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

