// 画布容器
'use client';

import { useEffect, useState, RefObject } from 'react';
import { CanvasSize } from '@/lib/types';
import { ZoomIn, ZoomOut } from 'lucide-react';

interface CanvasProps {
  canvasRef: RefObject<HTMLCanvasElement>;
  canvasSize: CanvasSize;
  userZoom?: number; // 用户手动缩放（50-200）
  onScaleChange?: (scale: number) => void;
}

export default function Canvas({
  canvasRef,
  canvasSize,
  userZoom = 100,
  onScaleChange,
}: CanvasProps) {
  const [autoScale, setAutoScale] = useState(1);

  // 计算自动缩放比例（移除最大值限制，允许缩小显示大画布）
  useEffect(() => {
    const updateScale = () => {
      const container = document.getElementById('canvas-container');
      if (!container) return;

      const containerWidth = container.clientWidth - 80; // 增加边距
      const containerHeight = container.clientHeight - 120; // 增加边距（考虑缩放控制条）

      const scaleByWidth = containerWidth / canvasSize.width;
      const scaleByHeight = containerHeight / canvasSize.height;
      // 移除 Math.min(..., 1) 限制，允许画布自动缩小以适应容器
      const newAutoScale = Math.min(scaleByWidth, scaleByHeight);

      setAutoScale(newAutoScale);
    };

    // 立即执行一次
    updateScale();

    // 监听窗口大小变化
    window.addEventListener('resize', updateScale);

    // 使用 setTimeout 确保在画布尺寸改变后重新计算
    const timer = setTimeout(updateScale, 100);

    return () => {
      window.removeEventListener('resize', updateScale);
      clearTimeout(timer);
    };
  }, [canvasSize]);

  // 通知父组件缩放变化
  useEffect(() => {
    const finalScale = (autoScale * userZoom) / 100;
    onScaleChange?.(finalScale);
  }, [autoScale, userZoom, onScaleChange]);

  const finalScale = (autoScale * userZoom) / 100;

  return (
    <div
      id="canvas-container"
      className="flex-1 flex flex-col items-center justify-center relative"
      style={{ backgroundColor: '#F7F8FA' }}
    >
      {/* 画布容器（带边框和阴影） */}
      <div
        style={{
          width: `${canvasSize.width * finalScale}px`,
          height: `${canvasSize.height * finalScale}px`,
          borderRadius: '4px',
          border: '1px solid hsl(var(--border-medium))',
          boxShadow: '0 10px 40px rgba(0,0,0,0.1)',
          backgroundColor: '#fff',
          overflow: 'hidden',
          transition: 'all 0.2s ease-out',
        }}
      >
        {/* 画布（缩放） */}
        <div
          style={{
            transform: `scale(${finalScale})`,
            transformOrigin: 'top left',
            width: `${canvasSize.width}px`,
            height: `${canvasSize.height}px`,
          }}
        >
          <canvas
            ref={canvasRef}
            style={{
              display: 'block',
              width: `${canvasSize.width}px`,
              height: `${canvasSize.height}px`,
            }}
          />
        </div>
      </div>

    </div>
  );
}

