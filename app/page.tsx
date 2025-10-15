'use client';

import { useEffect, useRef, useState } from 'react';
import { CanvasManager } from '@/lib/canvas-manager';
import { VersionManager } from '@/lib/version-manager';
import { AIImageGenerator } from '@/lib/ai-image-generator';
import { CanvasVersion, CanvasSize, DEFAULT_CANVAS_SIZE } from '@/lib/types';
import Topbar from './components/home/Topbar';
import Sidebar from './components/home/Sidebar';
import Canvas from './components/home/Canvas';
import FontPanel from './components/home/FontPanel';
import { AIImageDialog } from './components/home/AIImageDialog';

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
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAIImageDialog, setShowAIImageDialog] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const aiImageGeneratorRef = useRef<AIImageGenerator | null>(null);

  // 初始化 - 只在组件挂载时执行一次
  useEffect(() => {
    if (!canvasRef.current) return;

    managerRef.current = new CanvasManager(
      canvasRef.current,
      canvasSize.width,
      canvasSize.height
    );
    versionRef.current = new VersionManager();
    aiImageGeneratorRef.current = new AIImageGenerator();

    const allVersions = versionRef.current.getAll();
    const activeVersion = versionRef.current.getActive();

    console.log('🔍 初始化加载:', {
      版本数量: allVersions.length,
      所有版本: allVersions.map(v => ({ id: v.id, name: v.name, updatedAt: new Date(v.updatedAt).toLocaleString() })),
      当前激活版本: activeVersion ? { id: activeVersion.id, name: activeVersion.name, updatedAt: new Date(activeVersion.updatedAt).toLocaleString() } : null,
    });

    setVersions(allVersions);
    setActiveId(activeVersion!.id);

    if (activeVersion?.data) {
      managerRef.current.loadFromJSON(activeVersion.data);
      // ✅ 不再需要 migrateOldGroups，因为 rebindGroupEvents 已经处理了双击编辑
    }

    // 监听选择事件
    managerRef.current.canvas.on('selection:created', (e: any) => {
      const target = e.selected?.[0] || e.target;
      setSelectedObject(target);
    });
    managerRef.current.canvas.on('selection:updated', (e: any) => {
      const target = e.selected?.[0] || e.target;
      setSelectedObject(target);
    });
    managerRef.current.canvas.on('selection:cleared', () => {
      setSelectedObject(null);
    });

    // 监听右键菜单
    managerRef.current.canvas.on('mouse:down', (e: any) => {
      if (e.button === 3 && e.target) {
        // 右键点击
        e.e.preventDefault();
        setContextMenu({ x: e.e.clientX, y: e.e.clientY });
      } else {
        setContextMenu(null);
      }
    });

    // 点击画布空白区域取消选中
    managerRef.current.canvas.on('mouse:down', (e) => {
      if (!e.target) {
        managerRef.current?.canvas.discardActiveObject();
        managerRef.current?.canvas.renderAll();
      }
    });

    // 监听画布变化，更新撤销/重做状态
    const updateUndoRedoState = () => {
      if (managerRef.current) {
        setCanUndo(managerRef.current.canUndo());
        setCanRedo(managerRef.current.canRedo());
      }
    };
    managerRef.current.canvas.on('object:added', updateUndoRedoState);
    managerRef.current.canvas.on('object:modified', updateUndoRedoState);
    managerRef.current.canvas.on('object:removed', updateUndoRedoState);

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

    // 键盘事件：删除选中对象、图层调整
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && managerRef.current) {
        const activeObject = managerRef.current.canvas.getActiveObject();
        if (activeObject) {
          // 检查是否处于编辑状态
          const isEditing = (activeObject as any).isEditing;

          // 只有在非编辑状态下才删除整个对象
          if (!isEditing) {
            e.preventDefault(); // 阻止默认行为
            managerRef.current.deleteActive(); // 使用 deleteActive 方法支持多选删除
          }
          // 如果处于编辑状态,让浏览器处理默认的删除行为（删除选中的文字）
        }
      }

      // 图层调整快捷键和复制快捷键
      if (managerRef.current && managerRef.current.canvas.getActiveObject()) {
        const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
        const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

        // 复制快捷键 Cmd/Ctrl + D
        if (cmdOrCtrl && e.key === 'd') {
          e.preventDefault();
          managerRef.current.duplicateActive();
          return;
        }

        if (cmdOrCtrl && e.key === ']') {
          e.preventDefault();
          if (e.shiftKey) {
            managerRef.current.bringToFront(); // Cmd/Ctrl + Shift + ]
          } else {
            managerRef.current.bringForward(); // Cmd/Ctrl + ]
          }
        } else if (cmdOrCtrl && e.key === '[') {
          e.preventDefault();
          if (e.shiftKey) {
            managerRef.current.sendToBack(); // Cmd/Ctrl + Shift + [
          } else {
            managerRef.current.sendBackward(); // Cmd/Ctrl + [
          }
        }
      }
    };

    // 剪贴板粘贴事件：支持粘贴图片
    const handlePaste = async (e: ClipboardEvent) => {
      if (!managerRef.current) return;

      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.indexOf('image') !== -1) {
          e.preventDefault();
          const blob = item.getAsFile();
          if (blob) {
            try {
              await managerRef.current.addImageFromClipboard(blob);
            } catch (error) {
              console.error('Failed to paste image:', error);
            }
          }
          break;
        }
      }
    };

    window.addEventListener('click', handleGlobalClick);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('paste', handlePaste);

    return () => {
      managerRef.current?.dispose();
      window.removeEventListener('click', handleGlobalClick);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('paste', handlePaste);
    };
  }, []); // 空依赖数组，只在组件挂载时执行一次

  // 页面卸载前保存数据
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (managerRef.current && versionRef.current && activeId) {
        const data = managerRef.current.toJSON();
        versionRef.current.update(activeId, data);
        console.log('💾 页面卸载前保存:', {
          版本ID: activeId,
          数据大小: data.length,
        });
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      // 组件卸载时也保存一次
      handleBeforeUnload();
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [activeId]);

  // 自动保存（增加间隔，减少 localStorage 写入）
  useEffect(() => {
    let lastSavedData = '';

    const timer = setInterval(() => {
      if (managerRef.current && versionRef.current && activeId) {
        const data = managerRef.current.toJSON();

        // 只有数据变化时才保存，避免重复写入
        if (data !== lastSavedData) {
          try {
            // 自动保存时不保存缩略图，减少 localStorage 占用
            versionRef.current.update(activeId, data);
            lastSavedData = data;
            console.log('💾 自动保存成功:', {
              版本ID: activeId,
              数据大小: data.length,
              时间: new Date().toLocaleTimeString()
            });
          } catch (error) {
            console.error('❌ 自动保存失败:', error);
            // 如果 localStorage 满了，清理旧版本
            if (error instanceof Error && error.name === 'QuotaExceededError') {
              console.warn('⚠️ localStorage 已满，请考虑删除一些版本');
            }
          }
        }
      }
    }, 2000); // 2 秒自动保存一次，确保数据及时保存

    return () => clearInterval(timer);
  }, [activeId]);

  // 工具切换
  const handleToolChange = (tool: string) => {
    setActiveTool(tool);
    if (tool === 'text' && managerRef.current) {
      managerRef.current.addText(); // 单行文本
    } else if (tool === 'textbox' && managerRef.current) {
      managerRef.current.addTextbox(); // 多行文本
    } else if (tool === 'image' && managerRef.current) {
      // 触发文件选择
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file && managerRef.current) {
          try {
            await managerRef.current.addImage(file);
          } catch (error) {
            console.error('Failed to add image:', error);
          }
        }
      };
      input.click();
    } else if (tool === 'ai-image') {
      // 打开 AI 生图对话框
      setShowAIImageDialog(true);
    } else if (tool === 'emoji') {
      // 切换 Emoji 选择器
      setShowEmojiPicker(!showEmojiPicker);
    }
  };

  // AI 生成图片
  const handleAIImageGenerate = async (prompt: string, size: string) => {
    if (!aiImageGeneratorRef.current || !managerRef.current) return;

    try {
      // 生成图片
      const imageUrl = await aiImageGeneratorRef.current.generateImage(prompt, size);

      // 从 URL 加载图片到画布
      await managerRef.current.addImageFromURL(imageUrl);

      console.log('✅ AI 生成的图片已添加到画布');
    } catch (error) {
      console.error('❌ AI 生图失败:', error);
      throw error;
    }
  };

  // 添加 Emoji 到画布
  const handleEmojiSelect = (emoji: string) => {
    if (managerRef.current) {
      managerRef.current.addText(emoji);
      setShowEmojiPicker(false);
    }
  };

  // 撤销
  const handleUndo = () => {
    if (managerRef.current) {
      managerRef.current.undo();
      setCanUndo(managerRef.current.canUndo());
      setCanRedo(managerRef.current.canRedo());
    }
  };

  // 重做
  const handleRedo = () => {
    if (managerRef.current) {
      managerRef.current.redo();
      setCanUndo(managerRef.current.canUndo());
      setCanRedo(managerRef.current.canRedo());
    }
  };

  // 版本管理
  const switchVersion = (id: string) => {
    if (!managerRef.current || !versionRef.current) return;

    // 保存当前版本
    const currentData = managerRef.current.toJSON();
    const currentThumbnail = managerRef.current.toThumbnail();
    versionRef.current.update(activeId, currentData, currentThumbnail);

    // 切换版本
    versionRef.current.setActive(id); // ✅ 更新 VersionManager 的 activeId
    const version = versionRef.current.getById(id);

    console.log('🔄 切换版本:', {
      从: activeId,
      到: id,
      版本名称: version?.name,
      更新时间: version ? new Date(version.updatedAt).toLocaleString() : null,
      数据是否为空: !version?.data,
    });

    if (version) {
      // 如果版本数据为空，清空画布；否则加载数据
      if (!version.data || version.data === '') {
        console.log('📄 新建空白画布');
        managerRef.current.clear();
      } else {
        managerRef.current.loadFromJSON(version.data);
      }
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

  // 清理 localStorage
  const handleClearStorage = () => {
    if (confirm('确定要清理所有缓存吗？这将删除所有版本数据，此操作不可恢复！')) {
      localStorage.clear();
      alert('缓存已清理，页面即将刷新');
      window.location.reload();
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

  const handleLineHeightChange = (lineHeight: number) => {
    managerRef.current?.updateProperty('lineHeight', lineHeight);
  };

  const handleLetterSpacingChange = (letterSpacing: number) => {
    managerRef.current?.updateProperty('charSpacing', letterSpacing);
  };

  const handleBackgroundChange = (
    style: 'none' | 'solid',
    color?: string,
    opacity?: number
  ) => {
    managerRef.current?.updateBackground(style, color, opacity);
  };

  const handleUnderlineChange = (
    style: 'none' | 'solid' | 'wavy' | 'dotted',
    width?: number,
    color?: string
  ) => {
    managerRef.current?.updateUnderline(style, width, color);
  };

  const handleBorderChange = (
    style: 'none' | 'solid' | 'dashed',
    width?: number,
    color?: string
  ) => {
    managerRef.current?.updateBorder(style, width, color);
  };

  // 获取选中对象的属性（支持多选）
  const getSelectedObjectProperty = (property: string, defaultValue: any) => {
    if (!selectedObject) return defaultValue;

    // 如果是多选，获取第一个对象的属性
    if (selectedObject.type === 'activeSelection') {
      const objects = (selectedObject as any).getObjects();
      if (objects.length === 0) return defaultValue;

      const firstObj = objects[0];
      // 如果是 Group，获取内部文本对象的属性
      if (firstObj.type === 'group') {
        const textObj = (firstObj as any)._objects?.find((o: any) => o.type === 'i-text');
        return textObj?.[property] || defaultValue;
      }
      return firstObj[property] || defaultValue;
    }

    // 单个对象
    if (selectedObject.type === 'group') {
      const textObj = (selectedObject as any)._objects?.find((o: any) => o.type === 'i-text');
      return textObj?.[property] || defaultValue;
    }

    return selectedObject[property] || defaultValue;
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
        onClearStorage={handleClearStorage}
      />

      {/* 主内容区 */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* 左侧工具栏 */}
        <Sidebar
          activeTool={activeTool}
          onToolChange={handleToolChange}
          canUndo={canUndo}
          canRedo={canRedo}
          onUndo={handleUndo}
          onRedo={handleRedo}
        />

        {/* Emoji 选择器 */}
        {showEmojiPicker && (
          <>
            {/* 背景遮罩 */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => setShowEmojiPicker(false)}
            />
            {/* Emoji 弹层 */}
            <div
              className="fixed z-50 bg-white rounded-lg shadow-lg border border-gray-200 p-4"
              style={{ left: '72px', top: '50%', transform: 'translateY(-50%)', maxHeight: '400px', overflowY: 'auto' }}
            >
              <div className="grid grid-cols-8 gap-2">
                {[
                  '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂',
                  '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩',
                  '😘', '😗', '😚', '😙', '😋', '😛', '😜', '🤪',
                  '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨',
                  '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥',
                  '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕',
                  '🤢', '🤮', '🤧', '🥵', '🥶', '😵', '🤯', '🤠',
                  '🥳', '😎', '🤓', '🧐', '😕', '😟', '🙁', '☹️',
                  '😮', '😯', '😲', '😳', '🥺', '😦', '😧', '😨',
                  '😰', '😥', '😢', '😭', '😱', '😖', '😣', '😞',
                  '😓', '😩', '😫', '🥱', '😤', '😡', '😠', '🤬',
                  '👍', '👎', '👌', '✌️', '🤞', '🤟', '🤘', '🤙',
                  '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💪',
                  '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍',
                  '💯', '💢', '💥', '💫', '💦', '💨', '🕳️', '💬',
                  '👁️', '🗨️', '🗯️', '💭', '💤', '⭐', '🌟', '✨',
                  '🔥', '💧', '🌈', '☀️', '🌙', '⚡', '☁️', '❄️',
                  '🎉', '🎊', '🎈', '🎁', '🏆', '🥇', '🥈', '🥉',
                ].map((emoji) => (
                  <button
                    key={emoji}
                    className="text-2xl hover:bg-gray-100 rounded p-2 transition-colors"
                    onClick={() => handleEmojiSelect(emoji)}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* 画布区域 */}
        <Canvas
          canvasRef={canvasRef}
          canvasSize={canvasSize}
          userZoom={userZoom}
          onScaleChange={setCanvasScale}
        />

        {/* 右侧字体面板 */}
        <FontPanel
          selectedFont={getSelectedObjectProperty('fontFamily', 'Noto Sans SC')}
          fontSize={getSelectedObjectProperty('fontSize', 60)}
          textColor={getSelectedObjectProperty('fill', '#333333')}
          lineHeight={getSelectedObjectProperty('lineHeight', 1.2)}
          letterSpacing={getSelectedObjectProperty('charSpacing', 0)}
          selectedObject={selectedObject}
          onFontChange={handleFontChange}
          onFontSizeChange={handleFontSizeChange}
          onColorChange={handleColorChange}
          onLineHeightChange={handleLineHeightChange}
          onLetterSpacingChange={handleLetterSpacingChange}
          onBackgroundChange={handleBackgroundChange}
          onUnderlineChange={handleUnderlineChange}
          onBorderChange={handleBorderChange}
        />
      </div>

      {/* 右键菜单 */}
      {contextMenu && selectedObject && (
        <>
          {/* 背景遮罩，点击关闭菜单 */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setContextMenu(null)}
          />
          {/* 菜单 */}
          <div
            className="fixed z-50 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[160px]"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <button
              className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center justify-between"
              onClick={() => {
                managerRef.current?.bringToFront();
                setContextMenu(null);
              }}
            >
              <span>置于顶层</span>
              <span className="text-xs text-gray-400">⌘⇧]</span>
            </button>
            <button
              className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center justify-between"
              onClick={() => {
                managerRef.current?.bringForward();
                setContextMenu(null);
              }}
            >
              <span>上移一层</span>
              <span className="text-xs text-gray-400">⌘]</span>
            </button>
            <button
              className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center justify-between"
              onClick={() => {
                managerRef.current?.sendBackward();
                setContextMenu(null);
              }}
            >
              <span>下移一层</span>
              <span className="text-xs text-gray-400">⌘[</span>
            </button>
            <button
              className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center justify-between"
              onClick={() => {
                managerRef.current?.sendToBack();
                setContextMenu(null);
              }}
            >
              <span>置于底层</span>
              <span className="text-xs text-gray-400">⌘⇧[</span>
            </button>
          </div>
        </>
      )}

      {/* AI 生图对话框 */}
      <AIImageDialog
        open={showAIImageDialog}
        onOpenChange={setShowAIImageDialog}
        onGenerate={handleAIImageGenerate}
      />
    </div>
  );
}
