'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ChefHat, Eye, EyeOff, Loader2 } from 'lucide-react';
import { authStorage } from '@/lib/auth';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function RegisterPage() {
  const router = useRouter();

  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    password: '',
    password_confirm: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })); }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (form.password !== form.password_confirm) {
      setError('Passwords do not match');
      return;
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API}/api/auth/register/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: form.first_name,
          last_name: form.last_name,
          email: form.email,
          password: form.password,
          password_confirm: form.password_confirm,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        const msg = Object.values(data).flat().join(', ');
        setError(msg || 'Registration failed');
        return;
      }

      // Auto-login if tokens returned
      if (data.access) {
        authStorage.setTokens(data.access, data.refresh, data.user);
        router.push('/dashboard');
      } else {
        router.push('/login?registered=1');
      }
    } catch {
      setError('Unable to connect. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const inputCls = 'w-full px-3 py-2.5 rounded-lg text-sm outline-none transition-colors';
  const inputStyle = {
    border: '1.5px solid #E2E8F0',
    color: '#0F172A',
    backgroundColor: '#F8FAFC',
  };

  return (
    <div className="flex min-h-screen">
      {/* Left — brand panel */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 p-12 relative overflow-hidden"
        style={{ backgroundColor: '#1C3355' }}>
        <div className="absolute -top-24 -right-24 rounded-full opacity-10"
          style={{ width: 400, height: 400, backgroundColor: '#D95F0E' }} />
        <div className="absolute -bottom-32 -left-32 rounded-full opacity-10"
          style={{ width: 500, height: 500, backgroundColor: '#0D9488' }} />

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
            Join Afsal<br />Catering
          </h1>
          <p className="mt-3 text-base font-medium" style={{ color: 'rgba(255,255,255,0.6)' }}>
            Set up your account to get started
          </p>
          <div className="mt-8 flex flex-col gap-3">
            {['Full event lifecycle management', 'Smart grocery generation', 'Instant PDF quotations'].map(f => (
              <div key={f} className="flex items-center gap-2">
                <div className="rounded-full" style={{ width: 6, height: 6, backgroundColor: '#D95F0E' }} />
                <span className="text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>{f}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="relative z-10 text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
          © {new Date().getFullYear()} Afsal Catering. All rights reserved.
        </p>
      </div>

      {/* Right — register form */}
      <div className="flex flex-1 items-center justify-center px-6 py-12" style={{ backgroundColor: '#fff' }}>
        <div className="w-full" style={{ maxWidth: 400 }}>
          {/* Mobile logo */}
          <div className="flex lg:hidden items-center gap-2 mb-8">
            <div className="flex items-center justify-center rounded-lg"
              style={{ width: 36, height: 36, backgroundColor: '#1C3355' }}>
              <ChefHat size={18} color="#fff" />
            </div>
            <span className="font-bold text-base" style={{ color: '#1C3355' }}>CateringOS</span>
          </div>

          <h2 className="font-bold mb-1" style={{ fontSize: 26, color: '#0F172A' }}>
            Create your account
          </h2>
          <p className="text-sm mb-8" style={{ color: '#64748B' }}>
            Fill in the details below to get started
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Name row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium" style={{ color: '#0F172A' }}>First Name</label>
                <input type="text" required value={form.first_name} onChange={e => set('first_name', e.target.value)}
                  placeholder="Mohamed" className={inputCls} style={inputStyle}
                  onFocus={e => (e.currentTarget.style.borderColor = '#D95F0E')}
                  onBlur={e => (e.currentTarget.style.borderColor = '#E2E8F0')} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium" style={{ color: '#0F172A' }}>Last Name</label>
                <input type="text" required value={form.last_name} onChange={e => set('last_name', e.target.value)}
                  placeholder="Sharif" className={inputCls} style={inputStyle}
                  onFocus={e => (e.currentTarget.style.borderColor = '#D95F0E')}
                  onBlur={e => (e.currentTarget.style.borderColor = '#E2E8F0')} />
              </div>
            </div>

            {/* Email */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" style={{ color: '#0F172A' }}>Email Address</label>
              <input type="email" required autoComplete="email" value={form.email}
                onChange={e => set('email', e.target.value)}
                placeholder="you@example.com" className={inputCls} style={inputStyle}
                onFocus={e => (e.currentTarget.style.borderColor = '#D95F0E')}
                onBlur={e => (e.currentTarget.style.borderColor = '#E2E8F0')} />
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" style={{ color: '#0F172A' }}>Password</label>
              <div className="relative">
                <input type={showPassword ? 'text' : 'password'} required value={form.password}
                  onChange={e => set('password', e.target.value)} placeholder="Min. 8 characters"
                  className={`${inputCls} pr-10`} style={inputStyle}
                  onFocus={e => (e.currentTarget.style.borderColor = '#D95F0E')}
                  onBlur={e => (e.currentTarget.style.borderColor = '#E2E8F0')} />
                <button type="button" onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: '#94A3B8' }}>
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" style={{ color: '#0F172A' }}>Confirm Password</label>
              <div className="relative">
                <input type={showConfirm ? 'text' : 'password'} required value={form.password_confirm}
                  onChange={e => set('password_confirm', e.target.value)} placeholder="Re-enter password"
                  className={`${inputCls} pr-10`} style={inputStyle}
                  onFocus={e => (e.currentTarget.style.borderColor = '#D95F0E')}
                  onBlur={e => (e.currentTarget.style.borderColor = '#E2E8F0')} />
                <button type="button" onClick={() => setShowConfirm(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: '#94A3B8' }}>
                  {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
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
            <button type="submit" disabled={loading}
              className="flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold text-white transition-opacity mt-1"
              style={{ backgroundColor: '#D95F0E', opacity: loading ? 0.7 : 1 }}>
              {loading && <Loader2 size={15} className="animate-spin" />}
              {loading ? 'Creating account…' : 'Create Account'}
            </button>
          </form>

          {/* Sign in link */}
          <p className="text-sm text-center mt-6" style={{ color: '#64748B' }}>
            Already have an account?{' '}
            <a href="/login" className="font-semibold hover:underline" style={{ color: '#D95F0E' }}>
              Sign in
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
