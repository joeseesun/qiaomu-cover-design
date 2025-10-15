// 七牛云上传工具（使用 S3 兼容接口）
import CryptoJS from 'crypto-js';

export class QiniuUploader {
  private accessKey = 'p5en81L6k53PkgCQywYK9vX9BJLnJqrtmvBXkFaW';
  private secretKey = 'qV4m6r47s9okI7PEjCyrG6xMKtr9hmJMz1z4ZHEk';
  private bucket = 'joemarkdown';
  private region = 'cn-east-1';
  private endpoint = `https://${this.bucket}.s3.${this.region}.qiniucs.com`;
  private domain = 'https://img.t5t6.com'; // 访问域名

  // 生成唯一文件名
  private generateFileName(file: File): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    const ext = file.name.split('.').pop() || 'jpg';
    return `xhs-cover/${timestamp}-${random}.${ext}`;
  }

  // 使用 S3 兼容接口上传文件
  async uploadFile(file: File): Promise<string> {
    try {
      const key = this.generateFileName(file);
      const url = `${this.endpoint}/${key}`;
      const date = new Date().toUTCString();

      console.log('📤 上传参数 (S3):', {
        key,
        fileName: file.name,
        fileSize: `${(file.size / 1024).toFixed(2)} KB`,
        url,
      });

      // 生成 S3 签名
      const authorization = this.generateS3Authorization('PUT', key, file.type, date);

      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': file.type || 'application/octet-stream',
          'Date': date,
          'Authorization': authorization,
        },
        body: file,
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

      const fileUrl = `${this.domain}/${key}`;

      console.log('✅ 图片上传成功:', fileUrl);
      return fileUrl;
    } catch (error) {
      console.error('❌ 图片上传失败:', error);
      throw error;
    }
  }

  // 生成 S3 Authorization 头
  private generateS3Authorization(method: string, key: string, contentType: string, date: string): string {
    // S3 签名字符串格式：
    // HTTP-Verb + "\n" +
    // Content-MD5 + "\n" +
    // Content-Type + "\n" +
    // Date + "\n" +
    // CanonicalizedAmzHeaders +
    // CanonicalizedResource

    const stringToSign = [
      method,
      '', // Content-MD5 (可选)
      contentType || '',
      date,
      `/${this.bucket}/${key}`,
    ].join('\n');

    console.log('🔑 S3 签名字符串:', stringToSign);

    // HMAC-SHA1 签名
    const sign = CryptoJS.HmacSHA1(stringToSign, this.secretKey);
    const signBase64 = CryptoJS.enc.Base64.stringify(sign);

    const authorization = `QBox ${this.accessKey}:${signBase64}`;
    console.log('🔑 Authorization:', authorization);

    return authorization;
  }

  // 上传 Blob（用于剪贴板图片）
  async uploadBlob(blob: Blob): Promise<string> {
    const file = new File([blob], 'clipboard-image.png', { type: blob.type });
    return this.uploadFile(file);
  }
}

