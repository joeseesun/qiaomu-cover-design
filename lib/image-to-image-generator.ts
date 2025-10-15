// 图片转图片生成器 - 使用火山引擎 ARK API
export class ImageToImageGenerator {
  private apiKey: string;
  private endpoint: string;
  private model: string;

  constructor() {
    this.apiKey = 'b2310e59-c88f-4ea1-866c-5af25a1316df';
    this.endpoint = 'https://ark.cn-beijing.volces.com/api/v3/images/generations';
    this.model = 'ep-20250916145609-9bqzl';
  }

  /**
   * 生成图片 - 单张图片输入
   * @param prompt 提示词
   * @param imageUrl 输入图片URL
   * @param size 图片尺寸 (1K/2K/4K)
   * @returns 生成的图片URL
   */
  async generateFromSingleImage(
    prompt: string,
    imageUrl: string,
    size: '1K' | '2K' | '4K' = '2K'
  ): Promise<string> {
    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          prompt,
          image: imageUrl,
          sequential_image_generation: 'disabled',
          response_format: 'url',
          size,
          stream: false,
          watermark: false,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API请求失败: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      
      // 检查返回数据格式
      if (!data.data || !data.data[0] || !data.data[0].url) {
        throw new Error('API返回数据格式错误');
      }

      return data.data[0].url;
    } catch (error) {
      console.error('❌ 图片转换失败:', error);
      throw error;
    }
  }

  /**
   * 生成图片 - 多张图片输入
   * @param prompt 提示词
   * @param imageUrls 输入图片URL数组
   * @param size 图片尺寸 (1K/2K/4K)
   * @returns 生成的图片URL
   */
  async generateFromMultipleImages(
    prompt: string,
    imageUrls: string[],
    size: '1K' | '2K' | '4K' = '2K'
  ): Promise<string> {
    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          prompt,
          image: imageUrls,
          sequential_image_generation: 'disabled',
          response_format: 'url',
          size,
          stream: false,
          watermark: false,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API请求失败: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      
      // 检查返回数据格式
      if (!data.data || !data.data[0] || !data.data[0].url) {
        throw new Error('API返回数据格式错误');
      }

      return data.data[0].url;
    } catch (error) {
      console.error('❌ 图片转换失败:', error);
      throw error;
    }
  }
}

