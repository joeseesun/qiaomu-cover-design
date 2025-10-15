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
  onUserZoomChange?: (zoom: number) => void; // 新增：通知父组件用户缩放变化
}

export default function Canvas({
  canvasRef,
  canvasSize,
  userZoom = 100,
  onScaleChange,
  onUserZoomChange,
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

  // 双指缩放（触控板手势）
  useEffect(() => {
    const container = document.getElementById('canvas-container');
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      // 检测是否是触控板双指缩放手势（ctrlKey 为 true）
      if (e.ctrlKey) {
        e.preventDefault();

        // 触控板双指缩放手势：
        // - 双指分开(放大): deltaY < 0
        // - 双指合拢(缩小): deltaY > 0
        // 因此需要取反: zoomChange = -deltaY
        const zoomSpeed = 0.3;
        const zoomChange = -e.deltaY * zoomSpeed;

        // 计算新的缩放值（限制在 50-200 之间）
        const newZoom = Math.min(200, Math.max(50, userZoom + zoomChange));

        // 通知父组件更新缩放
        onUserZoomChange?.(newZoom);
      }
    };

    // 添加事件监听器，使用 passive: false 以允许 preventDefault
    container.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, [userZoom, onUserZoomChange]);

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

