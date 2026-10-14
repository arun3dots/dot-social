'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { Sparkles, ArrowRight, CheckCircle2, ShieldCheck } from 'lucide-react';

export default function CreatorLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e?: React.FormEvent, isDemo = false) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError(null);

    const targetEmail = isDemo ? 'jane@creatorstudio.dev' : email.trim();

    if (!isDemo && !targetEmail) {
      setError('Please enter your email address.');
      setLoading(false);
      return;
    }

    try {
      const res = await signIn('creator-credentials', {
        email: targetEmail,
        name: isDemo ? 'Jane Creator' : targetEmail.split('@')[0],
        isDemo: isDemo ? 'true' : 'false',
        redirect: false,
      });

      if (res?.error) {
        setError(res.error || 'Authentication failed. Please verify your email.');
      } else if (res?.ok) {
        router.push('/');
        router.refresh();
      }
    } catch (err: any) {
      setError(err.message || 'Network error during sign in.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    setLoading(true);
    signIn('google', { callbackUrl: '/' });
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      background: 'hsl(var(--bg-page))',
    }}>
      {/* ── Left panel: branding ──────────────────────────── */}
      <div style={{
        background: 'hsl(var(--sidebar-bg))',
        display: 'flex', flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '40px 48px',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Subtle decorative circles */}
        <div style={{
          position: 'absolute', top: -120, right: -120,
          width: 400, height: 400, borderRadius: '50%',
          background: 'hsl(221 83% 53% / .08)',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: -80, left: -80,
          width: 280, height: 280, borderRadius: '50%',
          background: 'hsl(262 83% 58% / .06)',
          pointerEvents: 'none',
        }} />

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'hsl(221 83% 53%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Sparkles size={18} color="white" />
          </div>
          <span style={{ fontSize: 16, fontWeight: 700, color: 'white', letterSpacing: '-0.02em' }}>
            dot.social
          </span>
        </div>

        {/* Hero text */}
        <div>
          <h1 style={{
            fontSize: 36, fontWeight: 800, color: 'white',
            letterSpacing: '-0.04em', lineHeight: 1.15, marginBottom: 16,
          }}>
            Your AI social<br />media studio.
          </h1>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,.55)', lineHeight: 1.7, marginBottom: 32, maxWidth: 320 }}>
            Generate, review, and schedule multi-platform content across Instagram, LinkedIn, and X — powered by AI.
          </p>

          {/* Feature list */}
          {[
            'Connect Instagram, LinkedIn, and X',
            '3-Day AI batch content generator',
            'Human-in-the-loop approval workflow',
            'Bring Your Own LLM keys',
          ].map((f) => (
            <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <CheckCircle2 size={15} style={{ color: 'hsl(142 71% 55%)', flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,.7)' }}>{f}</span>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,.3)' }}>
          dot.social v1.0 · Antigravity Enterprise
        </div>
      </div>

      {/* ── Right panel: login form ───────────────────────── */}
      <div style={{
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '40px 48px',
        background: 'hsl(var(--bg-surface))',
      }}>
        <div style={{ width: '100%', maxWidth: 380 }}>
          {/* Admin link */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 32 }}>
            <a
              href="/admin/login"
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                fontSize: 12, color: 'hsl(var(--text-tertiary))',
                textDecoration: 'none', transition: 'color 0.15s',
              }}
            >
              <ShieldCheck size={13} />
              Admin login
            </a>
          </div>

          {/* Heading */}
          <div style={{ marginBottom: 28 }}>
            <h2 style={{
              fontSize: 24, fontWeight: 800, color: 'hsl(var(--text-primary))',
              letterSpacing: '-0.03em', marginBottom: 6,
            }}>
              Sign in
            </h2>
            <p style={{ fontSize: 13, color: 'hsl(var(--text-secondary))' }}>
              Welcome back to Creator Studio
            </p>
          </div>

          {/* Error */}
          {error && (
            <div style={{
              padding: '10px 14px', marginBottom: 16,
              borderRadius: 'var(--radius-sm)',
              background: 'hsl(0 72% 51% / .08)',
              border: '1px solid hsl(0 72% 51% / .25)',
              color: 'hsl(0 72% 45%)',
              fontSize: 12,
            }}>
              {error}
            </div>
          )}

          {/* Email form */}
          <form onSubmit={(e) => handleLogin(e, false)} style={{ marginBottom: 16 }}>
            <div style={{ marginBottom: 12 }}>
              <label className="label">Email address</label>
              <input
                type="text"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="creator@brand.com"
                autoComplete="email"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center', fontSize: 14, padding: '10px 20px' }}
            >
              Sign in with Email
              <ArrowRight size={14} />
            </button>
          </form>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div style={{ flex: 1, height: 1, background: 'hsl(var(--border))' }} />
            <span style={{ fontSize: 11, color: 'hsl(var(--text-tertiary))' }}>or continue with</span>
            <div style={{ flex: 1, height: 1, background: 'hsl(var(--border))' }} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Google */}
            <button
              onClick={handleGoogleLogin}
              disabled={loading}
              className="btn btn-secondary"
              style={{ width: '100%', justifyContent: 'center', fontSize: 13, padding: '10px 20px' }}
            >
              <svg style={{ width: 16, height: 16 }} viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              Continue with Google
            </button>

            {/* Demo */}
            <button
              onClick={() => handleLogin(undefined, true)}
              disabled={loading}
              className="btn btn-ghost"
              style={{ width: '100%', justifyContent: 'center', fontSize: 12 }}
            >
              One-Click Demo Access (Jane Creator)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
