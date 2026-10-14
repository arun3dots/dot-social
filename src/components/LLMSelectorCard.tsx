'use client';

import React from 'react';
import { LLMConfig, LLMProvider } from '@/types';
import { Cpu, Key, Sparkles } from 'lucide-react';

interface Props {
  config: LLMConfig;
  onChangeConfig: (newConfig: LLMConfig) => void;
}

const PROVIDERS: { id: LLMProvider; label: string; model: string }[] = [
  { id: 'GEMINI',   label: 'Gemini',    model: 'gemini-1.5-flash' },
  { id: 'OPENAI',   label: 'OpenAI',    model: 'gpt-4o-mini' },
  { id: 'DEEPSEEK', label: 'DeepSeek',  model: 'deepseek-chat' },
];

export default function LLMSelectorCard({ config, onChangeConfig }: Props) {
  const handleModeChange = (mode: 'SYSTEM_DEFAULT' | 'BYOK') => {
    onChangeConfig({
      ...config,
      mode,
      provider: mode === 'SYSTEM_DEFAULT' ? 'GEMINI' : config.provider,
    });
  };

  const handleProviderChange = (provider: LLMProvider) => {
    const p = PROVIDERS.find((x) => x.id === provider);
    onChangeConfig({ ...config, provider, model: p?.model ?? 'gemini-1.5-flash' });
  };

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">
          <Cpu size={15} className="text-purple-600" />
          AI Generation Engine
        </div>
        <div className="card-desc">
          Select between system default LLM or bring your personal API keys.
        </div>
      </div>

      <div className="card-body flex flex-col gap-3">
        {/* Mode Toggle Cards */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => handleModeChange('SYSTEM_DEFAULT')}
            className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
              config.mode === 'SYSTEM_DEFAULT'
                ? 'border-sky-500 bg-sky-50/50 shadow-sm'
                : 'border-slate-200 bg-white hover:border-slate-300'
            }`}
          >
            <div className="flex items-center gap-1.5 mb-1 font-semibold text-xs text-slate-900">
              <Sparkles size={13} className="text-sky-600 shrink-0" />
              <span>Platform In-built</span>
            </div>
            <p className="text-[11px] text-slate-500 line-clamp-2">
              Gemini 1.5 Flash (Included, zero setup)
            </p>
          </button>

          <button
            type="button"
            onClick={() => handleModeChange('BYOK')}
            className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
              config.mode === 'BYOK'
                ? 'border-purple-500 bg-purple-50/50 shadow-sm'
                : 'border-slate-200 bg-white hover:border-slate-300'
            }`}
          >
            <div className="flex items-center gap-1.5 mb-1 font-semibold text-xs text-slate-900">
              <Key size={13} className="text-purple-600 shrink-0" />
              <span>Bring Your Key</span>
            </div>
            <p className="text-[11px] text-slate-500 line-clamp-2">
              OpenAI / DeepSeek / Gemini keys
            </p>
          </button>
        </div>

        {/* BYOK provider buttons & input */}
        {config.mode === 'BYOK' && (
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex flex-col gap-2.5">
            <div>
              <span className="label">Select Provider</span>
              <div className="flex gap-2">
                {PROVIDERS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleProviderChange(p.id)}
                    className={`btn btn-sm ${
                      config.provider === p.id
                        ? 'btn-primary'
                        : 'btn-secondary'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="label">{config.provider} API Key</label>
              <input
                type="password"
                className="input"
                placeholder={`Enter your ${config.provider} API key…`}
                value={config.apiKey || ''}
                onChange={(e) => onChangeConfig({ ...config, apiKey: e.target.value })}
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                Session-only memory. Falls back to server keys if left blank.
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
