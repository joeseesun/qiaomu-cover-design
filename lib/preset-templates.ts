/**
 * 预设模板数据
 * 包含各种分类的小红书封面模板
 */

import { Template } from './template-manager';

// 预设模板列表
export const PRESET_TEMPLATES: Omit<Template, 'id' | 'createdAt'>[] = [
  // ========== 文字卡片类 ==========
  {
    name: '简约红色卡片',
    category: '文字卡片',
    canvasSize: { width: 1242, height: 1660 },
    isPreset: true,
    canvasJSON: JSON.stringify({
      version: '5.3.0',
      objects: [
        {
          type: 'rect',
          left: 0,
          top: 0,
          width: 1242,
          height: 1660,
          fill: '#FF6B6B',
          selectable: false,  // 🆕 背景不可选择，避免干扰画布背景切换
          evented: false,     // 🆕 不响应事件
          data: { isBackground: true },  // 🆕 标记为背景层
        },
        {
          type: 'text',
          left: 100,
          top: 200,
          width: 1042,
          fontSize: 80,
          fontFamily: 'Arial',
          fontWeight: 'bold',
          fill: '#FFFFFF',
          text: '点击修改标题',
          textAlign: 'left',
          selectable: true,
        },
        {
          type: 'text',
          left: 100,
          top: 350,
          width: 1042,
          fontSize: 48,
          fontFamily: 'Arial',
          fill: '#FFFFFF',
          text: '这里是副标题或描述文字',
          textAlign: 'left',
          selectable: true,
        },
      ],
    }),
  },

  {
    name: '渐变蓝色卡片',
    category: '文字卡片',
    canvasSize: { width: 1242, height: 1660 },
    isPreset: true,
    canvasJSON: JSON.stringify({
      version: '5.3.0',
      objects: [
        {
          type: 'rect',
          left: 0,
          top: 0,
          width: 1242,
          height: 1660,
          fill: {
            type: 'linear',
            coords: { x1: 0, y1: 0, x2: 0, y2: 1660 },
            colorStops: [
              { offset: 0, color: '#667eea' },
              { offset: 1, color: '#764ba2' },
            ],
          },
          selectable: false,  // 🆕 背景不可选择
          evented: false,     // 🆕 不响应事件
          data: { isBackground: true },  // 🆕 标记为背景层
        },
        {
          type: 'text',
          left: 621,
          top: 700,
          fontSize: 90,
          fontFamily: 'Arial',
          fontWeight: 'bold',
          fill: '#FFFFFF',
          text: '大标题',
          textAlign: 'center',
          originX: 'center',
          originY: 'center',
          selectable: true,
        },
        {
          type: 'text',
          left: 621,
          top: 850,
          fontSize: 50,
          fontFamily: 'Arial',
          fill: '#FFFFFF',
          text: '副标题文字',
          textAlign: 'center',
          originX: 'center',
          originY: 'center',
          selectable: true,
        },
      ],
    }),
  },

  {
    name: '极简白底卡片',
    category: '文字卡片',
    canvasSize: { width: 1242, height: 1660 },
    isPreset: true,
    canvasJSON: JSON.stringify({
      version: '5.3.0',
      objects: [
        {
          type: 'rect',
          left: 0,
          top: 0,
          width: 1242,
          height: 1660,
          fill: '#FFFFFF',
          selectable: false,  // 🆕 背景不可选择
          evented: false,     // 🆕 不响应事件
          data: { isBackground: true },  // 🆕 标记为背景层
        },
        {
          type: 'rect',
          left: 100,
          top: 150,
          width: 10,
          height: 120,
          fill: '#000000',
          selectable: true,
        },
        {
          type: 'text',
          left: 140,
          top: 180,
          fontSize: 80,
          fontFamily: 'Arial',
          fontWeight: 'bold',
          fill: '#000000',
          text: '标题文字',
          selectable: true,
        },
        {
          type: 'text',
          left: 100,
          top: 320,
          width: 1042,
          fontSize: 45,
          fontFamily: 'Arial',
          fill: '#666666',
          text: '这里可以写一些描述性的文字内容',
          selectable: true,
        },
      ],
    }),
  },

  // ========== 知识分享类 ==========
  {
    name: '知识要点列表',
    category: '知识分享',
    canvasSize: { width: 1242, height: 1660 },
    isPreset: true,
    canvasJSON: JSON.stringify({
      version: '5.3.0',
      objects: [
        {
          type: 'rect',
          left: 0,
          top: 0,
          width: 1242,
          height: 1660,
          fill: '#F7F9FC',
          selectable: false,  // 🆕 背景不可选择
          evented: false,     // 🆕 不响应事件
          data: { isBackground: true },  // 🆕 标记为背景层
        },
        {
          type: 'rect',
          left: 0,
          top: 0,
          width: 1242,
          height: 200,
          fill: '#4A90E2',
          selectable: true,
        },
        {
          type: 'text',
          left: 621,
          top: 100,
          fontSize: 70,
          fontFamily: 'Arial',
          fontWeight: 'bold',
          fill: '#FFFFFF',
          text: '知识分享',
          textAlign: 'center',
          originX: 'center',
          originY: 'center',
          selectable: true,
        },
        {
          type: 'circle',
          left: 100,
          top: 280,
          radius: 30,
          fill: '#4A90E2',
          selectable: true,
        },
        {
          type: 'text',
          left: 145,
          top: 280,
          fontSize: 24,
          fontFamily: 'Arial',
          fontWeight: 'bold',
          fill: '#FFFFFF',
          text: '1',
          originY: 'center',
          selectable: true,
        },
        {
          type: 'text',
          left: 200,
          top: 280,
          fontSize: 50,
          fontFamily: 'Arial',
          fill: '#333333',
          text: '第一个要点',
          originY: 'center',
          selectable: true,
        },
        {
          type: 'circle',
          left: 100,
          top: 450,
          radius: 30,
          fill: '#4A90E2',
          selectable: true,
        },
        {
          type: 'text',
          left: 145,
          top: 450,
          fontSize: 24,
          fontFamily: 'Arial',
          fontWeight: 'bold',
          fill: '#FFFFFF',
          text: '2',
          originY: 'center',
          selectable: true,
        },
        {
          type: 'text',
          left: 200,
          top: 450,
          fontSize: 50,
          fontFamily: 'Arial',
          fill: '#333333',
          text: '第二个要点',
          originY: 'center',
          selectable: true,
        },
        {
          type: 'circle',
          left: 100,
          top: 620,
          radius: 30,
          fill: '#4A90E2',
          selectable: true,
        },
        {
          type: 'text',
          left: 145,
          top: 620,
          fontSize: 24,
          fontFamily: 'Arial',
          fontWeight: 'bold',
          fill: '#FFFFFF',
          text: '3',
          originY: 'center',
          selectable: true,
        },
        {
          type: 'text',
          left: 200,
          top: 620,
          fontSize: 50,
          fontFamily: 'Arial',
          fill: '#333333',
          text: '第三个要点',
          originY: 'center',
          selectable: true,
        },
      ],
    }),
  },

  // ========== 情绪表达类 ==========
  {
    name: '大字报风格',
    category: '情绪表达',
    canvasSize: { width: 1242, height: 1660 },
    isPreset: true,
    canvasJSON: JSON.stringify({
      version: '5.3.0',
      objects: [
        {
          type: 'rect',
          left: 0,
          top: 0,
          width: 1242,
          height: 1660,
          fill: '#FFD93D',
          selectable: false,  // 🆕 背景不可选择
          evented: false,     // 🆕 不响应事件
          data: { isBackground: true },  // 🆕 标记为背景层
        },
        {
          type: 'text',
          left: 621,
          top: 830,
          fontSize: 120,
          fontFamily: 'Arial',
          fontWeight: 'bold',
          fill: '#000000',
          text: '金句',
          textAlign: 'center',
          originX: 'center',
          originY: 'center',
          selectable: true,
        },
      ],
    }),
  },

  {
    name: '温柔粉色',
    category: '情绪表达',
    canvasSize: { width: 1242, height: 1660 },
    isPreset: true,
    canvasJSON: JSON.stringify({
      version: '5.3.0',
      objects: [
        {
          type: 'rect',
          left: 0,
          top: 0,
          width: 1242,
          height: 1660,
          fill: '#FFB6C1',
          selectable: false,  // 🆕 背景不可选择
          evented: false,     // 🆕 不响应事件
          data: { isBackground: true },  // 🆕 标记为背景层
        },
        {
          type: 'text',
          left: 621,
          top: 700,
          fontSize: 80,
          fontFamily: 'Arial',
          fontWeight: 'normal',
          fill: '#FFFFFF',
          text: '温柔的文字',
          textAlign: 'center',
          originX: 'center',
          originY: 'center',
          selectable: true,
        },
        {
          type: 'text',
          left: 621,
          top: 850,
          fontSize: 45,
          fontFamily: 'Arial',
          fill: '#FFFFFF',
          text: '副标题',
          textAlign: 'center',
          originX: 'center',
          originY: 'center',
          selectable: true,
        },
      ],
    }),
  },

  // ========== 小红书风格模板 ==========

  // 便签纸风格（黄色）
  {
    name: '便签纸·黄色',
    category: '文字卡片',
    canvasSize: { width: 1242, height: 1660 },
    isPreset: true,
    canvasJSON: JSON.stringify({
      version: '5.3.0',
      objects: [
        // 日期标签
        {
          type: 'i-text',
          left: 80,
          top: 50,
          fontSize: 32,
          fontFamily: 'Arial',
          fill: '#666666',
          text: 'Date: __.__',
        },
        // 主标题
        {
          type: 'i-text',
          left: 120,
          top: 280,
          fontSize: 72,
          fontFamily: 'KaiTi, STKaiti, serif',
          fontWeight: 'bold',
          fill: '#000000',
          text: '点击修改标题文字',
          lineHeight: 1.4,
        },
        // 荧光笔背景
        {
          type: 'rect',
          left: 100,
          top: 270,
          width: 1000,
          height: 220,
          fill: '#FFE066',
          opacity: 0.4,
          selectable: false,
          evented: false,
        },
        // 表情符号
        {
          type: 'i-text',
          left: 1050,
          top: 1500,
          fontSize: 80,
          text: '🤔',
        },
      ],
    }),
  },

  // 引用卡片风格（蓝色）
  {
    name: '引用卡片·蓝色',
    category: '文字卡片',
    canvasSize: { width: 1242, height: 1660 },
    isPreset: true,
    canvasJSON: JSON.stringify({
      version: '5.3.0',
      objects: [
        // 圆角卡片
        {
          type: 'rect',
          left: 80,
          top: 80,
          width: 1082,
          height: 1500,
          fill: 'rgba(255, 255, 255, 0.7)',
          rx: 40,
          ry: 40,
          selectable: false,
          evented: false,
        },
        // 引号装饰
        {
          type: 'i-text',
          left: 150,
          top: 150,
          fontSize: 120,
          fontFamily: 'Georgia, serif',
          fill: '#90CAF9',
          fontWeight: 'bold',
          text: '"',
          selectable: false,
          evented: false,
        },
        // 主文字
        {
          type: 'i-text',
          left: 150,
          top: 350,
          fontSize: 68,
          fontFamily: 'SimHei, STHeiti, sans-serif',
          fill: '#333333',
          text: '点击修改文字内容\n可以多行显示',
          lineHeight: 1.5,
        },
        // 装饰短线
        {
          type: 'line',
          left: 950,
          top: 1450,
          x1: 0,
          y1: 0,
          x2: 100,
          y2: 0,
          stroke: '#90CAF9',
          strokeWidth: 8,
          selectable: false,
          evented: false,
        },
      ],
    }),
  },

  // 极简文字风格（白色）
  {
    name: '极简文字·白色',
    category: '文字卡片',
    canvasSize: { width: 1242, height: 1660 },
    isPreset: true,
    canvasJSON: JSON.stringify({
      version: '5.3.0',
      objects: [
        // 超大标题
        {
          type: 'i-text',
          left: 120,
          top: 400,
          fontSize: 96,
          fontFamily: 'KaiTi, STKaiti, serif',
          fontWeight: 'bold',
          fill: '#2C3E50',
          text: '点击修改\n标题文字',
          lineHeight: 1.3,
        },
        // 关键词方框
        {
          type: 'rect',
          left: 110,
          top: 550,
          width: 280,
          height: 120,
          fill: 'transparent',
          stroke: '#4CAF50',
          strokeWidth: 6,
          rx: 8,
          ry: 8,
        },
      ],
    }),
  },

  // 便签纸风格（粉色）
  {
    name: '便签纸·粉色',
    category: '文字卡片',
    canvasSize: { width: 1242, height: 1660 },
    isPreset: true,
    canvasJSON: JSON.stringify({
      version: '5.3.0',
      objects: [
        // 顶部标签
        {
          type: 'i-text',
          left: 400,
          top: 30,
          fontSize: 24,
          fontFamily: 'Arial',
          fill: '#999999',
          text: 'Info Doc.    Encyclopedia    •    •',
          selectable: false,
          evented: false,
        },
        // 主标题
        {
          type: 'i-text',
          left: 120,
          top: 300,
          fontSize: 76,
          fontFamily: 'SimHei, STHeiti, sans-serif',
          fontWeight: 'bold',
          fill: '#000000',
          text: '点击修改标题，\n可以换行显示！',
          lineHeight: 1.4,
        },
        // 粉色荧光笔
        {
          type: 'rect',
          left: 100,
          top: 420,
          width: 600,
          height: 100,
          fill: '#FFB6D9',
          opacity: 0.5,
          selectable: false,
          evented: false,
        },
        // 底部小字
        {
          type: 'i-text',
          left: 900,
          top: 1600,
          fontSize: 20,
          fontFamily: 'Arial',
          fill: '#CCCCCC',
          text: 'Source / Xiaohongshu',
          selectable: false,
          evented: false,
        },
      ],
    }),
  },

  // 引用卡片风格（绿色）
  {
    name: '引用卡片·绿色',
    category: '文字卡片',
    canvasSize: { width: 1242, height: 1660 },
    isPreset: true,
    canvasJSON: JSON.stringify({
      version: '5.3.0',
      objects: [
        // 圆角卡片
        {
          type: 'rect',
          left: 80,
          top: 80,
          width: 1082,
          height: 1500,
          fill: 'rgba(255, 255, 255, 0.8)',
          rx: 40,
          ry: 40,
          selectable: false,
          evented: false,
        },
        // 引号装饰
        {
          type: 'i-text',
          left: 150,
          top: 120,
          fontSize: 100,
          fontFamily: 'Georgia, serif',
          fill: '#C8E6C9',
          fontWeight: 'bold',
          text: '"',
          selectable: false,
          evented: false,
        },
        // 主文字
        {
          type: 'i-text',
          left: 150,
          top: 350,
          fontSize: 64,
          fontFamily: 'SimHei, STHeiti, sans-serif',
          fill: '#2E7D32',
          text: '点击修改文字内容\n（可以多行）',
          lineHeight: 1.5,
        },
        // 装饰短线
        {
          type: 'line',
          left: 950,
          top: 1450,
          x1: 0,
          y1: 0,
          x2: 100,
          y2: 0,
          stroke: '#81C784',
          strokeWidth: 8,
          selectable: false,
          evented: false,
        },
      ],
    }),
  },
];

