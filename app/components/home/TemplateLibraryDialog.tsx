/**
 * 模板库对话框
 * 展示模板分类、网格、预览等功能
 */

'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Trash2 } from 'lucide-react';
import { getTemplateManager, Template, TemplateCategory } from '@/lib/template-manager';
import { PRESET_TEMPLATES } from '@/lib/preset-templates';

interface TemplateLibraryDialogProps {
  open: boolean;
  onClose: () => void;
  onApplyTemplate: (templateId: string) => void;
  currentCanvasSize?: { width: number; height: number }; // 🆕 当前画布尺寸
}

export default function TemplateLibraryDialog({
  open,
  onClose,
  onApplyTemplate,
  currentCanvasSize,
}: TemplateLibraryDialogProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<TemplateCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmTemplate, setConfirmTemplate] = useState<Template | null>(null);
  const [showAllSizes, setShowAllSizes] = useState(false); // 🆕 是否显示所有尺寸

  // 加载模板
  useEffect(() => {
    if (open) {
      const manager = getTemplateManager();

      // 🆕 清理旧的预设模板（名称不在新列表中的）
      const presetNames = PRESET_TEMPLATES.map(t => t.name);
      const allTemplates = manager.getAll();
      allTemplates.forEach(template => {
        if (template.isPreset && !presetNames.includes(template.name)) {
          console.log('🗑️ 删除旧模板:', template.name);
          manager.delete(template.id);
        }
      });

      // 🆕 每次打开都检查并添加缺失的预设模板
      manager.addPresetTemplates(PRESET_TEMPLATES);

      // 为预设模板生成缩略图（强制重新生成）
      const generateThumbnails = async () => {
        const updatedTemplates = manager.getAll();
        console.log('📊 开始生成缩略图，共', updatedTemplates.length, '个模板');

        for (const template of updatedTemplates) {
          if (template.isPreset) {
            try {
              console.log('🖼️ 生成缩略图:', template.name);
              const thumbnail = await manager.generateThumbnailFromJSON(
                template.canvasJSON,
                template.canvasSize.width,
                template.canvasSize.height,
                template.name
              );

              if (thumbnail && thumbnail.startsWith('data:image')) {
                manager.update(template.id, { thumbnail });
                console.log('✅ 缩略图生成成功:', template.name, '大小:', thumbnail.length);
              } else {
                console.error('❌ 缩略图无效:', template.name);
              }
            } catch (error) {
              console.error('❌ 生成缩略图失败:', template.name, error);
            }
          }
        }
        setTemplates(manager.getAll());
        console.log('✅ 所有缩略图生成完成');
      };

      generateThumbnails();
    }
  }, [open]);

  // 过滤模板
  const filteredTemplates = templates.filter(template => {
    const matchCategory = selectedCategory === 'all' || template.category === selectedCategory;
    const matchSearch = template.name.toLowerCase().includes(searchQuery.toLowerCase());

    // 🆕 如果不显示所有尺寸，则只显示匹配当前画布比例的模板
    let matchSize = true;
    if (!showAllSizes && currentCanvasSize) {
      const currentRatio = currentCanvasSize.width / currentCanvasSize.height;
      const templateRatio = template.canvasSize.width / template.canvasSize.height;
      matchSize = Math.abs(currentRatio - templateRatio) < 0.05;
    }

    return matchCategory && matchSearch && matchSize;
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

  // 点击模板，显示确认对话框
  const handleTemplateClick = (template: Template) => {
    setConfirmTemplate(template);
  };

  // 确认应用模板
  const handleConfirmApply = () => {
    if (confirmTemplate) {
      onApplyTemplate(confirmTemplate.id);
      setConfirmTemplate(null);
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-[1000px] max-h-[80vh] p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle>模板库</DialogTitle>
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
                      ? 'bg-gray-900 text-white'
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
            {/* 搜索栏和筛选 */}
            <div className="p-4 border-b space-y-3">
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

              {/* 🆕 尺寸筛选提示 */}
              {currentCanvasSize && (
                <div className="flex items-center justify-between text-sm">
                  <div className="text-gray-600">
                    当前画布：{currentCanvasSize.width} × {currentCanvasSize.height}
                    {!showAllSizes && (
                      <span className="ml-2 text-gray-900">（仅显示匹配比例）</span>
                    )}
                  </div>
                  <button
                    onClick={() => setShowAllSizes(!showAllSizes)}
                    className="text-gray-900 hover:text-gray-700 underline"
                  >
                    {showAllSizes ? '只看匹配比例' : '显示所有尺寸'}
                  </button>
                </div>
              )}
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
                      onClick={() => handleTemplateClick(template)}
                    >
                      {/* 缩略图 */}
                      <div className="relative aspect-[3/4] bg-white rounded-lg overflow-hidden shadow-sm hover:shadow-xl transition-all duration-200 border border-gray-200 hover:border-gray-900">
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
                        <div className="absolute inset-0 bg-gray-900 bg-opacity-0 group-hover:bg-opacity-10 transition-all duration-200 flex items-center justify-center">
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-white px-4 py-2 rounded-full shadow-lg">
                            <span className="text-sm font-medium text-gray-900">点击使用</span>
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

      {/* 确认对话框 */}
      {confirmTemplate && (
        <Dialog open={!!confirmTemplate} onOpenChange={() => setConfirmTemplate(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>使用模板</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <p className="text-sm text-gray-600 mb-4">
                确定要使用「<span className="font-semibold text-gray-900">{confirmTemplate.name}</span>」模板吗？
              </p>
              <p className="text-sm text-amber-600">
                ⚠️ 当前画布内容将被替换
              </p>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setConfirmTemplate(null)}
              >
                取消
              </Button>
              <Button onClick={handleConfirmApply}>
                确定使用
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Dialog>
  );
}

