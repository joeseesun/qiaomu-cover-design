import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

const API_KEY = 'b2310e59-c88f-4ea1-866c-5af25a1316df';
const API_URL = 'https://ark.cn-beijing.volces.com/api/v3/images/generations';
const MODEL = 'ep-20250916145609-9bqzl';

// 七牛云配置
const QINIU_ACCESS_KEY = 'p5en81L6k53PkgCQywYK9vX9BJLnJqrtmvBXkFaW';
const QINIU_SECRET_KEY = 'qV4m6r47s9okI7PEjCyrG6xMKtr9hmJMz1z4ZHEk';
const QINIU_BUCKET = 'joemarkdown';
const QINIU_UPLOAD_URL = 'https://upload.qiniup.com';
const QINIU_DOMAIN = 'https://newimg.t5t6.com';

// Base64 URL 安全编码（不移除 = 号，与前端保持一致）
function base64urlEscape(str: string): string {
  return str.replace(/\+/g, '-').replace(/\//g, '_');
}

// 生成七牛云上传 Token
function generateUploadToken(key: string): string {
  const deadline = Math.floor(Date.now() / 1000) + 3600;
  const putPolicy = {
    scope: `${QINIU_BUCKET}:${key}`,
    deadline: deadline,
    returnBody: '{"key":"$(key)","hash":"$(etag)","fsize":$(fsize),"bucket":"$(bucket)","name":"$(x:name)"}'
  };

  const policyStr = JSON.stringify(putPolicy);
  const encodedPutPolicy = base64urlEscape(
    Buffer.from(policyStr).toString('base64')
  );

  const sign = crypto
    .createHmac('sha1', QINIU_SECRET_KEY)
    .update(encodedPutPolicy)
    .digest('base64');
  const encodedSign = base64urlEscape(sign);

  const token = `${QINIU_ACCESS_KEY}:${encodedSign}:${encodedPutPolicy}`;

  console.log('🔑 生成上传 Token:', {
    key,
    deadline: new Date(deadline * 1000).toISOString(),
    token: token.substring(0, 50) + '...',
  });

  return token;
}

export async function POST(request: NextRequest) {
  try {
    const { prompt, size = '1024x1024' } = await request.json();

    if (!prompt) {
      return NextResponse.json(
        { error: '缺少提示词' },
        { status: 400 }
      );
    }

    console.log('🎨 后端开始调用 AI 生图 API...', { prompt, size });

    // 1. 调用 AI 生图 API
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
        size: size,
        stream: false,
        watermark: false,
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

    if (!result.data || !result.data[0] || !result.data[0].url) {
      console.error('❌ AI API 返回数据格式错误:', result);
      return NextResponse.json(
        { error: '返回数据中没有图片 URL' },
        { status: 500 }
      );
    }

    const aiImageUrl = result.data[0].url;
    console.log('✅ AI 生图成功:', aiImageUrl);

    // 2. 下载 AI 生成的图片
    console.log('📥 开始下载 AI 生成的图片...');
    const imageResponse = await fetch(aiImageUrl);
    if (!imageResponse.ok) {
      throw new Error(`下载图片失败: ${imageResponse.statusText}`);
    }

    const imageBuffer = await imageResponse.arrayBuffer();
    console.log('✅ 图片下载成功，大小:', (imageBuffer.byteLength / 1024).toFixed(2), 'KB');

    // 3. 上传到七牛云
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 15);
    const key = `ai-images/${timestamp}-${randomStr}.jpg`;
    const token = generateUploadToken(key);

    console.log('📤 开始上传到七牛云...', { key });

    const formData = new FormData();
    formData.append('token', token);
    formData.append('key', key);
    formData.append('x:name', 'ai-generated.jpg');
    formData.append('file', new Blob([imageBuffer], { type: 'image/jpeg' }));

    const uploadResponse = await fetch(QINIU_UPLOAD_URL, {
      method: 'POST',
      body: formData,
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error('❌ 七牛云上传失败:', errorText);
      throw new Error(`七牛云上传失败: ${errorText}`);
    }

    const uploadResult = await uploadResponse.json();
    const qiniuUrl = `${QINIU_DOMAIN}/${uploadResult.key}`;
    console.log('✅ 上传到七牛云成功:', qiniuUrl);

    // 返回七牛云 URL
    return NextResponse.json({
      data: [
        {
          url: qiniuUrl,
        }
      ]
    });
  } catch (error) {
    console.error('❌ 后端处理失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}

