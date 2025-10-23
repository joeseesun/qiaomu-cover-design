/**
 * 获取所有共享素材 API
 * GET /api/materials/public/list
 */

import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

export async function GET(request: NextRequest) {
  try {
    // 获取所有共享素材 ID
    const materialIds = await kv.smembers('material:public:list');

    if (!materialIds || materialIds.length === 0) {
      return NextResponse.json({
        success: true,
        materials: [],
      });
    }

    // 批量获取素材数据
    const materials = await Promise.all(
      materialIds.map(async (id) => {
        const material = await kv.get(`material:public:${id}`);
        return material;
      })
    );

    // 过滤掉 null 值（已过期的素材）
    const validMaterials = materials.filter((m) => m !== null);

    // 按创建时间倒序排序
    validMaterials.sort((a: any, b: any) => b.createdAt - a.createdAt);

    console.log('✅ 获取共享素材成功，数量:', validMaterials.length);

    return NextResponse.json({
      success: true,
      materials: validMaterials,
    });
  } catch (error) {
    console.error('❌ 获取共享素材失败:', error);
    return NextResponse.json(
      { success: false, message: '获取共享素材失败' },
      { status: 500 }
    );
  }
}

