// 字体面板
'use client';

import { useState, useEffect } from 'react';
import { FONTS, FontConfig } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Loader2, ChevronLeft, ChevronRight, Minus, Plus } from 'lucide-react';
import ColorPicker from './ColorPicker';

// 预设颜色
const PRESET_COLORS = [
  '#FFE066', '#FFB84D', '#FF9999', '#FF6B9D', '#C77DFF', '#9D84FF',
  '#7DD3FC', '#67E8F9', '#6EE7B7', '#A7F3D0', '#FDE047', '#FCA5A5',
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
  // 背景
  onBackgroundChange?: (style: 'none' | 'solid' | 'gradient', color?: string) => void;
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
  const [lineHeightInput, setLineHeightInput] = useState('');
  const [letterSpacingInput, setLetterSpacingInput] = useState('');

  // 背景状态
  const [backgroundStyle, setBackgroundStyle] = useState<'none' | 'solid' | 'gradient'>('none');
  const [backgroundColor, setBackgroundColor] = useState('#FFE066');

  // 下划线状态
  const [underlineStyle, setUnderlineStyle] = useState<'none' | 'solid' | 'wavy' | 'dotted'>('none');
  const [underlineWidth, setUnderlineWidth] = useState(2);
  const [underlineColor, setUnderlineColor] = useState('#FF2442');

  // 边框状态
  const [borderStyle, setBorderStyle] = useState<'none' | 'solid' | 'dashed'>('none');
  const [borderWidth, setBorderWidth] = useState(2);
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
  }, []);

  // 同步输入框的值
  useEffect(() => {
    if (selectedObject) {
      setLineHeightInput((selectedObject.lineHeight || lineHeight).toFixed(1));
      setLetterSpacingInput(String(Math.round(selectedObject.charSpacing || letterSpacing)));
    } else {
      setLineHeightInput(lineHeight.toFixed(1));
      setLetterSpacingInput(String(letterSpacing));
    }
  }, [selectedObject, lineHeight, letterSpacing]);

  // 添加到最近使用
  const addToRecent = (font: FontConfig) => {
    setRecentFontFamilies((prev) => {
      const filtered = prev.filter((f) => f !== font.family);
      const updated = [font.family, ...filtered].slice(0, MAX_RECENT_FONTS);
      localStorage.setItem(RECENT_FONTS_KEY, JSON.stringify(updated));
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

  // 计算分页
  const fontsPerPage = 6;
  const totalPages = Math.ceil(FONTS.length / fontsPerPage);
  const displayFonts = FONTS.slice(
    currentPage * fontsPerPage,
    (currentPage + 1) * fontsPerPage
  );

  const handlePrevPage = () => {
    setCurrentPage((prev) => Math.max(0, prev - 1));
  };

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(totalPages - 1, prev + 1));
  };

  // 获取当前选中对象的字体和颜色
  const currentFont = selectedObject?.fontFamily || selectedFont;
  const currentColor = selectedObject?.fill || textColor;

  // 判断字体是否是最近使用的
  const isRecentFont = (fontFamily: string) => {
    return recentFontFamilies.includes(fontFamily);
  };

  return (
    <aside
      className="flex flex-col overflow-y-auto bg-background"
      style={{ width: '360px', borderLeft: '1px solid hsl(var(--border))' }}
    >
      {/* 字体网格 */}
      <div className="px-8 py-6">
        <h3 className="text-sm font-semibold mb-5">字体</h3>

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
                {/* 最近使用标记（蓝色小点） */}
                {isRecent && (
                  <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-blue-500" />
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
          <div className="flex items-center justify-center gap-4 mt-5">
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

      <Separator />

      {/* 文字属性 */}
      <div className="px-8 py-6 space-y-6">
        {/* 颜色 */}
        <div className="space-y-3">
          <label className="text-sm font-medium">文字颜色</label>
          <ColorPicker
            color={currentColor}
            onChange={onColorChange}
          />
        </div>

        {/* 行间距 */}
        <div className="space-y-2">
          <label className="text-sm font-medium">行间距</label>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (!selectedObject) return;
                const current = selectedObject.lineHeight || lineHeight;
                const newValue = Math.max(0.5, Number((current - 0.1).toFixed(1)));
                onLineHeightChange?.(newValue);
              }}
              disabled={!selectedObject}
              className="p-1.5 rounded border border-input hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <Input
              type="text"
              value={lineHeightInput}
              onChange={(e) => {
                const input = e.target.value;
                setLineHeightInput(input);

                // 只有在输入有效数字时才更新
                const value = parseFloat(input);
                if (!isNaN(value) && value >= 0.5 && value <= 5) {
                  onLineHeightChange?.(value);
                }
              }}
              onBlur={() => {
                // 失焦时验证并修正值
                const value = parseFloat(lineHeightInput);
                if (isNaN(value) || value < 0.5) {
                  const corrected = 0.5;
                  setLineHeightInput(corrected.toFixed(1));
                  onLineHeightChange?.(corrected);
                } else if (value > 5) {
                  const corrected = 5;
                  setLineHeightInput(corrected.toFixed(1));
                  onLineHeightChange?.(corrected);
                } else {
                  setLineHeightInput(value.toFixed(1));
                }
              }}
              disabled={!selectedObject}
              className="h-9 text-center"
            />
            <button
              onClick={() => {
                if (!selectedObject) return;
                const current = selectedObject.lineHeight || lineHeight;
                const newValue = Math.min(5, Number((current + 0.1).toFixed(1)));
                onLineHeightChange?.(newValue);
              }}
              disabled={!selectedObject}
              className="p-1.5 rounded border border-input hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* 字间距 */}
        <div className="space-y-2">
          <label className="text-sm font-medium">字间距</label>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (!selectedObject) return;
                const current = selectedObject.charSpacing || letterSpacing;
                const newValue = Math.max(-500, current - 10);
                onLetterSpacingChange?.(newValue);
              }}
              disabled={!selectedObject}
              className="p-1.5 rounded border border-input hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <Input
              type="text"
              value={letterSpacingInput}
              onChange={(e) => {
                const input = e.target.value;
                setLetterSpacingInput(input);

                // 只有在输入有效数字时才更新
                const value = parseInt(input);
                if (!isNaN(value) && value >= -500 && value <= 1000) {
                  onLetterSpacingChange?.(value);
                }
              }}
              onBlur={() => {
                // 失焦时验证并修正值
                const value = parseInt(letterSpacingInput);
                if (isNaN(value) || value < -500) {
                  const corrected = -500;
                  setLetterSpacingInput(String(corrected));
                  onLetterSpacingChange?.(corrected);
                } else if (value > 1000) {
                  const corrected = 1000;
                  setLetterSpacingInput(String(corrected));
                  onLetterSpacingChange?.(corrected);
                } else {
                  setLetterSpacingInput(String(value));
                }
              }}
              disabled={!selectedObject}
              className="h-9 text-center"
            />
            <button
              onClick={() => {
                if (!selectedObject) return;
                const current = selectedObject.charSpacing || letterSpacing;
                const newValue = Math.min(1000, current + 10);
                onLetterSpacingChange?.(newValue);
              }}
              disabled={!selectedObject}
              className="p-1.5 rounded border border-input hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      <Separator />

      {/* 背景 */}
      <div className="px-8 py-6 space-y-4">
        <h3 className="text-sm font-semibold">背景</h3>

        {/* 样式选择 */}
        <div className="flex gap-2">
          <Button
            variant={backgroundStyle === 'none' ? 'default' : 'outline'}
            size="sm"
            className="flex-1"
            onClick={() => {
              setBackgroundStyle('none');
              onBackgroundChange?.('none');
            }}
            disabled={!selectedObject}
          >
            无
          </Button>
          <Button
            variant={backgroundStyle === 'solid' ? 'default' : 'outline'}
            size="sm"
            className="flex-1"
            onClick={() => {
              setBackgroundStyle('solid');
              onBackgroundChange?.('solid', backgroundColor);
            }}
            disabled={!selectedObject}
          >
            纯色
          </Button>
          <Button
            variant={backgroundStyle === 'gradient' ? 'default' : 'outline'}
            size="sm"
            className="flex-1"
            onClick={() => {
              setBackgroundStyle('gradient');
              onBackgroundChange?.('gradient', backgroundColor);
            }}
            disabled={!selectedObject}
          >
            渐变
          </Button>
        </div>

        {/* 颜色选择 */}
        {backgroundStyle !== 'none' && (
          <div className="space-y-3">
            <label className="text-xs text-muted-foreground">颜色</label>
            <div className="grid grid-cols-6 gap-2">
              {PRESET_COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => {
                    setBackgroundColor(color);
                    onBackgroundChange?.(backgroundStyle, color);
                  }}
                  disabled={!selectedObject}
                  className={`w-full aspect-square rounded border transition-all hover:scale-110 ${
                    backgroundColor === color
                      ? 'border-primary ring-2 ring-primary/20'
                      : 'border-border/30'
                  }`}
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
            <ColorPicker
              color={backgroundColor}
              onChange={(color) => {
                setBackgroundColor(color);
                onBackgroundChange?.(backgroundStyle, color);
              }}
              disabled={!selectedObject}
            />
          </div>
        )}
      </div>

      <Separator />

      {/* 下划线 */}
      <div className="px-8 py-6 space-y-4">
        <h3 className="text-sm font-semibold">下划线</h3>

        {/* 样式选择 */}
        <div className="grid grid-cols-4 gap-2">
          <Button
            variant={underlineStyle === 'none' ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              setUnderlineStyle('none');
              onUnderlineChange?.('none');
            }}
            disabled={!selectedObject}
          >
            无
          </Button>
          <Button
            variant={underlineStyle === 'solid' ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              setUnderlineStyle('solid');
              onUnderlineChange?.('solid', underlineWidth, underlineColor);
            }}
            disabled={!selectedObject}
          >
            直线
          </Button>
          <Button
            variant={underlineStyle === 'wavy' ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              setUnderlineStyle('wavy');
              onUnderlineChange?.('wavy', underlineWidth, underlineColor);
            }}
            disabled={!selectedObject}
          >
            波浪
          </Button>
          <Button
            variant={underlineStyle === 'dotted' ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              setUnderlineStyle('dotted');
              onUnderlineChange?.('dotted', underlineWidth, underlineColor);
            }}
            disabled={!selectedObject}
          >
            点线
          </Button>
        </div>

        {/* 粗细和颜色 */}
        {underlineStyle !== 'none' && (
          <div className="space-y-4">
            {/* 粗细 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs text-muted-foreground">粗细</label>
                <span className="text-xs text-muted-foreground">{underlineWidth}px</span>
              </div>
              <Slider
                value={[underlineWidth]}
                onValueChange={(value) => {
                  setUnderlineWidth(value[0]);
                  onUnderlineChange?.(underlineStyle, value[0], underlineColor);
                }}
                min={1}
                max={10}
                step={1}
                disabled={!selectedObject}
              />
            </div>

            {/* 颜色 */}
            <div className="space-y-3">
              <label className="text-xs text-muted-foreground">颜色</label>
              <div className="grid grid-cols-6 gap-2">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => {
                      setUnderlineColor(color);
                      onUnderlineChange?.(underlineStyle, underlineWidth, color);
                    }}
                    disabled={!selectedObject}
                    className={`w-full aspect-square rounded border transition-all hover:scale-110 ${
                      underlineColor === color
                        ? 'border-primary ring-2 ring-primary/20'
                        : 'border-border/30'
                    }`}
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
              </div>
              <ColorPicker
                color={underlineColor}
                onChange={(color) => {
                  setUnderlineColor(color);
                  onUnderlineChange?.(underlineStyle, underlineWidth, color);
                }}
                disabled={!selectedObject}
              />
            </div>
          </div>
        )}
      </div>

      <Separator />

      {/* 边框 */}
      <div className="px-8 py-6 space-y-4">
        <h3 className="text-sm font-semibold">边框</h3>

        {/* 样式选择 */}
        <div className="flex gap-2">
          <Button
            variant={borderStyle === 'none' ? 'default' : 'outline'}
            size="sm"
            className="flex-1"
            onClick={() => {
              setBorderStyle('none');
              onBorderChange?.('none');
            }}
            disabled={!selectedObject}
          >
            无
          </Button>
          <Button
            variant={borderStyle === 'solid' ? 'default' : 'outline'}
            size="sm"
            className="flex-1"
            onClick={() => {
              setBorderStyle('solid');
              onBorderChange?.('solid', borderWidth, borderColor);
            }}
            disabled={!selectedObject}
          >
            实线
          </Button>
          <Button
            variant={borderStyle === 'dashed' ? 'default' : 'outline'}
            size="sm"
            className="flex-1"
            onClick={() => {
              setBorderStyle('dashed');
              onBorderChange?.('dashed', borderWidth, borderColor);
            }}
            disabled={!selectedObject}
          >
            虚线
          </Button>
        </div>

        {/* 粗细和颜色 */}
        {borderStyle !== 'none' && (
          <div className="space-y-4">
            {/* 粗细 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs text-muted-foreground">粗细</label>
                <span className="text-xs text-muted-foreground">{borderWidth}px</span>
              </div>
              <Slider
                value={[borderWidth]}
                onValueChange={(value) => {
                  setBorderWidth(value[0]);
                  onBorderChange?.(borderStyle, value[0], borderColor);
                }}
                min={1}
                max={10}
                step={1}
                disabled={!selectedObject}
              />
            </div>

            {/* 颜色 */}
            <div className="space-y-3">
              <label className="text-xs text-muted-foreground">颜色</label>
              <div className="grid grid-cols-6 gap-2">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => {
                      setBorderColor(color);
                      onBorderChange?.(borderStyle, borderWidth, color);
                    }}
                    disabled={!selectedObject}
                    className={`w-full aspect-square rounded border transition-all hover:scale-110 ${
                      borderColor === color
                        ? 'border-primary ring-2 ring-primary/20'
                        : 'border-border/30'
                    }`}
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
              </div>
              <ColorPicker
                color={borderColor}
                onChange={(color) => {
                  setBorderColor(color);
                  onBorderChange?.(borderStyle, borderWidth, color);
                }}
                disabled={!selectedObject}
              />
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

