'use client';

import React, { useEffect, useState } from 'react';
import { Settings, Image as ImageIcon, Radio, Cloud, RefreshCw, CheckCircle2 } from 'lucide-react';

const COST: Record<string, string> = {
  low: '~$0.01 per image',
  medium: '~$0.04 per image',
  high: '~$0.17 per image',
};

interface S3Status {
  configured: boolean;
  bucket?: string;
  region?: string;
  userPrefix?: string;
  userObjectCount?: number;
  error?: string;
}

export default function SettingsCard() {
  const [quality, setQuality] = useState<string>('low');
  const [options, setOptions] = useState<string[]>(['low', 'medium', 'high']);
  const [publishing, setPublishing] = useState<{ armed: boolean; note: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // S3 Cloud Storage state
  const [s3Status, setS3Status] = useState<S3Status | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setQuality(d.settings?.imageQuality || 'low');
        if (Array.isArray(d.options?.imageQuality)) setOptions(d.options.imageQuality);
        if (d.publishing) setPublishing(d.publishing);
      })
      .catch(console.error);

    fetch('/api/media/s3')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) setS3Status(d);
      })
      .catch(console.error);
  }, []);

  const save = async (q: string) => {
    if (q === quality || saving) return;
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageQuality: q }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'could not save');
      setQuality(d.settings.imageQuality);
      setMsg(`Saved (${d.settings.imageQuality})`);
      setTimeout(() => setMsg(null), 3000);
    } catch (e: any) {
      setMsg(`Not saved: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleSyncS3 = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    setSyncMsg(null);
    try {
      const res = await fetch('/api/media/s3', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setSyncMsg(`Synced ${data.syncedCount} images to S3!`);
        // Refresh object count
        fetch('/api/media/s3')
          .then((r) => r.json())
          .then(setS3Status);
      } else {
        setSyncMsg(`Sync failed: ${data.error}`);
      }
    } catch (e: any) {
      setSyncMsg(`Sync error: ${e.message}`);
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncMsg(null), 4000);
    }
  };

  return (
    <div className="card">
      <div className="card-header flex items-center justify-between">
        <div>
          <div className="card-title">
            <Settings size={15} className="text-slate-600" />
            Generation & Cloud Storage Settings
          </div>
          <div className="card-desc">AI image resolution, S3 cloud bucket, and background scheduler.</div>
        </div>
        {saving && <span className="text-[11px] text-slate-400 font-mono">saving…</span>}
      </div>

      <div className="card-body flex flex-col gap-3">
        {/* Image Quality Settings */}
        <div>
          <label className="label flex items-center gap-1.5">
            <ImageIcon size={12} />
            Image Generation Quality
          </label>
          <div className="flex gap-2">
            {options.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => save(q)}
                className={`btn btn-sm flex-1 capitalize font-medium ${
                  quality === q
                    ? 'btn-primary'
                    : 'btn-secondary text-slate-600'
                }`}
              >
                {q}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1.5">
            <span>Current: <strong className="text-slate-700 font-semibold">{quality}</strong> · {COST[quality] || ''}</span>
            {msg && <span className="text-emerald-600 font-medium">{msg}</span>}
          </div>
        </div>

        {/* AWS S3 Cloud Storage Card */}
        <div className="border-t border-slate-100 pt-3 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs text-slate-700 font-semibold">
              <Cloud size={14} className="text-sky-600" />
              <span>AWS S3 Cloud Storage</span>
            </div>
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                s3Status?.configured
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-rose-50 text-rose-700 border border-rose-200'
              }`}
            >
              {s3Status?.configured ? (
                <>
                  <CheckCircle2 size={10} />
                  Connected
                </>
              ) : (
                'Not Configured'
              )}
            </span>
          </div>

          {s3Status?.configured && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 flex flex-col gap-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 text-[11px]">Bucket Name:</span>
                <span className="font-mono font-medium text-slate-800 text-[11px]">{s3Status.bucket}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 text-[11px]">Region:</span>
                <span className="font-mono font-medium text-slate-800 text-[11px]">{s3Status.region}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 text-[11px]">User Storage Path:</span>
                <span className="font-mono text-sky-700 font-semibold text-[11px] truncate max-w-[200px]" title={s3Status.userPrefix}>
                  s3://{s3Status.bucket}/{s3Status.userPrefix}
                </span>
              </div>

              <div className="pt-2 border-t border-slate-200/70 flex items-center justify-between gap-2 mt-1">
                <button
                  type="button"
                  onClick={handleSyncS3}
                  disabled={isSyncing}
                  className="btn btn-xs btn-secondary flex items-center gap-1 text-[11px]"
                >
                  <RefreshCw size={11} className={isSyncing ? 'animate-spin' : ''} />
                  <span>{isSyncing ? 'Syncing to S3…' : 'Sync Images to S3'}</span>
                </button>
                {syncMsg && <span className="text-[11px] text-emerald-600 font-medium truncate">{syncMsg}</span>}
              </div>
            </div>
          )}
        </div>

        {/* Live Publishing Gate */}
        <div className="border-t border-slate-100 pt-2.5 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <Radio size={13} className="text-slate-500" />
            <span>Live Publishing:</span>
          </div>
          <span className={`badge ${publishing?.armed ? 'badge-live' : 'badge-sandbox'}`}>
            {publishing ? (publishing.armed ? 'ARMED' : 'SANDBOX') : 'CHECKING'}
          </span>
        </div>
      </div>
    </div>
  );
}
