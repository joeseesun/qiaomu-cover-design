'use client';

import { useEffect, useRef, useState } from 'react';
import { CanvasManager } from '@/lib/canvas-manager';
import { VersionManager } from '@/lib/version-manager';
import { AIImageGenerator } from '@/lib/ai-image-generator';
import { ImageToImageGenerator } from '@/lib/image-to-image-generator';
import { CanvasVersion, CanvasSize, DEFAULT_CANVAS_SIZE } from '@/lib/types';
import Topbar from './components/home/Topbar';
import Sidebar from './components/home/Sidebar';
import Canvas from './components/home/Canvas';
import FontPanel from './components/home/FontPanel';
import { AIImageDialog } from './components/home/AIImageDialog';
import ImageLibrary from './components/home/ImageLibrary';
import ImageUploadDialog from './components/home/ImageUploadDialog';
import ShapeDialog from './components/home/ShapeDialog';
import ImageToImageDialog from './components/home/ImageToImageDialog';
import ConfirmDialog from './components/ui/ConfirmDialog';
import Toast, { ToastType } from './components/ui/Toast';
import { HexColorPicker } from 'react-colorful';

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
  const [isPanMode, setIsPanMode] = useState(false); // 拖拽模式锁定状态
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [showShapeFillPicker, setShowShapeFillPicker] = useState(false);
  const [showShapeStrokePicker, setShowShapeStrokePicker] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAIImageDialog, setShowAIImageDialog] = useState(false);
  const [showImageLibrary, setShowImageLibrary] = useState(false);
  const [showImageUploadDialog, setShowImageUploadDialog] = useState(false);
  const [showShapeDialog, setShowShapeDialog] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    message: string;
    onConfirm: () => void;
  }>({ open: false, message: '', onConfirm: () => {} });
  const [toast, setToast] = useState<{
    show: boolean;
    message: string;
    type: ToastType;
  }>({ show: false, message: '', type: 'success' });
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [showImageToImageDialog, setShowImageToImageDialog] = useState(false);
  const aiImageGeneratorRef = useRef<AIImageGenerator | null>(null);
  const imageToImageGeneratorRef = useRef<ImageToImageGenerator | null>(null);

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
    imageToImageGeneratorRef.current = new ImageToImageGenerator();

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

    // 在Fabric.js的upperCanvasEl上监听右键
    const upperCanvas = managerRef.current.canvas.upperCanvasEl;
    const handleCanvasContextMenu = (e: MouseEvent) => {
      console.log('🟡🟡🟡 upperCanvasEl contextmenu触发!');
      e.preventDefault();
      e.stopPropagation();

      const pointer = managerRef.current!.canvas.getPointer(e);
      const target = managerRef.current!.canvas.findTarget(e as any, false);

      console.log('🖱️ 右键点击:', { target: target?.type, pointer });

      if (target) {
        managerRef.current!.canvas.setActiveObject(target);
        managerRef.current!.canvas.renderAll();
        setContextMenu({ x: e.clientX, y: e.clientY });
        console.log('✅ 显示菜单');
      } else {
        setContextMenu(null);
        console.log('⚠️ 关闭菜单');
      }
    };

    upperCanvas.addEventListener('contextmenu', handleCanvasContextMenu);



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
        // 检查是否有输入框获得焦点
        const target = e.target as HTMLElement;
        const isInputFocused = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

        // 如果输入框获得焦点,不处理删除键,让浏览器处理
        if (isInputFocused) {
          return;
        }

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

      // 全局快捷键（不需要选中对象）
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      // 撤销/重做快捷键
      if (cmdOrCtrl && e.key === 'z' && managerRef.current) {
        e.preventDefault();
        if (e.shiftKey) {
          // Cmd/Ctrl + Shift + Z = 重做
          managerRef.current.redo();
        } else {
          // Cmd/Ctrl + Z = 撤销
          managerRef.current.undo();
        }
        return;
      }

      // Tab键 - 打开图片转换对话框（需要选中对象且不在编辑状态）
      if (e.key === 'Tab' && managerRef.current) {
        const activeObject = managerRef.current.canvas.getActiveObject();
        const activeObjects = managerRef.current.canvas.getActiveObjects();

        // 检查是否处于文本编辑状态
        const isEditing = activeObject && (activeObject as any).isEditing;

        if (activeObjects.length > 0 && !isEditing) {
          e.preventDefault();
          setShowImageToImageDialog(true);
          return;
        }
      }

      // 图层调整快捷键和复制快捷键（需要选中对象）
      if (managerRef.current && managerRef.current.canvas.getActiveObject()) {
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
            managerRef.current.sendBackwards(); // Cmd/Ctrl + [
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
      upperCanvas.removeEventListener('contextmenu', handleCanvasContextMenu);
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
      // 显示图片上传选择对话框
      setShowImageUploadDialog(true);
    } else if (tool === 'ai-image') {
      // 打开 AI 生图对话框
      setShowAIImageDialog(true);
    } else if (tool === 'emoji') {
      // 切换 Emoji 选择器
      setShowEmojiPicker(!showEmojiPicker);
    } else if (tool === 'shape') {
      // 显示形状选择对话框
      setShowShapeDialog(true);
    }
  };

  // AI 生成图片
  const handleAIImageGenerate = async (prompt: string, size: string) => {
    if (!aiImageGeneratorRef.current || !managerRef.current) return;

    try {
      // 生成图片
      const imageUrl = await aiImageGeneratorRef.current.generateImage(prompt, size);

      // 从 URL 加载图片到画布
      console.log('📥 准备添加AI生成的图片到画布:', imageUrl);
      await managerRef.current.addImageFromURL(imageUrl);

      console.log('✅ AI 生成的图片已添加到画布');
    } catch (error) {
      console.error('❌ AI 生图失败:', error);
      throw error;
    }
  };

  // 从图库选择图片
  const handleSelectImageFromLibrary = async (url: string) => {
    if (!managerRef.current) return;

    try {
      // 从图库选择时不需要再次保存到图库
      await managerRef.current.addImageFromURL(url, false);
      console.log('✅ 图库图片已添加到画布');
    } catch (error) {
      console.error('❌ 添加图库图片失败:', error);
    }
  };

  // 选择形状
  const handleSelectShape = (shapeType: string) => {
    if (!managerRef.current) return;
    managerRef.current.addShape(shapeType);
  };

  // 图片转图片生成
  const handleImageToImageGenerate = async (prompt: string, size: '1K' | '2K' | '4K') => {
    if (!managerRef.current || !imageToImageGeneratorRef.current) return;

    try {
      // 显示加载提示
      setToast({ show: true, message: '正在转换对象为图片...', type: 'info' });

      // 将选中的对象转换为图片URL
      const imageUrls = await managerRef.current.getSelectedObjectsAsImages();

      console.log('✅ 对象已转换为图片:', imageUrls);

      // 显示生成提示
      setToast({ show: true, message: '正在生成新图片...', type: 'info' });

      // 调用API生成新图片
      let generatedImageUrl: string;
      if (imageUrls.length === 1) {
        generatedImageUrl = await imageToImageGeneratorRef.current.generateFromSingleImage(
          prompt,
          imageUrls[0],
          size
        );
      } else {
        generatedImageUrl = await imageToImageGeneratorRef.current.generateFromMultipleImages(
          prompt,
          imageUrls,
          size
        );
      }

      console.log('✅ 新图片已生成:', generatedImageUrl);

      // 将生成的图片添加到画布
      console.log('📥 准备添加图片转换结果到画布:', generatedImageUrl);
      await managerRef.current.addImageFromURL(generatedImageUrl);

      setToast({ show: true, message: '图片生成成功!', type: 'success' });
    } catch (error) {
      console.error('❌ 图片转换失败:', error);
      setToast({
        show: true,
        message: error instanceof Error ? error.message : '图片转换失败',
        type: 'error'
      });
      throw error;
    }
  };

  // 本地上传图片
  const handleLocalUpload = () => {
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
  };

  // 添加 Emoji 到画布
  const handleEmojiSelect = (emoji: string) => {
    if (managerRef.current) {
      managerRef.current.addText(emoji);
      setShowEmojiPicker(false);
    }
  };

  // 处理右键菜单
  const handleContextMenu = (e: React.MouseEvent<HTMLCanvasElement>) => {
    console.log('🎯🎯🎯 handleContextMenu 被调用了!', e.type, e.button);
    e.preventDefault(); // 阻止默认右键菜单
    e.stopPropagation(); // 阻止事件冒泡

    if (!managerRef.current) {
      console.log('❌ managerRef.current 不存在');
      return;
    }

    // 获取点击位置的对象
    const pointer = managerRef.current.canvas.getPointer(e.nativeEvent);
    const target = managerRef.current.canvas.findTarget(e.nativeEvent as any, false);

    console.log('🖱️ 右键点击:', { target: target?.type, pointer, clientX: e.clientX, clientY: e.clientY });

    if (target) {
      // 如果点击了对象,选中它并显示菜单
      managerRef.current.canvas.setActiveObject(target);
      managerRef.current.canvas.renderAll();
      setContextMenu({ x: e.clientX, y: e.clientY });
      console.log('✅ 菜单应该显示了');
    } else {
      // 点击空白区域,关闭菜单
      setContextMenu(null);
      console.log('⚠️ 点击了空白区域,关闭菜单');
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
    const newVersion = versionRef.current.create(`画布 ${versions.length + 1}`);
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
    if (confirm('确定要清理所有缓存吗？这将删除所有画布数据，此操作不可恢复！')) {
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
      setToast({ show: true, message: '下载成功', type: 'success' });
    } catch (error) {
      setToast({ show: true, message: '下载失败', type: 'error' });
    }
  };

  const handleShare = async () => {
    if (!managerRef.current) return;

    try {
      const blob = await managerRef.current.toBlob();
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob }),
      ]);
      setToast({ show: true, message: '已复制到剪贴板', type: 'success' });
    } catch (error) {
      setToast({ show: true, message: '复制失败，请使用下载功能', type: 'error' });
    }
  };

  // 切换拖拽模式
  const handlePanModeToggle = () => {
    setIsPanMode(!isPanMode);
  };

  // 监听ESC键退出拖拽模式
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isPanMode) {
        setIsPanMode(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPanMode]);

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

  const handleTextAlignChange = (align: 'left' | 'center' | 'right') => {
    managerRef.current?.updateTextAlign(align);
  };

  const handleCanvasBackgroundChange = (type: 'solid' | 'gradient' | 'image', value: string) => {
    if (!managerRef.current) return;

    if (type === 'solid') {
      // 纯色背景
      managerRef.current.setBackgroundColor(value);
    } else if (type === 'gradient') {
      // 渐变背景
      managerRef.current.setBackgroundGradient(value);
    } else if (type === 'image') {
      // 图片背景
      managerRef.current.setBackgroundImage(value);
    }
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
        isPanMode={isPanMode}
        onVersionChange={switchVersion}
        onNewVersion={createNewVersion}
        onDuplicateVersion={duplicateVersion}
        onRenameVersion={renameVersion}
        onDeleteVersion={deleteVersion}
        onCanvasSizeChange={handleCanvasSizeChange}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onZoomReset={handleZoomReset}
        onPanModeToggle={handlePanModeToggle}
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
          isPanMode={isPanMode}
          onScaleChange={setCanvasScale}
          onUserZoomChange={setUserZoom}
          onContextMenu={handleContextMenu}
        />

        {/* 右侧字体面板 */}
        <FontPanel
          selectedFont={getSelectedObjectProperty('fontFamily', 'LXGW WenKai')}
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
          onTextAlignChange={handleTextAlignChange}
          onBackgroundChange={handleBackgroundChange}
          onUnderlineChange={handleUnderlineChange}
          onBorderChange={handleBorderChange}
          onCanvasBackgroundChange={handleCanvasBackgroundChange}
        />
      </div>

      {/* 右键菜单 */}
      {contextMenu && selectedObject && (
        <>
          {/* 背景遮罩，点击关闭菜单 */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => {
              setContextMenu(null);
              setShowShapeFillPicker(false);
              setShowShapeStrokePicker(false);
            }}
          />
          {/* 菜单 */}
          <div
            className="fixed z-50 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[160px]"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            {/* 形状专属选项 */}
            {(selectedObject as any).isShape && (
              <>
                <div className="px-4 py-1 text-xs text-gray-500 font-medium">形状设置</div>
                <button
                  className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100"
                  onClick={() => setShowShapeFillPicker(!showShapeFillPicker)}
                >
                  改变填充颜色
                </button>
                <button
                  className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100"
                  onClick={() => setShowShapeStrokePicker(!showShapeStrokePicker)}
                >
                  改变边框颜色
                </button>
                <div className="h-px bg-gray-200 my-1" />
                <div className="px-4 py-1 text-xs text-gray-500 font-medium">图层</div>
              </>
            )}

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
                managerRef.current?.sendBackwards();
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

          {/* 填充颜色选择器 */}
          {showShapeFillPicker && (
            <div
              className="fixed z-50 bg-white rounded-lg shadow-lg p-3"
              style={{ left: contextMenu.x + 180, top: contextMenu.y }}
            >
              <HexColorPicker
                color={(selectedObject as any).fill || '#3b82f6'}
                onChange={(color) => {
                  if (selectedObject) {
                    selectedObject.set('fill', color);
                    managerRef.current?.canvas.renderAll();
                  }
                }}
              />
            </div>
          )}

          {/* 边框颜色选择器 */}
          {showShapeStrokePicker && (
            <div
              className="fixed z-50 bg-white rounded-lg shadow-lg p-3"
              style={{ left: contextMenu.x + 180, top: contextMenu.y + 40 }}
            >
              <HexColorPicker
                color={(selectedObject as any).stroke || '#1e40af'}
                onChange={(color) => {
                  if (selectedObject) {
                    selectedObject.set('stroke', color);
                    managerRef.current?.canvas.renderAll();
                  }
                }}
              />
            </div>
          )}
        </>
      )}

      {/* AI 生图对话框 */}
      <AIImageDialog
        open={showAIImageDialog}
        onOpenChange={setShowAIImageDialog}
        onGenerate={handleAIImageGenerate}
      />

      {/* 图片转图片对话框 */}
      <ImageToImageDialog
        open={showImageToImageDialog}
        onClose={() => setShowImageToImageDialog(false)}
        onGenerate={handleImageToImageGenerate}
        imageCount={managerRef.current?.canvas.getActiveObjects().length || 0}
      />

      {/* 图片库 */}
      {showImageLibrary && (
        <ImageLibrary
          onClose={() => setShowImageLibrary(false)}
          onSelectImage={handleSelectImageFromLibrary}
        />
      )}

      {/* 图片上传选择对话框 */}
      <ImageUploadDialog
        open={showImageUploadDialog}
        onClose={() => setShowImageUploadDialog(false)}
        onLocalUpload={handleLocalUpload}
        onLibrarySelect={() => setShowImageLibrary(true)}
      />

      {/* 形状选择对话框 */}
      <ShapeDialog
        open={showShapeDialog}
        onClose={() => setShowShapeDialog(false)}
        onSelectShape={handleSelectShape}
      />

      {/* 通用确认对话框 */}
      <ConfirmDialog
        open={confirmDialog.open}
        message={confirmDialog.message}
        onConfirm={() => {
          confirmDialog.onConfirm();
          setConfirmDialog({ open: false, message: '', onConfirm: () => {} });
        }}
        onCancel={() => setConfirmDialog({ open: false, message: '', onConfirm: () => {} })}
      />

      {/* Toast提示 */}
      {toast.show && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast({ show: false, message: '', type: 'success' })}
        />
      )}
    </div>
  );
}
