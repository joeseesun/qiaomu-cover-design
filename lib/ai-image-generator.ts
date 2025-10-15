// AI 生图服务
export class AIImageGenerator {
  private apiKey = 'b2310e59-c88f-4ea1-866c-5af25a1316df';
  private apiUrl = 'https://ark.cn-beijing.volces.com/api/v3/images/generations';
  private model = 'ep-20250916145609-9bqzl';

  // 生成图片
  async generateImage(prompt: string): Promise<string> {
    try {
      console.log('🎨 开始生成图片...', { prompt });

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
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
        console.error('❌ 生成图片失败:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText,
        });
        throw new Error(`生成图片失败 (${response.status}): ${errorText || response.statusText}`);
      }

      const result = await response.json();
      
      // 提取图片 URL
      if (result.data && result.data.length > 0 && result.data[0].url) {
        const imageUrl = result.data[0].url;
        console.log('✅ 图片生成成功:', imageUrl);
        return imageUrl;
      } else {
        throw new Error('返回数据中没有图片 URL');
      }
    } catch (error) {
      console.error('❌ AI 生图失败:', error);
      throw error;
    }
  }
}

