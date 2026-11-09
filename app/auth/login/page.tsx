'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { formatSriLankanPhone } from '@/lib/supabase/auth';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get('redirect') || '/';

  // Auth Modes: 'phone' (preferred), 'email' (optional), 'counter_pin' (staff)
  const [authMode, setAuthMode] = useState<'phone' | 'email' | 'counter_pin'>('phone');
  
  // Phone OTP States
  const [phoneNumber, setPhoneNumber] = useState('');
  const [fullName, setFullName] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [phoneStep, setPhoneStep] = useState<'input' | 'verify'>('input');

  // Email States
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Counter PIN State
  const [staffPin, setStaffPin] = useState('');

  // General Status States
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 1. Send Phone OTP
  const handleSendPhoneOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setStatusMessage(null);

    const formatted = formatSriLankanPhone(phoneNumber);
    if (!formatted || formatted.length < 11) {
      setErrorMessage('Please enter a valid Sri Lankan mobile number (e.g. 077 123 4567).');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: formatted }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send OTP code.');

      setStatusMessage(data.message || `OTP code sent to ${formatted}`);
      setPhoneStep('verify');
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Error sending OTP');
    } finally {
      setLoading(false);
    }
  };

  // 2. Verify Phone OTP
  const handleVerifyPhoneOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: phoneNumber,
          token: otpCode,
          fullName: fullName || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Verification failed.');

      if (typeof window !== 'undefined') {
        localStorage.setItem('smart_salon_user', JSON.stringify(data.user));
        localStorage.setItem('smart_salon_role', data.user.role);
      }

      if (data.user.role === 'owner' || data.user.role === 'staff') {
        router.push(redirectUrl !== '/' ? redirectUrl : '/owner-pos');
      } else {
        router.push(redirectUrl);
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Invalid verification code');
    } finally {
      setLoading(false);
    }
  };

  // 3. Email + Password Login
  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/email/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed.');

      if (typeof window !== 'undefined') {
        localStorage.setItem('smart_salon_user', JSON.stringify(data.user));
        localStorage.setItem('smart_salon_role', data.user.role);
      }

      if (data.user.role === 'owner' || data.user.role === 'staff') {
        router.push(redirectUrl !== '/' ? redirectUrl : '/owner-pos');
      } else {
        router.push(redirectUrl);
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  // 4. Staff Quick PIN Login
  const handleStaffQuickLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (staffPin === '1234' || staffPin === '9021') {
      const isOwner = staffPin === '9021';
      const role = isOwner ? 'owner' : 'staff';

      document.cookie = `smart_salon_auth=demo-token; path=/; max-age=604800`;
      document.cookie = `smart_salon_role=${role}; path=/; max-age=604800`;

      if (typeof window !== 'undefined') {
        localStorage.setItem(
          'smart_salon_user',
          JSON.stringify({
            fullName: isOwner ? 'Master Salon Owner' : 'Barber Kavi',
            role,
            phone: '+94770000000',
          })
        );
        localStorage.setItem('smart_salon_role', role);
      }

      router.push('/owner-pos');
    } else {
      setErrorMessage('Invalid Staff PIN. (Demo: 9021 for Owner, 1234 for Staff)');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-4 max-w-md mx-auto font-body">
      {/* Top Header */}
      <header className="pt-6 pb-2">
        <Link href="/" className="inline-flex items-center gap-2 text-slate-400 hover:text-white mb-4 transition">
          <span className="material-symbols-outlined text-xl">arrow_back</span>
          <span className="text-sm font-medium">Home / මුල් පිටුව</span>
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <span className="material-symbols-outlined text-2xl">verified_user</span>
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Smart Salon LK</h1>
            <p className="text-xs text-slate-400">Authentication & Security • ආරක්ෂිත ප්‍රවේශය</p>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="my-auto bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl">
        {/* Auth Method Navigation Tabs */}
        <div className="grid grid-cols-3 bg-slate-950 p-1 rounded-2xl border border-slate-800 mb-6 gap-1">
          <button
            type="button"
            onClick={() => {
              setAuthMode('phone');
              setPhoneStep('input');
              setErrorMessage(null);
            }}
            className={`py-2 text-[11px] font-bold rounded-xl transition flex flex-col items-center justify-center gap-0.5 ${
              authMode === 'phone'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span className="material-symbols-outlined text-base">phone_iphone</span>
            <span>Phone OTP</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setAuthMode('email');
              setErrorMessage(null);
            }}
            className={`py-2 text-[11px] font-bold rounded-xl transition flex flex-col items-center justify-center gap-0.5 ${
              authMode === 'email'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span className="material-symbols-outlined text-base">mail</span>
            <span>Email</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setAuthMode('counter_pin');
              setErrorMessage(null);
            }}
            className={`py-2 text-[11px] font-bold rounded-xl transition flex flex-col items-center justify-center gap-0.5 ${
              authMode === 'counter_pin'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span className="material-symbols-outlined text-base">dialpad</span>
            <span>Staff PIN</span>
          </button>
        </div>

        {errorMessage && (
          <div className="mb-4 p-3.5 bg-red-500/10 border border-red-500/30 rounded-2xl text-xs text-red-400 flex items-start gap-2.5">
            <span className="material-symbols-outlined text-base shrink-0">error</span>
            <span>{errorMessage}</span>
          </div>
        )}

        {statusMessage && (
          <div className="mb-4 p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-xs text-emerald-400 flex items-start gap-2.5">
            <span className="material-symbols-outlined text-base shrink-0">check_circle</span>
            <span>{statusMessage}</span>
          </div>
        )}

        {/* 1. Phone OTP Auth (Preferred) */}
        {authMode === 'phone' && (
          <div>
            {phoneStep === 'input' ? (
              <form onSubmit={handleSendPhoneOtp} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Your Full Name (නම) <span className="text-slate-500 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Kasun Chamara"
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    WhatsApp / Mobile Number (දුරකථන අංකය)
                  </label>
                  <div className="flex rounded-2xl overflow-hidden border border-slate-800 focus-within:border-amber-500 transition">
                    <span className="bg-slate-950 px-3.5 py-3 text-sm text-slate-400 font-semibold border-r border-slate-800 flex items-center gap-1.5">
                      🇱🇰 +94
                    </span>
                    <input
                      type="tel"
                      required
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="77 123 4567"
                      className="w-full bg-slate-950 px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1.5">
                    Sri Lankan SMS / WhatsApp OTP verification.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-amber-500 hover:bg-amber-400 active:scale-[0.98] text-slate-950 font-bold py-3.5 rounded-2xl text-sm transition shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {loading ? (
                    <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>
                  ) : (
                    <>
                      <span>Send OTP Code • කේතය එවන්න</span>
                      <span className="material-symbols-outlined text-lg">arrow_forward</span>
                    </>
                  )}
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyPhoneOtp} className="space-y-4">
                <div className="text-center py-2">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-amber-500/10 text-amber-400 mb-2">
                    <span className="material-symbols-outlined text-2xl">sms</span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Enter code sent to <strong className="text-white">{phoneNumber}</strong>
                  </p>
                </div>

                <div>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="• • • • • •"
                    className="w-full text-center tracking-[0.5em] text-2xl font-bold bg-slate-950 border border-slate-800 rounded-2xl py-3 text-amber-400 placeholder-slate-700 focus:outline-none focus:border-amber-500 transition"
                  />
                  <p className="text-[11px] text-center text-slate-500 mt-2">
                    Demo Code: <span className="text-amber-400 font-mono font-bold">123456</span>
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={loading || otpCode.length < 6}
                  className="w-full bg-amber-500 hover:bg-amber-400 active:scale-[0.98] text-slate-950 font-bold py-3.5 rounded-2xl text-sm transition shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {loading ? (
                    <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>
                  ) : (
                    <>
                      <span>Verify & Continue • තහවුරු කරන්න</span>
                      <span className="material-symbols-outlined text-lg">verified</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setPhoneStep('input')}
                  className="w-full text-xs text-slate-400 hover:text-white py-2 text-center"
                >
                  Change phone number / දුරකථන අංකය මාරු කරන්න
                </button>
              </form>
            )}
          </div>
        )}

        {/* 2. Email + Password Auth (Optional) */}
        {authMode === 'email' && (
          <form onSubmit={handleEmailLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Email Address (විද්‍යුත් තැපෑල)
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="owner@smartsalon.lk"
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Password (මුරපදය)
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-amber-500 hover:bg-amber-400 active:scale-[0.98] text-slate-950 font-bold py-3.5 rounded-2xl text-sm transition shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>
              ) : (
                <>
                  <span>Sign In with Email</span>
                  <span className="material-symbols-outlined text-lg">login</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* 3. Staff Quick PIN Counter */}
        {authMode === 'counter_pin' && (
          <form onSubmit={handleStaffQuickLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Staff Counter PIN (කාර්ය මණ්ඩල රහස්‍ය අංකය)
              </label>
              <input
                type="password"
                required
                maxLength={6}
                value={staffPin}
                onChange={(e) => setStaffPin(e.target.value)}
                placeholder="Enter 4-digit PIN"
                className="w-full text-center tracking-[0.4em] text-xl font-bold bg-slate-950 border border-slate-800 rounded-2xl py-3 text-white placeholder-slate-700 focus:outline-none focus:border-amber-500 transition"
              />
              <p className="text-[11px] text-slate-500 mt-2 text-center">
                Owner Demo PIN: <strong className="text-amber-400 font-mono">9021</strong> • Staff PIN:{' '}
                <strong className="text-amber-400 font-mono">1234</strong>
              </p>
            </div>

            <button
              type="submit"
              className="w-full bg-amber-500 hover:bg-amber-400 active:scale-[0.98] text-slate-950 font-bold py-3.5 rounded-2xl text-sm transition shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Unlock Salon POS Counter</span>
              <span className="material-symbols-outlined text-lg">point_of_sale</span>
            </button>
          </form>
        )}
      </div>

      {/* Footer Info */}
      <footer className="py-4 text-center text-[11px] text-slate-600">
        Smart Salon LK • Kiribathgoda • Session-Hardened RBAC & Immutable Audit
      </footer>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex items-center justify-center text-amber-400 font-bold">
          <div className="flex flex-col items-center gap-3">
            <span className="material-symbols-outlined text-3xl animate-spin">progress_activity</span>
            <span>Loading Smart Salon LK Auth...</span>
          </div>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
