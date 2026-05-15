'use client';

import { useState, FormEvent, Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { Eye, EyeOff, Loader2, CheckCircle2 } from 'lucide-react';
import { authStorage } from '@/lib/auth';
import { subscriptionStore, type SubscriptionApiData } from '@/store/subscriptionStore';

const API = process.env.NEXT_PUBLIC_API_URL;

type LoginResponse = {
  access?: string;
  refresh?: string;
  tenant_slug?: string;
  user?: {
    id: string;
    email: string;
    name: string;
  };
  error?: string;
  detail?: string;
  non_field_errors?: string[];
  subscription?: SubscriptionApiData;
};

function LoginPageContent() {
  const router       = useRouter();
  const searchParams = useSearchParams();

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    if (searchParams?.get('registered') === '1') {
      setRegistered(true);
    }
    const prefill = searchParams?.get('email');
    if (prefill) {
      setEmail(prefill);
    }
  }, [searchParams]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const from = searchParams?.get('from');
      const res = await fetch(`${API}/api/auth/login/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data: LoginResponse = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg = data.error
          ?? data.detail
          ?? data.non_field_errors?.[0]
          ?? 'Login failed';
        setError(msg);
        return;
      }

      if (!data.access || !data.refresh || !data.tenant_slug || !data.user) {
        setError('Login response is incomplete.');
        return;
      }

      authStorage.setTokens(data.access, data.refresh, data.user);
      authStorage.setSlug(data.tenant_slug);
      subscriptionStore.getState().syncFromApi(data.subscription);

      router.push(from || `/app/${data.tenant_slug}/dashboard`);
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
        style={{ backgroundColor: '#020617' }}
      >
        {/* Background accents */}
        <div
          className="absolute -top-24 -right-24 rounded-full opacity-10"
          style={{
            width: 420,
            height: 420,
            backgroundColor: '#D95F0E',
            filter: 'blur(40px)',
          }}
        />

        <div
          className="absolute -bottom-40 -left-40 rounded-full opacity-10"
          style={{
            width: 520,
            height: 520,
            backgroundColor: '#0D9488',
            filter: 'blur(60px)',
          }}
        />

        <div
          className="absolute top-1/2 right-10 -translate-y-1/2 rounded-full opacity-5"
          style={{
            width: 320,
            height: 320,
            backgroundColor: '#FFFFFF',
            filter: 'blur(30px)',
          }}
        />

        {/* Logo */}
        <div className="relative z-10 flex items-start justify-start">
          <div className="relative w-[520px] h-[120px]">
            <img
              src="/logos/white-logo.png"
              alt="CateringOS"
              className="h-full w-full object-contain object-left"
            />
          </div>
        </div>

        {/* Center content */}
        <div className="relative z-10 max-w-xl">
          {/* <div
            className="inline-flex items-center rounded-full border px-4 py-1.5 text-xs font-medium mb-6"
            style={{
              borderColor: 'rgba(255,255,255,0.12)',
              backgroundColor: 'rgba(255,255,255,0.04)',
              color: 'rgba(255,255,255,0.75)',
              backdropFilter: 'blur(8px)',
            }}
          >
            Catering Business Operating System
          </div> */}

          <h1
            className="font-semibold tracking-tight"
            style={{
              fontSize: 42,
              lineHeight: 1.3,
              color: '#FFFFFF',
            }}
          >
            Run your catering operations from one unified platform.
          </h1>

          <p
            className="mt-6 text-lg leading-8"
            style={{
              color: 'rgba(255,255,255,0.62)',
              maxWidth: 560,
            }}
          >
            Streamline quotations, menu planning, costing, CRM,
            event execution, and operational workflows with clarity and control.
          </p>

          {/* Feature cards */}
          {/* <div className="mt-10 grid grid-cols-1 gap-4">
            {[
              'Lead & client management',
              'Menu planning & costing engine',
              'Professional quotations & invoices',
              'Event operations & execution tracking',
            ].map(feature => (
              <div
                key={feature}
                className="flex items-center gap-3 rounded-2xl px-4 py-4"
                style={{
                  backgroundColor: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  backdropFilter: 'blur(10px)',
                }}
              >
                <div
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: '#D95F0E' }}
                />

                <span
                  className="text-sm font-medium"
                  style={{ color: 'rgba(255,255,255,0.82)' }}
                >
                  {feature}
                </span>
              </div>
            ))}
          </div> */}
        </div>

        {/* Footer */}
        <div className="relative z-10 flex items-center justify-between">
          <p
            className="text-xs"
            style={{ color: 'rgba(255,255,255,0.35)' }}
          >
            © {new Date().getFullYear()} CateringOS. All rights reserved.
          </p>

          <div
            className="rounded-full border px-3 py-1 text-xs"
            style={{
              borderColor: 'rgba(255,255,255,0.08)',
              color: 'rgba(255,255,255,0.45)',
              backgroundColor: 'rgba(255,255,255,0.03)',
            }}
          >
            Enterprise SaaS Platform
          </div>
        </div>
      </div>
      {/* Right — login form */}
      <div className="flex flex-1 items-center justify-center px-6 py-12" style={{ backgroundColor: '#fff' }}>
        <div className="w-full" style={{ maxWidth: 380 }}>
          {/* Mobile logo */}
           <div className="flex lg:hidden items-center gap-2 mb-8">
            <div className="relative w-[520px] h-[120px]">
              <img
                src="/logos/white-logo.png"
                alt="CateringOS"
                className="h-full w-full object-contain object-left"
              />
            </div>
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
                onFocus={e => (e.currentTarget.style.borderColor = 'black')}
                onBlur={e =>  (e.currentTarget.style.borderColor = '#E2E8F0')}
                suppressHydrationWarning
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
                  onFocus={e => (e.currentTarget.style.borderColor = 'black')}
                  onBlur={e =>  (e.currentTarget.style.borderColor = '#E2E8F0')}
                  suppressHydrationWarning
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: '#94A3B8' }}
                  suppressHydrationWarning
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
              style={{ backgroundColor: 'black', opacity: loading ? 0.7 : 1 }}
              suppressHydrationWarning
            >
              {loading && <Loader2 size={15} className="animate-spin" />}
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          {/* Sign up link */}
          <p className="text-sm text-center mt-6" style={{ color: '#64748B' }}>
            Don&apos;t have an account?{' '}
            <a href="/register" className="font-semibold hover:underline" style={{ color: 'black' }}>
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
