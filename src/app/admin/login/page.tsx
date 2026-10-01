'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { ShieldAlert, Terminal, Lock, Key, ArrowRight, ArrowLeft } from 'lucide-react';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleAdminLogin = async (e?: React.FormEvent, isDemo = false) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await signIn('admin-credentials', {
        email: isDemo ? 'admin@antigravity.local' : email.trim(),
        secretKey: isDemo ? '' : secretKey,
        isDemo: isDemo ? 'true' : 'false',
        redirect: false,
      });

      if (res?.error) {
        setError(res.error || 'Authentication rejected. Access denied.');
      } else if (res?.ok) {
        router.push('/admin');
        router.refresh();
      }
    } catch (err: any) {
      setError(err.message || 'Authentication error.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#07080b] text-[#f1f5f9] flex flex-col justify-between p-6">
      <div className="flex justify-between items-center max-w-6xl mx-auto w-full py-4">
        <a
          href="/login"
          className="text-xs font-mono text-zinc-500 hover:text-zinc-300 transition-colors flex items-center gap-1.5"
        >
          <ArrowLeft size={14} />
          &larr; Back to Creator Studio
        </a>

        <div className="flex items-center gap-2 font-mono text-xs text-rose-400 bg-rose-950/30 border border-rose-900/40 px-3 py-1 rounded">
          <ShieldAlert size={14} />
          <span>RESTRICTED_SUPER_ADMIN_ZONE</span>
        </div>
      </div>

      <div className="max-w-md w-full mx-auto my-auto">
        <div className="bg-[#0f1219] border border-rose-950/60 rounded-lg p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-rose-600 via-purple-600 to-cyan-600"></div>

          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-rose-950/40 border border-rose-800/40 text-rose-400 mb-4">
              <Lock size={22} />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white mb-2 font-mono">
              Super Admin Control Plane
            </h1>
            <p className="text-xs text-zinc-400">
              Platform administration, global LLM routing, and tenant monitoring.
            </p>
          </div>

          {error && (
            <div className="mb-6 p-3 rounded bg-rose-950/50 border border-rose-800/60 text-rose-300 text-xs font-mono">
              {error}
            </div>
          )}

          <form onSubmit={(e) => handleAdminLogin(e, false)} className="space-y-4">
            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-zinc-400 mb-2">
                Admin Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@antigravity.local"
                className="w-full bg-[#0a0c10] border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-100 font-mono focus:outline-none focus:border-rose-500"
              />
            </div>

            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-zinc-400 mb-2">
                Secret Access Key
              </label>
              <input
                type="password"
                value={secretKey}
                onChange={(e) => setSecretKey(e.target.value)}
                placeholder="••••••••••••"
                className="w-full bg-[#0a0c10] border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-100 font-mono focus:outline-none focus:border-rose-500"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-rose-700 hover:bg-rose-600 text-white font-medium py-2.5 px-4 rounded transition-all text-sm font-mono mt-2"
            >
              <Key size={14} />
              <span>Authenticate Super Admin</span>
            </button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-zinc-800"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase font-mono">
              <span className="bg-[#0f1219] px-2 text-zinc-500">Evaluation Mode</span>
            </div>
          </div>

          <button
            onClick={() => handleAdminLogin(undefined, true)}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 font-mono text-xs py-2.5 px-4 rounded transition-all"
          >
            <span>One-Click Super Admin Access (Demo)</span>
            <ArrowRight size={13} />
          </button>
        </div>
      </div>

      <div className="text-center text-xs text-zinc-700 font-mono py-4">
        restricted environment // security audit logging active
      </div>
    </div>
  );
}
