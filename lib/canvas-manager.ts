// 画布管理器
import { fabric } from 'fabric';
import { HighlightConfig, CANVAS_WIDTH, CANVAS_HEIGHT } from './types';
import { QiniuUploader } from './qiniu-uploader';

export class CanvasManager {
  canvas: fabric.Canvas;
  width: number;
  height: number;
  private history: string[] = [];
  private historyIndex: number = -1;
  private isUndoRedoing: boolean = false;
  private saveHistoryTimer: NodeJS.Timeout | null = null;
  private qiniuUploader: QiniuUploader;

  constructor(element: HTMLCanvasElement, width = CANVAS_WIDTH, height = CANVAS_HEIGHT) {
    this.width = width;
    this.height = height;
    this.qiniuUploader = new QiniuUploader();
    this.canvas = new fabric.Canvas(element, {
      width: this.width,
      height: this.height,
      backgroundColor: '#ffffff',
      // 隐藏画布边框
      selection: true, // 允许框选
      selectionBorderColor: 'transparent', // 隐藏选择框边框
      selectionLineWidth: 0, // 选择框边框宽度为 0
    });

    // 监听画布变化，保存历史记录（使用防抖）
    this.canvas.on('object:added', () => this.scheduleHistorySave());
    this.canvas.on('object:modified', () => this.scheduleHistorySave());
    this.canvas.on('object:removed', () => this.scheduleHistorySave());

    // 监听所有文本对象进入编辑模式
    this.canvas.on('text:editing:entered', (e: any) => {
      console.log('📝 Text editing entered');
      this.setupTextEditingListeners(e.target);
    });
  }

  // 设置文本编辑监听器(用于普通IText和Textbox)
  private setupTextEditingListeners(editText: any) {
    console.log('📌 Setting up editing listeners for text object');

    // ESC键退出编辑
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        console.log('⌨️ ESC pressed, exiting editing');
        editText.exitEditing();
      }
    };
    window.addEventListener('keydown', handleEscape, { capture: true });

    // 监听画布容器点击(灰色区域)
    const handleContainerClick = (e: Event) => {
      console.log('🎯 Canvas container clicked (custom event received), exiting editing', e);
      editText.exitEditing();
    };

    // 监听canvas元素点击
    const handleCanvasClick = () => {
      console.log('🖱️ Canvas clicked, checking activeObject');
      // 延迟检查,等待Fabric.js处理完点击事件
      setTimeout(() => {
        const activeObj = this.canvas.getActiveObject();
        console.log('🔍 ActiveObject:', activeObj === editText ? 'still editText' : 'changed');
        // 如果activeObject不再是editText,说明点击了其他地方,退出编辑
        if (activeObj !== editText) {
          console.log('✅ ActiveObject changed, exiting editing');
          editText.exitEditing();
        }
      }, 10);
    };

    // 立即添加监听器
    console.log('📌 Adding click listeners for editing mode');
    // 监听画布容器点击(灰色区域)
    document.addEventListener('canvas-container-click', handleContainerClick);
    console.log('📌 Container click listener added');
    // 监听canvas元素点击 - 需要延迟避免立即触发
    const canvasElement = this.canvas.getElement();
    setTimeout(() => {
      canvasElement.addEventListener('click', handleCanvasClick);
      console.log('📌 Canvas click listener added');
    }, 200);

    // 监听编辑退出,移除所有监听器
    const handleEditingExited = () => {
      console.log('🚪 Exited editing, removing listeners');
      window.removeEventListener('keydown', handleEscape, { capture: true } as any);
      document.removeEventListener('canvas-container-click', handleContainerClick);
      canvasElement.removeEventListener('click', handleCanvasClick);
      editText.off('editing:exited', handleEditingExited);
    };
    editText.on('editing:exited', handleEditingExited);
  }

  // 添加单行文本（IText）
  addText(text = '双击编辑') {
    const obj = new fabric.IText(text, {
      left: this.width / 2,
      top: this.height / 2,
      fontSize: 60,
      fontFamily: 'Noto Sans SC',
      fill: '#333333',
      originX: 'center',
      originY: 'center',
      editable: true,
      selectable: true,
      textBaseline: 'middle',
    });

    this.canvas.add(obj);
    this.canvas.setActiveObject(obj);
    this.canvas.renderAll();
    return obj;
  }

  // 添加多行文本（Textbox，支持自动换行）
  addTextbox(text = '双击编辑') {
    const obj = new fabric.Textbox(text, {
      left: this.width / 2,
      top: this.height / 2,
      width: this.width * 0.8, // 画布宽度的80%
      fontSize: 60,
      fontFamily: 'Noto Sans SC',
      fill: '#333333',
      originX: 'center',
      originY: 'center',
      editable: true,
      selectable: true,
      textBaseline: 'middle',
      splitByGrapheme: true, // 支持中文字符换行
    });

    this.canvas.add(obj);
    this.canvas.setActiveObject(obj);
    this.canvas.renderAll();
    return obj;
  }

  // 压缩图片
  private compressImage(file: File, maxWidth = 1200, quality = 0.8): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // 如果图片宽度超过最大宽度，按比例缩小
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Failed to get canvas context'));
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);

          // 转换为 JPEG 格式，质量 0.8
          const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(compressedDataUrl);
        };

        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = e.target?.result as string;
      };

      reader.onerror = () => {
        reject(new Error('Failed to read file'));
      };

      reader.readAsDataURL(file);
    });
  }

  // 添加图片（上传到七牛云）
  addImage(file: File): Promise<fabric.Image> {
    return new Promise(async (resolve, reject) => {
      try {
        console.log('📤 开始上传图片到七牛云...');

        // 上传到七牛云
        const imageUrl = await this.qiniuUploader.uploadFile(file);

        console.log('✅ 图片上传成功，URL:', imageUrl);

        // 从七牛云 URL 加载图片
        fabric.Image.fromURL(imageUrl, (img) => {
          if (!img) {
            reject(new Error('Failed to load image from Qiniu'));
            return;
          }

          // 计算缩放比例，确保图片不超过画布的 80%
          const maxWidth = this.width * 0.8;
          const maxHeight = this.height * 0.8;
          const scale = Math.min(
            maxWidth / (img.width || 1),
            maxHeight / (img.height || 1),
            1 // 不放大，只缩小
          );

          img.set({
            left: this.width / 2,
            top: this.height / 2,
            originX: 'center',
            originY: 'center',
            scaleX: scale,
            scaleY: scale,
          });

          this.canvas.add(img);
          this.canvas.setActiveObject(img);
          this.canvas.renderAll();
          resolve(img);
        }, { crossOrigin: 'anonymous' }); // 允许跨域
      } catch (error) {
        console.error('❌ 图片上传失败:', error);
        reject(error);
      }
    });
  }

  // 从剪贴板添加图片（上传到七牛云）
  addImageFromClipboard(blob: Blob): Promise<fabric.Image> {
    return new Promise(async (resolve, reject) => {
      try {
        console.log('📤 开始上传剪贴板图片到七牛云...');

        // 上传到七牛云
        const imageUrl = await this.qiniuUploader.uploadBlob(blob);

        console.log('✅ 剪贴板图片上传成功，URL:', imageUrl);

        // 从七牛云 URL 加载图片
        fabric.Image.fromURL(imageUrl, (img) => {
          if (!img) {
            reject(new Error('Failed to load image from Qiniu'));
            return;
          }

          // 计算缩放比例
          const maxWidth = this.width * 0.8;
          const maxHeight = this.height * 0.8;
          const scale = Math.min(
            maxWidth / (img.width || 1),
            maxHeight / (img.height || 1),
            1
          );

          img.set({
            left: this.width / 2,
            top: this.height / 2,
            originX: 'center',
            originY: 'center',
            scaleX: scale,
            scaleY: scale,
          });

          this.canvas.add(img);
          this.canvas.setActiveObject(img);
          this.canvas.renderAll();
          resolve(img);
        }, { crossOrigin: 'anonymous' }); // 允许跨域
      } catch (error) {
        console.error('❌ 剪贴板图片上传失败:', error);
        reject(error);
      }
    });
  }

  // 从 URL 添加图片（用于 AI 生图）
  addImageFromURL(imageUrl: string): Promise<fabric.Image> {
    return new Promise((resolve, reject) => {
      console.log('📥 从 URL 加载图片:', imageUrl);

      fabric.Image.fromURL(imageUrl, (img) => {
        if (!img) {
          reject(new Error('Failed to load image from URL'));
          return;
        }

        // 计算缩放比例
        const maxWidth = this.width * 0.8;
        const maxHeight = this.height * 0.8;
        const scale = Math.min(
          maxWidth / (img.width || 1),
          maxHeight / (img.height || 1),
          1
        );

        img.set({
          left: this.width / 2,
          top: this.height / 2,
          originX: 'center',
          originY: 'center',
          scaleX: scale,
          scaleY: scale,
        });

        this.canvas.add(img);
        this.canvas.setActiveObject(img);
        this.canvas.renderAll();
        resolve(img);
      }, { crossOrigin: 'anonymous' }); // 允许跨域
    });
  }

  // 调整图层顺序
  bringToFront() {
    const activeObject = this.canvas.getActiveObject();
    if (activeObject) {
      this.canvas.bringToFront(activeObject);
      this.canvas.renderAll();
    }
  }

  sendToBack() {
    const activeObject = this.canvas.getActiveObject();
    if (activeObject) {
      this.canvas.sendToBack(activeObject);
      this.canvas.renderAll();
    }
  }

  bringForward() {
    const activeObject = this.canvas.getActiveObject();
    if (activeObject) {
      this.canvas.bringForward(activeObject);
      this.canvas.renderAll();
    }
  }

  sendBackward() {
    const activeObject = this.canvas.getActiveObject();
    if (activeObject) {
      this.canvas.sendBackward(activeObject);
      this.canvas.renderAll();
    }
  }

  // 复制选中的对象
  duplicateActive() {
    const activeObject = this.canvas.getActiveObject();
    if (!activeObject) return;

    // 处理多选
    if (activeObject.type === 'activeSelection') {
      const selection = activeObject as fabric.ActiveSelection;
      const objects = selection.getObjects();

      // 取消选择
      this.canvas.discardActiveObject();

      // 复制每个对象
      const clonedObjects: fabric.Object[] = [];
      objects.forEach((obj: any) => {
        obj.clone((cloned: fabric.Object) => {
          cloned.set({
            left: (cloned.left || 0) + 20,
            top: (cloned.top || 0) + 20,
          });
          this.canvas.add(cloned);
          clonedObjects.push(cloned);
        }, ['data', 'selectable', 'evented']);
      });

      // 选中复制的对象
      setTimeout(() => {
        const sel = new fabric.ActiveSelection(clonedObjects, {
          canvas: this.canvas,
        });
        this.canvas.setActiveObject(sel);
        this.canvas.renderAll();
      }, 10);

      return;
    }

    // 处理单个对象
    activeObject.clone((cloned: fabric.Object) => {
      cloned.set({
        left: (cloned.left || 0) + 20,
        top: (cloned.top || 0) + 20,
      });
      this.canvas.add(cloned);
      this.canvas.setActiveObject(cloned);
      this.canvas.renderAll();

      // 如果是 Group，需要重新绑定事件
      if (cloned.type === 'group') {
        this.rebindGroupEvents(cloned as fabric.Group);
      }
    }, ['data', 'selectable', 'evented']);
  }

  // 更新现有高亮文本的背景色
  updateHighlightBackground(
    group: fabric.Group,
    type: 'marker' | 'underline' | 'box',
    color: string
  ) {
    const items = (group as any)._objects || [];
    const textObj = items.find((obj: any) => obj.type === 'i-text');
    const backgroundObj = items.find((obj: any) => obj.type !== 'i-text');

    if (!textObj || !backgroundObj) return;

    const paddingX = 20;
    const paddingY = 12;

    // 根据类型更新背景
    switch (type) {
      case 'marker':
        // 更新荧光笔背景
        if (backgroundObj.type === 'rect') {
          backgroundObj.set({
            fill: color,
            opacity: 0.5,
          });
        } else {
          // 如果类型不匹配，需要重新创建
          this.recreateHighlightText(group, type, color);
          return;
        }
        break;
      case 'underline':
        // 更新下划线
        if (backgroundObj.type === 'line') {
          backgroundObj.set({
            stroke: color,
          });
        } else {
          this.recreateHighlightText(group, type, color);
          return;
        }
        break;
      case 'box':
        // 更新边框
        if (backgroundObj.type === 'rect') {
          backgroundObj.set({
            stroke: color,
            fill: 'transparent',
          });
        } else {
          this.recreateHighlightText(group, type, color);
          return;
        }
        break;
    }

    this.canvas.renderAll();
  }

  // 重新创建高亮文本（当类型改变时）
  recreateHighlightText(
    group: fabric.Group,
    type: 'marker' | 'underline' | 'box',
    color: string
  ) {
    const items = (group as any)._objects || [];
    const textObj = items.find((obj: any) => obj.type === 'i-text');

    if (!textObj) return;

    const config: HighlightConfig = {
      text: textObj.text || '',
      type,
      color,
      fontSize: textObj.fontSize,
      fontFamily: textObj.fontFamily,
      left: group.left,
      top: group.top,
      angle: group.angle,
      scaleX: group.scaleX,
      scaleY: group.scaleY,
    };

    this.canvas.remove(group);
    this.addHighlightText(config);
  }

  // 添加高亮文本（使用 Group 但支持双击编辑）
  addHighlightText(config: HighlightConfig, left?: number, top?: number) {
    // 获取当前选中对象的位置（如果有）
    const activeObj = this.canvas.getActiveObject();
    const finalLeft = left ?? config.left ?? activeObj?.left ?? this.width / 2;
    const finalTop = top ?? config.top ?? activeObj?.top ?? this.height / 2;
    const finalAngle = config.angle ?? 0;
    const finalScaleX = config.scaleX ?? 1;
    const finalScaleY = config.scaleY ?? 1;

    const text = new fabric.IText(config.text, {
      fontSize: config.fontSize || 60,
      fontFamily: config.fontFamily || 'Noto Sans SC',
      fill: '#333333',
      editable: true,
      selectable: true,
      originX: 'center',
      originY: 'center',
      textAlign: 'center',
    });

    let background: fabric.Object | null = null;
    const paddingX = 20; // 左右内边距
    const paddingY = 12; // 上下内边距

    // 根据类型创建背景
    switch (config.type) {
      case 'marker':
        // 荧光笔效果：半透明矩形背景
        background = new fabric.Rect({
          width: (text.width || 0) + paddingX * 2,
          height: (text.height || 0) + paddingY * 2,
          fill: config.color,
          opacity: 0.5,
          rx: 6,
          ry: 6,
          originX: 'center',
          originY: 'center',
        });
        break;
      case 'underline':
        // 下划线效果
        background = new fabric.Line(
          [
            -(text.width || 0) / 2,
            (text.height || 0) / 2 + 6,
            (text.width || 0) / 2,
            (text.height || 0) / 2 + 6,
          ],
          {
            stroke: config.color,
            strokeWidth: 4,
            originX: 'center',
            originY: 'center',
          }
        );
        break;
      case 'box':
        // 边框效果
        background = new fabric.Rect({
          width: (text.width || 0) + paddingX * 2,
          height: (text.height || 0) + paddingY * 2,
          stroke: config.color,
          strokeWidth: 3,
          fill: 'transparent',
          rx: 6,
          ry: 6,
          originX: 'center',
          originY: 'center',
        });
        break;
    }

    // 确保背景和文本的位置都是 (0, 0)，这样它们在 Group 内部就是居中的
    background!.set({ left: 0, top: 0 });
    text.set({ left: 0, top: 0 });

    const group = new fabric.Group([background!, text], {
      left: finalLeft,
      top: finalTop,
      angle: finalAngle,
      scaleX: finalScaleX,
      scaleY: finalScaleY,
      originX: 'center',
      originY: 'center',
      subTargetCheck: true, // 允许选中子对象
      data: { isDecoratedText: true }, // ✅ 标记为新的装饰文本，避免被迁移
    });

    // 监听双击事件，进入文本编辑模式
    group.on('mousedblclick', () => {
      // 获取 Group 的实际中心点坐标（考虑所有变换）
      const centerPoint = group.getCenterPoint();
      const savedLeft = centerPoint.x;
      const savedTop = centerPoint.y;
      const savedAngle = group.angle || 0;
      const savedScaleX = group.scaleX || 1;
      const savedScaleY = group.scaleY || 1;

      // 获取文本对象的属性
      const items = (group as any)._objects || [];
      const textObj = items.find((obj: any) => obj.type === 'i-text');

      if (textObj) {
        // 保存文本内容和样式
        const textContent = textObj.text || '';
        const originalFontSize = textObj.fontSize || 60;
        const fontFamily = textObj.fontFamily || 'Noto Sans SC';
        const fill = textObj.fill || '#333333';
        const scaledFontSize = originalFontSize * savedScaleX;

        // 移除 Group
        this.canvas.remove(group);

        // 创建新的文本对象用于编辑
        const editText = new fabric.IText(textContent, {
          left: savedLeft,
          top: savedTop,
          angle: savedAngle,
          fontSize: scaledFontSize,
          fontFamily: fontFamily,
          fill: fill,
          scaleX: 1,
          scaleY: 1,
          originX: 'center',
          originY: 'center',
          editable: true,
          selectable: true,
          textAlign: 'center',
        });

        this.canvas.add(editText);
        this.canvas.setActiveObject(editText);

        // 保存当前滚动位置
        const savedScrollX = window.scrollX;
        const savedScrollY = window.scrollY;

        // 保存body和html的overflow样式
        const bodyOverflow = document.body.style.overflow;
        const htmlOverflow = document.documentElement.style.overflow;

        // 临时禁用滚动
        document.body.style.overflow = 'hidden';
        document.documentElement.style.overflow = 'hidden';

        // 强制阻止滚动的函数
        const preventScroll = (e: Event) => {
          e.preventDefault();
          e.stopPropagation();
          window.scrollTo(savedScrollX, savedScrollY);
          return false;
        };

        // 在多个事件上阻止滚动
        window.addEventListener('scroll', preventScroll, { passive: false, capture: true });
        document.addEventListener('scroll', preventScroll, { passive: false, capture: true });
        document.body.addEventListener('scroll', preventScroll, { passive: false, capture: true });

        // 延迟进入编辑模式，并立即恢复滚动
        setTimeout(() => {
          editText.enterEditing();
          editText.selectAll();

          // 强制恢复滚动位置(多次尝试)
          const restoreScroll = () => {
            window.scrollTo(savedScrollX, savedScrollY);
            document.documentElement.scrollTop = savedScrollY;
            document.documentElement.scrollLeft = savedScrollX;
            document.body.scrollTop = savedScrollY;
            document.body.scrollLeft = savedScrollX;
          };

          restoreScroll();
          setTimeout(restoreScroll, 10);
          setTimeout(restoreScroll, 50);

          // 延迟移除滚动监听和恢复overflow，确保编辑模式完全稳定
          setTimeout(() => {
            window.removeEventListener('scroll', preventScroll, { capture: true } as any);
            document.removeEventListener('scroll', preventScroll, { capture: true } as any);
            document.body.removeEventListener('scroll', preventScroll, { capture: true } as any);

            // 恢复overflow样式
            document.body.style.overflow = bodyOverflow;
            document.documentElement.style.overflow = htmlOverflow;

            // 最后一次恢复滚动位置
            restoreScroll();
          }, 200);
        }, 0);

        this.canvas.renderAll();

        // 监听ESC键退出编辑
        const handleEscape = (e: KeyboardEvent) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            editText.exitEditing();
          }
        };
        window.addEventListener('keydown', handleEscape, { capture: true });

        // 监听画布容器点击(灰色区域)
        const handleContainerClick = (e: Event) => {
          console.log('🎯 Canvas container clicked (custom event received), exiting editing', e);
          editText.exitEditing();
        };

        // 监听canvas元素点击
        const handleCanvasClick = () => {
          console.log('🖱️ Canvas clicked, checking activeObject');
          // 延迟检查,等待Fabric.js处理完点击事件
          setTimeout(() => {
            const activeObj = this.canvas.getActiveObject();
            console.log('🔍 ActiveObject:', activeObj === editText ? 'still editText' : 'changed');
            // 如果activeObject不再是editText,说明点击了其他地方,退出编辑
            if (activeObj !== editText) {
              console.log('✅ ActiveObject changed, exiting editing');
              editText.exitEditing();
            }
          }, 10);
        };

        // 延迟添加点击监听，避免立即触发
        setTimeout(() => {
          console.log('📌 Click listeners added for editing mode');
          console.log('   - Adding canvas-container-click listener');
          console.log('   - Adding canvas click listener');
          // 监听画布容器点击(灰色区域)
          document.addEventListener('canvas-container-click', handleContainerClick);
          // 监听canvas元素点击
          const canvasElement = this.canvas.getElement();
          canvasElement.addEventListener('click', handleCanvasClick);
          console.log('✅ All listeners added successfully');
        }, 200);

        // 监听文本编辑完成，重新创建 Group
        editText.on('editing:exited', () => {
          console.log('🚪 Exited editing, removing listeners');
          // 移除所有监听器
          window.removeEventListener('keydown', handleEscape, { capture: true } as any);
          document.removeEventListener('canvas-container-click', handleContainerClick);
          const canvasElement = this.canvas.getElement();
          canvasElement.removeEventListener('click', handleCanvasClick);
          window.removeEventListener('scroll', preventScroll);
          document.removeEventListener('scroll', preventScroll);

          const newConfig = {
            ...config,
            text: editText.text || '',
            fontSize: originalFontSize,
            fontFamily: fontFamily,
            fill: fill,
            left: editText.left,
            top: editText.top,
            angle: editText.angle,
            scaleX: savedScaleX,
            scaleY: savedScaleY,
          };
          this.canvas.remove(editText);
          this.addHighlightText(newConfig);
        });
      }
    });

    this.canvas.add(group);
    this.canvas.setActiveObject(group);
    this.canvas.renderAll();
    return group;
  }

  // 设置背景色
  setBackgroundColor(color: string) {
    this.canvas.setBackgroundColor(color, () => this.canvas.renderAll());
  }

  // 更新选中对象的属性
  updateProperty(property: string, value: any) {
    const activeObj = this.canvas.getActiveObject();
    if (!activeObj) return;

    // 处理多选
    if (activeObj.type === 'activeSelection') {
      const selection = activeObj as fabric.ActiveSelection;
      const objects = selection.getObjects();

      objects.forEach((obj: any) => {
        this.updateSingleObjectProperty(obj, property, value);
      });

      this.canvas.renderAll();
      this.canvas.fire('object:modified', { target: activeObj });
      return;
    }

    // 处理单个对象
    this.updateSingleObjectProperty(activeObj, property, value);
    activeObj.setCoords();
    this.canvas.renderAll();
    this.canvas.fire('object:modified', { target: activeObj });
  }

  // 更新单个对象的属性
  private updateSingleObjectProperty(obj: any, property: string, value: any) {
    let targetObj = obj;

    // 如果是 Group，需要更新内部的文本对象
    if (obj.type === 'group') {
      const textObj = (obj as any)._objects?.find((o: any) => o.type === 'i-text' || o.type === 'textbox');
      if (textObj) {
        targetObj = textObj;
      }
    }

    // 对于文本颜色，需要特殊处理以支持多行文本
    if (property === 'fill' && (targetObj.type === 'i-text' || targetObj.type === 'textbox' || targetObj.type === 'text')) {
      // 设置整体颜色
      targetObj.set('fill', value);

      // 如果是 i-text 或 textbox，清除所有选区样式，确保所有文本都使用统一颜色
      if (targetObj.type === 'i-text' || targetObj.type === 'textbox') {
        const textLength = (targetObj as any).text?.length || 0;
        if (textLength > 0) {
          // 清除所有字符的样式，让它们使用对象的 fill 属性
          (targetObj as any).setSelectionStyles({ fill: value }, 0, textLength);
        }
      }
    } else {
      targetObj.set(property, value);
    }
  }

  // 删除选中对象
  deleteActive() {
    const activeObj = this.canvas.getActiveObject();
    if (!activeObj) return;

    // 处理多选
    if (activeObj.type === 'activeSelection') {
      const selection = activeObj as fabric.ActiveSelection;
      const objects = selection.getObjects();

      // 批量删除
      objects.forEach((obj: any) => {
        this.canvas.remove(obj);
      });

      // 取消选择
      this.canvas.discardActiveObject();
    } else {
      // 删除单个对象
      this.canvas.remove(activeObj);
    }

    this.canvas.renderAll();
  }

  // 添加/更新背景
  updateBackground(style: 'none' | 'solid', color?: string, opacity?: number) {
    const activeObj = this.canvas.getActiveObject();
    if (!activeObj) return;

    // 处理多选
    if (activeObj.type === 'activeSelection') {
      const selection = activeObj as fabric.ActiveSelection;
      const objects = selection.getObjects();

      // 取消选择
      this.canvas.discardActiveObject();

      // 批量更新
      objects.forEach((obj: any) => {
        this.updateSingleObjectBackground(obj, style, color, opacity);
      });

      this.canvas.renderAll();
      return;
    }

    // 处理单个对象
    this.updateSingleObjectBackground(activeObj, style, color, opacity);
  }

  // 更新单个对象的背景
  private updateSingleObjectBackground(
    obj: any,
    style: 'none' | 'solid',
    color?: string,
    opacity?: number
  ) {
    const currentConfig = this.extractTextConfig(obj);
    if (!currentConfig) return;

    // 更新背景配置
    currentConfig.backgroundStyle = style;
    currentConfig.backgroundColor = color || currentConfig.backgroundColor || '#FFE066';
    // 更新透明度
    if (opacity !== undefined) {
      currentConfig.backgroundOpacity = opacity;
    } else if (!currentConfig.backgroundOpacity) {
      // 如果之前没有背景，设置默认透明度
      currentConfig.backgroundOpacity = 0.5;
    }

    // 删除旧对象
    this.canvas.remove(obj);

    // 重新创建
    this.createDecoratedText(currentConfig);
  }

  // 添加/更新下划线
  updateUnderline(
    style: 'none' | 'solid' | 'wavy' | 'dotted',
    width?: number,
    color?: string
  ) {
    const activeObj = this.canvas.getActiveObject();
    if (!activeObj) return;

    // 处理多选
    if (activeObj.type === 'activeSelection') {
      const selection = activeObj as fabric.ActiveSelection;
      const objects = selection.getObjects();

      // 取消选择
      this.canvas.discardActiveObject();

      // 批量更新
      objects.forEach((obj: any) => {
        this.updateSingleObjectUnderline(obj, style, width, color);
      });

      this.canvas.renderAll();
      return;
    }

    // 处理单个对象
    this.updateSingleObjectUnderline(activeObj, style, width, color);
  }

  // 更新单个对象的下划线
  private updateSingleObjectUnderline(
    obj: any,
    style: 'none' | 'solid' | 'wavy' | 'dotted',
    width?: number,
    color?: string
  ) {
    const currentConfig = this.extractTextConfig(obj);
    if (!currentConfig) return;

    // 更新下划线配置
    currentConfig.underlineStyle = style;
    currentConfig.underlineWidth = width || currentConfig.underlineWidth || 2;
    currentConfig.underlineColor = color || currentConfig.underlineColor || '#FF2442';

    // 删除旧对象
    this.canvas.remove(obj);

    // 重新创建
    this.createDecoratedText(currentConfig);
  }

  // 添加/更新边框
  updateBorder(
    style: 'none' | 'solid' | 'dashed',
    width?: number,
    color?: string
  ) {
    const activeObj = this.canvas.getActiveObject();
    if (!activeObj) return;

    // 处理多选
    if (activeObj.type === 'activeSelection') {
      const selection = activeObj as fabric.ActiveSelection;
      const objects = selection.getObjects();

      // 取消选择
      this.canvas.discardActiveObject();

      // 批量更新
      objects.forEach((obj: any) => {
        this.updateSingleObjectBorder(obj, style, width, color);
      });

      this.canvas.renderAll();
      return;
    }

    // 处理单个对象
    this.updateSingleObjectBorder(activeObj, style, width, color);
  }

  // 更新单个对象的边框
  private updateSingleObjectBorder(
    obj: any,
    style: 'none' | 'solid' | 'dashed',
    width?: number,
    color?: string
  ) {
    const currentConfig = this.extractTextConfig(obj);
    if (!currentConfig) return;

    // 更新边框配置
    currentConfig.borderStyle = style;
    currentConfig.borderWidth = width || currentConfig.borderWidth || 2;
    currentConfig.borderColor = color || currentConfig.borderColor || '#FF2442';

    // 删除旧对象
    this.canvas.remove(obj);

    // 重新创建
    this.createDecoratedText(currentConfig);
  }

  // 提取文本配置
  private extractTextConfig(obj: any): any {
    let textObj: any;
    let config: any = {};

    if (obj.type === 'group') {
      const items = (obj as any)._objects || [];
      textObj = items.find((o: any) => o.type === 'i-text' || o.type === 'textbox');
      if (!textObj) return null;

      config = {
        text: textObj.text,
        fontSize: textObj.fontSize,
        fontFamily: textObj.fontFamily,
        fill: textObj.fill,
        lineHeight: textObj.lineHeight,
        charSpacing: textObj.charSpacing,
        left: obj.left,
        top: obj.top,
        angle: obj.angle,
        scaleX: obj.scaleX,
        scaleY: obj.scaleY,
        textType: textObj.type, // ✅ 保存原始文本类型
      };

      // 提取装饰配置
      items.forEach((item: any) => {
        if (item.type === 'rect') {
          // 矩形可能是背景或边框
          if (item.fill && item.fill !== 'transparent') {
            // 有填充色 = 背景
            config.backgroundStyle = 'solid';
            config.backgroundColor = item.fill;
            config.backgroundOpacity = item.opacity ?? 0.5;  // ✅ 保存透明度，默认 0.5
          } else if (item.fill === 'transparent' || item.stroke) {
            // 透明填充或有描边 = 边框
            config.borderStyle = item.strokeDashArray ? 'dashed' : 'solid';
            config.borderWidth = item.strokeWidth;
            config.borderColor = item.stroke;
          }
        } else if (item.type === 'line' || item.type === 'polyline') {
          if (item.type === 'polyline') {
            config.underlineStyle = 'wavy';
          } else if (item.strokeDashArray) {
            config.underlineStyle = 'dotted';
          } else {
            config.underlineStyle = 'solid';
          }
          config.underlineWidth = item.strokeWidth;
          config.underlineColor = item.stroke;
        }
      });
    } else if (obj.type === 'i-text' || obj.type === 'text' || obj.type === 'textbox') {
      config = {
        text: obj.text,
        fontSize: obj.fontSize,
        fontFamily: obj.fontFamily,
        fill: obj.fill,
        lineHeight: obj.lineHeight,
        charSpacing: obj.charSpacing,
        left: obj.left,
        top: obj.top,
        angle: obj.angle,
        scaleX: obj.scaleX,
        scaleY: obj.scaleY,
        textType: obj.type, // ✅ 保存原始文本类型
      };
    } else {
      return null;
    }

    return config;
  }

  // 创建带装饰的文本
  private createDecoratedText(config: any) {
    // 根据原始类型决定使用 IText 还是 Textbox
    // 如果没有 textType，默认使用 textbox（向后兼容）
    const useTextbox = config.textType === 'textbox' || !config.textType;

    let text: fabric.IText | fabric.Textbox;

    if (useTextbox) {
      // 多行文本：使用 Textbox，支持固定宽度和自动换行
      const maxTextWidth = this.width * 0.8; // 画布宽度的80%
      text = new fabric.Textbox(config.text || '文字', {
        width: maxTextWidth,
        fontSize: config.fontSize || 60,
        fontFamily: config.fontFamily || 'Noto Sans SC',
        fill: config.fill || '#333333',
        lineHeight: config.lineHeight || 1.2,
        charSpacing: config.charSpacing || 0,
        editable: true,
        selectable: true,
        originX: 'center',
        originY: 'center',
        textBaseline: 'middle',
        splitByGrapheme: true, // 支持中文字符换行
      });
    } else {
      // 单行文本：使用 IText，不自动换行
      text = new fabric.IText(config.text || '文字', {
        fontSize: config.fontSize || 60,
        fontFamily: config.fontFamily || 'Noto Sans SC',
        fill: config.fill || '#333333',
        lineHeight: config.lineHeight || 1.2,
        charSpacing: config.charSpacing || 0,
        editable: true,
        selectable: true,
        originX: 'center',
        originY: 'center',
        textBaseline: 'middle',
      });
    }

    // 强制计算文本尺寸
    text.setCoords();

    const objects: fabric.Object[] = [];
    const paddingX = 20;
    const paddingY = 12;
    const textWidth = text.width || 0;
    const textHeight = text.height || 0;

    // 背景
    if (config.backgroundStyle && config.backgroundStyle !== 'none') {
      const background = new fabric.Rect({
        width: textWidth + paddingX * 2,
        height: textHeight + paddingY * 2,
        fill: config.backgroundColor || '#FFE066',
        opacity: config.backgroundOpacity ?? 0.5,  // ✅ 使用保存的透明度
        rx: 6,
        ry: 6,
        originX: 'center',
        originY: 'center',
      });
      objects.push(background);
    }

    // 边框
    if (config.borderStyle && config.borderStyle !== 'none') {
      const border = new fabric.Rect({
        width: textWidth + paddingX * 2,
        height: textHeight + paddingY * 2,
        stroke: config.borderColor || '#FF2442',
        strokeWidth: config.borderWidth || 2,
        strokeDashArray: config.borderStyle === 'dashed' ? [(config.borderWidth || 2) * 3, (config.borderWidth || 2) * 2] : undefined,
        fill: 'transparent',
        rx: 6,
        ry: 6,
        originX: 'center',
        originY: 'center',
      });
      objects.push(border);
    }

    // 下划线
    if (config.underlineStyle && config.underlineStyle !== 'none') {
      const lineY = textHeight / 2 + 8;  // 文本底部 + 8px
      const lineWidth = config.underlineWidth || 2;
      const lineColor = config.underlineColor || '#FF2442';

      let underline: fabric.Object;
      if (config.underlineStyle === 'solid') {
        underline = new fabric.Line(
          [-textWidth / 2, lineY, textWidth / 2, lineY],
          {
            stroke: lineColor,
            strokeWidth: lineWidth,
            originX: 'center',
            originY: 'center',
          }
        );
      } else if (config.underlineStyle === 'dotted') {
        underline = new fabric.Line(
          [-textWidth / 2, lineY, textWidth / 2, lineY],
          {
            stroke: lineColor,
            strokeWidth: lineWidth,
            strokeDashArray: [lineWidth * 2, lineWidth * 2],
            originX: 'center',
            originY: 'center',
          }
        );
      } else {
        // wavy
        const amplitude = lineWidth * 2;
        const frequency = 10;
        const points: any[] = [];

        for (let x = 0; x <= textWidth; x += 2) {
          const y = lineY + Math.sin((x / frequency) * Math.PI) * amplitude;
          points.push({ x: x - textWidth / 2, y });
        }

        underline = new fabric.Polyline(points, {
          stroke: lineColor,
          strokeWidth: lineWidth,
          fill: '',
          originX: 'center',
          originY: 'center',
        });
      }
      objects.push(underline);
    }

    // 添加文本
    objects.push(text);

    // 如果有装饰，创建 Group；否则只添加文本
    if (objects.length > 1) {
      // 确保所有对象的位置都是 (0, 0)，这样它们在 Group 内部就是居中的
      // 但是下划线需要保持其 Y 坐标偏移
      objects.forEach(obj => {
        if (obj.type === 'line' || obj.type === 'polyline') {
          // 下划线：只设置 left: 0，保持 top 为其计算的 Y 坐标
          obj.set({ left: 0 });
        } else {
          // 其他对象：设置 left: 0, top: 0
          obj.set({ left: 0, top: 0 });
        }
      });

      const group = new fabric.Group(objects, {
        left: config.left || this.width / 2,
        top: config.top || this.height / 2,
        angle: config.angle || 0,
        scaleX: config.scaleX || 1,
        scaleY: config.scaleY || 1,
        originX: 'center',
        originY: 'center',
      });

      // 双击编辑
      group.on('mousedblclick', () => {
        // 获取 Group 的实际中心点坐标（考虑所有变换）
        const centerPoint = group.getCenterPoint();
        const savedLeft = centerPoint.x;
        const savedTop = centerPoint.y;
        const savedAngle = group.angle || 0;
        const savedScaleX = group.scaleX || 1;
        const savedScaleY = group.scaleY || 1;

        // 保存文本属性
        const textContent = text.text || '';
        const originalFontSize = text.fontSize || 60;
        const fontFamily = text.fontFamily || 'Noto Sans SC';
        const fill = text.fill || '#333333';
        const lineHeight = text.lineHeight || 1.2;
        const charSpacing = text.charSpacing || 0;
        const scaledFontSize = originalFontSize * savedScaleX;
        const textType = text.type; // 保存原始文本类型

        // 移除 Group
        this.canvas.remove(group);

        // 根据原始类型创建编辑文本对象
        let editText: fabric.IText | fabric.Textbox;

        if (textType === 'textbox') {
          // 多行文本
          const maxTextWidth = this.width * 0.8;
          editText = new fabric.Textbox(textContent, {
            width: maxTextWidth,
            left: savedLeft,
            top: savedTop,
            angle: savedAngle,
            fontSize: scaledFontSize,
            fontFamily: fontFamily,
            fill: fill,
            lineHeight: lineHeight,
            charSpacing: charSpacing,
            scaleX: 1,
            scaleY: 1,
            originX: 'center',
            originY: 'center',
            editable: true,
            selectable: true,
            textBaseline: 'middle',
            splitByGrapheme: true,
          });
        } else {
          // 单行文本
          editText = new fabric.IText(textContent, {
            left: savedLeft,
            top: savedTop,
            angle: savedAngle,
            fontSize: scaledFontSize,
            fontFamily: fontFamily,
            fill: fill,
            lineHeight: lineHeight,
            charSpacing: charSpacing,
            scaleX: 1,
            scaleY: 1,
            originX: 'center',
            originY: 'center',
            editable: true,
            selectable: true,
            textBaseline: 'middle',
          });
        }

        this.canvas.add(editText);
        this.canvas.setActiveObject(editText);

        // 保存当前滚动位置
        const savedScrollX = window.scrollX;
        const savedScrollY = window.scrollY;

        // 保存body和html的overflow样式
        const bodyOverflow = document.body.style.overflow;
        const htmlOverflow = document.documentElement.style.overflow;

        // 临时禁用滚动
        document.body.style.overflow = 'hidden';
        document.documentElement.style.overflow = 'hidden';

        // 强制阻止滚动的函数
        const preventScroll = (e: Event) => {
          e.preventDefault();
          e.stopPropagation();
          window.scrollTo(savedScrollX, savedScrollY);
          return false;
        };

        // 在多个事件上阻止滚动
        window.addEventListener('scroll', preventScroll, { passive: false, capture: true });
        document.addEventListener('scroll', preventScroll, { passive: false, capture: true });
        document.body.addEventListener('scroll', preventScroll, { passive: false, capture: true });

        // 延迟进入编辑模式，并立即恢复滚动
        setTimeout(() => {
          editText.enterEditing();
          editText.selectAll();

          // 强制恢复滚动位置(多次尝试)
          const restoreScroll = () => {
            window.scrollTo(savedScrollX, savedScrollY);
            document.documentElement.scrollTop = savedScrollY;
            document.documentElement.scrollLeft = savedScrollX;
            document.body.scrollTop = savedScrollY;
            document.body.scrollLeft = savedScrollX;
          };

          restoreScroll();
          setTimeout(restoreScroll, 10);
          setTimeout(restoreScroll, 50);

          // 延迟移除滚动监听和恢复overflow，确保编辑模式完全稳定
          setTimeout(() => {
            window.removeEventListener('scroll', preventScroll, { capture: true } as any);
            document.removeEventListener('scroll', preventScroll, { capture: true } as any);
            document.body.removeEventListener('scroll', preventScroll, { capture: true } as any);

            // 恢复overflow样式
            document.body.style.overflow = bodyOverflow;
            document.documentElement.style.overflow = htmlOverflow;

            // 最后一次恢复滚动位置
            restoreScroll();
          }, 200);
        }, 0);

        // 监听ESC键退出编辑
        const handleEscape = (e: KeyboardEvent) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            editText.exitEditing();
          }
        };
        window.addEventListener('keydown', handleEscape, { capture: true });

        // 监听画布容器点击(灰色区域)
        const handleContainerClick = (e: Event) => {
          console.log('🎯 Canvas container clicked, exiting editing');
          editText.exitEditing();
        };

        // 监听canvas元素点击
        const handleCanvasClick = () => {
          console.log('🖱️ Canvas clicked, checking activeObject');
          // 延迟检查,等待Fabric.js处理完点击事件
          setTimeout(() => {
            const activeObj = this.canvas.getActiveObject();
            console.log('🔍 ActiveObject:', activeObj === editText ? 'still editText' : 'changed');
            // 如果activeObject不再是editText,说明点击了其他地方,退出编辑
            if (activeObj !== editText) {
              console.log('✅ ActiveObject changed, exiting editing');
              editText.exitEditing();
            }
          }, 10);
        };

        // 立即添加监听器
        console.log('📌 Adding click listeners for editing mode');
        // 监听画布容器点击(灰色区域)
        document.addEventListener('canvas-container-click', handleContainerClick);
        console.log('📌 Container click listener added');
        // 监听canvas元素点击 - 需要延迟避免立即触发
        const canvasElement = this.canvas.getElement();
        setTimeout(() => {
          canvasElement.addEventListener('click', handleCanvasClick);
          console.log('📌 Canvas click listener added');
        }, 200);

        editText.on('editing:exited', () => {
          console.log('🚪 Exited editing, removing listeners');
          // 移除所有监听器
          window.removeEventListener('keydown', handleEscape, { capture: true } as any);
          document.removeEventListener('canvas-container-click', handleContainerClick);
          const canvasElement = this.canvas.getElement();
          canvasElement.removeEventListener('click', handleCanvasClick);
          window.removeEventListener('scroll', preventScroll);
          document.removeEventListener('scroll', preventScroll);

          const newConfig = {
            ...config,
            text: editText.text || '',
            fontSize: originalFontSize,
            fontFamily: fontFamily,
            fill: fill,
            lineHeight: lineHeight,
            charSpacing: charSpacing,
            left: editText.left,
            top: editText.top,
            angle: editText.angle,
            scaleX: savedScaleX,
            scaleY: savedScaleY,
            textType: textType, // 保持原始类型
          };
          this.canvas.remove(editText);
          this.createDecoratedText(newConfig);
        });
      });

      this.canvas.add(group);
      this.canvas.renderAll();
      this.canvas.setActiveObject(group);
    } else {
      text.set({
        left: config.left || this.width / 2,
        top: config.top || this.height / 2,
        angle: config.angle || 0,
        scaleX: config.scaleX || 1,
        scaleY: config.scaleY || 1,
      });
      this.canvas.add(text);
      this.canvas.renderAll();
      this.canvas.setActiveObject(text);
    }
  }

  // 导出为 JSON
  toJSON() {
    return JSON.stringify(this.canvas.toJSON());
  }

  // 从 JSON 加载
  loadFromJSON(json: string) {
    this.canvas.loadFromJSON(json, () => {
      // 加载完成后，重新绑定所有 Group 对象的双击事件
      this.rebindGroupEvents();
      this.canvas.renderAll();
    });
  }

  // 重新绑定所有 Group 对象的双击事件
  private rebindGroupEvents() {
    const objects = this.canvas.getObjects();

    objects.forEach((obj: any) => {
      if (obj.type === 'group' && obj._objects) {
        const textObj = obj._objects.find((o: any) => o.type === 'i-text' || o.type === 'textbox');
        if (!textObj) return;

        // 提取配置
        const config = this.extractTextConfig(obj);
        if (!config) return;

        // 绑定双击事件
        obj.on('mousedblclick', () => {
          // 获取 Group 的实际中心点坐标（考虑所有变换）
          const centerPoint = obj.getCenterPoint();
          const savedLeft = centerPoint.x;
          const savedTop = centerPoint.y;
          const savedAngle = obj.angle || 0;
          const savedScaleX = obj.scaleX || 1;
          const savedScaleY = obj.scaleY || 1;

          // 保存文本属性
          const textContent = textObj.text || '';
          const originalFontSize = textObj.fontSize || 60;
          const fontFamily = textObj.fontFamily || 'Noto Sans SC';
          const fill = textObj.fill || '#333333';
          const lineHeight = textObj.lineHeight || 1.2;
          const charSpacing = textObj.charSpacing || 0;
          const scaledFontSize = originalFontSize * savedScaleX;
          const textType = textObj.type; // 保存原始文本类型

          // 移除 Group
          this.canvas.remove(obj);

          // 根据原始类型创建编辑文本对象
          let editText: fabric.IText | fabric.Textbox;

          if (textType === 'textbox') {
            // 多行文本
            const maxTextWidth = this.width * 0.8;
            editText = new fabric.Textbox(textContent, {
              width: maxTextWidth,
              left: savedLeft,
              top: savedTop,
              angle: savedAngle,
              fontSize: scaledFontSize,
              fontFamily: fontFamily,
              fill: fill,
              lineHeight: lineHeight,
              charSpacing: charSpacing,
              scaleX: 1,
              scaleY: 1,
              originX: 'center',
              originY: 'center',
              editable: true,
              selectable: true,
              textBaseline: 'middle',
              splitByGrapheme: true,
            });
          } else {
            // 单行文本
            editText = new fabric.IText(textContent, {
              left: savedLeft,
              top: savedTop,
              angle: savedAngle,
              fontSize: scaledFontSize,
              fontFamily: fontFamily,
              fill: fill,
              lineHeight: lineHeight,
              charSpacing: charSpacing,
              scaleX: 1,
              scaleY: 1,
              originX: 'center',
              originY: 'center',
              editable: true,
              selectable: true,
              textBaseline: 'middle',
            });
          }

          this.canvas.add(editText);
          this.canvas.setActiveObject(editText);

          // 保存当前滚动位置
          const savedScrollX = window.scrollX;
          const savedScrollY = window.scrollY;

          // 保存body和html的overflow样式
          const bodyOverflow = document.body.style.overflow;
          const htmlOverflow = document.documentElement.style.overflow;

          // 临时禁用滚动
          document.body.style.overflow = 'hidden';
          document.documentElement.style.overflow = 'hidden';

          // 强制阻止滚动的函数
          const preventScroll = (e: Event) => {
            e.preventDefault();
            e.stopPropagation();
            window.scrollTo(savedScrollX, savedScrollY);
            return false;
          };

          // 在多个事件上阻止滚动
          window.addEventListener('scroll', preventScroll, { passive: false, capture: true });
          document.addEventListener('scroll', preventScroll, { passive: false, capture: true });
          document.body.addEventListener('scroll', preventScroll, { passive: false, capture: true });

          // 延迟进入编辑模式，并立即恢复滚动
          setTimeout(() => {
            editText.enterEditing();
            editText.selectAll();

            // 强制恢复滚动位置(多次尝试)
            const restoreScroll = () => {
              window.scrollTo(savedScrollX, savedScrollY);
              document.documentElement.scrollTop = savedScrollY;
              document.documentElement.scrollLeft = savedScrollX;
              document.body.scrollTop = savedScrollY;
              document.body.scrollLeft = savedScrollX;
            };

            restoreScroll();
            setTimeout(restoreScroll, 10);
            setTimeout(restoreScroll, 50);

            // 延迟移除滚动监听和恢复overflow，确保编辑模式完全稳定
            setTimeout(() => {
              window.removeEventListener('scroll', preventScroll, { capture: true } as any);
              document.removeEventListener('scroll', preventScroll, { capture: true } as any);
              document.body.removeEventListener('scroll', preventScroll, { capture: true } as any);

              // 恢复overflow样式
              document.body.style.overflow = bodyOverflow;
              document.documentElement.style.overflow = htmlOverflow;

              // 最后一次恢复滚动位置
              restoreScroll();
            }, 200);
          }, 0);

          // 监听ESC键退出编辑
          const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              e.stopPropagation();
              editText.exitEditing();
            }
          };
          window.addEventListener('keydown', handleEscape, { capture: true });

          // 监听画布容器点击(灰色区域)
          const handleContainerClick = (e: Event) => {
            console.log('🎯 Canvas container clicked, exiting editing');
            editText.exitEditing();
          };

          // 监听canvas元素点击
          const handleCanvasClick = () => {
            console.log('🖱️ Canvas clicked, checking activeObject');
            // 延迟检查,等待Fabric.js处理完点击事件
            setTimeout(() => {
              const activeObj = this.canvas.getActiveObject();
              console.log('🔍 ActiveObject:', activeObj === editText ? 'still editText' : 'changed');
              // 如果activeObject不再是editText,说明点击了其他地方,退出编辑
              if (activeObj !== editText) {
                console.log('✅ ActiveObject changed, exiting editing');
                editText.exitEditing();
              }
            }, 10);
          };

          // 立即添加监听器
          console.log('📌 Adding click listeners for editing mode');
          // 监听画布容器点击(灰色区域)
          document.addEventListener('canvas-container-click', handleContainerClick);
          console.log('📌 Container click listener added');
          // 监听canvas元素点击 - 需要延迟避免立即触发
          const canvasElement = this.canvas.getElement();
          setTimeout(() => {
            canvasElement.addEventListener('click', handleCanvasClick);
            console.log('📌 Canvas click listener added');
          }, 200);

          editText.on('editing:exited', () => {
            console.log('🚪 Exited editing, removing listeners');
            // 移除所有监听器
            window.removeEventListener('keydown', handleEscape, { capture: true } as any);
            document.removeEventListener('canvas-container-click', handleContainerClick);
            const canvasElement = this.canvas.getElement();
            canvasElement.removeEventListener('click', handleCanvasClick);
            window.removeEventListener('scroll', preventScroll);
            document.removeEventListener('scroll', preventScroll);

            const newConfig = {
              ...config,
              text: editText.text || '',
              fontSize: originalFontSize,
              fontFamily: fontFamily,
              fill: fill,
              lineHeight: lineHeight,
              charSpacing: charSpacing,
              left: editText.left,
              top: editText.top,
              angle: editText.angle,
              scaleX: savedScaleX,
              scaleY: savedScaleY,
              textType: textType, // 保持原始类型
            };
            this.canvas.remove(editText);

            // 根据配置类型选择创建方法
            if (config.backgroundStyle || config.underlineStyle || config.borderStyle) {
              this.createDecoratedText(newConfig);
            } else if (config.type) {
              this.addHighlightText(newConfig);
            }
          });
        });
      }
    });
  }

  // 导出为 Blob
  async toBlob(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      this.canvas.getElement().toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Failed to create blob'))),
        'image/png',
        1.0
      );
    });
  }

  // 生成缩略图
  toThumbnail() {
    return this.canvas.toDataURL({
      format: 'jpeg', // 使用 JPEG 格式，比 PNG 小很多
      quality: 0.2,   // 降低质量到 0.2
      multiplier: 0.15, // 降低尺寸到 0.15
    });
  }

  // 清空画布
  clear() {
    this.canvas.clear();
    this.canvas.setBackgroundColor('#ffffff', () => this.canvas.renderAll());
  }

  // ✅ 已移除 migrateOldGroups 方法
  // 原因：rebindGroupEvents 已经处理了 Group 的双击编辑功能
  // 不再需要将 Group 转换为 IText

  // 调度历史记录保存（防抖）
  private scheduleHistorySave() {
    if (this.saveHistoryTimer) {
      clearTimeout(this.saveHistoryTimer);
    }
    this.saveHistoryTimer = setTimeout(() => {
      this.saveHistory();
    }, 300); // 300ms 防抖
  }

  // 保存历史记录
  private saveHistory() {
    if (this.isUndoRedoing) return;

    const json = JSON.stringify(this.canvas.toJSON(['data', 'selectable', 'evented']));

    // 检查是否与上一个状态相同，避免重复保存
    if (this.history.length > 0 && this.history[this.historyIndex] === json) {
      return;
    }

    // 如果当前不在历史记录的末尾，删除后面的记录
    if (this.historyIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.historyIndex + 1);
    }

    // 添加新记录
    this.history.push(json);
    this.historyIndex++;

    // 限制历史记录数量（最多 20 条，减少内存占用）
    if (this.history.length > 20) {
      this.history.shift();
      this.historyIndex--;
    }
  }

  // 撤销
  undo() {
    if (this.historyIndex > 0) {
      this.isUndoRedoing = true;
      this.historyIndex--;
      this.loadFromJSON(this.history[this.historyIndex]);
      this.isUndoRedoing = false;
    }
  }

  // 重做
  redo() {
    if (this.historyIndex < this.history.length - 1) {
      this.isUndoRedoing = true;
      this.historyIndex++;
      this.loadFromJSON(this.history[this.historyIndex]);
      this.isUndoRedoing = false;
    }
  }

  // 检查是否可以撤销
  canUndo(): boolean {
    return this.historyIndex > 0;
  }

  // 检查是否可以重做
  canRedo(): boolean {
    return this.historyIndex < this.history.length - 1;
  }

  // 销毁画布
  dispose() {
    this.canvas.dispose();
  }
}

