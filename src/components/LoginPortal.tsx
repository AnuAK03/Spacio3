import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Car,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Mail,
  MapPin,
  ShieldCheck,
} from 'lucide-react';
import { UserRole, UserSession } from '../types/parkpool';
import { LiveMobilityBackground } from './LiveMobilityBackground';

interface LoginPortalProps {
  onAuthComplete: (user: UserSession, token: string) => void;
}

type AuthMode = 'signin' | 'register' | 'forgot' | 'admin';
type AdminModeState = 'loading' | 'unclaimed' | 'claimed' | 'env';

const ROLE_OPTIONS: Array<{
  role: Extract<UserRole, 'driver' | 'host'>;
  title: string;
  subtitle: string;
  defaultOrg: string;
  accentText: string;
  accentBg: string;
  accentBorder: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    role: 'driver',
    title: 'Driver',
    subtitle: 'Search, book & navigate',
    defaultOrg: 'Bengaluru Commuter',
    accentText: 'text-[#C83709]',
    accentBg: 'bg-[#FFF0EA]',
    accentBorder: 'border-[#D93F0B] ring-1 ring-[#D93F0B]',
    icon: Car,
  },
  {
    role: 'host',
    title: 'Provider',
    subtitle: 'Onboard, slots & payouts',
    defaultOrg: 'Bengaluru Parking Partner',
    accentText: 'text-[#047857]',
    accentBg: 'bg-emerald-50',
    accentBorder: 'border-[#047857] ring-1 ring-[#047857]',
    icon: KeyRound,
  },
];

export const LoginPortal: React.FC<LoginPortalProps> = ({ onAuthComplete }) => {
  const [authMode, setAuthMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [recoveryPhrase, setRecoveryPhrase] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [selectedRole, setSelectedRole] = useState<Extract<UserRole, 'driver' | 'host'>>('driver');
  const [displayName, setDisplayName] = useState('');
  const [organization, setOrganization] = useState('Bengaluru Commuter');

  const [adminMode, setAdminMode] = useState<AdminModeState>('loading');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminName, setAdminName] = useState('ParkPool Operations Admin');
  const [adminPasscode, setAdminPasscode] = useState('');
  const [adminConfirmPasscode, setAdminConfirmPasscode] = useState('');

  const [hasRegisteredUsers, setHasRegisteredUsers] = useState<boolean>(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch('/api/auth/status')
      .then((res) => res.json())
      .then((data: { adminMode?: 'env' | 'claimed' | 'unclaimed'; hasRegisteredUsers?: boolean }) => {
        if (!active) return;
        setAdminMode(data.adminMode || 'claimed');
        if (typeof data.hasRegisteredUsers === 'boolean') {
          setHasRegisteredUsers(data.hasRegisteredUsers);
          if (!data.hasRegisteredUsers) {
            setAuthMode('register');
          }
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (authMode !== 'admin') return;
    let active = true;
    setAdminMode('loading');
    fetch('/api/auth/status')
      .then((res) => res.json())
      .then((data: { adminMode?: 'env' | 'claimed' | 'unclaimed' }) => {
        if (active) setAdminMode(data.adminMode || 'claimed');
      })
      .catch(() => {
        if (active) setAdminMode('claimed');
      });
    return () => {
      active = false;
    };
  }, [authMode]);

  const handleSelectRole = (opt: (typeof ROLE_OPTIONS)[number]) => {
    setSelectedRole(opt.role);
    setOrganization(opt.defaultOrg);
  };

  const switchMode = (next: AuthMode) => {
    setAuthMode(next);
    setError(null);
    setSuccessMsg(null);
  };

  const handleSignInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setBusy(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Invalid email or password.');
        return;
      }
      onAuthComplete(data.user as UserSession, String(data.token));
    } catch {
      setError('Could not connect to authentication server.');
    } finally {
      setBusy(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!displayName.trim()) {
      setError('Please enter your full name.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (recoveryPhrase.trim().length < 3) {
      setError('Please enter a security recovery word (at least 3 characters).');
      return;
    }

    setBusy(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          displayName: displayName.trim(),
          role: selectedRole,
          organization: organization.trim(),
          recoveryPhrase: recoveryPhrase.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Registration failed. Please try again.');
        return;
      }
      onAuthComplete(data.user as UserSession, String(data.token));
    } catch {
      setError('Could not connect to authentication server.');
    } finally {
      setBusy(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!email.trim()) {
      setError('Please enter your registered email address.');
      return;
    }
    if (recoveryPhrase.trim().length < 3) {
      setError('Please enter your security recovery word.');
      return;
    }
    if (password.length < 6) {
      setError('New password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }

    setBusy(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          recoveryPhrase: recoveryPhrase.trim(),
          newPassword: password,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not reset password.');
        return;
      }
      setSuccessMsg(data.message || 'Password updated successfully. You can now sign in.');
      setConfirmPassword('');
      setRecoveryPhrase('');
    } catch {
      setError('Could not connect to authentication server.');
    } finally {
      setBusy(false);
    }
  };

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (adminMode === 'unclaimed') {
      if (!adminEmail.trim()) {
        setError('Please enter an administrator email.');
        return;
      }
      if (adminPasscode.length < 6) {
        setError('Admin passcode must be at least 6 characters.');
        return;
      }
      if (adminPasscode !== adminConfirmPasscode) {
        setError('Admin passcodes do not match.');
        return;
      }
    }

    setBusy(true);
    try {
      const endpoint =
        adminMode === 'unclaimed' ? '/api/auth/admin/claim' : '/api/auth/admin/login';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          adminMode === 'unclaimed'
            ? {
                email: adminEmail.trim(),
                displayName: adminName.trim(),
                passcode: adminPasscode,
              }
            : {
                email: adminEmail.trim() || undefined,
                passcode: adminPasscode,
              }
        ),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Admin authentication failed.');
        return;
      }
      onAuthComplete(data.user as UserSession, String(data.token));
    } catch {
      setError('Could not connect to authentication server.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-8 text-[#111827]">
      <LiveMobilityBackground />

      <div className="grid w-full max-w-5xl grid-cols-1 overflow-hidden rounded-3xl border border-black/[0.08] bg-white/90 shadow-2xl backdrop-blur-xl lg:grid-cols-12">
        {/* Left Energetic Ride-App Showcase Panel */}
        <div className="relative flex flex-col justify-between overflow-hidden bg-gradient-to-br from-[#18122B] via-[#2B1B3D] to-[#0D3B36] p-6 text-white sm:p-8 lg:col-span-6">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-[#FF5A1F]/25 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-16 -left-16 h-56 w-56 rounded-full bg-[#10B981]/25 blur-3xl"
          />

          <div className="relative z-10">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[#FF5A1F] to-[#D93F0B] font-display text-xl font-extrabold text-white shadow-md">
                P
              </div>
              <div>
                <div className="font-display text-2xl font-extrabold tracking-tight">
                  ParkPool <span className="text-[#FF8A5C]">AI</span>
                </div>
                <div className="text-xs text-slate-300">
                  Smart Parking. Shared Possibilities.
                </div>
              </div>
            </div>

            <h1 className="mt-8 font-display text-3xl font-bold leading-snug text-white">
              Find, Book &amp; Share Verified Parking
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-slate-200">
              Connect with verified residential, community, and commercial spaces across
              Bengaluru with exact gate walking routes and instant booking protection.
            </p>

            <ul className="mt-6 space-y-3 text-sm text-slate-100">
              {[
                'Verified listings & transparent hourly pricing',
                'Live walking routes to exact parking gates',
                'QR gate verification & zero-loss overstay protection',
                'Instant confirmation & conflict-free slots',
              ].map((item) => (
                <li key={item} className="flex items-center gap-2.5">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-[#34D399]" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="relative z-10 mt-8 flex items-center justify-between border-t border-white/15 pt-4 text-xs text-slate-300">
            <span className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-[#FF8A5C]" />
              Bengaluru City Network
            </span>
            <span>Find · Book · Share</span>
          </div>
        </div>

        {/* Right Simple Auth Card */}
        <div className="flex flex-col justify-center p-6 sm:p-8 lg:col-span-6">
          {/* Visible 3-Role Selector (Driver, Provider, Admin) */}
          <div className="mb-4">
            <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-[#4B5563]">
              Select Workspace Role
            </div>
            <div className="grid grid-cols-3 gap-2" role="group" aria-label="Workspace role">
              {ROLE_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const active = authMode !== 'admin' && selectedRole === opt.role;
                return (
                  <button
                    key={opt.role}
                    type="button"
                    onClick={() => {
                      handleSelectRole(opt);
                      if (authMode === 'admin') {
                        switchMode('signin');
                      }
                    }}
                    className={`rounded-xl border p-2.5 text-left transition-all ${
                      active
                        ? `${opt.accentBorder} ${opt.accentBg}`
                        : 'border-black/[0.08] bg-[#F8F7F4] hover:border-black/20'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <Icon
                        className={`h-4 w-4 shrink-0 ${
                          active ? opt.accentText : 'text-[#4B5563]'
                        }`}
                      />
                      <span className="font-display text-xs font-bold text-[#111827]">
                        {opt.title}
                      </span>
                    </div>
                    <div className="mt-0.5 truncate text-[10px] text-[#4B5563]">
                      {opt.subtitle}
                    </div>
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() => switchMode('admin')}
                className={`rounded-xl border p-2.5 text-left transition-all ${
                  authMode === 'admin'
                    ? 'border-[#4338CA] bg-indigo-50 ring-1 ring-[#4338CA]'
                    : 'border-black/[0.08] bg-[#F8F7F4] hover:border-indigo-300'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <ShieldCheck
                    className={`h-4 w-4 shrink-0 ${
                      authMode === 'admin' ? 'text-[#4338CA]' : 'text-[#4B5563]'
                    }`}
                  />
                  <span className="font-display text-xs font-bold text-[#111827]">Admin</span>
                </div>
                <div className="mt-0.5 truncate text-[10px] text-[#4B5563]">
                  Verify, audit &amp; ops
                </div>
              </button>
            </div>
          </div>

          {authMode === 'forgot' ? (
            <div className="space-y-4">
              <div>
                <button
                  type="button"
                  onClick={() => switchMode('signin')}
                  className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold text-[#4B5563] hover:text-[#111827]"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Back to Sign In</span>
                </button>
                <h2 className="font-display text-2xl font-bold text-[#111827]">
                  Reset Your Password
                </h2>
                <p className="mt-1 text-xs text-[#4B5563]">
                  Enter your registered email and security recovery word to set a new password.
                </p>
              </div>

              {error && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-700">
                  {error}
                </div>
              )}

              {successMsg && (
                <div className="space-y-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-xs font-medium text-emerald-900">
                  <div>{successMsg}</div>
                  <button
                    type="button"
                    onClick={() => switchMode('signin')}
                    className="font-bold text-[#047857] underline"
                  >
                    Sign in now
                  </button>
                </div>
              )}

              <form onSubmit={(e) => void handleForgotSubmit(e)} className="space-y-3.5">
                <div>
                  <label
                    htmlFor="forgot-email"
                    className="mb-1 block text-xs font-semibold text-[#374151]"
                  >
                    Registered Email Address
                  </label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-[#4B5563]" />
                    <input
                      id="forgot-email"
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full rounded-xl border border-black/[0.1] bg-[#F8F7F4] py-2.5 pl-10 pr-3.5 text-sm text-[#111827] focus:border-[#D93F0B] focus:bg-white focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="forgot-recovery"
                    className="mb-1 block text-xs font-semibold text-[#374151]"
                  >
                    Security Recovery Word
                  </label>
                  <input
                    id="forgot-recovery"
                    type="text"
                    required
                    minLength={3}
                    maxLength={120}
                    value={recoveryPhrase}
                    onChange={(e) => setRecoveryPhrase(e.target.value)}
                    placeholder="Word set during registration"
                    className="w-full rounded-xl border border-black/[0.1] bg-[#F8F7F4] px-3.5 py-2.5 text-sm text-[#111827] focus:border-[#D93F0B] focus:bg-white focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="forgot-new-password"
                      className="mb-1 block text-xs font-semibold text-[#374151]"
                    >
                      New Password
                    </label>
                    <input
                      id="forgot-new-password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Min 6 characters"
                      className="w-full rounded-xl border border-black/[0.1] bg-[#F8F7F4] px-3.5 py-2.5 text-sm text-[#111827] focus:border-[#D93F0B] focus:bg-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="forgot-confirm-password"
                      className="mb-1 block text-xs font-semibold text-[#374151]"
                    >
                      Confirm New Password
                    </label>
                    <input
                      id="forgot-confirm-password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter password"
                      className="w-full rounded-xl border border-black/[0.1] bg-[#F8F7F4] px-3.5 py-2.5 text-sm text-[#111827] focus:border-[#D93F0B] focus:bg-white focus:outline-none"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={busy}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#E0430D] to-[#C83709] px-5 py-3 text-sm font-bold text-white shadow-sm transition-all hover:brightness-110 disabled:opacity-60"
                >
                  <span>{busy ? 'Updating Password...' : 'Reset Password'}</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </form>
            </div>
          ) : authMode === 'admin' ? (
            <div className="space-y-4">
              <div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-[#4338CA]" />
                  <h2 className="font-display text-2xl font-bold text-[#111827]">
                    {adminMode === 'unclaimed'
                      ? 'First-Run Admin Setup'
                      : 'Admin Operations Sign In'}
                  </h2>
                </div>
                <p className="mt-1 text-xs text-[#4B5563]">
                  {adminMode === 'unclaimed'
                    ? 'Claim administrator access by setting an admin passcode for this workspace.'
                    : 'Enter your administrator passcode to verify providers, spaces, disputes & ops.'}
                </p>
              </div>

              {error && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-700">
                  {error}
                </div>
              )}

              {adminMode === 'loading' ? (
                <div className="rounded-xl border border-black/[0.08] bg-[#F8F7F4] p-4 text-xs text-[#4B5563]">
                  Checking administrator configuration...
                </div>
              ) : (
                <form onSubmit={(e) => void handleAdminSubmit(e)} className="space-y-3.5">
                  <div>
                    <label
                      htmlFor="admin-email"
                      className="mb-1 block text-xs font-semibold text-[#374151]"
                    >
                      {adminMode === 'unclaimed'
                        ? 'Administrator Email'
                        : 'Administrator Email (optional)'}
                    </label>
                    <input
                      id="admin-email"
                      type="email"
                      required={adminMode === 'unclaimed'}
                      value={adminEmail}
                      onChange={(e) => setAdminEmail(e.target.value)}
                      placeholder="admin@parkpool.local"
                      className="w-full rounded-xl border border-black/[0.1] bg-[#F8F7F4] px-3.5 py-2.5 text-sm text-[#111827] focus:border-[#4338CA] focus:bg-white focus:outline-none"
                    />
                  </div>

                  {adminMode === 'unclaimed' && (
                    <div>
                      <label
                        htmlFor="admin-name"
                        className="mb-1 block text-xs font-semibold text-[#374151]"
                      >
                        Administrator Name
                      </label>
                      <input
                        id="admin-name"
                        type="text"
                        required
                        maxLength={100}
                        value={adminName}
                        onChange={(e) => setAdminName(e.target.value)}
                        className="w-full rounded-xl border border-black/[0.1] bg-[#F8F7F4] px-3.5 py-2.5 text-sm text-[#111827] focus:border-[#4338CA] focus:bg-white focus:outline-none"
                      />
                    </div>
                  )}

                  <div>
                    <label
                      htmlFor="admin-passcode"
                      className="mb-1 block text-xs font-semibold text-[#374151]"
                    >
                      {adminMode === 'unclaimed' ? 'Set Admin Passcode' : 'Admin Passcode'}
                    </label>
                    <input
                      id="admin-passcode"
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={adminPasscode}
                      onChange={(e) => setAdminPasscode(e.target.value)}
                      placeholder="Min 6 characters"
                      className="w-full rounded-xl border border-black/[0.1] bg-[#F8F7F4] px-3.5 py-2.5 text-sm text-[#111827] focus:border-[#4338CA] focus:bg-white focus:outline-none"
                    />
                  </div>

                  {adminMode === 'unclaimed' && (
                    <div>
                      <label
                        htmlFor="admin-confirm-passcode"
                        className="mb-1 block text-xs font-semibold text-[#374151]"
                      >
                        Confirm Admin Passcode
                      </label>
                      <input
                        id="admin-confirm-passcode"
                        type={showPassword ? 'text' : 'password'}
                        required
                        minLength={6}
                        value={adminConfirmPasscode}
                        onChange={(e) => setAdminConfirmPasscode(e.target.value)}
                        placeholder="Re-enter passcode"
                        className="w-full rounded-xl border border-black/[0.1] bg-[#F8F7F4] px-3.5 py-2.5 text-sm text-[#111827] focus:border-[#4338CA] focus:bg-white focus:outline-none"
                      />
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={busy}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#4338CA] to-[#3730A3] px-5 py-3 text-sm font-bold text-white shadow-sm transition-all hover:brightness-110 disabled:opacity-60"
                  >
                    <span>
                      {busy
                        ? 'Authenticating...'
                        : adminMode === 'unclaimed'
                        ? 'Claim Admin Access & Enter'
                        : 'Sign In as Admin'}
                    </span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </form>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <h2 className="font-display text-2xl font-bold text-[#111827]">
                  {authMode === 'signin'
                    ? `Sign In as ${selectedRole === 'host' ? 'Provider' : 'Driver'}`
                    : `Register as ${selectedRole === 'host' ? 'Provider' : 'Driver'}`}
                </h2>
                <p className="mt-1 text-xs text-[#4B5563]">
                  {authMode === 'signin'
                    ? 'Enter your email and password to access your workspace.'
                    : 'Register as a Driver or Parking Provider in seconds.'}
                </p>
              </div>

              <div
                role="tablist"
                aria-label="Authentication mode"
                className="grid grid-cols-2 gap-1.5 rounded-xl border border-black/[0.08] bg-[#F3F2EE] p-1"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={authMode === 'signin'}
                  onClick={() => switchMode('signin')}
                  className={`rounded-lg py-2 text-xs font-bold transition-all ${
                    authMode === 'signin'
                      ? 'bg-white text-[#111827] shadow-sm'
                      : 'text-[#4B5563] hover:text-[#111827]'
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={authMode === 'register'}
                  onClick={() => switchMode('register')}
                  className={`rounded-lg py-2 text-xs font-bold transition-all ${
                    authMode === 'register'
                      ? 'bg-white text-[#111827] shadow-sm'
                      : 'text-[#4B5563] hover:text-[#111827]'
                  }`}
                >
                  Register
                </button>
              </div>

              {!hasRegisteredUsers && authMode === 'register' && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2 text-xs font-medium text-amber-900">
                  First time here? Create your Driver or Provider account below to get started.
                </div>
              )}

              {error && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-700">
                  <div>{error}</div>
                  {authMode === 'signin' && (
                    <button
                      type="button"
                      onClick={() => switchMode('register')}
                      className="mt-1.5 font-bold text-[#C83709] underline"
                    >
                      Create a new account &rarr;
                    </button>
                  )}
                </div>
              )}

              {authMode === 'signin' ? (
                <form onSubmit={(e) => void handleSignInSubmit(e)} className="space-y-4">
                  <div>
                    <label
                      htmlFor="signin-email"
                      className="mb-1 block text-xs font-semibold text-[#374151]"
                    >
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-[#4B5563]" />
                      <input
                        id="signin-email"
                        type="email"
                        required
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="w-full rounded-xl border border-black/[0.1] bg-[#F8F7F4] py-2.5 pl-10 pr-3.5 text-sm text-[#111827] focus:border-[#D93F0B] focus:bg-white focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <label
                        htmlFor="signin-password"
                        className="text-xs font-semibold text-[#374151]"
                      >
                        Password
                      </label>
                      <button
                        type="button"
                        onClick={() => switchMode('forgot')}
                        className="text-xs font-semibold text-[#C83709] hover:underline"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <div className="relative">
                      <Lock className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-[#4B5563]" />
                      <input
                        id="signin-password"
                        type={showPassword ? 'text' : 'password'}
                        required
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter your password"
                        className="w-full rounded-xl border border-black/[0.1] bg-[#F8F7F4] py-2.5 pl-10 pr-10 text-sm text-[#111827] focus:border-[#D93F0B] focus:bg-white focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((s) => !s)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        className="absolute right-3 top-2.5 text-[#4B5563] hover:text-[#111827]"
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={busy}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#E0430D] to-[#C83709] px-5 py-3 text-sm font-bold text-white shadow-sm transition-all hover:brightness-110 disabled:opacity-60"
                  >
                    <span>{busy ? 'Signing In...' : 'Sign In'}</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>

                  <div className="rounded-xl border border-black/[0.07] bg-[#F8F7F4] px-4 py-3 text-center text-xs text-[#4B5563]">
                    New to ParkPool AI?{' '}
                    <button
                      type="button"
                      onClick={() => switchMode('register')}
                      className="font-bold text-[#C83709] hover:underline"
                    >
                      Register an account
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={(e) => void handleRegisterSubmit(e)} className="space-y-3">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label
                        htmlFor="reg-name"
                        className="mb-1 block text-xs font-semibold text-[#374151]"
                      >
                        Full Name
                      </label>
                      <input
                        id="reg-name"
                        type="text"
                        required
                        maxLength={100}
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="Your full name"
                        className="w-full rounded-xl border border-black/[0.1] bg-[#F8F7F4] px-3 py-2 text-sm text-[#111827] focus:border-[#D93F0B] focus:bg-white focus:outline-none"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="reg-org"
                        className="mb-1 block text-xs font-semibold text-[#374151]"
                      >
                        {selectedRole === 'host' ? 'Organization Name' : 'City / Commuter Label'}
                      </label>
                      <input
                        id="reg-org"
                        type="text"
                        required
                        maxLength={120}
                        value={organization}
                        onChange={(e) => setOrganization(e.target.value)}
                        className="w-full rounded-xl border border-black/[0.1] bg-[#F8F7F4] px-3 py-2 text-sm text-[#111827] focus:border-[#D93F0B] focus:bg-white focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="reg-email"
                      className="mb-1 block text-xs font-semibold text-[#374151]"
                    >
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-3.5 top-2.5 h-4 w-4 text-[#4B5563]" />
                      <input
                        id="reg-email"
                        type="email"
                        required
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="w-full rounded-xl border border-black/[0.1] bg-[#F8F7F4] py-2 pl-10 pr-3.5 text-sm text-[#111827] focus:border-[#D93F0B] focus:bg-white focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label
                        htmlFor="reg-password"
                        className="mb-1 block text-xs font-semibold text-[#374151]"
                      >
                        Password
                      </label>
                      <div className="relative">
                        <Lock className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-[#4B5563]" />
                        <input
                          id="reg-password"
                          type={showPassword ? 'text' : 'password'}
                          required
                          minLength={6}
                          autoComplete="new-password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Min 6 characters"
                          className="w-full rounded-xl border border-black/[0.1] bg-[#F8F7F4] py-2 pl-9 pr-9 text-sm text-[#111827] focus:border-[#D93F0B] focus:bg-white focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((s) => !s)}
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                          className="absolute right-2.5 top-2.5 text-[#4B5563] hover:text-[#111827]"
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="reg-confirm"
                        className="mb-1 block text-xs font-semibold text-[#374151]"
                      >
                        Confirm Password
                      </label>
                      <input
                        id="reg-confirm"
                        type={showPassword ? 'text' : 'password'}
                        required
                        minLength={6}
                        autoComplete="new-password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Re-enter password"
                        className="w-full rounded-xl border border-black/[0.1] bg-[#F8F7F4] px-3 py-2 text-sm text-[#111827] focus:border-[#D93F0B] focus:bg-white focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="reg-recovery"
                      className="mb-1 block text-xs font-semibold text-[#374151]"
                    >
                      Security Recovery Word (for Forgot Password)
                    </label>
                    <input
                      id="reg-recovery"
                      type="text"
                      required
                      minLength={3}
                      maxLength={120}
                      value={recoveryPhrase}
                      onChange={(e) => setRecoveryPhrase(e.target.value)}
                      placeholder="e.g. your hometown, pet name, or PIN"
                      className="w-full rounded-xl border border-black/[0.1] bg-[#F8F7F4] px-3 py-2 text-sm text-[#111827] focus:border-[#D93F0B] focus:bg-white focus:outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={busy}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#E0430D] to-[#C83709] px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-all hover:brightness-110 disabled:opacity-60"
                  >
                    <span>
                      {busy ? 'Creating Account...' : 'Create Account & Enter Workspace'}
                    </span>
                    <ArrowRight className="h-4 w-4" />
                  </button>

                  <div className="text-center text-xs text-[#4B5563]">
                    Already registered?{' '}
                    <button
                      type="button"
                      onClick={() => switchMode('signin')}
                      className="font-bold text-[#C83709] hover:underline"
                    >
                      Sign in here
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
