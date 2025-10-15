'use client';

import { useEffect, useRef, useState } from 'react';
import { CanvasManager } from '@/lib/canvas-manager';
import { VersionManager } from '@/lib/version-manager';
import { CanvasVersion, CanvasSize, DEFAULT_CANVAS_SIZE } from '@/lib/types';
import Topbar from './components/home/Topbar';
import Sidebar from './components/home/Sidebar';
import Canvas from './components/home/Canvas';
import FontPanel from './components/home/FontPanel';

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const managerRef = useRef<CanvasManager | null>(null);
  const versionRef = useRef<VersionManager | null>(null);

  const [versions, setVersions] = useState<CanvasVersion[]>([]);
  const [activeId, setActiveId] = useState('');
  const [selectedObject, setSelectedObject] = useState<any>(null);
  const [activeTool, setActiveTool] = useState('text');
  const [canvasScale, setCanvasScale] = useState(1);
  const [canvasSize, setCanvasSize] = useState<CanvasSize>(DEFAULT_CANVAS_SIZE);
  const [userZoom, setUserZoom] = useState(100); // 用户手动缩放（50-200%）

  // 初始化
  useEffect(() => {
    if (!canvasRef.current) return;

    managerRef.current = new CanvasManager(
      canvasRef.current,
      canvasSize.width,
      canvasSize.height
    );
    versionRef.current = new VersionManager();

    setVersions(versionRef.current.getAll());
    setActiveId(versionRef.current.getActive()!.id);

    const active = versionRef.current.getActive();
    if (active?.data) {
      managerRef.current.loadFromJSON(active.data);
      // 迁移旧的 Group 对象为新的 IText（修复双击编辑问题）
      setTimeout(() => {
        managerRef.current?.migrateOldGroups();
      }, 100);
    }

    // 监听选择事件
    managerRef.current.canvas.on('selection:created', (e) => {
      setSelectedObject(e.selected?.[0]);
    });
    managerRef.current.canvas.on('selection:updated', (e) => {
      setSelectedObject(e.selected?.[0]);
    });
    managerRef.current.canvas.on('selection:cleared', () => {
      setSelectedObject(null);
    });

    // 点击画布空白区域取消选中
    managerRef.current.canvas.on('mouse:down', (e) => {
      if (!e.target) {
        managerRef.current?.canvas.discardActiveObject();
        managerRef.current?.canvas.renderAll();
      }
    });

    // 全局点击事件：只有点击画布容器的灰色背景区域时才取消选中
    const handleGlobalClick = (e: MouseEvent) => {
      if (!managerRef.current) return;

      const target = e.target as HTMLElement;
      const canvasContainer = document.getElementById('canvas-container');

      if (!canvasContainer) return;

      // 只有直接点击画布容器的灰色背景区域时才取消选中
      // 不包括点击画布本身、Topbar、Sidebar、FontPanel 等其他 UI 元素
      if (target === canvasContainer) {
        const activeObject = managerRef.current.canvas.getActiveObject();
        if (activeObject && !(activeObject as any).isEditing) {
          managerRef.current.canvas.discardActiveObject();
          managerRef.current.canvas.renderAll();
        }
      }
    };

    // 键盘事件：删除选中对象
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && managerRef.current) {
        const activeObject = managerRef.current.canvas.getActiveObject();
        if (activeObject) {
          managerRef.current.canvas.remove(activeObject);
          managerRef.current.canvas.renderAll();
        }
      }
    };

    window.addEventListener('click', handleGlobalClick);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      managerRef.current?.dispose();
      window.removeEventListener('click', handleGlobalClick);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // 自动保存
  useEffect(() => {
    const timer = setInterval(() => {
      if (managerRef.current && versionRef.current && activeId) {
        const data = managerRef.current.toJSON();
        versionRef.current.update(activeId, data);
      }
    }, 2000);

    return () => clearInterval(timer);
  }, [activeId]);

  // 工具切换
  const handleToolChange = (tool: string) => {
    setActiveTool(tool);
    if (tool === 'text' && managerRef.current) {
      managerRef.current.addText();
    }
  };

  // 版本管理
  const switchVersion = (id: string) => {
    if (!managerRef.current || !versionRef.current) return;

    // 保存当前版本
    const currentData = managerRef.current.toJSON();
    versionRef.current.update(activeId, currentData);

    // 切换版本
    const version = versionRef.current.getById(id);
    if (version) {
      managerRef.current.loadFromJSON(version.data);
    }

    setActiveId(id);
    setVersions(versionRef.current.getAll());
  };

  const createNewVersion = () => {
    if (!versionRef.current) return;
    const newVersion = versionRef.current.create(`版本 ${versions.length + 1}`);
    setVersions(versionRef.current.getAll());
    switchVersion(newVersion.id);
  };

  const duplicateVersion = () => {
    if (!managerRef.current || !versionRef.current) return;
    const data = managerRef.current.toJSON();
    const newVersion = versionRef.current.duplicate(activeId, data);
    setVersions(versionRef.current.getAll());
    switchVersion(newVersion.id);
  };

  const renameVersion = (id: string, newName: string) => {
    if (!versionRef.current) return;
    versionRef.current.rename(id, newName);
    setVersions(versionRef.current.getAll());
  };

  const deleteVersion = (id: string) => {
    if (!versionRef.current) return;
    try {
      versionRef.current.delete(id);
      setVersions(versionRef.current.getAll());
      // 如果删除的是当前版本，切换到第一个版本
      if (id === activeId) {
        const firstVersion = versionRef.current.getAll()[0];
        if (firstVersion) {
          switchVersion(firstVersion.id);
        }
      }
    } catch (error: any) {
      alert(error.message);
    }
  };

  // 导出
  const handleDownload = async () => {
    if (!managerRef.current) return;

    try {
      const blob = await managerRef.current.toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `xiaohongshu-cover-${Date.now()}.png`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      alert('下载失败');
    }
  };

  const handleShare = async () => {
    if (!managerRef.current) return;

    try {
      const blob = await managerRef.current.toBlob();
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob }),
      ]);
      alert('已复制到剪贴板');
    } catch (error) {
      alert('复制失败，请使用导出功能');
    }
  };

  // 画布尺寸改变
  const handleCanvasSizeChange = (newSize: CanvasSize) => {
    if (!managerRef.current) return;

    const currentData = managerRef.current.toJSON();
    setCanvasSize(newSize);

    managerRef.current.dispose();
    if (canvasRef.current) {
      managerRef.current = new CanvasManager(
        canvasRef.current,
        newSize.width,
        newSize.height
      );

      if (currentData) {
        managerRef.current.loadFromJSON(currentData);
      }

      managerRef.current.canvas.on('selection:created', (e) => {
        setSelectedObject(e.selected?.[0]);
      });
      managerRef.current.canvas.on('selection:updated', (e) => {
        setSelectedObject(e.selected?.[0]);
      });
      managerRef.current.canvas.on('selection:cleared', () => {
        setSelectedObject(null);
      });
    }
  };

  // 缩放控制
  const handleZoomIn = () => {
    setUserZoom((prev) => Math.min(prev + 10, 200));
  };

  const handleZoomOut = () => {
    setUserZoom((prev) => Math.max(prev - 10, 50));
  };

  const handleZoomReset = () => {
    setUserZoom(100);
  };

  // 字体面板操作
  const handleFontChange = (fontFamily: string) => {
    managerRef.current?.updateProperty('fontFamily', fontFamily);
  };

  const handleFontSizeChange = (size: number) => {
    managerRef.current?.updateProperty('fontSize', size);
  };

  const handleColorChange = (color: string) => {
    managerRef.current?.updateProperty('fill', color);
  };

  const handleHighlight = (
    type: 'marker' | 'underline' | 'box',
    color: string
  ) => {
    if (!selectedObject || !managerRef.current) return;

    // 如果已经是高亮文本（Group），只更新背景色
    if (selectedObject.type === 'group') {
      managerRef.current.updateHighlightBackground(selectedObject, type, color);
    } else {
      // 如果是普通文本，转换为高亮文本
      const text = selectedObject.text || '高亮文字';
      const left = selectedObject.left;
      const top = selectedObject.top;

      managerRef.current.deleteActive();
      managerRef.current.addHighlightText(
        {
          text,
          type,
          color,
          fontSize: selectedObject.fontSize,
          fontFamily: selectedObject.fontFamily,
        },
        left,
        top
      );
    }
  };

  return (
    <div className="h-screen flex flex-col">
      {/* 顶部导航 */}
      <Topbar
        versions={versions}
        activeVersionId={activeId}
        canvasSize={canvasSize}
        canvasScale={canvasScale}
        onVersionChange={switchVersion}
        onNewVersion={createNewVersion}
        onDuplicateVersion={duplicateVersion}
        onRenameVersion={renameVersion}
        onDeleteVersion={deleteVersion}
        onCanvasSizeChange={handleCanvasSizeChange}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onZoomReset={handleZoomReset}
        onDownload={handleDownload}
        onShare={handleShare}
      />

      {/* 主内容区 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 左侧工具栏 */}
        <Sidebar activeTool={activeTool} onToolChange={handleToolChange} />

        {/* 画布区域 */}
        <Canvas
          canvasRef={canvasRef}
          canvasSize={canvasSize}
          userZoom={userZoom}
          onScaleChange={setCanvasScale}
        />

        {/* 右侧字体面板 */}
        <FontPanel
          selectedFont={selectedObject?.fontFamily || 'Noto Sans SC'}
          fontSize={selectedObject?.fontSize || 60}
          textColor={selectedObject?.fill || '#333333'}
          selectedObject={selectedObject}
          onFontChange={handleFontChange}
          onFontSizeChange={handleFontSizeChange}
          onColorChange={handleColorChange}
          onHighlight={handleHighlight}
        />
      </div>
    </div>
  );
}
