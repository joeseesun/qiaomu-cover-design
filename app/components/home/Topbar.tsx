// 顶部导航栏
'use client';


import { CanvasVersion, CanvasSize, CANVAS_RATIOS } from '@/lib/types';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Menu, Download, Copy, Plus, ZoomIn, ZoomOut, Pencil, Trash2, Check, X, Database, ChevronDown, Palette } from 'lucide-react';
import { useState } from 'react';

interface TopbarProps {
  versions: CanvasVersion[];
  activeVersionId: string;
  canvasSize: CanvasSize;
  canvasScale: number;
  onVersionChange: (id: string) => void;
  onNewVersion: () => void;
  onDuplicateVersion: () => void;
  onRenameVersion: (id: string, newName: string) => void;
  onDeleteVersion: (id: string) => void;
  onCanvasSizeChange: (size: CanvasSize) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onDownload: () => void;
  onShare: () => void;
  onClearStorage?: () => void;
}

export default function Topbar({
  versions,
  activeVersionId,
  canvasSize,
  canvasScale,
  onVersionChange,
  onNewVersion,
  onDuplicateVersion,
  onRenameVersion,
  onDeleteVersion,
  onCanvasSizeChange,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onDownload,
  onShare,
  onClearStorage,
}: TopbarProps) {
  const [sizeMenuOpen, setSizeMenuOpen] = useState(false);
  const [activeRatio, setActiveRatio] = useState<'3:4' | '1:1' | '4:3' | '16:9' | '9:16'>('3:4');
  const [editingVersionId, setEditingVersionId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const activeVersion = versions.find((v) => v.id === activeVersionId);

  const handleStartRename = (version: CanvasVersion) => {
    setEditingVersionId(version.id);
    setEditingName(version.name);
  };

  const handleSaveRename = () => {
    if (editingVersionId && editingName.trim()) {
      onRenameVersion(editingVersionId, editingName.trim());
    }
    setEditingVersionId(null);
    setEditingName('');
  };

  const handleCancelRename = () => {
    setEditingVersionId(null);
    setEditingName('');
  };

  return (
    <header
      className="flex items-center justify-between px-8 bg-background"
      style={{ height: '64px', borderBottom: '1px solid hsl(var(--border))' }}
    >
      {/* 左侧：Logo + 版本选择 + 尺寸选择 */}
      <div className="flex items-center gap-6">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <Palette className="h-5 w-5 text-muted-foreground" />
          <span className="font-semibold text-foreground text-base">乔木画布 Beta</span>
        </div>

        {/* 版本选择 */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="h-10 px-5 border-gray-200 gap-2">
              {activeVersion?.name || '画布 1'}
              <ChevronDown className="h-4 w-4 text-gray-500" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-72 border-gray-200">
            {/* 版本列表 */}
            <div className="max-h-80 overflow-y-auto">
              {versions.map((version) => (
                <div
                  key={version.id}
                  className={`group flex items-center justify-between px-2 py-2 hover:bg-gray-50 rounded-sm ${
                    version.id === activeVersionId ? 'bg-gray-100' : ''
                  }`}
                >
                  {editingVersionId === version.id ? (
                    // 编辑模式
                    <div className="flex items-center gap-2 flex-1">
                      <input
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveRename();
                          if (e.key === 'Escape') handleCancelRename();
                        }}
                        className="flex-1 px-2 py-1 text-sm border border-gray-200 rounded"
                        autoFocus
                      />
                      <button
                        onClick={handleSaveRename}
                        className="p-1 hover:bg-gray-50 rounded"
                      >
                        <Check className="h-4 w-4 text-green-600" />
                      </button>
                      <button
                        onClick={handleCancelRename}
                        className="p-1 hover:bg-gray-50 rounded"
                      >
                        <X className="h-4 w-4 text-muted-foreground" />
                      </button>
                    </div>
                  ) : (
                    // 正常模式
                    <>
                      <button
                        onClick={() => onVersionChange(version.id)}
                        className="flex-1 text-left px-2 py-1 text-sm"
                      >
                        {version.name}
                      </button>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStartRename(version);
                          }}
                          className="p-1 hover:bg-white rounded"
                          title="重命名"
                        >
                          <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                        {versions.length > 1 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm(`确定删除画布"${version.name}"吗？`)) {
                                onDeleteVersion(version.id);
                              }
                            }}
                            className="p-1 hover:bg-white rounded"
                            title="删除"
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onNewVersion}>
              <Plus className="mr-2 h-4 w-4" />
              新建画布
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDuplicateVersion}>
              <Copy className="mr-2 h-4 w-4" />
              复制当前画布
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* 尺寸选择 */}
        <DropdownMenu open={sizeMenuOpen} onOpenChange={setSizeMenuOpen}>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="h-10 px-5 border-gray-200 gap-2">
              {canvasSize.name} ({canvasSize.ratio})
              <ChevronDown className="h-4 w-4 text-gray-500" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-80 border-gray-200">
            {/* 比例 Tab */}
            <div className="flex border-b border-gray-200">
              {(['3:4', '1:1', '4:3', '16:9', '9:16'] as const).map((ratio) => (
                <button
                  key={ratio}
                  onClick={() => setActiveRatio(ratio)}
                  className={`flex-1 px-3 py-3 text-sm font-medium transition-colors ${
                    activeRatio === ratio
                      ? 'text-gray-900 border-b-2 border-gray-400'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {ratio}
                </button>
              ))}
            </div>

            {/* 尺寸列表 */}
            <div className="p-3">
              {CANVAS_RATIOS[activeRatio].map((size) => (
                <button
                  key={size.name}
                  onClick={() => {
                    onCanvasSizeChange(size);
                    setSizeMenuOpen(false);
                  }}
                  className={`w-full px-4 py-3 text-left rounded-md transition-colors flex items-center justify-between ${
                    canvasSize.name === size.name
                      ? 'bg-gray-100 text-gray-900'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <span className="text-sm font-medium">{size.name}</span>
                  {canvasSize.name === size.name && (
                    <span className="text-xs">✓</span>
                  )}
                </button>
              ))}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* 右侧：缩放控制 + 复制 + 下载 */}
      <div className="flex items-center gap-3">
        {/* 缩放控制 */}
        <div className="flex items-center gap-1 px-2 py-1 rounded-md border border-gray-200 bg-background">
          <button
            onClick={onZoomOut}
            className="p-1 rounded hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ZoomOut className="h-4 w-4 text-muted-foreground" />
          </button>
          <button
            onClick={onZoomReset}
            className="px-3 py-1 text-sm rounded hover:bg-accent transition-colors text-foreground min-w-[50px]"
          >
            {Math.round(canvasScale * 100)}%
          </button>
          <button
            onClick={onZoomIn}
            className="p-1 rounded hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ZoomIn className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        <Button className="h-10 px-6 py-2 gap-2 shadow-sm" onClick={onShare}>
          <Copy className="h-4 w-4" />
          复制
        </Button>
        <Button className="h-10 px-6 py-2 gap-2 shadow-sm" onClick={onDownload}>
          <Download className="h-4 w-4" />
          下载
        </Button>

        {/* 更多菜单 */}
        {onClearStorage && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-10 w-10">
                <Menu className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={onClearStorage} className="text-destructive">
                <Database className="h-4 w-4 mr-2" />
                清理缓存
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  );
}

