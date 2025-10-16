// 快速提示词管理
const STORAGE_KEY = 'quick-prompts';

export interface QuickPrompt {
  id: string;
  text: string;
  createdAt: number;
}

// 默认提示词
const DEFAULT_PROMPTS: QuickPrompt[] = [
  {
    id: '1',
    text: '星际穿越,黑洞,黑洞里冲出一辆快支离破碎的复古列车,抢视觉冲击力,电影大片,末日既视感',
    createdAt: Date.now(),
  },
  {
    id: '2',
    text: '赛博朋克城市,霓虹灯,雨夜,未来感,科幻,高清,电影质感',
    createdAt: Date.now(),
  },
  {
    id: '3',
    text: '中国风,水墨画,山水,云雾缭绕,意境深远,古典美学',
    createdAt: Date.now(),
  },
  {
    id: '4',
    text: '宇宙星空,星云,璀璨星河,深邃,神秘,壮观',
    createdAt: Date.now(),
  },
];

export class QuickPromptsManager {
  private prompts: QuickPrompt[] = [];

  constructor() {
    this.loadFromStorage();
  }

  /**
   * 从localStorage加载
   */
  private loadFromStorage() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.prompts = JSON.parse(stored);
      } else {
        // 首次使用,加载默认提示词
        this.prompts = DEFAULT_PROMPTS;
        this.saveToStorage();
      }
    } catch (error) {
      console.error('❌ 快速提示词加载失败:', error);
      this.prompts = DEFAULT_PROMPTS;
    }
  }

  /**
   * 保存到localStorage
   */
  private saveToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.prompts));
    } catch (error) {
      console.error('❌ 快速提示词保存失败:', error);
    }
  }

  /**
   * 获取所有提示词
   */
  getAll(): QuickPrompt[] {
    return [...this.prompts];
  }

  /**
   * 添加提示词
   */
  add(text: string): QuickPrompt {
    const newPrompt: QuickPrompt = {
      id: Date.now().toString(),
      text: text.trim(),
      createdAt: Date.now(),
    };
    this.prompts.push(newPrompt);
    this.saveToStorage();
    return newPrompt;
  }

  /**
   * 更新提示词
   */
  update(id: string, text: string): boolean {
    const index = this.prompts.findIndex(p => p.id === id);
    if (index === -1) return false;
    
    this.prompts[index].text = text.trim();
    this.saveToStorage();
    return true;
  }

  /**
   * 删除提示词
   */
  delete(id: string): boolean {
    const index = this.prompts.findIndex(p => p.id === id);
    if (index === -1) return false;
    
    this.prompts.splice(index, 1);
    this.saveToStorage();
    return true;
  }

  /**
   * 重置为默认提示词
   */
  reset() {
    this.prompts = DEFAULT_PROMPTS;
    this.saveToStorage();
  }
}

// 单例
let instance: QuickPromptsManager | null = null;

export function getQuickPromptsManager(): QuickPromptsManager {
  if (!instance) {
    instance = new QuickPromptsManager();
  }
  return instance;
}

