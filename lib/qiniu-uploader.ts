// 七牛云上传工具（表单上传）
import CryptoJS from 'crypto-js';

export class QiniuUploader {
  private accessKey = 'p5en81L6k53PkgCQywYK9vX9BJLnJqrtmvBXkFaW';
  private secretKey = 'qV4m6r47s9okI7PEjCyrG6xMKtr9hmJMz1z4ZHEk';
  private bucket = 'joemarkdown';
  private uploadUrl = 'https://upload.qiniup.com'; // 使用 upload.qiniup.com
  private domain = 'https://newimg.t5t6.com'; // 访问域名
  private storagePath = 'xhs-cover'; // 存储路径

  // 生成唯一文件名
  private generateFileName(file: File): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    const ext = file.name.split('.').pop() || 'jpg';
    return `${this.storagePath}/${timestamp}-${random}.${ext}`;
  }

  // 生成上传 Token
  private generateUploadToken(key: string, expires = 3600): string {
    const deadline = Math.floor(Date.now() / 1000) + expires;

    const putPolicy = {
      scope: `${this.bucket}:${key}`,
      deadline: deadline,
      returnBody: '{"key":"$(key)","hash":"$(etag)","fsize":$(fsize),"bucket":"$(bucket)","name":"$(x:name)"}'
    };

    // 1. JSON 序列化并 Base64 编码
    const policyStr = JSON.stringify(putPolicy);
    const encodedPutPolicy = this.base64urlEscape(
      CryptoJS.enc.Base64.stringify(CryptoJS.enc.Utf8.parse(policyStr))
    );

    // 2. HMAC-SHA1 签名
    const sign = CryptoJS.HmacSHA1(encodedPutPolicy, this.secretKey);
    const encodedSign = this.base64urlEscape(CryptoJS.enc.Base64.stringify(sign));

    // 3. 拼接 Token
    const token = `${this.accessKey}:${encodedSign}:${encodedPutPolicy}`;

    console.log('🔑 生成上传 Token:', {
      putPolicy,
      deadline: new Date(deadline * 1000).toISOString(),
      token: token.substring(0, 50) + '...',
    });

    return token;
  }

  // Base64 URL 安全编码
  private base64urlEscape(str: string): string {
    return str.replace(/\+/g, '-').replace(/\//g, '_');
  }

  // 表单上传文件
  async uploadFile(file: File): Promise<string> {
    try {
      const key = this.generateFileName(file);
      const token = this.generateUploadToken(key);

      console.log('📤 上传参数:', {
        key,
        fileName: file.name,
        fileSize: `${(file.size / 1024).toFixed(2)} KB`,
        uploadUrl: this.uploadUrl,
      });

      // 构建 FormData
      const formData = new FormData();
      formData.append('token', token);
      formData.append('key', key);
      formData.append('x:name', file.name);
      formData.append('file', file);

      const response = await fetch(this.uploadUrl, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ 上传失败响应:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText,
        });
        throw new Error(`上传失败 (${response.status}): ${errorText || response.statusText}`);
      }

      const result = await response.json();
      const fileUrl = `${this.domain}/${result.key}`;

      console.log('✅ 图片上传成功:', fileUrl);
      return fileUrl;
    } catch (error) {
      console.error('❌ 图片上传失败:', error);
      throw error;
    }
  }

  // 上传 Blob（用于剪贴板图片）
  async uploadBlob(blob: Blob): Promise<string> {
    const file = new File([blob], 'clipboard-image.png', { type: blob.type });
    return this.uploadFile(file);
  }

  // 上传 Base64 编码的图片
  async uploadBase64(base64Data: string, fileName: string): Promise<string> {
    try {
      // 将 base64 转换为 Blob
      const byteString = atob(base64Data);
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
      }
      const blob = new Blob([ab], { type: 'image/png' });

      // 创建 File 对象
      const file = new File([blob], fileName, { type: 'image/png' });

      // 使用现有的 uploadFile 方法
      return this.uploadFile(file);
    } catch (error) {
      console.error('❌ Base64 图片上传失败:', error);
      throw error;
    }
  }
}

