import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

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

  return `${QINIU_ACCESS_KEY}:${encodedSign}:${encodedPutPolicy}`;
}

export async function POST(request: NextRequest) {
  try {
    const { imageUrl, apiKey } = await request.json();

    if (!imageUrl) {
      return NextResponse.json(
        { error: '缺少图片 URL' },
        { status: 400 }
      );
    }

    if (!apiKey) {
      return NextResponse.json(
        { error: '缺少 Remove.bg API Key' },
        { status: 400 }
      );
    }

    console.log('🎨 开始去除背景:', imageUrl);

    // 1. 调用 Remove.bg API
    const formData = new FormData();
    formData.append('image_url', imageUrl);
    formData.append('size', 'auto');

    const removeBgResponse = await fetch('https://api.remove.bg/v1.0/removebg', {
      method: 'POST',
      headers: {
        'X-API-Key': apiKey,
      },
      body: formData,
    });

    if (!removeBgResponse.ok) {
      const errorText = await removeBgResponse.text();
      console.error('❌ Remove.bg API 失败:', errorText);
      
      // 解析错误信息
      try {
        const errorJson = JSON.parse(errorText);
        return NextResponse.json(
          { error: errorJson.errors?.[0]?.title || 'Remove.bg API 调用失败' },
          { status: removeBgResponse.status }
        );
      } catch {
        return NextResponse.json(
          { error: `Remove.bg API 调用失败: ${removeBgResponse.status}` },
          { status: removeBgResponse.status }
        );
      }
    }

    console.log('✅ 背景去除成功');

    // 2. 获取去背景后的图片
    const imageBuffer = await removeBgResponse.arrayBuffer();
    console.log('✅ 图片下载成功，大小:', (imageBuffer.byteLength / 1024).toFixed(2), 'KB');

    // 3. 上传到七牛云
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 15);
    const key = `${QINIU_STORAGE_PATH}/no-bg-${timestamp}-${randomStr}.png`;
    const token = generateUploadToken(key);

    console.log('📤 开始上传到七牛云...', { key });

    const uploadFormData = new FormData();
    uploadFormData.append('token', token);
    uploadFormData.append('key', key);
    uploadFormData.append('x:name', 'no-bg.png');
    uploadFormData.append('file', new Blob([imageBuffer], { type: 'image/png' }));

    const uploadResponse = await fetch(QINIU_UPLOAD_URL, {
      method: 'POST',
      body: uploadFormData,
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
      success: true,
      url: qiniuUrl,
    });
  } catch (error) {
    console.error('❌ 去背景处理失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}

