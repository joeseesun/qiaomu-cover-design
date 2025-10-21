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

export default function SettingsDialog({ isOpen, onClose }: SettingsDialogProps) {
  const [apiKey, setApiKey] = useState('');
  const [apiEndpoint, setApiEndpoint] = useState('');
  const [modelId, setModelId] = useState('');

  useEffect(() => {
    if (isOpen) {
      const savedApiKey = localStorage.getItem('ai_api_key') || '';
      const savedEndpoint = localStorage.getItem('ai_api_endpoint') || 'https://ark.cn-beijing.volces.com/api/v3/images/generations';
      const savedModelId = localStorage.getItem('ai_model_id') || '';

      setApiKey(savedApiKey);
      setApiEndpoint(savedEndpoint);
      setModelId(savedModelId);
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

    onClose();
  };

  const handleResetSettings = () => {
    const defaultEndpoint = 'https://ark.cn-beijing.volces.com/api/v3/images/generations';

    setApiKey('');
    setApiEndpoint(defaultEndpoint);
    setModelId('');

    localStorage.removeItem('ai_api_key');
    localStorage.setItem('ai_api_endpoint', defaultEndpoint);
    localStorage.removeItem('ai_model_id');
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
