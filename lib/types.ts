// 类型定义文件
export interface CanvasVersion {
  id: string;
  name: string;
  data: string;              // Fabric.js JSON
  thumbnail?: string;        // Base64
  createdAt: number;
  updatedAt: number;
}

export interface HighlightConfig {
  text: string;
  type: 'marker' | 'underline' | 'box';
  color: string;
  fontSize?: number;
  fontFamily?: string;
}

export interface FontConfig {
  name: string;
  family: string;
  weight: number[];
  preview: string;  // 预览文字
  loaded?: boolean; // 是否已加载
}

export const HIGHLIGHT_COLORS = [
  '#FFEB3B', // 黄色
  '#4CAF50', // 绿色
  '#2196F3', // 蓝色
  '#E91E63', // 粉色
  '#FF5722', // 橙色
];

// 12 个精选中文字体
export const FONTS: FontConfig[] = [
  { name: '思源黑体', family: 'Noto Sans SC', weight: [400, 700], preview: '设计' },
  { name: '思源宋体', family: 'Noto Serif SC', weight: [400, 700], preview: '设计' },
  { name: '站酷快乐体', family: 'ZCOOL KuaiLe', weight: [400], preview: '设计' },
  { name: '站酷文艺体', family: 'ZCOOL QingKe HuangYou', weight: [400], preview: '设计' },
  { name: '阿里普惠体', family: 'Alibaba PuHuiTi', weight: [400, 700], preview: '设计' },
  { name: '优设标题黑', family: 'YouSheBiaoTiHei', weight: [400], preview: '设计' },
  { name: '庞门正道标题', family: 'Pangmen Zhengdao', weight: [400], preview: '设计' },
  { name: '江西拙楷', family: 'JiangXiZhuoKai', weight: [400], preview: '设计' },
  { name: '霞鹜文楷', family: 'LXGW WenKai', weight: [400, 700], preview: '设计' },
  { name: '得意黑', family: 'Smiley Sans', weight: [400], preview: '设计' },
  { name: '小赖字体', family: 'XiaoLai', weight: [400], preview: '设计' },
  { name: 'Arial', family: 'Arial, sans-serif', weight: [400, 700], preview: 'Aa' },
];

// 画布尺寸配置
export interface CanvasSize {
  name: string;
  width: number;
  height: number;
  ratio: string;
}

export const CANVAS_RATIOS = {
  '3:4': [
    { name: '720×960', width: 720, height: 960, ratio: '3:4' },
    { name: '768×1024', width: 768, height: 1024, ratio: '3:4' },
    { name: '960×1280', width: 960, height: 1280, ratio: '3:4' },
    { name: '1080×1440', width: 1080, height: 1440, ratio: '3:4' },
  ],
  '1:1': [
    { name: '720×720', width: 720, height: 720, ratio: '1:1' },
    { name: '960×960', width: 960, height: 960, ratio: '1:1' },
    { name: '1080×1080', width: 1080, height: 1080, ratio: '1:1' },
  ],
  '4:3': [
    { name: '960×720', width: 960, height: 720, ratio: '4:3' },
    { name: '1024×768', width: 1024, height: 768, ratio: '4:3' },
    { name: '1280×960', width: 1280, height: 960, ratio: '4:3' },
    { name: '1440×1080', width: 1440, height: 1080, ratio: '4:3' },
  ],
};

// 默认画布尺寸（960×1280, 3:4）
export const DEFAULT_CANVAS_SIZE = CANVAS_RATIOS['3:4'][2];
export const CANVAS_WIDTH = DEFAULT_CANVAS_SIZE.width;
export const CANVAS_HEIGHT = DEFAULT_CANVAS_SIZE.height;

// 颜色系统
export const COLORS = {
  primary: '#FF2442',
  background: '#F7F8FA',
  surface: '#FFFFFF',
  border: '#E5E7EB',
  text: {
    primary: '#1F2937',
    secondary: '#6B7280',
    disabled: '#9CA3AF',
  },
  icon: {
    default: '#6B7280',
    hover: '#1F2937',
    active: '#FF2442',
  }
};

