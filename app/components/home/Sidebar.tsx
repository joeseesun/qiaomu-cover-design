// 左侧工具栏
'use client';

import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import {
  Type,
  Square,
  Palette,
  AlignCenter,
  Highlighter,
  Undo2,
  Redo2,
} from 'lucide-react';

interface SidebarProps {
  activeTool: string;
  onToolChange: (tool: string) => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
}

export default function Sidebar({
  activeTool,
  onToolChange,
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
}: SidebarProps) {
  const tools = [
    { id: 'text', label: '文本', icon: Type },
    { id: 'shape', label: '形状', icon: Square },
    { id: 'color', label: '颜色', icon: Palette },
    { id: 'align', label: '对齐', icon: AlignCenter },
    { id: 'highlight', label: '高亮', icon: Highlighter },
  ];

  return (
    <aside
      className="flex flex-col items-center py-8 gap-4 bg-background"
      style={{ width: '72px', borderRight: '1px solid hsl(var(--border))' }}
    >
      <TooltipProvider delayDuration={300}>
        {/* 工具按钮 */}
        {tools.map((tool) => {
          const Icon = tool.icon;
          const isActive = activeTool === tool.id;
          return (
            <Tooltip key={tool.id}>
              <TooltipTrigger asChild>
                <Button
                  variant={isActive ? 'default' : 'ghost'}
                  size="icon"
                  onClick={() => onToolChange(tool.id)}
                  className="relative h-12 w-12"
                >
                  <Icon className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>{tool.label}</p>
              </TooltipContent>
            </Tooltip>
          );
        })}

        <Separator className="w-6 my-3" />

        {/* 撤销/重做 */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-12 w-12"
              disabled={!canUndo}
              onClick={onUndo}
            >
              <Undo2 className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">
            <p>撤销</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-12 w-12"
              disabled={!canRedo}
              onClick={onRedo}
            >
              <Redo2 className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">
            <p>重做</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </aside>
  );
}

