'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useState, useEffect } from 'react';

interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

// 检查是否已配置 API Key
export function hasApiKeyConfigured(): boolean {
  if (typeof window === 'undefined') return false;
  const apiKey = localStorage.getItem('ai_api_key');
  return !!(apiKey && apiKey.trim());
}

// 检查是否已配置 Remove.bg API Key
export function hasRemoveBgApiKeyConfigured(): boolean {
  if (typeof window === 'undefined') return false;
  const apiKey = localStorage.getItem('removebg_api_key');
  return !!(apiKey && apiKey.trim());
}

export default function SettingsDialog({ isOpen, onClose }: SettingsDialogProps) {
  const [apiKey, setApiKey] = useState('');
  const [apiEndpoint, setApiEndpoint] = useState('');
  const [modelId, setModelId] = useState('');
  const [removeBgApiKey, setRemoveBgApiKey] = useState('');

  useEffect(() => {
    if (isOpen) {
      const savedApiKey = localStorage.getItem('ai_api_key') || '';
      const savedEndpoint = localStorage.getItem('ai_api_endpoint') || 'https://ark.cn-beijing.volces.com/api/v3/images/generations';
      const savedModelId = localStorage.getItem('ai_model_id') || '';
      const savedRemoveBgApiKey = localStorage.getItem('removebg_api_key') || '';

      setApiKey(savedApiKey);
      setApiEndpoint(savedEndpoint);
      setModelId(savedModelId);
      setRemoveBgApiKey(savedRemoveBgApiKey);
    }
  }, [isOpen]);

  const handleSaveSettings = () => {
    if (apiKey.trim()) {
      localStorage.setItem('ai_api_key', apiKey);
    } else {
      localStorage.removeItem('ai_api_key');
    }

    if (apiEndpoint.trim()) {
      localStorage.setItem('ai_api_endpoint', apiEndpoint);
    } else {
      localStorage.removeItem('ai_api_endpoint');
    }

    if (modelId.trim()) {
      localStorage.setItem('ai_model_id', modelId);
    } else {
      localStorage.removeItem('ai_model_id');
    }

    if (removeBgApiKey.trim()) {
      localStorage.setItem('removebg_api_key', removeBgApiKey);
    } else {
      localStorage.removeItem('removebg_api_key');
    }

    onClose();
  };

  const handleResetSettings = () => {
    const defaultEndpoint = 'https://ark.cn-beijing.volces.com/api/v3/images/generations';

    setApiKey('');
    setApiEndpoint(defaultEndpoint);
    setModelId('');
    setRemoveBgApiKey('');

    localStorage.removeItem('ai_api_key');
    localStorage.setItem('ai_api_endpoint', defaultEndpoint);
    localStorage.removeItem('ai_model_id');
    localStorage.removeItem('removebg_api_key');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>⚙️ AI 生图配置</span>
            <a
              href="https://xiangyangqiaomu.feishu.cn/wiki/OK3iwTHxwiQ3Ghkug16c3r1rnKe"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1 font-normal"
            >
              查看教程
              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* AI 生图配置 */}
          <div className="space-y-4 pb-4 border-b">
            <h3 className="text-sm font-semibold text-muted-foreground">AI 生图配置</h3>

            <div className="space-y-2">
              <Label htmlFor="model-id">模型 ID *</Label>
              <Input
                id="model-id"
                type="text"
                value={modelId}
                onChange={(e) => setModelId(e.target.value)}
                placeholder="ep-20250916145609-9bqzl"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="api-key">API Key *</Label>
              <Input
                id="api-key"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="输入你的 API Key"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="api-endpoint">API 端点</Label>
              <Input
                id="api-endpoint"
                type="url"
                value={apiEndpoint}
                onChange={(e) => setApiEndpoint(e.target.value)}
                placeholder="https://ark.cn-beijing.volces.com/api/v3/images/generations"
              />
            </div>
          </div>

          {/* Remove.bg 配置 */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-muted-foreground">Remove.bg 配置</h3>
              <a
                href="https://www.remove.bg/api"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1"
              >
                获取 API
                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </div>

            <div className="space-y-2">
              <Label htmlFor="removebg-api-key">API Key</Label>
              <Input
                id="removebg-api-key"
                type="password"
                value={removeBgApiKey}
                onChange={(e) => setRemoveBgApiKey(e.target.value)}
                placeholder="输入你的 Remove.bg API Key"
              />
              <p className="text-xs text-muted-foreground">
                用于一键去除图片背景功能
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-4 border-t">
          <Button variant="outline" onClick={handleResetSettings}>
            重置
          </Button>

          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              取消
            </Button>
            <Button variant="outline" onClick={handleSaveSettings}>
              保存设置
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
