// 画布管理器
import { fabric } from 'fabric';
import { HighlightConfig, CANVAS_WIDTH, CANVAS_HEIGHT } from './types';

export class CanvasManager {
  canvas: fabric.Canvas;
  width: number;
  height: number;

  constructor(element: HTMLCanvasElement, width = CANVAS_WIDTH, height = CANVAS_HEIGHT) {
    this.width = width;
    this.height = height;
    this.canvas = new fabric.Canvas(element, {
      width: this.width,
      height: this.height,
      backgroundColor: '#ffffff',
      // 隐藏画布边框
      selection: true, // 允许框选
      selectionBorderColor: 'transparent', // 隐藏选择框边框
      selectionLineWidth: 0, // 选择框边框宽度为 0
    });
  }

  // 添加普通文本
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
    });
    this.canvas.add(obj);
    this.canvas.setActiveObject(obj);
    this.canvas.renderAll();
    return obj;
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
    };

    const left = group.left;
    const top = group.top;

    this.canvas.remove(group);
    this.addHighlightText(config, left, top);
  }

  // 添加高亮文本（使用 Group 但支持双击编辑）
  addHighlightText(config: HighlightConfig, left?: number, top?: number) {
    // 获取当前选中对象的位置（如果有）
    const activeObj = this.canvas.getActiveObject();
    const finalLeft = left ?? activeObj?.left ?? this.width / 2;
    const finalTop = top ?? activeObj?.top ?? this.height / 2;

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

    const group = new fabric.Group([background!, text], {
      left: finalLeft,
      top: finalTop,
      originX: 'center',
      originY: 'center',
      subTargetCheck: true, // 允许选中子对象
    });

    // 监听双击事件，进入文本编辑模式
    group.on('mousedblclick', () => {
      // 解散 Group
      const items = (group as any)._objects || [];
      const textObj = items.find((obj: any) => obj.type === 'i-text');

      if (textObj) {
        this.canvas.remove(group);
        textObj.set({
          left: group.left,
          top: group.top,
          originX: 'center',
          originY: 'center',
        });
        this.canvas.add(textObj);
        this.canvas.setActiveObject(textObj);
        textObj.enterEditing();
        textObj.selectAll();
        this.canvas.renderAll();

        // 监听文本编辑完成，重新创建 Group
        textObj.on('editing:exited', () => {
          const left = textObj.left;
          const top = textObj.top;
          this.canvas.remove(textObj);
          this.addHighlightText(
            {
              ...config,
              text: textObj.text || '',
            },
            left,
            top
          );
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
    const obj = this.canvas.getActiveObject();
    if (obj) {
      // 如果是 Group，需要更新内部的文本对象
      if (obj.type === 'group') {
        const textObj = (obj as any)._objects?.find((o: any) => o.type === 'i-text');
        if (textObj) {
          textObj.set(property, value);
        }
      } else {
        obj.set(property, value);
      }
      obj.setCoords(); // 更新坐标
      this.canvas.renderAll();
      this.canvas.fire('object:modified', { target: obj }); // 触发修改事件
    }
  }

  // 删除选中对象
  deleteActive() {
    const obj = this.canvas.getActiveObject();
    if (obj) {
      this.canvas.remove(obj);
      this.canvas.renderAll();
    }
  }

  // 导出为 JSON
  toJSON() {
    return JSON.stringify(this.canvas.toJSON());
  }

  // 从 JSON 加载
  loadFromJSON(json: string) {
    this.canvas.loadFromJSON(json, () => this.canvas.renderAll());
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
      format: 'png',
      quality: 0.3,
      multiplier: 0.2,
    });
  }

  // 清空画布
  clear() {
    this.canvas.clear();
    this.canvas.setBackgroundColor('#ffffff', () => this.canvas.renderAll());
  }

  // 迁移旧的 Group 对象为新的 IText（修复双击编辑问题）
  migrateOldGroups() {
    const objects = this.canvas.getObjects();
    const groupsToMigrate: any[] = [];

    // 找到所有 Group 对象
    objects.forEach((obj: any) => {
      if (obj.type === 'group' && obj._objects) {
        const textObj = obj._objects.find((o: any) => o.type === 'i-text');
        if (textObj) {
          groupsToMigrate.push({ group: obj, text: textObj });
        }
      }
    });

    // 转换每个 Group
    groupsToMigrate.forEach(({ group, text }) => {
      // 创建新的 IText
      const newText = new fabric.IText(text.text, {
        fontSize: text.fontSize,
        fontFamily: text.fontFamily,
        fill: text.fill,
        left: group.left,
        top: group.top,
        originX: 'center',
        originY: 'center',
        editable: true,
        selectable: true,
        textAlign: 'center',
      });

      // 检测高亮类型并应用样式
      const bgObj = group._objects.find((o: any) => o.type === 'rect' && o.fill !== 'transparent');
      const strokeObj = group._objects.find((o: any) => o.type === 'rect' && o.fill === 'transparent');
      const lineObj = group._objects.find((o: any) => o.type === 'line');

      if (bgObj) {
        // 荧光笔效果
        newText.set({
          backgroundColor: bgObj.fill,
          padding: 10,
        });
      } else if (strokeObj) {
        // 边框效果
        newText.set({
          stroke: strokeObj.stroke,
          strokeWidth: 3,
          padding: 12,
        });
      } else if (lineObj) {
        // 下划线效果
        newText.set({
          underline: true,
          fill: lineObj.stroke,
        });
      }

      // 删除旧 Group，添加新 IText
      this.canvas.remove(group);
      this.canvas.add(newText);
    });

    this.canvas.renderAll();
    console.log(`已迁移 ${groupsToMigrate.length} 个旧的 Group 对象`);
  }

  // 销毁画布
  dispose() {
    this.canvas.dispose();
  }
}

