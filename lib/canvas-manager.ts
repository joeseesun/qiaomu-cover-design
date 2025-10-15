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
      textBaseline: 'middle', // 修复 'alphabetical' 错误
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
    });

    // 监听双击事件，进入文本编辑模式
    group.on('mousedblclick', () => {
      // 保存 Group 的所有变换属性
      const savedLeft = group.left || 0;
      const savedTop = group.top || 0;
      const savedAngle = group.angle || 0;
      const savedScaleX = group.scaleX || 1;
      const savedScaleY = group.scaleY || 1;

      // 解散 Group，获取文本对象
      const items = (group as any)._objects || [];
      const textObj = items.find((obj: any) => obj.type === 'i-text');

      if (textObj) {
        this.canvas.remove(group);

        // 直接使用 Group 的位置（Group 和文本都是 center origin）
        textObj.set({
          left: savedLeft,
          top: savedTop,
          angle: savedAngle,
          scaleX: 1,  // 重置缩放，保持原始字体大小
          scaleY: 1,
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
          const newConfig = {
            ...config,
            text: textObj.text || '',
            left: textObj.left,
            top: textObj.top,
            angle: textObj.angle,
            scaleX: savedScaleX,  // 恢复原始缩放
            scaleY: savedScaleY,
          };
          this.canvas.remove(textObj);
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
      const textObj = (obj as any)._objects?.find((o: any) => o.type === 'i-text');
      if (textObj) {
        targetObj = textObj;
      }
    }

    // 对于文本颜色，需要特殊处理以支持多行文本
    if (property === 'fill' && (targetObj.type === 'i-text' || targetObj.type === 'text')) {
      // 设置整体颜色
      targetObj.set('fill', value);

      // 如果是 i-text，清除所有选区样式，确保所有文本都使用统一颜色
      if (targetObj.type === 'i-text') {
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
  updateBackground(style: 'none' | 'solid', color?: string) {
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
        this.updateSingleObjectBackground(obj, style, color);
      });

      this.canvas.renderAll();
      return;
    }

    // 处理单个对象
    this.updateSingleObjectBackground(activeObj, style, color);
  }

  // 更新单个对象的背景
  private updateSingleObjectBackground(
    obj: any,
    style: 'none' | 'solid',
    color?: string
  ) {
    const currentConfig = this.extractTextConfig(obj);
    if (!currentConfig) return;

    // 更新背景配置
    currentConfig.backgroundStyle = style;
    currentConfig.backgroundColor = color || currentConfig.backgroundColor || '#FFE066';

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
      textObj = items.find((o: any) => o.type === 'i-text');
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
      };

      // 提取装饰配置
      items.forEach((item: any) => {
        if (item.type === 'rect' && item.opacity === 0.5) {
          config.backgroundStyle = 'solid';
          config.backgroundColor = item.fill;
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
        } else if (item.type === 'rect' && item.fill === 'transparent') {
          config.borderStyle = item.strokeDashArray ? 'dashed' : 'solid';
          config.borderWidth = item.strokeWidth;
          config.borderColor = item.stroke;
        }
      });
    } else if (obj.type === 'i-text' || obj.type === 'text') {
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
      };
    } else {
      return null;
    }

    return config;
  }

  // 创建带装饰的文本
  private createDecoratedText(config: any) {
    const text = new fabric.IText(config.text || '文字', {
      fontSize: config.fontSize || 60,
      fontFamily: config.fontFamily || 'Noto Sans SC',
      fill: config.fill || '#333333',
      lineHeight: config.lineHeight || 1.2,
      charSpacing: config.charSpacing || 0,
      editable: true,
      selectable: true,
      originX: 'center',
      originY: 'center',
      textBaseline: 'middle', // 修复 'alphabetical' 错误
    });

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
        opacity: 0.5,
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
      const lineY = textHeight / 2 + 8;
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
      objects.forEach(obj => {
        obj.set({
          left: 0,
          top: 0,
        });
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
        const savedLeft = group.left || 0;
        const savedTop = group.top || 0;
        const savedAngle = group.angle || 0;
        const savedScaleX = group.scaleX || 1;
        const savedScaleY = group.scaleY || 1;

        this.canvas.remove(group);
        text.set({
          left: savedLeft,
          top: savedTop,
          angle: savedAngle,
          scaleX: 1,  // 重置缩放，保持原始字体大小
          scaleY: 1,
          originX: 'center',
          originY: 'center',
        });
        this.canvas.add(text);
        this.canvas.setActiveObject(text);
        text.enterEditing();
        text.selectAll();

        text.on('editing:exited', () => {
          const newConfig = {
            ...config,
            text: text.text || '',
            left: text.left,
            top: text.top,
            angle: text.angle,
            scaleX: savedScaleX,  // 恢复原始缩放
            scaleY: savedScaleY,
          };
          this.canvas.remove(text);
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

