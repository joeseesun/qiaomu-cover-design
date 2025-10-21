/**
 * 预设模板数据
 * 精选小红书风格封面模板（黑灰主题，按比例分组）
 */

import { Template } from './template-manager';

// 🆕 生成缩略图 URL（从 public/templates/ 目录）
function getThumbnailUrl(templateName: string): string {
  const fileName = templateName
    .replace(/·/g, '-')
    .replace(/\s+/g, '-')
    .toLowerCase() + '.png';
  return `/templates/${fileName}`;
}

// 预设模板列表
export const PRESET_TEMPLATES: Omit<Template, 'id' | 'createdAt'>[] = [
  // ========== 3:4 竖版（960×1280）==========
  // 极简黑白
  {
    name: '极简黑白·竖版',
    category: '文字卡片',
    canvasSize: { width: 960, height: 1280 },
    isPreset: true,
    thumbnail: getThumbnailUrl('极简黑白·竖版'),
    canvasJSON: JSON.stringify({
      version: '5.3.0',
      objects: [
        // 日期标签
        {
          type: 'i-text',
          left: 100,
          top: 80,
          fontSize: 40,
          fontFamily: 'Arial',
          fill: '#999999',
          text: 'Date: 12.25',
        },
        // 主标题
        {
          type: 'i-text',
          left: 100,
          top: 500,
          fontSize: 120,
          fontFamily: 'KaiTi, STKaiti, serif',
          fontWeight: 'bold',
          fill: '#000000',
          text: '点击修改\n标题文字',
          lineHeight: 1.3,
          textAlign: 'left',
        },
        // 荧光笔背景
        {
          type: 'rect',
          left: 80,
          top: 490,
          width: 1080,
          height: 360,
          fill: '#FFE066',
          opacity: 0.4,
          selectable: false,
          evented: false,
        },
        // 表情符号
        {
          type: 'i-text',
          left: 1000,
          top: 1450,
          fontSize: 120,
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
    thumbnail: getThumbnailUrl('引用卡片·蓝色'),
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
          left: 130,
          top: 200,
          fontSize: 200,
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
          top: 550,
          fontSize: 100,
          fontFamily: 'SimHei, STHeiti, sans-serif',
          fill: '#1A1A1A',
          fontWeight: 'bold',
          text: '点击修改\n文字内容',
          lineHeight: 1.3,
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
    thumbnail: getThumbnailUrl('极简文字·白色'),
    canvasJSON: JSON.stringify({
      version: '5.3.0',
      objects: [
        // 超大标题
        {
          type: 'i-text',
          left: 100,
          top: 500,
          fontSize: 140,
          fontFamily: 'KaiTi, STKaiti, serif',
          fontWeight: 'bold',
          fill: '#1A1A1A',
          text: '点击修改\n标题文字',
          lineHeight: 1.2,
        },
        // 关键词方框
        {
          type: 'rect',
          left: 85,
          top: 650,
          width: 400,
          height: 180,
          fill: 'transparent',
          stroke: '#4CAF50',
          strokeWidth: 8,
          rx: 12,
          ry: 12,
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
    thumbnail: getThumbnailUrl('便签纸·粉色'),
    canvasJSON: JSON.stringify({
      version: '5.3.0',
      objects: [
        // 顶部标签
        {
          type: 'i-text',
          left: 350,
          top: 60,
          fontSize: 32,
          fontFamily: 'Arial',
          fill: '#AAAAAA',
          text: 'Info Doc.    Encyclopedia    •    •',
          selectable: false,
          evented: false,
        },
        // 主标题
        {
          type: 'i-text',
          left: 100,
          top: 500,
          fontSize: 110,
          fontFamily: 'SimHei, STHeiti, sans-serif',
          fontWeight: 'bold',
          fill: '#000000',
          text: '点击修改\n标题文字',
          lineHeight: 1.3,
        },
        // 粉色荧光笔
        {
          type: 'rect',
          left: 80,
          top: 490,
          width: 900,
          height: 280,
          fill: '#FFB6D9',
          opacity: 0.4,
          selectable: false,
          evented: false,
        },
        // 底部小字
        {
          type: 'i-text',
          left: 850,
          top: 1580,
          fontSize: 28,
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
    thumbnail: getThumbnailUrl('引用卡片·绿色'),
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
          left: 130,
          top: 200,
          fontSize: 200,
          fontFamily: 'Georgia, serif',
          fill: '#A5D6A7',
          fontWeight: 'bold',
          text: '"',
          selectable: false,
          evented: false,
        },
        // 主文字
        {
          type: 'i-text',
          left: 150,
          top: 550,
          fontSize: 100,
          fontFamily: 'SimHei, STHeiti, sans-serif',
          fill: '#2E7D32',
          fontWeight: 'bold',
          text: '点击修改\n文字内容',
          lineHeight: 1.3,
        },
        // 装饰短线
        {
          type: 'line',
          left: 950,
          top: 1400,
          x1: 0,
          y1: 0,
          x2: 150,
          y2: 0,
          stroke: '#81C784',
          strokeWidth: 10,
          selectable: false,
          evented: false,
        },
      ],
    }),
  },

  // ========== 4:3 横版（1660×1242）==========
  // 便签纸风格（黄色·横版）
  {
    name: '便签纸·黄色·横版',
    category: '文字卡片',
    canvasSize: { width: 1660, height: 1242 },
    isPreset: true,
    thumbnail: getThumbnailUrl('便签纸·黄色·横版'),
    canvasJSON: JSON.stringify({
      version: '5.3.0',
      objects: [
        // 日期标签
        {
          type: 'i-text',
          left: 80,
          top: 60,
          fontSize: 36,
          fontFamily: 'Arial',
          fill: '#999999',
          text: 'Date: 12.25',
        },
        // 主标题
        {
          type: 'i-text',
          left: 80,
          top: 350,
          fontSize: 100,
          fontFamily: 'KaiTi, STKaiti, serif',
          fontWeight: 'bold',
          fill: '#000000',
          text: '点击修改标题文字',
          lineHeight: 1.3,
          textAlign: 'left',
        },
        // 荧光笔背景
        {
          type: 'rect',
          left: 60,
          top: 340,
          width: 1200,
          height: 280,
          fill: '#FFE066',
          opacity: 0.4,
          selectable: false,
          evented: false,
        },
        // 表情符号
        {
          type: 'i-text',
          left: 1450,
          top: 1050,
          fontSize: 100,
          text: '🤔',
        },
      ],
    }),
  },

  // 引用卡片风格（蓝色·横版）
  {
    name: '引用卡片·蓝色·横版',
    category: '文字卡片',
    canvasSize: { width: 1660, height: 1242 },
    isPreset: true,
    thumbnail: getThumbnailUrl('引用卡片·蓝色·横版'),
    canvasJSON: JSON.stringify({
      version: '5.3.0',
      objects: [
        // 圆角卡片
        {
          type: 'rect',
          left: 60,
          top: 60,
          width: 1540,
          height: 1122,
          fill: 'rgba(255, 255, 255, 0.7)',
          rx: 40,
          ry: 40,
          selectable: false,
          evented: false,
        },
        // 引号装饰
        {
          type: 'i-text',
          left: 100,
          top: 120,
          fontSize: 180,
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
          left: 120,
          top: 400,
          fontSize: 90,
          fontFamily: 'SimHei, STHeiti, sans-serif',
          fill: '#1A1A1A',
          fontWeight: 'bold',
          text: '点击修改文字内容',
          lineHeight: 1.3,
        },
        // 装饰短线
        {
          type: 'line',
          left: 1400,
          top: 1050,
          x1: 0,
          y1: 0,
          x2: 150,
          y2: 0,
          stroke: '#90CAF9',
          strokeWidth: 8,
          selectable: false,
          evented: false,
        },
      ],
    }),
  },

  // ========== 1:1 方形（1242×1242）==========
  // 极简文字风格（白色·方形）
  {
    name: '极简文字·白色·方形',
    category: '文字卡片',
    canvasSize: { width: 1242, height: 1242 },
    isPreset: true,
    thumbnail: getThumbnailUrl('极简文字·白色·方形'),
    canvasJSON: JSON.stringify({
      version: '5.3.0',
      objects: [
        // 超大标题
        {
          type: 'i-text',
          left: 100,
          top: 350,
          fontSize: 130,
          fontFamily: 'KaiTi, STKaiti, serif',
          fontWeight: 'bold',
          fill: '#1A1A1A',
          text: '点击修改\n标题文字',
          lineHeight: 1.2,
        },
        // 关键词方框
        {
          type: 'rect',
          left: 85,
          top: 480,
          width: 380,
          height: 170,
          fill: 'transparent',
          stroke: '#4CAF50',
          strokeWidth: 8,
          rx: 12,
          ry: 12,
        },
      ],
    }),
  },

  // 便签纸风格（粉色·方形）
  {
    name: '便签纸·粉色·方形',
    category: '文字卡片',
    canvasSize: { width: 1242, height: 1242 },
    isPreset: true,
    thumbnail: getThumbnailUrl('便签纸·粉色·方形'),
    canvasJSON: JSON.stringify({
      version: '5.3.0',
      objects: [
        // 顶部标签
        {
          type: 'i-text',
          left: 300,
          top: 50,
          fontSize: 30,
          fontFamily: 'Arial',
          fill: '#AAAAAA',
          text: 'Info Doc.    Encyclopedia',
          selectable: false,
          evented: false,
        },
        // 主标题
        {
          type: 'i-text',
          left: 100,
          top: 380,
          fontSize: 100,
          fontFamily: 'SimHei, STHeiti, sans-serif',
          fontWeight: 'bold',
          fill: '#000000',
          text: '点击修改\n标题文字',
          lineHeight: 1.3,
        },
        // 粉色荧光笔
        {
          type: 'rect',
          left: 80,
          top: 370,
          width: 850,
          height: 260,
          fill: '#FFB6D9',
          opacity: 0.4,
          selectable: false,
          evented: false,
        },
        // 底部小字
        {
          type: 'i-text',
          left: 800,
          top: 1180,
          fontSize: 26,
          fontFamily: 'Arial',
          fill: '#CCCCCC',
          text: 'Source / XHS',
          selectable: false,
          evented: false,
        },
      ],
    }),
  },

  // ========== 16:9 横版（1280×720）==========
  // 极简文字风格（白色·16:9）
  {
    name: '极简文字·白色·16:9',
    category: '文字卡片',
    canvasSize: { width: 1280, height: 720 },
    isPreset: true,
    thumbnail: getThumbnailUrl('极简文字·白色·16:9'),
    canvasJSON: JSON.stringify({
      version: '5.3.0',
      objects: [
        // 超大标题
        {
          type: 'i-text',
          left: 80,
          top: 200,
          fontSize: 100,
          fontFamily: 'KaiTi, STKaiti, serif',
          fontWeight: 'bold',
          fill: '#1A1A1A',
          text: '点击修改标题文字',
          lineHeight: 1.2,
        },
        // 关键词方框
        {
          type: 'rect',
          left: 65,
          top: 320,
          width: 600,
          height: 130,
          fill: 'transparent',
          stroke: '#4CAF50',
          strokeWidth: 8,
          rx: 12,
          ry: 12,
        },
      ],
    }),
  },

  // ========== 9:16 竖版（720×1280）==========
  // 便签纸风格（黄色·9:16）
  {
    name: '便签纸·黄色·9:16',
    category: '文字卡片',
    canvasSize: { width: 720, height: 1280 },
    isPreset: true,
    thumbnail: getThumbnailUrl('便签纸·黄色·9:16'),
    canvasJSON: JSON.stringify({
      version: '5.3.0',
      objects: [
        // 日期标签
        {
          type: 'i-text',
          left: 60,
          top: 50,
          fontSize: 28,
          fontFamily: 'Arial',
          fill: '#999999',
          text: 'Date: 12.25',
        },
        // 主标题
        {
          type: 'i-text',
          left: 60,
          top: 350,
          fontSize: 80,
          fontFamily: 'KaiTi, STKaiti, serif',
          fontWeight: 'bold',
          fill: '#000000',
          text: '点击修改\n标题文字',
          lineHeight: 1.3,
          textAlign: 'left',
        },
        // 荧光笔背景
        {
          type: 'rect',
          left: 45,
          top: 340,
          width: 630,
          height: 240,
          fill: '#FFE066',
          opacity: 0.4,
          selectable: false,
          evented: false,
        },
        // 表情符号
        {
          type: 'i-text',
          left: 580,
          top: 1100,
          fontSize: 80,
          text: '🤔',
        },
      ],
    }),
  },
];

