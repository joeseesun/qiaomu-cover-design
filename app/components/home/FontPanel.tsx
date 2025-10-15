// 字体面板
'use client';

import { useState, useEffect } from 'react';
import { FONTS, FontConfig } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Loader2, ChevronLeft, ChevronRight, Minus, Plus, X, AlignLeft, AlignCenter, AlignRight } from 'lucide-react';
import ColorPicker from './ColorPicker';
import { HexColorPicker } from 'react-colorful';

// 预设颜色 - 去掉最后两个颜色
const PRESET_COLORS = [
  '#FFE066', '#FFB84D', '#FF9999', '#FF6B9D', '#C77DFF', '#9D84FF',
  '#7DD3FC', '#67E8F9', '#6EE7B7', '#A7F3D0',
];

interface FontPanelProps {
  selectedFont: string;
  fontSize: number;
  textColor: string;
  lineHeight?: number;
  letterSpacing?: number;
  selectedObject: any;
  onFontChange: (fontFamily: string) => void;
  onFontSizeChange: (size: number) => void;
  onColorChange: (color: string) => void;
  onLineHeightChange?: (lineHeight: number) => void;
  onLetterSpacingChange?: (letterSpacing: number) => void;
  // 对齐
  onTextAlignChange?: (align: 'left' | 'center' | 'right') => void;
  // 背景
  onBackgroundChange?: (style: 'none' | 'solid', color?: string, opacity?: number) => void;
  // 下划线
  onUnderlineChange?: (style: 'none' | 'solid' | 'wavy' | 'dotted', width?: number, color?: string) => void;
  // 边框
  onBorderChange?: (style: 'none' | 'solid' | 'dashed', width?: number, color?: string) => void;
  // 画布背景
  onCanvasBackgroundChange?: (type: 'solid' | 'gradient' | 'image', value: string) => void;
}

const RECENT_FONTS_KEY = 'xhs_recent_fonts';
const MAX_RECENT_FONTS = 3; // 只标记最近使用的 3 个

export default function FontPanel({
  selectedFont,
  fontSize,
  textColor,
  lineHeight = 1.2,
  letterSpacing = 0,
  selectedObject,
  onFontChange,
  onFontSizeChange,
  onColorChange,
  onLineHeightChange,
  onLetterSpacingChange,
  onTextAlignChange,
  onBackgroundChange,
  onUnderlineChange,
  onBorderChange,
  onCanvasBackgroundChange,
}: FontPanelProps) {
  const [loadingFonts, setLoadingFonts] = useState<Set<string>>(new Set());
  const [loadedFonts, setLoadedFonts] = useState<Set<string>>(
    new Set(['Noto Sans SC', 'Noto Serif SC', 'Arial, sans-serif'])
  );
  const [recentFontFamilies, setRecentFontFamilies] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(0);

  // 主 Tab 状态
  const [activeMainTab, setActiveMainTab] = useState<'font' | 'spacing' | 'canvas'>('font');

  // 装饰 Tab 状态
  const [activeDecorationTab, setActiveDecorationTab] = useState<'background' | 'underline' | 'border'>('background');

  // 文本对齐状态
  const [textAlign, setTextAlign] = useState<'left' | 'center' | 'right'>('left');

  // 画布背景状态
  const [canvasBackgroundType, setCanvasBackgroundType] = useState<'solid' | 'image' | 'pattern'>('solid');
  const [canvasBackgroundColor, setCanvasBackgroundColor] = useState('#FFFFFF');
  const [showCanvasColorPicker, setShowCanvasColorPicker] = useState(false);
  const [uploadedBackgroundImage, setUploadedBackgroundImage] = useState<string | null>(null);

  // 字号输入框的本地状态
  const [fontSizeInput, setFontSizeInput] = useState<string>('');

  // 本地状态用于实时显示
  const [localLetterSpacing, setLocalLetterSpacing] = useState(letterSpacing);
  const [localLineHeight, setLocalLineHeight] = useState(lineHeight);

  // 同步 selectedObject 的值到本地状态
  useEffect(() => {
    if (selectedObject) {
      setLocalLetterSpacing(selectedObject.charSpacing ?? letterSpacing);
      setLocalLineHeight(selectedObject.lineHeight ?? lineHeight);

      // 同步背景颜色和透明度(从Group中提取)
      if (selectedObject.type === 'group') {
        const objects = (selectedObject as any)._objects || [];
        const bgRect = objects.find((obj: any) =>
          obj.type === 'rect' && obj.fill && obj.fill !== 'transparent'
        );

        if (bgRect) {
          setBackgroundStyle('solid');
          setBackgroundColor(bgRect.fill || '#FFE066');
          // 转换: Fabric.js的opacity(1=不透明) → 透明度(0=不透明)
          const fabricOpacity = bgRect.opacity ?? 1.0;
          const transparency = 1 - fabricOpacity;
          setBackgroundTransparency(transparency);
          console.log('📋 读取背景:', {
            color: bgRect.fill,
            fabricOpacity,
            transparency,
            displayTransparency: Math.round(transparency * 100) + '%'
          });
        } else {
          setBackgroundStyle('none');
        }
      } else {
        setBackgroundStyle('none');
      }
    } else {
      setLocalLetterSpacing(letterSpacing);
      setLocalLineHeight(lineHeight);
    }
  }, [selectedObject, letterSpacing, lineHeight]);

  // 背景状态
  const [backgroundStyle, setBackgroundStyle] = useState<'none' | 'solid'>('none');
  const [backgroundColor, setBackgroundColor] = useState('#FFE066');
  // 注意: 这里存储的是"透明度"(0=不透明, 1=完全透明)
  // 需要转换为Fabric.js的opacity(0=透明, 1=不透明)
  const [backgroundTransparency, setBackgroundTransparency] = useState(0); // 默认0%透明=不透明
  const [recentBackgroundColors, setRecentBackgroundColors] = useState<string[]>([]);

  // 下划线状态
  const [underlineStyle, setUnderlineStyle] = useState<'none' | 'solid' | 'wavy' | 'dotted'>('none');
  const [underlineWidth, setUnderlineWidth] = useState(5);
  const [underlineColor, setUnderlineColor] = useState('#FF2442');

  // 边框状态
  const [borderStyle, setBorderStyle] = useState<'none' | 'solid' | 'dashed'>('none');
  const [borderWidth, setBorderWidth] = useState(5);
  const [borderColor, setBorderColor] = useState('#FF2442');

  // 加载最近使用的字体（只存储 family 列表）
  useEffect(() => {
    const stored = localStorage.getItem(RECENT_FONTS_KEY);
    if (stored) {
      try {
        const fontFamilies = JSON.parse(stored) as string[];
        setRecentFontFamilies(fontFamilies.slice(0, MAX_RECENT_FONTS));
      } catch (error) {
        console.error('Failed to load recent fonts:', error);
      }
    }

    // 加载最近使用的背景颜色
    const storedColors = localStorage.getItem('recent-background-colors');
    if (storedColors) {
      try {
        const colors = JSON.parse(storedColors) as string[];
        setRecentBackgroundColors(colors.slice(0, 6));
      } catch (error) {
        console.error('Failed to load recent background colors:', error);
      }
    }
  }, []);

  // 预加载第一页的字体
  useEffect(() => {
    const fontsPerPage = 3;
    const firstPageFonts = FONTS.slice(0, fontsPerPage);
    firstPageFonts.forEach((font) => {
      loadFont(font);
    });
  }, []);

  // 添加到最近使用
  const addToRecent = (font: FontConfig) => {
    setRecentFontFamilies((prev) => {
      const filtered = prev.filter((f) => f !== font.family);
      const updated = [font.family, ...filtered].slice(0, MAX_RECENT_FONTS);
      localStorage.setItem(RECENT_FONTS_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  // 添加到最近使用的背景颜色
  const addToRecentBackgroundColors = (color: string) => {
    setRecentBackgroundColors((prev) => {
      const filtered = prev.filter((c) => c !== color);
      const updated = [color, ...filtered].slice(0, 6);
      localStorage.setItem('recent-background-colors', JSON.stringify(updated));
      return updated;
    });
  };

  // 懒加载字体
  const loadFont = async (font: FontConfig): Promise<void> => {
    // 如果已经加载完成,直接返回
    if (loadedFonts.has(font.family)) {
      return Promise.resolve();
    }

    // 如果正在加载,等待加载完成
    if (loadingFonts.has(font.family)) {
      // 等待字体加载完成
      return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          if (loadedFonts.has(font.family)) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 100);
      });
    }

    setLoadingFonts((prev) => new Set(prev).add(font.family));

    try {
      const link = document.createElement('link');
      link.href = `https://fonts.googleapis.com/css2?family=${font.family.replace(
        / /g,
        '+'
      )}:wght@${font.weight.join(';')}&display=swap`;
      link.rel = 'stylesheet';
      document.head.appendChild(link);

      await document.fonts.ready;

      setLoadedFonts((prev) => new Set(prev).add(font.family));
    } catch (error) {
      console.error(`Failed to load font: ${font.family}`, error);
    } finally {
      setLoadingFonts((prev) => {
        const next = new Set(prev);
        next.delete(font.family);
        return next;
      });
    }
  };

  const handleFontClick = async (font: FontConfig) => {
    // 先加载字体,等待完成后再应用
    await loadFont(font);
    onFontChange(font.family);
    addToRecent(font);
  };

  // 计算分页（每页 3 个字体）
  const fontsPerPage = 3;
  const totalPages = Math.ceil(FONTS.length / fontsPerPage);
  const displayFonts = FONTS.slice(
    currentPage * fontsPerPage,
    (currentPage + 1) * fontsPerPage
  );

  const handlePrevPage = () => {
    setCurrentPage((prev) => {
      const newPage = Math.max(0, prev - 1);
      // 预加载新页面的字体
      const newPageFonts = FONTS.slice(newPage * fontsPerPage, (newPage + 1) * fontsPerPage);
      newPageFonts.forEach((font) => loadFont(font));
      return newPage;
    });
  };

  const handleNextPage = () => {
    setCurrentPage((prev) => {
      const newPage = Math.min(totalPages - 1, prev + 1);
      // 预加载新页面的字体
      const newPageFonts = FONTS.slice(newPage * fontsPerPage, (newPage + 1) * fontsPerPage);
      newPageFonts.forEach((font) => loadFont(font));
      return newPage;
    });
  };

  // 获取当前选中对象的字体和颜色
  const getCurrentProperty = (property: string, defaultValue: any) => {
    if (!selectedObject) return defaultValue;

    // 如果是 Group，从内部文本对象获取
    if (selectedObject.type === 'group') {
      const textObj = (selectedObject as any)._objects?.find((o: any) => o.type === 'i-text' || o.type === 'textbox');
      return textObj?.[property] || defaultValue;
    }

    return selectedObject[property] || defaultValue;
  };

  const currentFont = getCurrentProperty('fontFamily', selectedFont);
  const currentColor = getCurrentProperty('fill', textColor);
  const currentFontSize = getCurrentProperty('fontSize', fontSize);

  // 同步字号到输入框
  useEffect(() => {
    setFontSizeInput(String(currentFontSize));
  }, [currentFontSize]);

  // 判断字体是否是最近使用的
  const isRecentFont = (fontFamily: string) => {
    return recentFontFamilies.includes(fontFamily);
  };

  return (
    <aside
      className="flex flex-col overflow-y-auto bg-background"
      style={{ width: '360px', borderLeft: '1px solid hsl(var(--border))' }}
    >
      {/* 主 Tab 组：字体设置 / 对齐与间距 / 画布背景 */}
      <Tabs value={activeMainTab} onValueChange={(value) => setActiveMainTab(value as any)} className="space-y-0">
        <TabsList className="w-full grid grid-cols-3">
          <TabsTrigger value="font">字体设置</TabsTrigger>
          <TabsTrigger value="spacing">对齐与间距</TabsTrigger>
          <TabsTrigger value="canvas">画布背景</TabsTrigger>
        </TabsList>

        {/* 字体设置 Tab */}
        <TabsContent value="font" className="px-8 py-6 space-y-6">
          {/* 字体网格 */}
          <div>
            <h3 className="text-sm font-semibold mb-4">字体</h3>
            <div className="grid grid-cols-3 gap-3">
              {displayFonts.map((font) => {
                const isSelected = currentFont === font.family;
                const isLoading = loadingFonts.has(font.family);
                const isLoaded = loadedFonts.has(font.family);
                const isRecent = isRecentFont(font.family);

                return (
                  <button
                    key={font.family}
                    onClick={() => handleFontClick(font)}
                    className={`relative h-24 flex flex-col items-center justify-center p-3 rounded-md border transition-all ${
                      isSelected
                        ? 'border-primary bg-primary/5 shadow-sm'
                        : 'border-border/40 bg-background hover:border-primary/50'
                    }`}
                  >
                    {/* 最近使用标记（小灰点） */}
                    {isRecent && (
                      <div className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-gray-400" />
                    )}

                    {isLoading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <>
                        <div
                          className="text-2xl font-bold mb-1"
                          style={{
                            fontFamily: isLoaded ? font.family : 'inherit',
                          }}
                        >
                          {font.preview}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {font.name}
                        </div>
                      </>
                    )}
                  </button>
                );
              })}
            </div>

            {/* 分页控制 */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-4 mt-4">
                <button
                  onClick={handlePrevPage}
                  disabled={currentPage === 0}
                  className="p-1 rounded hover:bg-accent transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>

                <span className="text-xs text-muted-foreground font-medium min-w-[32px] text-center">
                  {currentPage + 1} / {totalPages}
                </span>

                <button
                  onClick={handleNextPage}
                  disabled={currentPage === totalPages - 1}
                  className="p-1 rounded hover:bg-accent transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>

          {/* 字体颜色 + 字号 */}
          <div className="flex items-start gap-4">
            {/* 字体颜色 - 小方块 */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-muted-foreground h-[18px] leading-[18px]">颜色</label>
              <ColorPicker
                color={currentColor}
                onChange={onColorChange}
                compact
                disabled={!selectedObject}
              />
            </div>

            {/* 字号 */}
            <div className="flex-1 flex flex-col gap-2">
              <label className="text-xs font-medium text-muted-foreground h-[18px] leading-[18px]">字号</label>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 shrink-0 active:scale-95 transition-transform"
                  onClick={() => {
                    if (!selectedObject) return;
                    const newValue = Math.max(12, currentFontSize - 2);
                    setFontSizeInput(String(newValue));
                    onFontSizeChange(newValue);
                  }}
                  disabled={!selectedObject}
                >
                  <Minus className="h-3.5 w-3.5" />
                </Button>
                <Input
                  type="number"
                  value={fontSizeInput}
                  onChange={(e) => {
                    // 允许任意输入,包括空字符串
                    setFontSizeInput(e.target.value);
                  }}
                  onBlur={() => {
                    // 失焦时验证并应用
                    const value = Number(fontSizeInput);
                    if (!isNaN(value) && value >= 12 && value <= 200) {
                      onFontSizeChange(value);
                    } else {
                      // 如果无效,恢复到当前值
                      setFontSizeInput(String(currentFontSize));
                    }
                  }}
                  onKeyDown={(e) => {
                    // 按Enter时也触发验证
                    if (e.key === 'Enter') {
                      e.currentTarget.blur();
                    }
                  }}
                  disabled={!selectedObject}
                  className="flex-1 text-center h-8 text-base font-semibold tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  min={12}
                  max={200}
                />
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 shrink-0 active:scale-95 transition-transform"
                  onClick={() => {
                    if (!selectedObject) return;
                    const newValue = Math.min(200, currentFontSize + 2);
                    setFontSizeInput(String(newValue));
                    onFontSizeChange(newValue);
                  }}
                  disabled={!selectedObject}
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* 对齐与间距 Tab */}
        <TabsContent value="spacing" className="px-8 py-6 space-y-6">
          {/* 字间距 */}
          <div>
            <label className="text-sm font-semibold mb-3 block">字间距</label>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 shrink-0"
                onClick={() => {
                  if (!selectedObject) return;
                  const newValue = Math.max(-500, localLetterSpacing - 10);
                  setLocalLetterSpacing(newValue);
                  onLetterSpacingChange?.(newValue);
                }}
                disabled={!selectedObject}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <div className="flex-1 text-center h-9 flex items-center justify-center border rounded-md">
                <div className="text-base font-semibold tabular-nums">
                  {Math.round(localLetterSpacing)}
                </div>
              </div>
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 shrink-0"
                onClick={() => {
                  if (!selectedObject) return;
                  const newValue = Math.min(1000, localLetterSpacing + 10);
                  setLocalLetterSpacing(newValue);
                  onLetterSpacingChange?.(newValue);
                }}
                disabled={!selectedObject}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* 行间距 */}
          <div>
            <label className="text-sm font-semibold mb-3 block">行间距</label>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 shrink-0"
                onClick={() => {
                  if (!selectedObject) return;
                  const newValue = Math.max(0.5, Number((localLineHeight - 0.1).toFixed(1)));
                  setLocalLineHeight(newValue);
                  onLineHeightChange?.(newValue);
                }}
                disabled={!selectedObject}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <div className="flex-1 text-center h-9 flex items-center justify-center border rounded-md">
                <div className="text-base font-semibold tabular-nums">
                  {localLineHeight.toFixed(1)}
                </div>
              </div>
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 shrink-0"
                onClick={() => {
                  if (!selectedObject) return;
                  const newValue = Math.min(5, Number((localLineHeight + 0.1).toFixed(1)));
                  setLocalLineHeight(newValue);
                  onLineHeightChange?.(newValue);
                }}
                disabled={!selectedObject}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* 对齐方式 */}
          <div>
            <label className="text-sm font-semibold mb-3 block">对齐方式</label>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className={`flex-1 h-10 ${textAlign === 'left' ? 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground' : ''}`}
                onClick={() => {
                  setTextAlign('left');
                  onTextAlignChange?.('left');
                }}
                disabled={!selectedObject}
              >
                <AlignLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className={`flex-1 h-10 ${textAlign === 'center' ? 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground' : ''}`}
                onClick={() => {
                  setTextAlign('center');
                  onTextAlignChange?.('center');
                }}
                disabled={!selectedObject}
              >
                <AlignCenter className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className={`flex-1 h-10 ${textAlign === 'right' ? 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground' : ''}`}
                onClick={() => {
                  setTextAlign('right');
                  onTextAlignChange?.('right');
                }}
                disabled={!selectedObject}
              >
                <AlignRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* 画布背景 Tab */}
        <TabsContent value="canvas" className="px-8 py-6 space-y-6">
          {/* 纯色背景选择器 */}
          <div>
            <label className="text-sm font-semibold mb-3 block">纯色背景</label>
            <div className="grid grid-cols-6 gap-2">
              {/* 第一个是自定义颜色选择器 */}
              <div className="relative">
                <button
                  onClick={() => setShowCanvasColorPicker(!showCanvasColorPicker)}
                  className="w-full aspect-square rounded-md border-2 border-border hover:border-primary transition-colors flex items-center justify-center bg-gradient-to-br from-red-500 via-yellow-500 to-blue-500"
                >
                  <svg className="w-5 h-5 text-white drop-shadow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                  </svg>
                </button>
                {showCanvasColorPicker && (
                  <div className="absolute top-full left-0 mt-2 z-50">
                    <div className="fixed inset-0" onClick={() => setShowCanvasColorPicker(false)} />
                    <div className="relative bg-white rounded-lg shadow-lg p-3">
                      <HexColorPicker
                        color={canvasBackgroundColor}
                        onChange={(color) => {
                          setCanvasBackgroundColor(color);
                          setCanvasBackgroundType('solid');
                          onCanvasBackgroundChange?.('solid', color);
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* 预设颜色 */}
              {['#F5F5F5', '#E8E8E8', '#FFE5E5', '#FFF4E5', '#FFFBE5',
                '#E5F9FF', '#E5F0FF', '#F0E5FF', '#FFE5F5', '#E5FFE5', '#1A1A1A'].map((color) => (
                <button
                  key={color}
                  onClick={() => {
                    setCanvasBackgroundColor(color);
                    setCanvasBackgroundType('solid');
                    onCanvasBackgroundChange?.('solid', color);
                  }}
                  className={`w-full aspect-square rounded-md border-2 hover:border-primary transition-colors ${
                    canvasBackgroundColor === color && canvasBackgroundType === 'solid'
                      ? 'border-primary ring-2 ring-primary/20'
                      : 'border-border'
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          {/* 渐变背景 */}
          <div>
            <label className="text-sm font-semibold mb-3 block">渐变背景</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                // 柔和浅色渐变
                'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
                'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)',
                'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
                'linear-gradient(135deg, #fbc2eb 0%, #a6c1ee 100%)',
                'linear-gradient(135deg, #fdcbf1 0%, #e6dee9 100%)',
                'linear-gradient(135deg, #ffeaa7 0%, #fdcb6e 100%)',
                'linear-gradient(135deg, #a29bfe 0%, #6c5ce7 100%)',
                'linear-gradient(135deg, #fd79a8 0%, #fdcb6e 100%)',
                'linear-gradient(135deg, #74b9ff 0%, #0984e3 100%)',
              ].map((gradient, index) => (
                <button
                  key={index}
                  onClick={() => {
                    setCanvasBackgroundType('solid'); // 设置为solid类型以便替换
                    onCanvasBackgroundChange?.('gradient', gradient);
                  }}
                  className="h-16 rounded-md border-2 border-border hover:border-primary transition-colors"
                  style={{ background: gradient }}
                />
              ))}
            </div>
          </div>

          {/* 图片背景上传 */}
          <div>
            <label className="text-sm font-semibold mb-3 block">图片背景</label>
            <div className="flex gap-3">
              {/* 左侧预览 */}
              <div className="flex-1">
                {uploadedBackgroundImage ? (
                  <div className="relative w-full h-32 rounded-md border-2 border-border overflow-hidden group">
                    <img
                      src={uploadedBackgroundImage}
                      alt="背景预览"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="text-white text-sm">当前背景</span>
                    </div>
                  </div>
                ) : (
                  <div className="w-full h-32 rounded-md border-2 border-dashed border-border flex items-center justify-center">
                    <span className="text-sm text-muted-foreground">暂无图片</span>
                  </div>
                )}
              </div>

              {/* 右侧上传按钮 */}
              <div className="flex-1">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  id="canvas-bg-upload"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        const imageUrl = event.target?.result as string;
                        setUploadedBackgroundImage(imageUrl);
                        setCanvasBackgroundType('solid'); // 设置类型以便替换
                        onCanvasBackgroundChange?.('image', imageUrl);
                      };
                      reader.readAsDataURL(file);
                    }
                    // 重置input,允许上传同一文件
                    e.target.value = '';
                  }}
                />
                <label
                  htmlFor="canvas-bg-upload"
                  className="w-full h-32 rounded-md border-2 border-dashed border-border hover:border-primary transition-colors flex flex-col items-center justify-center gap-2 cursor-pointer"
                >
                  <svg className="w-8 h-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="text-sm text-muted-foreground text-center px-2">
                    {uploadedBackgroundImage ? '点击更换图片' : '点击上传图片'}
                  </span>
                </label>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <Separator />

      {/* 装饰 Tab 组 */}
      <Tabs value={activeDecorationTab} onValueChange={(value) => setActiveDecorationTab(value as any)} className="space-y-0">
        <TabsList>
          <TabsTrigger value="background">字体背景</TabsTrigger>
          <TabsTrigger value="underline">下划线</TabsTrigger>
          <TabsTrigger value="border">边框</TabsTrigger>
        </TabsList>

        {/* 背景 Tab 内容 */}
        <TabsContent value="background" className="px-8 py-6 space-y-4">
            {/* 颜色选择 + 透明度控制 */}
            <div className="flex items-start gap-4">
              {/* 背景颜色 - 小方块 */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-medium text-muted-foreground h-[18px] leading-[18px]">颜色</label>
                <ColorPicker
                  color={backgroundColor}
                  onChange={(color) => {
                    setBackgroundStyle('solid');
                    setBackgroundColor(color);
                    // 转换: 透明度 → Fabric.js的opacity
                    const fabricOpacity = 1 - backgroundTransparency;
                    onBackgroundChange?.('solid', color, fabricOpacity);
                    addToRecentBackgroundColors(color);
                  }}
                  compact
                  disabled={!selectedObject}
                />
              </div>

              {/* 透明度 */}
              <div className="flex-1 flex flex-col gap-2">
                <label className="text-xs font-medium text-muted-foreground h-[18px] leading-[18px]">透明度</label>
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 shrink-0 active:scale-95 transition-transform"
                    onClick={() => {
                      // 减少透明度(更不透明)
                      const newTransparency = Math.max(0, Number((backgroundTransparency - 0.1).toFixed(1)));
                      setBackgroundTransparency(newTransparency);
                      if (backgroundStyle === 'solid') {
                        const fabricOpacity = 1 - newTransparency;
                        onBackgroundChange?.('solid', backgroundColor, fabricOpacity);
                      }
                    }}
                    disabled={!selectedObject || backgroundTransparency <= 0}
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </Button>
                  <div className="flex-1 text-center h-8 flex items-center justify-center">
                    <div className="text-base font-semibold tabular-nums">
                      {Math.round(backgroundTransparency * 100)}%
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 shrink-0 active:scale-95 transition-transform"
                    onClick={() => {
                      // 增加透明度(更透明)
                      const newTransparency = Math.min(1, Number((backgroundTransparency + 0.1).toFixed(1)));
                      setBackgroundTransparency(newTransparency);
                      if (backgroundStyle === 'solid') {
                        const fabricOpacity = 1 - newTransparency;
                        onBackgroundChange?.('solid', backgroundColor, fabricOpacity);
                      }
                    }}
                    disabled={!selectedObject || backgroundTransparency >= 1}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>

            {/* 推荐颜色 */}
            <div className="space-y-3">
              <label className="text-xs text-muted-foreground">推荐颜色</label>
              <div className="grid grid-cols-11 gap-2">
                {/* 第一个：无背景 */}
                <button
                  onClick={() => {
                    setBackgroundStyle('none');
                    onBackgroundChange?.('none');
                  }}
                  disabled={!selectedObject}
                  className={`w-6 h-6 rounded border transition-all hover:scale-110 flex items-center justify-center ${
                    backgroundStyle === 'none'
                      ? 'border-primary ring-2 ring-primary/20 bg-gray-50'
                      : 'border-border/30 bg-white'
                  }`}
                  title="无背景"
                >
                  <X className="h-3 w-3 text-muted-foreground" />
                </button>

                {/* 推荐颜色 */}
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => {
                      setBackgroundStyle('solid');
                      setBackgroundColor(color);
                      const fabricOpacity = 1 - backgroundTransparency;
                      onBackgroundChange?.('solid', color, fabricOpacity);
                      addToRecentBackgroundColors(color);
                    }}
                    disabled={!selectedObject}
                    className={`w-6 h-6 rounded border transition-all hover:scale-110 ${
                      backgroundStyle === 'solid' && backgroundColor === color
                        ? 'border-primary ring-2 ring-primary/20'
                        : 'border-border/30'
                    }`}
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
              </div>
            </div>

            {/* 最近使用 */}
            {recentBackgroundColors.length > 0 && (
              <div className="space-y-3">
                <label className="text-xs text-muted-foreground">最近使用</label>
                <div className="flex gap-1.5">
                  {recentBackgroundColors.slice(0, 2).map((color) => (
                    <button
                      key={color}
                      onClick={() => {
                        setBackgroundStyle('solid');
                        setBackgroundColor(color);
                        const fabricOpacity = 1 - backgroundTransparency;
                        onBackgroundChange?.('solid', color, fabricOpacity);
                        addToRecentBackgroundColors(color);
                      }}
                      disabled={!selectedObject}
                      className={`w-6 h-6 rounded border transition-all hover:scale-110 ${
                        backgroundStyle === 'solid' && backgroundColor === color
                          ? 'border-primary ring-2 ring-primary/20'
                          : 'border-border/30'
                      }`}
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                </div>
              </div>
            )}
        </TabsContent>

        {/* 下划线 Tab 内容 */}
        <TabsContent value="underline" className="px-8 py-6 space-y-4">

        {/* 样式选择 */}
        <div className="grid grid-cols-4 gap-2">
          <Button
            variant="outline"
            size="sm"
            className={`border-black ${
              underlineStyle === 'none'
                ? 'bg-black text-white hover:bg-black hover:text-white'
                : 'bg-white text-black hover:bg-gray-50'
            }`}
            onClick={() => {
              setUnderlineStyle('none');
              onUnderlineChange?.('none');
            }}
            disabled={!selectedObject}
          >
            无
          </Button>
          <Button
            variant="outline"
            size="sm"
            className={`border-black ${
              underlineStyle === 'solid'
                ? 'bg-black text-white hover:bg-black hover:text-white'
                : 'bg-white text-black hover:bg-gray-50'
            }`}
            onClick={() => {
              setUnderlineStyle('solid');
              onUnderlineChange?.('solid', underlineWidth, underlineColor);
            }}
            disabled={!selectedObject}
          >
            直线
          </Button>
          <Button
            variant="outline"
            size="sm"
            className={`border-black ${
              underlineStyle === 'wavy'
                ? 'bg-black text-white hover:bg-black hover:text-white'
                : 'bg-white text-black hover:bg-gray-50'
            }`}
            onClick={() => {
              setUnderlineStyle('wavy');
              onUnderlineChange?.('wavy', underlineWidth, underlineColor);
            }}
            disabled={!selectedObject}
          >
            波浪
          </Button>
          <Button
            variant="outline"
            size="sm"
            className={`border-black ${
              underlineStyle === 'dotted'
                ? 'bg-black text-white hover:bg-black hover:text-white'
                : 'bg-white text-black hover:bg-gray-50'
            }`}
            onClick={() => {
              setUnderlineStyle('dotted');
              onUnderlineChange?.('dotted', underlineWidth, underlineColor);
            }}
            disabled={!selectedObject}
          >
            点线
          </Button>
        </div>

        {/* 颜色和粗细 */}
        {underlineStyle !== 'none' && (
          <div className="space-y-4">
            {/* 颜色选择 + 粗细控制 */}
            <div className="flex items-start gap-4">
              {/* 下划线颜色 - 小方块 */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-medium text-muted-foreground h-[18px] leading-[18px]">颜色</label>
                <ColorPicker
                  color={underlineColor}
                  onChange={(color) => {
                    setUnderlineColor(color);
                    onUnderlineChange?.(underlineStyle, underlineWidth, color);
                  }}
                  compact
                  disabled={!selectedObject}
                />
              </div>

              {/* 粗细 */}
              <div className="flex-1 flex flex-col gap-2">
                <label className="text-xs font-medium text-muted-foreground h-[18px] leading-[18px]">粗细</label>
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 shrink-0 active:scale-95 transition-transform"
                    onClick={() => {
                      const newWidth = Math.max(1, underlineWidth - 1);
                      setUnderlineWidth(newWidth);
                      onUnderlineChange?.(underlineStyle, newWidth, underlineColor);
                    }}
                    disabled={!selectedObject || underlineWidth <= 1}
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </Button>
                  <div className="flex-1 text-center h-8 flex items-center justify-center">
                    <div className="text-base font-semibold tabular-nums">
                      {underlineWidth}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 shrink-0 active:scale-95 transition-transform"
                    onClick={() => {
                      const newWidth = Math.min(20, underlineWidth + 1);
                      setUnderlineWidth(newWidth);
                      onUnderlineChange?.(underlineStyle, newWidth, underlineColor);
                    }}
                    disabled={!selectedObject || underlineWidth >= 20}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>

            {/* 推荐颜色 */}
            <div className="space-y-3">
              <label className="text-xs text-muted-foreground">推荐颜色</label>
              <div className="grid grid-cols-10 gap-2">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => {
                      setUnderlineColor(color);
                      onUnderlineChange?.(underlineStyle, underlineWidth, color);
                    }}
                    disabled={!selectedObject}
                    className={`w-6 h-6 rounded border transition-all hover:scale-110 ${
                      underlineColor === color
                        ? 'border-primary ring-2 ring-primary/20'
                        : 'border-border/30'
                    }`}
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
        </TabsContent>

        {/* 边框 Tab 内容 */}
        <TabsContent value="border" className="px-8 py-6 space-y-4">

        {/* 样式选择 */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className={`flex-1 border-black ${
              borderStyle === 'none'
                ? 'bg-black text-white hover:bg-black hover:text-white'
                : 'bg-white text-black hover:bg-gray-50'
            }`}
            onClick={() => {
              setBorderStyle('none');
              onBorderChange?.('none');
            }}
            disabled={!selectedObject}
          >
            无
          </Button>
          <Button
            variant="outline"
            size="sm"
            className={`flex-1 border-black ${
              borderStyle === 'solid'
                ? 'bg-black text-white hover:bg-black hover:text-white'
                : 'bg-white text-black hover:bg-gray-50'
            }`}
            onClick={() => {
              setBorderStyle('solid');
              onBorderChange?.('solid', borderWidth, borderColor);
            }}
            disabled={!selectedObject}
          >
            实线
          </Button>
          <Button
            variant="outline"
            size="sm"
            className={`flex-1 border-black ${
              borderStyle === 'dashed'
                ? 'bg-black text-white hover:bg-black hover:text-white'
                : 'bg-white text-black hover:bg-gray-50'
            }`}
            onClick={() => {
              setBorderStyle('dashed');
              onBorderChange?.('dashed', borderWidth, borderColor);
            }}
            disabled={!selectedObject}
          >
            虚线
          </Button>
        </div>

        {/* 颜色和粗细 */}
        {borderStyle !== 'none' && (
          <div className="space-y-4">
            {/* 颜色选择 + 粗细控制 */}
            <div className="flex items-start gap-4">
              {/* 边框颜色 - 小方块 */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-medium text-muted-foreground h-[18px] leading-[18px]">颜色</label>
                <ColorPicker
                  color={borderColor}
                  onChange={(color) => {
                    setBorderColor(color);
                    onBorderChange?.(borderStyle, borderWidth, color);
                  }}
                  compact
                  disabled={!selectedObject}
                />
              </div>

              {/* 粗细 */}
              <div className="flex-1 flex flex-col gap-2">
                <label className="text-xs font-medium text-muted-foreground h-[18px] leading-[18px]">粗细</label>
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 shrink-0 active:scale-95 transition-transform"
                    onClick={() => {
                      const newWidth = Math.max(1, borderWidth - 1);
                      setBorderWidth(newWidth);
                      onBorderChange?.(borderStyle, newWidth, borderColor);
                    }}
                    disabled={!selectedObject || borderWidth <= 1}
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </Button>
                  <div className="flex-1 text-center h-8 flex items-center justify-center">
                    <div className="text-base font-semibold tabular-nums">
                      {borderWidth}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 shrink-0 active:scale-95 transition-transform"
                    onClick={() => {
                      const newWidth = Math.min(20, borderWidth + 1);
                      setBorderWidth(newWidth);
                      onBorderChange?.(borderStyle, newWidth, borderColor);
                    }}
                    disabled={!selectedObject || borderWidth >= 20}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>

            {/* 推荐颜色 */}
            <div className="space-y-3">
              <label className="text-xs text-muted-foreground">推荐颜色</label>
              <div className="grid grid-cols-10 gap-2">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => {
                      setBorderColor(color);
                      onBorderChange?.(borderStyle, borderWidth, color);
                    }}
                    disabled={!selectedObject}
                    className={`w-6 h-6 rounded border transition-all hover:scale-110 ${
                      borderColor === color
                        ? 'border-primary ring-2 ring-primary/20'
                        : 'border-border/30'
                    }`}
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
        </TabsContent>
      </Tabs>
    </aside>
  );
}

