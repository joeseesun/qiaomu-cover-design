// 七牛云上传工具
import CryptoJS from 'crypto-js';

export class QiniuUploader {
  private accessKey = 'p5en81L6k53PkgCQywYK9vX9BJLnJqrtmvBXkFaW';
  private secretKey = 'qV4m6r47s9okI7PEjCyrG6xMKtr9hmJMz1z4ZHEk';
  private bucket = 'joemarkdown';
  private domain = 'https://img.t5t6.com'; // 访问域名
  private uploadUrl = 'https://up.qiniup.com'; // 华东区域上传地址

  // 生成上传 token
  private generateUploadToken(key?: string): string {
    const putPolicy = {
      scope: key ? `${this.bucket}:${key}` : this.bucket,
      deadline: Math.floor(Date.now() / 1000) + 3600, // 1小时后过期
    };

    // 1. 将 putPolicy 转为 JSON 字符串，然后 Base64 编码（URL 安全）
    const policyStr = JSON.stringify(putPolicy);
    const encodedPutPolicy = this.urlSafeBase64Encode(policyStr);

    // 2. 使用 HMAC-SHA1 对 encodedPutPolicy 签名，然后 Base64 编码（URL 安全）
    const sign = CryptoJS.HmacSHA1(encodedPutPolicy, this.secretKey);
    const signBase64 = CryptoJS.enc.Base64.stringify(sign);
    const encodedSign = signBase64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    // 3. 拼接 token: AccessKey:EncodedSign:EncodedPutPolicy
    const uploadToken = `${this.accessKey}:${encodedSign}:${encodedPutPolicy}`;

    console.log('🔑 生成上传 Token:', {
      putPolicy,
      encodedPutPolicy: encodedPutPolicy.substring(0, 30) + '...',
      encodedSign: encodedSign.substring(0, 20) + '...',
    });

    return uploadToken;
  }

  // URL 安全的 Base64 编码
  private urlSafeBase64Encode(str: string): string {
    const wordArray = CryptoJS.enc.Utf8.parse(str);
    const base64 = CryptoJS.enc.Base64.stringify(wordArray);
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  // 生成唯一文件名
  private generateFileName(file: File): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    const ext = file.name.split('.').pop() || 'jpg';
    return `xhs-cover/${timestamp}-${random}.${ext}`;
  }

  // 上传文件到七牛云
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

      const formData = new FormData();
      formData.append('token', token);
      formData.append('key', key);
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
}

