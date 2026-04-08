'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ChefHat, Eye, EyeOff, Loader2, CheckCircle2 } from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const COUNTRIES = [
  { value: 'IN', label: 'India' },
  { value: 'GB', label: 'United Kingdom' },
  { value: 'US', label: 'United States' },
];

export default function RegisterPage() {
  const router = useRouter();

  const [form, setForm] = useState({
    company_name: '',
    email: '',
    password: '',
    confirmPassword: '',
    country: 'IN',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error,   setError]   = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })); }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (form.password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API}/api/onboard/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: form.company_name,
          email:       form.email,
          password:    form.password,
          country:     form.country,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        const msg = Object.values(data).flat().join(', ');
        setError(msg || 'Registration failed. Please try again.');
        return;
      }

      setSuccess(true);

      // Redirect to login with success message and pre-filled email
      setTimeout(() => {
        const params = new URLSearchParams({ registered: '1', email: form.email });
        router.push(`/login?${params.toString()}`);
      }, 1800);
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
            Start your<br />account
          </h1>
          <p className="mt-3 text-base font-medium" style={{ color: 'rgba(255,255,255,0.6)' }}>
            Set up your catering business in seconds
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
          © {new Date().getFullYear()} CateringOS. All rights reserved.
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

          {success ? (
            /* ── Success state ── */
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="flex items-center justify-center rounded-full"
                style={{ width: 64, height: 64, backgroundColor: '#F0FDF4' }}>
                <CheckCircle2 size={36} style={{ color: '#16a34a' }} />
              </div>
              <h2 className="font-bold text-center" style={{ fontSize: 22, color: '#0F172A' }}>
                Account created!
              </h2>
              <p className="text-sm text-center" style={{ color: '#64748B' }}>
                Redirecting you to sign in…
              </p>
              <Loader2 size={18} className="animate-spin" style={{ color: '#D95F0E' }} />
            </div>
          ) : (
            <>
              <h2 className="font-bold mb-1" style={{ fontSize: 26, color: '#0F172A' }}>
                Create your account
              </h2>
              <p className="text-sm mb-8" style={{ color: '#64748B' }}>
                One account per business. Takes 30 seconds.
              </p>

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                {/* Company Name */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium" style={{ color: '#0F172A' }}>Company Name</label>
                  <input
                    type="text"
                    required
                    value={form.company_name}
                    onChange={e => set('company_name', e.target.value)}
                    placeholder="Afsal Catering Services"
                    className={inputCls}
                    style={inputStyle}
                    onFocus={e => (e.currentTarget.style.borderColor = '#D95F0E')}
                    onBlur={e =>  (e.currentTarget.style.borderColor = '#E2E8F0')}
                  />
                </div>

                {/* Email */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium" style={{ color: '#0F172A' }}>Email Address</label>
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    value={form.email}
                    onChange={e => set('email', e.target.value)}
                    placeholder="owner@company.com"
                    className={inputCls}
                    style={inputStyle}
                    onFocus={e => (e.currentTarget.style.borderColor = '#D95F0E')}
                    onBlur={e =>  (e.currentTarget.style.borderColor = '#E2E8F0')}
                  />
                </div>

                {/* Password */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium" style={{ color: '#0F172A' }}>Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={form.password}
                      onChange={e => set('password', e.target.value)}
                      placeholder="Min. 8 characters"
                      className={`${inputCls} pr-10`}
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

                {/* Confirm Password */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium" style={{ color: '#0F172A' }}>Confirm Password</label>
                  <div className="relative">
                    <input
                      type={showConfirm ? 'text' : 'password'}
                      required
                      value={form.confirmPassword}
                      onChange={e => set('confirmPassword', e.target.value)}
                      placeholder="Re-enter your password"
                      className={`${inputCls} pr-10`}
                      style={inputStyle}
                      onFocus={e => (e.currentTarget.style.borderColor = '#D95F0E')}
                      onBlur={e =>  (e.currentTarget.style.borderColor = '#E2E8F0')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2"
                      style={{ color: '#94A3B8' }}
                    >
                      {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {/* Country */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium" style={{ color: '#0F172A' }}>Country</label>
                  <select
                    required
                    value={form.country}
                    onChange={e => set('country', e.target.value)}
                    className={inputCls}
                    style={{ ...inputStyle, appearance: 'auto' }}
                    onFocus={e => (e.currentTarget.style.borderColor = '#D95F0E')}
                    onBlur={e =>  (e.currentTarget.style.borderColor = '#E2E8F0')}
                  >
                    {COUNTRIES.map(c => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
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
                  className="flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold text-white transition-opacity mt-1"
                  style={{ backgroundColor: '#D95F0E', opacity: loading ? 0.7 : 1 }}
                >
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}
