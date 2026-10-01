'use client';

import React from 'react';
import { LLMConfig, LLMProvider } from '@/types';
import { Cpu, Key, Sparkles } from 'lucide-react';

interface Props {
  config: LLMConfig;
  onChangeConfig: (newConfig: LLMConfig) => void;
}

export default function LLMSelectorCard({ config, onChangeConfig }: Props) {
  const handleModeChange = (mode: 'SYSTEM_DEFAULT' | 'BYOK') => {
    onChangeConfig({
      ...config,
      mode,
      provider: mode === 'SYSTEM_DEFAULT' ? 'GEMINI' : config.provider,
    });
  };

  const handleProviderChange = (provider: LLMProvider) => {
    let model = 'gemini-1.5-flash';
    if (provider === 'OPENAI') model = 'gpt-4o-mini';
    if (provider === 'DEEPSEEK') model = 'deepseek-chat';

    onChangeConfig({
      ...config,
      provider,
      model,
    });
  };

  return (
    <div className="bg-[#0e121a] border border-zinc-800 rounded-lg p-5 shadow-xl transition-all hover:border-zinc-700">
      <div className="mb-4">
        <h2 className="text-sm font-semibold tracking-tight text-zinc-100 flex items-center gap-2 mb-1">
          <Cpu size={16} className="text-purple-400" />
          AI Generation Engine
        </h2>
        <p className="text-xs text-zinc-400">
          Select between our in-built default LLM (Google Gemini) or Bring Your Own Key (OpenAI / DeepSeek).
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2.5 mb-3.5">
        <div
          onClick={() => handleModeChange('SYSTEM_DEFAULT')}
          className={`p-3 rounded-md border cursor-pointer transition-all ${
            config.mode === 'SYSTEM_DEFAULT'
              ? 'border-cyan-500/60 bg-cyan-950/20'
              : 'border-zinc-800 bg-[#07090e] hover:border-zinc-700'
          }`}
        >
          <div className="flex items-center gap-2 mb-1">
            <Sparkles size={14} className="text-cyan-400" />
            <span className="font-semibold text-xs text-zinc-100">Platform In-built LLM</span>
          </div>
          <p className="text-[11px] text-zinc-400">
            Google Gemini 1.5 Flash (Included, zero setup required)
          </p>
        </div>

        <div
          onClick={() => handleModeChange('BYOK')}
          className={`p-3 rounded-md border cursor-pointer transition-all ${
            config.mode === 'BYOK'
              ? 'border-purple-500/60 bg-purple-950/20'
              : 'border-zinc-800 bg-[#07090e] hover:border-zinc-700'
          }`}
        >
          <div className="flex items-center gap-2 mb-1">
            <Key size={14} className="text-purple-400" />
            <span className="font-semibold text-xs text-zinc-100">Connect Your Own (BYOK)</span>
          </div>
          <p className="text-[11px] text-zinc-400">
            Use your personal API keys (OpenAI / DeepSeek / Gemini)
          </p>
        </div>
      </div>

      {config.mode === 'BYOK' && (
        <div className="p-3.5 bg-[#07090e] border border-zinc-800 rounded-md flex flex-col gap-3">
          <div>
            <label className="block text-[11px] font-mono text-zinc-400 uppercase tracking-wider mb-1.5">
              Select Provider
            </label>
            <div className="flex gap-2">
              {(['GEMINI', 'OPENAI', 'DEEPSEEK'] as LLMProvider[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => handleProviderChange(p)}
                  className={`px-2.5 py-1 rounded text-xs font-mono transition-all ${
                    config.provider === p
                      ? 'bg-purple-600 text-white font-semibold'
                      : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-mono text-zinc-400 uppercase tracking-wider mb-1.5">
              {config.provider} API Key
            </label>
            <input
              type="password"
              placeholder={`Enter your ${config.provider} API key...`}
              value={config.apiKey || ''}
              onChange={(e) => onChangeConfig({ ...config, apiKey: e.target.value })}
              className="w-full bg-[#0b0e14] border border-zinc-700 rounded px-3 py-1.5 text-xs text-zinc-100 font-mono focus:outline-none focus:border-cyan-500"
            />
            <span className="text-[10px] text-zinc-500 mt-1 block">
              Stored locally for your session. Falls back to mock synthesis if left blank.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
