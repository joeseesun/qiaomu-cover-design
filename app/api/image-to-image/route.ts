// 图片转图片API路由 - 代理火山引擎ARK API请求
import { NextRequest, NextResponse } from 'next/server';

const ARK_API_KEY = 'b2310e59-c88f-4ea1-866c-5af25a1316df';
const ARK_ENDPOINT = 'https://ark.cn-beijing.volces.com/api/v3/images/generations';
const ARK_MODEL = 'ep-20250916145609-9bqzl';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { prompt, image, size = '2K' } = body;

    if (!prompt) {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      );
    }

    if (!image) {
      return NextResponse.json(
        { error: 'Image is required' },
        { status: 400 }
      );
    }

    console.log('🎨 代理图片转换请求:', {
      prompt: prompt.substring(0, 50) + '...',
      imageCount: Array.isArray(image) ? image.length : 1,
      size,
    });

    // 调用火山引擎API
    const response = await fetch(ARK_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ARK_API_KEY}`,
      },
      body: JSON.stringify({
        model: ARK_MODEL,
        prompt,
        image,
        sequential_image_generation: 'disabled',
        response_format: 'url',
        size,
        stream: false,
        watermark: false,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ 火山引擎API错误:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText,
      });
      return NextResponse.json(
        { error: `API请求失败: ${response.status} ${errorText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    console.log('✅ 图片生成成功:', data);

    return NextResponse.json(data);
  } catch (error) {
    console.error('❌ 图片转换API错误:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

