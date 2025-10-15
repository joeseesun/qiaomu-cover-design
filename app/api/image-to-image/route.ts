// 图片转图片API路由 - 代理火山引擎ARK API请求并转存到七牛云
import { NextRequest, NextResponse } from 'next/server';
import CryptoJS from 'crypto-js';

const ARK_API_KEY = 'b2310e59-c88f-4ea1-866c-5af25a1316df';
const ARK_ENDPOINT = 'https://ark.cn-beijing.volces.com/api/v3/images/generations';
const ARK_MODEL = 'ep-20250916145609-9bqzl';

// 七牛云配置
const QINIU_ACCESS_KEY = 'p5en81L6k53PkgCQywYK9vX9BJLnJqrtmvBXkFaW';
const QINIU_SECRET_KEY = 'qV4m6r47s9okI7PEjCyrG6xMKtr9hmJMz1z4ZHEk';
const QINIU_BUCKET = 'joemarkdown';
const QINIU_UPLOAD_URL = 'https://upload.qiniup.com';
const QINIU_DOMAIN = 'https://newimg.t5t6.com';
const QINIU_STORAGE_PATH = 'xhs-cover';

// Base64 URL 安全编码
function base64urlEscape(str: string): string {
  return str.replace(/\+/g, '-').replace(/\//g, '_');
}

// 生成七牛云上传Token
function generateUploadToken(key: string, expires = 3600): string {
  const deadline = Math.floor(Date.now() / 1000) + expires;
  const putPolicy = {
    scope: `${QINIU_BUCKET}:${key}`,
    deadline: deadline,
    returnBody: '{"key":"$(key)","hash":"$(etag)","fsize":$(fsize),"bucket":"$(bucket)"}'
  };

  const policyStr = JSON.stringify(putPolicy);
  const encodedPutPolicy = base64urlEscape(
    CryptoJS.enc.Base64.stringify(CryptoJS.enc.Utf8.parse(policyStr))
  );

  const sign = CryptoJS.HmacSHA1(encodedPutPolicy, QINIU_SECRET_KEY);
  const encodedSign = base64urlEscape(CryptoJS.enc.Base64.stringify(sign));

  return `${QINIU_ACCESS_KEY}:${encodedSign}:${encodedPutPolicy}`;
}

// 下载图片并上传到七牛云
async function downloadAndUploadToQiniu(imageUrl: string): Promise<string> {
  try {
    console.log('📥 下载生成的图片:', imageUrl);

    // 下载图片
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`下载图片失败: ${response.status}`);
    }

    const blob = await response.blob();

    // 生成文件名
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    const key = `${QINIU_STORAGE_PATH}/ai-generated-${timestamp}-${random}.jpg`;

    // 生成上传Token
    const token = generateUploadToken(key);

    // 上传到七牛云
    const formData = new FormData();
    formData.append('token', token);
    formData.append('key', key);
    formData.append('file', blob);

    console.log('📤 上传到七牛云:', key);

    const uploadResponse = await fetch(QINIU_UPLOAD_URL, {
      method: 'POST',
      body: formData,
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      throw new Error(`上传到七牛云失败: ${uploadResponse.status} ${errorText}`);
    }

    const result = await uploadResponse.json();
    const qiniuUrl = `${QINIU_DOMAIN}/${result.key}`;

    console.log('✅ 图片已转存到七牛云:', qiniuUrl);

    return qiniuUrl;
  } catch (error) {
    console.error('❌ 转存图片失败:', error);
    throw error;
  }
}

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

    // 检查返回数据格式
    if (!data.data || !data.data[0] || !data.data[0].url) {
      return NextResponse.json(
        { error: 'API返回数据格式错误' },
        { status: 500 }
      );
    }

    // 下载图片并上传到七牛云
    const originalUrl = data.data[0].url;
    const qiniuUrl = await downloadAndUploadToQiniu(originalUrl);

    // 返回七牛云URL
    return NextResponse.json({
      data: [{
        url: qiniuUrl,
        original_url: originalUrl,
      }]
    });
  } catch (error) {
    console.error('❌ 图片转换API错误:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

