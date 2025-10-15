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
}: FontPanelProps) {
  const [loadingFonts, setLoadingFonts] = useState<Set<string>>(new Set());
  const [loadedFonts, setLoadedFonts] = useState<Set<string>>(
    new Set(['Noto Sans SC', 'Noto Serif SC', 'Arial, sans-serif'])
  );
  const [recentFontFamilies, setRecentFontFamilies] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(0);

  // 主 Tab 状态
  const [activeMainTab, setActiveMainTab] = useState<'font' | 'spacing'>('font');

  // 装饰 Tab 状态
  const [activeDecorationTab, setActiveDecorationTab] = useState<'background' | 'underline' | 'border'>('background');

  // 文本对齐状态
  const [textAlign, setTextAlign] = useState<'left' | 'center' | 'right'>('left');

  // 本地状态用于实时显示
  const [localLetterSpacing, setLocalLetterSpacing] = useState(letterSpacing);
  const [localLineHeight, setLocalLineHeight] = useState(lineHeight);

  // 同步 selectedObject 的值到本地状态
  useEffect(() => {
    if (selectedObject) {
      setLocalLetterSpacing(selectedObject.charSpacing ?? letterSpacing);
      setLocalLineHeight(selectedObject.lineHeight ?? lineHeight);
    } else {
      setLocalLetterSpacing(letterSpacing);
      setLocalLineHeight(lineHeight);
    }
  }, [selectedObject, letterSpacing, lineHeight]);

  // 背景状态
  const [backgroundStyle, setBackgroundStyle] = useState<'none' | 'solid'>('none');
  const [backgroundColor, setBackgroundColor] = useState('#FFE066');
  const [backgroundOpacity, setBackgroundOpacity] = useState(0.5);
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
  const loadFont = async (font: FontConfig) => {
    if (loadedFonts.has(font.family) || loadingFonts.has(font.family)) {
      return;
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

  const handleFontClick = (font: FontConfig) => {
    loadFont(font);
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
      const textObj = (selectedObject as any)._objects?.find((o: any) => o.type === 'i-text');
      return textObj?.[property] || defaultValue;
    }

    return selectedObject[property] || defaultValue;
  };

  const currentFont = getCurrentProperty('fontFamily', selectedFont);
  const currentColor = getCurrentProperty('fill', textColor);

  // 判断字体是否是最近使用的
  const isRecentFont = (fontFamily: string) => {
    return recentFontFamilies.includes(fontFamily);
  };

  return (
    <aside
      className="flex flex-col overflow-y-auto bg-background"
      style={{ width: '360px', borderLeft: '1px solid hsl(var(--border))' }}
    >
      {/* 主 Tab 组：字体设置 / 对齐与间距 */}
      <Tabs value={activeMainTab} onValueChange={(value) => setActiveMainTab(value as any)} className="space-y-0">
        <TabsList className="w-full grid grid-cols-2">
          <TabsTrigger value="font">字体设置</TabsTrigger>
          <TabsTrigger value="spacing">对齐与间距</TabsTrigger>
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

          {/* 字体颜色 */}
          <div>
            <label className="text-sm font-semibold mb-3 block">字体颜色</label>
            <ColorPicker
              color={currentColor}
              onChange={onColorChange}
              disabled={!selectedObject}
            />
          </div>

          {/* 字号 */}
          <div>
            <label className="text-sm font-semibold mb-3 block">字号</label>
            <Input
              type="number"
              value={fontSize}
              onChange={(e) => onFontSizeChange(Number(e.target.value))}
              disabled={!selectedObject}
              className="w-full"
              min={12}
              max={200}
            />
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
                    onBackgroundChange?.('solid', color, backgroundOpacity);
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
                      const newOpacity = Math.max(0, Number((backgroundOpacity - 0.1).toFixed(1)));
                      setBackgroundOpacity(newOpacity);
                      if (backgroundStyle === 'solid') {
                        onBackgroundChange?.('solid', backgroundColor, newOpacity);
                      }
                    }}
                    disabled={!selectedObject || backgroundOpacity <= 0}
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </Button>
                  <div className="flex-1 text-center h-8 flex items-center justify-center">
                    <div className="text-base font-semibold tabular-nums">
                      {Math.round(backgroundOpacity * 100)}%
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 shrink-0 active:scale-95 transition-transform"
                    onClick={() => {
                      const newOpacity = Math.min(1, Number((backgroundOpacity + 0.1).toFixed(1)));
                      setBackgroundOpacity(newOpacity);
                      if (backgroundStyle === 'solid') {
                        onBackgroundChange?.('solid', backgroundColor, newOpacity);
                      }
                    }}
                    disabled={!selectedObject || backgroundOpacity >= 1}
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
                      onBackgroundChange?.('solid', color, backgroundOpacity);
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
                        onBackgroundChange?.('solid', color, backgroundOpacity);
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

