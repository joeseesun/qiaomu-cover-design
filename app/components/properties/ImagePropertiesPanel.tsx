'use client';

import { useState, useEffect } from 'react';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FlipHorizontal, FlipVertical } from 'lucide-react';
import { hasRemoveBgApiKeyConfigured } from '@/app/components/home/SettingsDialog';

interface ImagePropertiesPanelProps {
  selectedObject: any;
  onOpacityChange: (value: number) => void;
  onBorderRadiusChange: (value: number) => void;
  onFlipHorizontal: () => void;
  onFlipVertical: () => void;
  onShadowChange: (shadow: { enabled: boolean; color: string; blur: number; offsetX: number; offsetY: number }) => void;
  onStrokeChange: (stroke: { enabled: boolean; color: string; width: number; style?: 'solid' | 'dashed' }) => void;
  onFilterChange: (filterType: string, value?: number) => void;
  onBrightnessChange: (value: number) => void;
  onContrastChange: (value: number) => void;
  onSaturationChange: (value: number) => void;
  onRemoveBackground?: (imageUrl: string) => Promise<void>;
  onRemoveBackgroundLocal?: (imageUrl: string) => Promise<void>;
  onOpenSettings?: () => void;
  onAIImageTransform?: (imageUrl: string, prompt: string) => Promise<void>;
}

export default function ImagePropertiesPanel({
  selectedObject,
  onOpacityChange,
  onBorderRadiusChange,
  onFlipHorizontal,
  onFlipVertical,
  onShadowChange,
  onStrokeChange,
  onFilterChange,
  onBrightnessChange,
  onContrastChange,
  onSaturationChange,
  onRemoveBackground,
  onRemoveBackgroundLocal,
  onOpenSettings,
  onAIImageTransform,
}: ImagePropertiesPanelProps) {
  const [activeTab, setActiveTab] = useState('basic');
  const [isRemovingBg, setIsRemovingBg] = useState(false);
  const [isRemovingBgLocal, setIsRemovingBgLocal] = useState(false);
  const [localProgress, setLocalProgress] = useState(0);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isTransforming, setIsTransforming] = useState(false);

  // 基础属性状态
  const [opacity, setOpacity] = useState(100);
  const [borderRadiusPercent, setBorderRadiusPercent] = useState(0); // 改为百分比

  // 同步 selectedObject 的属性到 state
  useEffect(() => {
    if (selectedObject) {
      setOpacity(Math.round((selectedObject.opacity || 1) * 100));

      // 从像素值转换为百分比（基于短边）
      const clipPath = (selectedObject.clipPath as any);
      if (clipPath?.rx && selectedObject.width && selectedObject.height) {
        const minSide = Math.min(selectedObject.width, selectedObject.height);
        const percent = Math.round((clipPath.rx / (minSide / 2)) * 100);
        setBorderRadiusPercent(Math.min(percent, 50));
      } else {
        setBorderRadiusPercent(0);
      }
    }
  }, [selectedObject]);

  // 效果状态 - 阴影
  const [shadowStyle, setShadowStyle] = useState<'none' | 'soft' | 'normal' | 'strong'>('none');
  const [shadowColor, setShadowColor] = useState('#000000');
  const [shadowBlur, setShadowBlur] = useState(10);
  const [shadowOffsetX, setShadowOffsetX] = useState(5);
  const [shadowOffsetY, setShadowOffsetY] = useState(5);

  // 效果状态 - 边框
  const [strokeStyle, setStrokeStyle] = useState<'none' | 'solid' | 'dashed'>('none');
  const [strokeColor, setStrokeColor] = useState('#000000');
  const [strokeWidth, setStrokeWidth] = useState(2);
  
  // 滤镜状态
  const [brightness, setBrightness] = useState(0);
  const [contrast, setContrast] = useState(0);
  const [saturation, setSaturation] = useState(0);

  // 获取图片的实际宽度（原始宽度 × 缩放比例）
  const getImageActualWidth = () => {
    if (!selectedObject) return 0;
    const scaleX = selectedObject.scaleX || 1;
    const width = selectedObject.width || 0;
    return width * scaleX;
  };

  // 处理圆角预设
  const handleBorderRadiusPreset = (percent: number) => {
    setBorderRadiusPercent(percent);
    // 将百分比转换为像素值（基于短边，确保圆形效果）
    if (selectedObject?.width && selectedObject?.height) {
      const minSide = Math.min(selectedObject.width, selectedObject.height);
      const radius = (minSide / 2) * (percent / 100);
      onBorderRadiusChange(radius);
    }
  };

  // 处理圆角滑块变化
  const handleBorderRadiusSliderChange = (percent: number) => {
    setBorderRadiusPercent(percent);
    // 将百分比转换为像素值（基于短边，确保圆形效果）
    if (selectedObject?.width && selectedObject?.height) {
      const minSide = Math.min(selectedObject.width, selectedObject.height);
      const radius = (minSide / 2) * (percent / 100);
      onBorderRadiusChange(radius);
    }
  };

  // 处理阴影样式变化
  const handleShadowStyleChange = (style: 'none' | 'soft' | 'normal' | 'strong') => {
    setShadowStyle(style);

    if (style === 'none') {
      onShadowChange({ enabled: false, color: shadowColor, blur: 0, offsetX: 0, offsetY: 0 });
    } else {
      // 预设值
      const presets = {
        soft: { blur: 5, offsetX: 3, offsetY: 3 },
        normal: { blur: 10, offsetX: 5, offsetY: 5 },
        strong: { blur: 20, offsetX: 10, offsetY: 10 },
      };
      const preset = presets[style];
      setShadowBlur(preset.blur);
      setShadowOffsetX(preset.offsetX);
      setShadowOffsetY(preset.offsetY);
      onShadowChange({
        enabled: true,
        color: shadowColor,
        blur: preset.blur,
        offsetX: preset.offsetX,
        offsetY: preset.offsetY,
      });
    }
  };

  // 处理阴影参数变化
  const handleShadowParamChange = (param: string, value: any) => {
    if (param === 'color') setShadowColor(value);
    if (param === 'blur') setShadowBlur(value);
    if (param === 'offsetX') setShadowOffsetX(value);
    if (param === 'offsetY') setShadowOffsetY(value);

    onShadowChange({
      enabled: true,
      color: param === 'color' ? value : shadowColor,
      blur: param === 'blur' ? value : shadowBlur,
      offsetX: param === 'offsetX' ? value : shadowOffsetX,
      offsetY: param === 'offsetY' ? value : shadowOffsetY,
    });
  };

  // 处理边框样式变化
  const handleStrokeStyleChange = (style: 'none' | 'solid' | 'dashed') => {
    setStrokeStyle(style);

    if (style === 'none') {
      onStrokeChange({ enabled: false, color: strokeColor, width: strokeWidth, style: 'solid' });
    } else {
      onStrokeChange({ enabled: true, color: strokeColor, width: strokeWidth, style });
    }
  };

  // 处理边框参数变化
  const handleStrokeParamChange = (param: string, value: any) => {
    if (param === 'color') setStrokeColor(value);
    if (param === 'width') setStrokeWidth(value);

    onStrokeChange({
      enabled: true,
      color: param === 'color' ? value : strokeColor,
      width: param === 'width' ? value : strokeWidth,
      style: strokeStyle === 'none' ? 'solid' : strokeStyle,
    });
  };

  return (
    <aside
      className="flex flex-col overflow-y-auto bg-background"
      style={{ width: '360px', borderLeft: '1px solid hsl(var(--border))' }}
    >
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-0">
        <TabsList className="w-full grid grid-cols-3">
          <TabsTrigger value="basic">基础</TabsTrigger>
          <TabsTrigger value="effects">效果</TabsTrigger>
          <TabsTrigger value="filters">滤镜</TabsTrigger>
        </TabsList>

        {/* 基础属性 Tab */}
        <TabsContent value="basic" className="px-8 py-6 space-y-6">
          {/* 不透明度 */}
          <div>
            <h3 className="text-sm font-semibold mb-4">不透明度</h3>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">{opacity}%</span>
              </div>
              <Slider
                value={[opacity]}
                min={0}
                max={100}
                step={1}
                onValueChange={(value) => {
                  setOpacity(value[0]);
                  onOpacityChange(value[0] / 100);
                }}
              />
            </div>
          </div>

          {/* 圆角 */}
          <div>
            <h3 className="text-sm font-semibold mb-4">圆角</h3>

            {/* 预设按钮 */}
            <div className="grid grid-cols-5 gap-2 mb-4">
              <Button
                variant="outline"
                size="sm"
                className={`border-black ${
                  borderRadiusPercent === 0
                    ? 'bg-black text-white hover:bg-black hover:text-white'
                    : 'bg-white text-black hover:bg-gray-50'
                }`}
                onClick={() => handleBorderRadiusPreset(0)}
              >
                无
              </Button>
              <Button
                variant="outline"
                size="sm"
                className={`border-black ${
                  borderRadiusPercent === 5
                    ? 'bg-black text-white hover:bg-black hover:text-white'
                    : 'bg-white text-black hover:bg-gray-50'
                }`}
                onClick={() => handleBorderRadiusPreset(5)}
              >
                小
              </Button>
              <Button
                variant="outline"
                size="sm"
                className={`border-black ${
                  borderRadiusPercent === 15
                    ? 'bg-black text-white hover:bg-black hover:text-white'
                    : 'bg-white text-black hover:bg-gray-50'
                }`}
                onClick={() => handleBorderRadiusPreset(15)}
              >
                中
              </Button>
              <Button
                variant="outline"
                size="sm"
                className={`border-black ${
                  borderRadiusPercent === 25
                    ? 'bg-black text-white hover:bg-black hover:text-white'
                    : 'bg-white text-black hover:bg-gray-50'
                }`}
                onClick={() => handleBorderRadiusPreset(25)}
              >
                大
              </Button>
              <Button
                variant="outline"
                size="sm"
                className={`border-black ${
                  borderRadiusPercent === 50
                    ? 'bg-black text-white hover:bg-black hover:text-white'
                    : 'bg-white text-black hover:bg-gray-50'
                }`}
                onClick={() => handleBorderRadiusPreset(50)}
              >
                最大
              </Button>
            </div>

            {/* 自定义滑块 */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-xs font-medium text-muted-foreground">自定义</label>
                <span className="text-xs text-muted-foreground">{borderRadiusPercent}%</span>
              </div>
              <Slider
                value={[borderRadiusPercent]}
                min={0}
                max={50}
                step={1}
                onValueChange={(value) => handleBorderRadiusSliderChange(value[0])}
              />
            </div>
          </div>

          {/* 翻转 */}
          <div>
            <h3 className="text-sm font-semibold mb-4">翻转</h3>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={onFlipHorizontal}
                className="flex-1"
              >
                <FlipHorizontal className="h-4 w-4 mr-2" />
                水平
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onFlipVertical}
                className="flex-1"
              >
                <FlipVertical className="h-4 w-4 mr-2" />
                垂直
              </Button>
            </div>
          </div>

          {/* 去背景 */}
          <div>
            <h3 className="text-sm font-semibold mb-4">去背景</h3>

            {/* 两个按钮并排 */}
            <div className="grid grid-cols-2 gap-2 mb-2">
              {/* Remove.bg API 去背景 */}
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  // 检查是否配置了 API Key
                  if (!hasRemoveBgApiKeyConfigured()) {
                    if (onOpenSettings) {
                      onOpenSettings();
                    } else {
                      alert('请先在设置中配置 Remove.bg API Key');
                    }
                    return;
                  }

                  // 获取图片 URL
                  const imageUrl = selectedObject?._element?.src || selectedObject?.getSrc?.();
                  if (!imageUrl) {
                    alert('无法获取图片 URL');
                    return;
                  }

                  setIsRemovingBg(true);
                  try {
                    if (onRemoveBackground) {
                      await onRemoveBackground(imageUrl);
                    }
                  } catch (error) {
                    console.error('去背景失败:', error);
                    alert(error instanceof Error ? error.message : '去背景失败');
                  } finally {
                    setIsRemovingBg(false);
                  }
                }}
                disabled={isRemovingBg || isRemovingBgLocal || isTransforming}
                className="w-full"
              >
                {isRemovingBg ? (
                  <>
                    <svg className="animate-spin h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="text-xs">处理中...</span>
                  </>
                ) : (
                  <span className="text-xs">去背景（API版）</span>
                )}
              </Button>

              {/* 本地 AI 去背景 */}
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  // 获取图片 URL
                  const imageUrl = selectedObject?._element?.src || selectedObject?.getSrc?.();
                  if (!imageUrl) {
                    alert('无法获取图片 URL');
                    return;
                  }

                  setIsRemovingBgLocal(true);
                  setLocalProgress(0);

                  try {
                    if (onRemoveBackgroundLocal) {
                      await onRemoveBackgroundLocal(imageUrl);
                    }
                  } catch (error) {
                    console.error('本地去背景失败:', error);
                    alert(error instanceof Error ? error.message : '本地去背景失败');
                  } finally {
                    setIsRemovingBgLocal(false);
                    setLocalProgress(0);
                  }
                }}
                disabled={isRemovingBg || isRemovingBgLocal || isTransforming}
                className="w-full"
              >
                {isRemovingBgLocal ? (
                  <>
                    <svg className="animate-spin h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="text-xs">{localProgress > 0 ? `${localProgress}%` : '处理中...'}</span>
                  </>
                ) : (
                  <span className="text-xs">免费去背景</span>
                )}
              </Button>
            </div>

            {/* 进度条 */}
            {isRemovingBgLocal && localProgress > 0 && (
              <div className="mt-2">
                <div className="w-full bg-gray-200 rounded-full h-1.5">
                  <div
                    className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                    style={{ width: `${localProgress}%` }}
                  ></div>
                </div>
              </div>
            )}
          </div>

          {/* AI 修图 */}
          <div>
            <h3 className="text-sm font-semibold mb-4">AI修图</h3>

            <div className="space-y-2">
              <input
                type="text"
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                onKeyDown={async (e) => {
                  if (e.key === 'Enter' && aiPrompt.trim() && !isTransforming) {
                    // 获取图片 URL
                    const imageUrl = selectedObject?._element?.src || selectedObject?.getSrc?.();
                    if (!imageUrl) {
                      alert('无法获取图片 URL');
                      return;
                    }

                    setIsTransforming(true);
                    try {
                      if (onAIImageTransform) {
                        await onAIImageTransform(imageUrl, aiPrompt.trim());
                        setAiPrompt(''); // 清空输入框
                      }
                    } catch (error) {
                      console.error('AI 修图失败:', error);
                      alert(error instanceof Error ? error.message : 'AI 修图失败');
                    } finally {
                      setIsTransforming(false);
                    }
                  }
                }}
                placeholder="输入提示词，回车生成..."
                disabled={isTransforming || isRemovingBg || isRemovingBgLocal}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              />

              {isTransforming && (
                <div className="flex items-center justify-center text-xs text-gray-500">
                  <svg className="animate-spin h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  AI 正在生成图片...
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* 效果 Tab */}
        <TabsContent value="effects" className="px-8 py-6 space-y-6">
          {/* 阴影 */}
          <div>
            <h3 className="text-sm font-semibold mb-4">阴影</h3>

            {/* 样式选择 */}
            <div className="grid grid-cols-4 gap-2 mb-4">
              <Button
                variant="outline"
                size="sm"
                className={`border-black ${
                  shadowStyle === 'none'
                    ? 'bg-black text-white hover:bg-black hover:text-white'
                    : 'bg-white text-black hover:bg-gray-50'
                }`}
                onClick={() => handleShadowStyleChange('none')}
              >
                无
              </Button>
              <Button
                variant="outline"
                size="sm"
                className={`border-black ${
                  shadowStyle === 'soft'
                    ? 'bg-black text-white hover:bg-black hover:text-white'
                    : 'bg-white text-black hover:bg-gray-50'
                }`}
                onClick={() => handleShadowStyleChange('soft')}
              >
                柔和
              </Button>
              <Button
                variant="outline"
                size="sm"
                className={`border-black ${
                  shadowStyle === 'normal'
                    ? 'bg-black text-white hover:bg-black hover:text-white'
                    : 'bg-white text-black hover:bg-gray-50'
                }`}
                onClick={() => handleShadowStyleChange('normal')}
              >
                标准
              </Button>
              <Button
                variant="outline"
                size="sm"
                className={`border-black ${
                  shadowStyle === 'strong'
                    ? 'bg-black text-white hover:bg-black hover:text-white'
                    : 'bg-white text-black hover:bg-gray-50'
                }`}
                onClick={() => handleShadowStyleChange('strong')}
              >
                强烈
              </Button>
            </div>

            {/* 参数调节 */}
            {shadowStyle !== 'none' && (
              <div className="space-y-4">
                {/* 阴影颜色 */}
                <div className="flex items-center gap-3">
                  <label className="text-xs font-medium text-muted-foreground w-16">颜色</label>
                  <input
                    type="color"
                    value={shadowColor}
                    onChange={(e) => handleShadowParamChange('color', e.target.value)}
                    className="h-8 w-16 rounded cursor-pointer border border-border"
                  />
                </div>

                {/* 模糊度 */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-medium text-muted-foreground">模糊</label>
                    <span className="text-xs text-muted-foreground">{shadowBlur}px</span>
                  </div>
                  <Slider
                    value={[shadowBlur]}
                    min={0}
                    max={50}
                    step={1}
                    onValueChange={(value) => handleShadowParamChange('blur', value[0])}
                  />
                </div>

                {/* 偏移 X */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-medium text-muted-foreground">偏移 X</label>
                    <span className="text-xs text-muted-foreground">{shadowOffsetX}px</span>
                  </div>
                  <Slider
                    value={[shadowOffsetX]}
                    min={-50}
                    max={50}
                    step={1}
                    onValueChange={(value) => handleShadowParamChange('offsetX', value[0])}
                  />
                </div>

                {/* 偏移 Y */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-medium text-muted-foreground">偏移 Y</label>
                    <span className="text-xs text-muted-foreground">{shadowOffsetY}px</span>
                  </div>
                  <Slider
                    value={[shadowOffsetY]}
                    min={-50}
                    max={50}
                    step={1}
                    onValueChange={(value) => handleShadowParamChange('offsetY', value[0])}
                  />
                </div>
              </div>
            )}
          </div>

          {/* 边框 */}
          <div>
            <h3 className="text-sm font-semibold mb-4">边框</h3>

            {/* 样式选择 */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              <Button
                variant="outline"
                size="sm"
                className={`border-black ${
                  strokeStyle === 'none'
                    ? 'bg-black text-white hover:bg-black hover:text-white'
                    : 'bg-white text-black hover:bg-gray-50'
                }`}
                onClick={() => handleStrokeStyleChange('none')}
              >
                无
              </Button>
              <Button
                variant="outline"
                size="sm"
                className={`border-black ${
                  strokeStyle === 'solid'
                    ? 'bg-black text-white hover:bg-black hover:text-white'
                    : 'bg-white text-black hover:bg-gray-50'
                }`}
                onClick={() => handleStrokeStyleChange('solid')}
              >
                实线
              </Button>
              <Button
                variant="outline"
                size="sm"
                className={`border-black ${
                  strokeStyle === 'dashed'
                    ? 'bg-black text-white hover:bg-black hover:text-white'
                    : 'bg-white text-black hover:bg-gray-50'
                }`}
                onClick={() => handleStrokeStyleChange('dashed')}
              >
                虚线
              </Button>
            </div>

            {/* 参数调节 */}
            {strokeStyle !== 'none' && (
              <div className="space-y-4">
                {/* 边框颜色 */}
                <div className="flex items-center gap-3">
                  <label className="text-xs font-medium text-muted-foreground w-16">颜色</label>
                  <input
                    type="color"
                    value={strokeColor}
                    onChange={(e) => handleStrokeParamChange('color', e.target.value)}
                    className="h-8 w-16 rounded cursor-pointer border border-border"
                  />
                </div>

                {/* 边框宽度 */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-medium text-muted-foreground">宽度</label>
                    <span className="text-xs text-muted-foreground">{strokeWidth}px</span>
                  </div>
                  <Slider
                    value={[strokeWidth]}
                    min={1}
                    max={200}
                    step={1}
                    onValueChange={(value) => handleStrokeParamChange('width', value[0])}
                  />
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        {/* 滤镜 Tab */}
        <TabsContent value="filters" className="px-8 py-6 space-y-6">
          {/* 快速滤镜 */}
          <div>
            <h3 className="text-sm font-semibold mb-4">快速滤镜</h3>
            <div className="grid grid-cols-3 gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onFilterChange('grayscale')}
              >
                灰度
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onFilterChange('sepia')}
              >
                棕褐
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onFilterChange('invert')}
              >
                反色
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onFilterChange('blur')}
              >
                模糊
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onFilterChange('sharpen')}
              >
                锐化
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onFilterChange('emboss')}
              >
                浮雕
              </Button>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onFilterChange('reset')}
              className="w-full mt-2"
            >
              重置滤镜
            </Button>
          </div>

          {/* 色彩调整 */}
          <div>
            <h3 className="text-sm font-semibold mb-4">色彩调整</h3>

            {/* 亮度 */}
            <div className="space-y-2 mb-4">
              <div className="flex justify-between items-center">
                <label className="text-xs font-medium text-muted-foreground">亮度</label>
                <span className="text-xs text-muted-foreground">{brightness > 0 ? '+' : ''}{Math.round(brightness * 100)}</span>
              </div>
              <Slider
                value={[brightness * 100]}
                min={-100}
                max={100}
                step={1}
                onValueChange={(value) => {
                  const val = value[0] / 100;
                  setBrightness(val);
                  onBrightnessChange(val);
                }}
              />
            </div>

            {/* 对比度 */}
            <div className="space-y-2 mb-4">
              <div className="flex justify-between items-center">
                <label className="text-xs font-medium text-muted-foreground">对比度</label>
                <span className="text-xs text-muted-foreground">{contrast > 0 ? '+' : ''}{Math.round(contrast * 100)}</span>
              </div>
              <Slider
                value={[contrast * 100]}
                min={-100}
                max={100}
                step={1}
                onValueChange={(value) => {
                  const val = value[0] / 100;
                  setContrast(val);
                  onContrastChange(val);
                }}
              />
            </div>

            {/* 饱和度 */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-xs font-medium text-muted-foreground">饱和度</label>
                <span className="text-xs text-muted-foreground">{saturation > 0 ? '+' : ''}{Math.round(saturation * 100)}</span>
              </div>
              <Slider
                value={[saturation * 100]}
                min={-100}
                max={100}
                step={1}
                onValueChange={(value) => {
                  const val = value[0] / 100;
                  setSaturation(val);
                  onSaturationChange(val);
                }}
              />
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </aside>
  );
}

