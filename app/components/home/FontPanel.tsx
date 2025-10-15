// 字体面板
'use client';

import { useState, useEffect } from 'react';
import { FONTS, HIGHLIGHT_COLORS, FontConfig } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Loader2, Highlighter, Underline, Square, ChevronLeft, ChevronRight } from 'lucide-react';
import ColorPicker from './ColorPicker';

interface FontPanelProps {
  selectedFont: string;
  fontSize: number;
  textColor: string;
  selectedObject: any;
  onFontChange: (fontFamily: string) => void;
  onFontSizeChange: (size: number) => void;
  onColorChange: (color: string) => void;
  onHighlight: (type: 'marker' | 'underline' | 'box', color: string) => void;
}

const RECENT_FONTS_KEY = 'xhs_recent_fonts';
const MAX_RECENT_FONTS = 6;

export default function FontPanel({
  selectedFont,
  fontSize,
  textColor,
  selectedObject,
  onFontChange,
  onFontSizeChange,
  onColorChange,
  onHighlight,
}: FontPanelProps) {
  const [loadingFonts, setLoadingFonts] = useState<Set<string>>(new Set());
  const [loadedFonts, setLoadedFonts] = useState<Set<string>>(
    new Set(['Noto Sans SC', 'Noto Serif SC', 'Arial, sans-serif'])
  );
  const [recentFonts, setRecentFonts] = useState<FontConfig[]>([]);
  const [showAllFonts, setShowAllFonts] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);

  // 加载最近使用的字体
  useEffect(() => {
    const stored = localStorage.getItem(RECENT_FONTS_KEY);
    if (stored) {
      try {
        const fontFamilies = JSON.parse(stored) as string[];
        const fonts = fontFamilies
          .map((family) => FONTS.find((f) => f.family === family))
          .filter((f): f is FontConfig => f !== undefined);
        setRecentFonts(fonts);
      } catch (error) {
        console.error('Failed to load recent fonts:', error);
      }
    }
    // 如果没有最近使用的字体，使用前 6 个
    if (!stored || recentFonts.length === 0) {
      setRecentFonts(FONTS.slice(0, MAX_RECENT_FONTS));
    }
  }, []);

  // 添加到最近使用
  const addToRecent = (font: FontConfig) => {
    setRecentFonts((prev) => {
      const filtered = prev.filter((f) => f.family !== font.family);
      const updated = [font, ...filtered].slice(0, MAX_RECENT_FONTS);
      localStorage.setItem(
        RECENT_FONTS_KEY,
        JSON.stringify(updated.map((f) => f.family))
      );
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
  const paginatedFonts = FONTS.slice(
    currentPage * fontsPerPage,
    (currentPage + 1) * fontsPerPage
  );

  const handlePrevPage = () => {
    setCurrentPage((prev) => Math.max(0, prev - 1));
  };

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(totalPages - 1, prev + 1));
  };

  // 获取当前显示的字体列表
  const displayFonts = showAllFonts ? paginatedFonts : recentFonts;

  // 获取当前选中对象的字体和颜色
  const currentFont = selectedObject?.fontFamily || selectedFont;
  const currentColor = selectedObject?.fill || textColor;

  return (
    <aside
      className="flex flex-col overflow-y-auto bg-background"
      style={{ width: '360px', borderLeft: '1px solid hsl(var(--border))' }}
    >
      {/* 字体网格 */}
      <div className="px-8 py-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-sm font-semibold">
            {showAllFonts ? '所有字体' : '最近使用'}
          </h3>
          <button
            onClick={() => {
              setShowAllFonts(!showAllFonts);
              setCurrentPage(0);
            }}
            className="text-xs text-primary hover:underline"
          >
            {showAllFonts ? '显示最近' : '显示全部'}
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {displayFonts.map((font) => {
            const isSelected = currentFont === font.family;
            const isLoading = loadingFonts.has(font.family);
            const isLoaded = loadedFonts.has(font.family);

            return (
              <button
                key={font.family}
                onClick={() => handleFontClick(font)}
                className={`h-24 flex flex-col items-center justify-center p-3 rounded-md border-2 transition-all hover:border-primary ${
                  isSelected
                    ? 'border-primary bg-primary/5'
                    : 'border-border bg-background'
                }`}
              >
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
        {showAllFonts && totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 mt-5">
            <button
              onClick={handlePrevPage}
              disabled={currentPage === 0}
              className="p-1 rounded hover:bg-accent transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-1.5">
              {Array.from({ length: totalPages }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentPage(i)}
                  className={`w-2 h-2 rounded-full transition-all ${
                    i === currentPage
                      ? 'bg-primary w-6'
                      : 'bg-border hover:bg-primary/50'
                  }`}
                />
              ))}
            </div>
            <button
              onClick={handleNextPage}
              disabled={currentPage === totalPages - 1}
              className="p-1 rounded hover:bg-accent transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        )}
      </div>

      <Separator />

      {/* 文字属性 */}
      {selectedObject && (
        <>
          <div className="px-8 py-6 space-y-6">
            <h3 className="text-sm font-semibold mb-1">文字属性</h3>

            {/* 颜色 */}
            <div className="space-y-3">
              <label className="text-sm font-medium">文字颜色</label>
              <ColorPicker
                color={currentColor}
                onChange={onColorChange}
              />
            </div>
          </div>

          <Separator />

          {/* 高亮样式 */}
          <div className="px-8 py-6 space-y-6">
            <h3 className="text-sm font-semibold mb-1">高亮样式</h3>

            {/* 样式按钮 */}
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 h-12"
                onClick={() => onHighlight('marker', HIGHLIGHT_COLORS[0])}
                title="荧光笔"
              >
                <Highlighter className="h-5 w-5" />
              </Button>
              <Button
                variant="outline"
                className="flex-1 h-12"
                onClick={() => onHighlight('underline', HIGHLIGHT_COLORS[0])}
                title="下划线"
              >
                <Underline className="h-5 w-5" />
              </Button>
              <Button
                variant="outline"
                className="flex-1 h-12"
                onClick={() => onHighlight('box', HIGHLIGHT_COLORS[0])}
                title="边框"
              >
                <Square className="h-5 w-5" />
              </Button>
            </div>

            {/* 颜色选择 */}
            <div className="flex gap-3 flex-wrap">
              {HIGHLIGHT_COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => onHighlight('marker', color)}
                  className="w-12 h-12 rounded-md border-2 transition-all hover:scale-110"
                  style={{
                    backgroundColor: color,
                  }}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </aside>
  );
}

