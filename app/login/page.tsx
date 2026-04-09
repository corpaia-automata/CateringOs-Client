'use client';

import { useState, FormEvent, Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChefHat, Eye, EyeOff, Loader2, CheckCircle2 } from 'lucide-react';
import { authStorage } from '@/lib/auth';

const API = process.env.NEXT_PUBLIC_API_URL;

function LoginPageContent() {
  const router       = useRouter();
  const searchParams = useSearchParams();

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);
  const [registered, setRegistered] = useState(false);

  useEffect(() => {
    if (searchParams.get('registered') === '1') {
      setRegistered(true);
    }
    const prefill = searchParams.get('email');
    if (prefill) {
      setEmail(prefill);
    }
  }, [searchParams]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Step 1: resolve the tenant from the email
      const findRes = await fetch(`${API}/api/auth/find-tenant/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (!findRes.ok) {
        setError('No account found for this email address.');
        return;
      }

      const { slug } = await findRes.json();

      // Step 2: tenant-scoped login
      const res = await fetch(`${API}/api/app/${slug}/auth/login/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const msg  = (body as any)?.detail
          ?? (body as any)?.non_field_errors?.[0]
          ?? 'Invalid credentials';
        setError(msg);
        return;
      }

      const data = await res.json();
      authStorage.setTokens(data.accessToken, data.refreshToken, data.user);
      authStorage.setSlug(slug);

      const from = searchParams.get('from') || `/app/${slug}/dashboard`;
      router.push(from);
    } catch {
      setError('Unable to connect. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const inputBase = 'px-3 py-2.5 rounded-lg text-sm outline-none transition-colors w-full';
  const inputStyle = {
    border: '1.5px solid #E2E8F0',
    color: '#0F172A',
    backgroundColor: '#F8FAFC',
  };

  return (
    <div className="flex min-h-screen">
      {/* Left — brand panel */}
      <div
        className="hidden lg:flex flex-col justify-between w-1/2 p-12 relative overflow-hidden"
        style={{ backgroundColor: '#1C3355' }}
      >
        <div className="absolute -top-24 -right-24 rounded-full opacity-10"
          style={{ width: 400, height: 400, backgroundColor: '#D95F0E' }} />
        <div className="absolute -bottom-32 -left-32 rounded-full opacity-10"
          style={{ width: 500, height: 500, backgroundColor: '#0D9488' }} />
        <div className="absolute top-1/2 right-0 -translate-y-1/2 rounded-full opacity-5"
          style={{ width: 300, height: 300, backgroundColor: '#fff' }} />

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="flex items-center justify-center rounded-xl"
            style={{ width: 44, height: 44, backgroundColor: '#D95F0E' }}>
            <ChefHat size={24} color="#fff" />
          </div>
          <span className="text-white font-bold text-lg">CateringOS</span>
        </div>

        {/* Center copy */}
        <div className="relative z-10">
          <h1 className="text-white font-bold leading-tight" style={{ fontSize: 42 }}>
            Afsal<br />Catering
          </h1>
          <p className="mt-3 text-base font-medium" style={{ color: 'rgba(255,255,255,0.6)' }}>
            Operations Management System
          </p>
          <div className="mt-8 flex flex-col gap-3">
            {['Manage leads & events', 'Track grocery & costs', 'Generate instant quotes'].map(f => (
              <div key={f} className="flex items-center gap-2">
                <div className="rounded-full" style={{ width: 6, height: 6, backgroundColor: '#D95F0E' }} />
                <span className="text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>{f}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="relative z-10 text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
          © {new Date().getFullYear()} CateringOS. All rights reserved.
        </p>
      </div>

      {/* Right — login form */}
      <div className="flex flex-1 items-center justify-center px-6 py-12" style={{ backgroundColor: '#fff' }}>
        <div className="w-full" style={{ maxWidth: 380 }}>
          {/* Mobile logo */}
          <div className="flex lg:hidden items-center gap-2 mb-8">
            <div className="flex items-center justify-center rounded-lg"
              style={{ width: 36, height: 36, backgroundColor: '#1C3355' }}>
              <ChefHat size={18} color="#fff" />
            </div>
            <span className="font-bold text-base" style={{ color: '#1C3355' }}>CateringOS</span>
          </div>

          <h2 className="font-bold mb-1" style={{ fontSize: 26, color: '#0F172A' }}>
            Welcome back
          </h2>
          <p className="text-sm mb-6" style={{ color: '#64748B' }}>
            Enter your credentials to continue.
          </p>

          {/* Registration success banner */}
          {registered && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm mb-6"
              style={{ backgroundColor: '#F0FDF4', color: '#16a34a', border: '1px solid #BBF7D0' }}>
              <CheckCircle2 size={16} />
              Account created! Please sign in.
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {/* Email */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" style={{ color: '#0F172A' }}>
                Email address
              </label>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                className={inputBase}
                style={inputStyle}
                onFocus={e => (e.currentTarget.style.borderColor = '#D95F0E')}
                onBlur={e =>  (e.currentTarget.style.borderColor = '#E2E8F0')}
              />
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" style={{ color: '#0F172A' }}>
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className={`${inputBase} pr-10`}
                  style={inputStyle}
                  onFocus={e => (e.currentTarget.style.borderColor = '#D95F0E')}
                  onBlur={e =>  (e.currentTarget.style.borderColor = '#E2E8F0')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: '#94A3B8' }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="px-3 py-2.5 rounded-lg text-sm"
                style={{ backgroundColor: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}>
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold text-white transition-opacity"
              style={{ backgroundColor: '#D95F0E', opacity: loading ? 0.7 : 1 }}
            >
              {loading && <Loader2 size={15} className="animate-spin" />}
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          {/* Sign up link */}
          <p className="text-sm text-center mt-6" style={{ color: '#64748B' }}>
            Don&apos;t have an account?{' '}
            <a href="/register" className="font-semibold hover:underline" style={{ color: '#D95F0E' }}>
              Create account
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginPageContent />
    </Suspense>
  );
}
