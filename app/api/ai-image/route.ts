import { NextRequest, NextResponse } from 'next/server';

const API_KEY = 'b2310e59-c88f-4ea1-866c-5af25a1316df';
const API_URL = 'https://ark.cn-beijing.volces.com/api/v3/images/generations';
const MODEL = 'ep-20250916145609-9bqzl';

export async function POST(request: NextRequest) {
  try {
    const { prompt } = await request.json();

    if (!prompt) {
      return NextResponse.json(
        { error: '缺少提示词' },
        { status: 400 }
      );
    }

    console.log('🎨 后端开始调用 AI 生图 API...', { prompt });

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        prompt: prompt,
        sequential_image_generation: 'disabled',
        response_format: 'url',
        size: '2K',
        stream: false,
        watermark: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ AI API 返回错误:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText,
      });
      return NextResponse.json(
        { error: `AI API 错误 (${response.status}): ${errorText}` },
        { status: response.status }
      );
    }

    const result = await response.json();
    console.log('✅ AI 生图成功:', result);

    return NextResponse.json(result);
  } catch (error) {
    console.error('❌ 后端处理失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}

