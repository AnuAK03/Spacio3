import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Buildings,
  Car,
  CaretDown,
  CheckCircle,
  Clock,
  Envelope,
  Eye,
  EyeSlash,
  Key,
  List,
  LockSimple,
  MapPin,
  QrCode,
  ShieldCheck,
  Wallet,
  X,
} from '@phosphor-icons/react';
import { UserRole, UserSession } from '../types/parkpool';
import { LiveMobilityBackground } from './LiveMobilityBackground';

interface LoginPortalProps {
  onAuthComplete: (user: UserSession, token: string) => void;
}

type AuthMode = 'signin' | 'register' | 'forgot' | 'admin';
type AdminModeState = 'loading' | 'unclaimed' | 'claimed' | 'env';
type LegalDocType = 'privacy' | 'terms' | null;

const ROLE_OPTIONS: Array<{
  role: Extract<UserRole, 'driver' | 'host'>;
  title: string;
  subtitle: string;
  defaultOrg: string;
  accentText: string;
  accentBg: string;
  accentBorder: string;
  icon: React.ComponentType<{ className?: string; weight?: 'regular' | 'duotone' | 'fill' | 'bold' }>;
}> = [
  {
    role: 'driver',
    title: 'Driver',
    subtitle: 'Book & park',
    defaultOrg: 'Bengaluru Commuter',
    accentText: 'text-[#C83709]',
    accentBg: 'bg-[#FFF0EA]',
    accentBorder: 'border-[#C83709] ring-1 ring-[#C83709]',
    icon: Car,
  },
  {
    role: 'host',
    title: 'Provider',
    subtitle: 'Host & earn',
    defaultOrg: 'Bengaluru Parking Partner',
    accentText: 'text-[#047857]',
    accentBg: 'bg-emerald-50',
    accentBorder: 'border-[#047857] ring-1 ring-[#047857]',
    icon: Key,
  },
];

const NAV_ITEMS = [
  { id: 'benefits', label: 'Benefits' },
  { id: 'how-it-works', label: 'How it works' },
  { id: 'guarantees', label: 'Protection' },
  { id: 'faq', label: 'Questions' },
];

const BENEFITS = [
  {
    title: 'Upfront hourly totals',
    detail: 'See the parking rate, 10% service fee (minimum ₹10), and 18% GST before confirming your slot.',
    icon: Wallet,
  },
  {
    title: 'Exact gate walking routes',
    detail: 'Follow verified pedestrian paths from your assigned entrance straight to metro gates or office towers.',
    icon: MapPin,
  },
  {
    title: 'Zero loss turnaround buffer',
    detail: 'Every reservation holds a 15 minute clearance gap plus automatic relocation or ₹50 delay credit.',
    icon: ShieldCheck,
  },
  {
    title: 'Host slot & payout control',
    detail: 'Parking providers manage bays, assign drivers, inspect live calendars, and export payout statements.',
    icon: Buildings,
  },
];

const HOW_STEPS = [
  {
    step: '01',
    title: 'Pick hub, timing, and vehicle',
    detail:
      'Choose a Bengaluru corridor, set your arrival window, and select your vehicle profile so tight bays are filtered out automatically.',
    icon: Clock,
  },
  {
    step: '02',
    title: 'Confirm hold & unlock QR pass',
    detail:
      'Pay from your Prepaid Wallet to generate an encrypted Entry QR pass and Spot Access PIN with a locked turnaround buffer.',
    icon: QrCode,
  },
  {
    step: '03',
    title: 'Check in cleanly at the gate',
    detail:
      'Present your QR code or scan the bay placard on arrival, extend hours safely if clear, and settle extra minutes at checkout.',
    icon: CheckCircle,
  },
];

const FAQ_ITEMS = [
  {
    q: 'How does the 15 minute turnaround buffer protect my reservation?',
    a: 'Every paid slot enforces a mandatory 15 minute gap before the next booking starts. If a prior vehicle stays past that buffer, your bay locks for new bookings and ParkPool automatically moves you to a verified backup bay or issues a full refund with a ₹50 credit.',
  },
  {
    q: 'How are parking prices, platform fees, and GST calculated?',
    a: 'Parking fees follow the hourly rate posted by each verified provider. ParkPool adds a 10% service fee (minimum ₹10) plus 18% GST on the service charge, itemized clearly on every hold card and settlement receipt.',
  },
  {
    q: 'What happens if my meeting runs long and I need extra parking time?',
    a: 'Request an extension from your active booking card in Dashboard. The system checks downstream reservations and asks the provider, showing you the exact added cost before deducting funds from your Prepaid Wallet.',
  },
  {
    q: 'Do I need to scan a wall QR code or show my phone to gate staff?',
    a: 'Both work. You can present your Entry QR pass and numeric Spot Access PIN to gate security, or scan the facility wall placard directly from your active booking panel.',
  },
  {
    q: 'Can apartment associations and commercial lots list spare hours?',
    a: 'Yes. Register as a Provider to upload verification details, add facilities with exact entrance coordinates, set closing cutoffs, assign bays to specific drivers, and download HTML, TXT, or CSV settlement records.',
  },
  {
    q: 'Can I cancel a confirmed booking if my schedule changes?',
    a: 'Bookings cancelled before arrival return funds to your Prepaid Wallet cleanly. If a host ever withdraws a confirmed future bay for maintenance, you choose between free nearby rebooking or an instant refund.',
  },
  {
    q: 'How do EV chargers and vehicle size limits stay accurate?',
    a: 'Each bay declares supported vehicle classes (2 Wheeler, Hatchback, Sedan, SUV) and EV availability. Your selected profile filters out incompatible sizes before you ever tap reserve.',
  },
];

const TAGLINE_LINES = [
  ['Every', 'reserved', 'bay', 'holds', 'a', 'verified', 'buffer,'],
  ['checks', 'your', 'plate', 'at', 'the', 'gate,'],
  ['and', 'settles', 'every', 'minute', 'transparently.'],
];

const RevealBlock: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = '' }) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced || typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -24px 0px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} data-visible={visible ? 'true' : 'false'} className={`reveal-block ${className}`}>
      {children}
    </div>
  );
};

const TaglineRevealSection: React.FC = () => {
  const sectionRef = useRef<HTMLElement | null>(null);
  const wordRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const [revealedCount, setRevealedCount] = useState<number>(0);

  const totalWords = TAGLINE_LINES.reduce((acc, line) => acc + line.length, 0);

  useEffect(() => {
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      setRevealedCount(totalWords);
      return;
    }

    let rafId = 0;
    let isInView = false;

    const evaluateWords = () => {
      rafId = 0;
      const triggerY = window.innerHeight * 0.78;
      let passed = 0;
      wordRefs.current.forEach((span) => {
        if (!span) return;
        const rect = span.getBoundingClientRect();
        if (rect.top <= triggerY) {
          passed += 1;
        }
      });
      setRevealedCount((prev) => Math.max(prev, passed));
    };

    const onScrollOrResize = () => {
      if (!isInView || rafId) return;
      rafId = window.requestAnimationFrame(evaluateWords);
    };

    const el = sectionRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setRevealedCount(totalWords);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        isInView = entries.some((entry) => entry.isIntersecting);
        if (isInView && !rafId) {
          rafId = window.requestAnimationFrame(evaluateWords);
        }
      },
      { threshold: 0.05, rootMargin: '100px 0px 100px 0px' }
    );
    observer.observe(el);
    window.addEventListener('scroll', onScrollOrResize, { passive: true });
    window.addEventListener('resize', onScrollOrResize, { passive: true });

    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', onScrollOrResize);
      window.removeEventListener('resize', onScrollOrResize);
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, [totalWords]);

  let wordIdx = 0;

  return (
    <section
      ref={sectionRef}
      aria-label="Core platform promise"
      className="mx-auto max-w-[1360px] px-4 py-12 sm:px-6 sm:py-16"
    >
      <div className="rounded-3xl bg-[#181818] px-6 py-12 text-white sm:px-12 sm:py-16">
        <div className="caption-3 uppercase tracking-wider text-white/60">
          Why drivers and facility owners stay with ParkPool
        </div>
        <h2 className="mt-4 max-w-[680px] heading-3 sm:heading-2 text-white">
          {TAGLINE_LINES.map((line, lineIndex) => (
            <span key={lineIndex} className="block">
              {line.map((word) => {
                const currentIdx = wordIdx;
                wordIdx += 1;
                const active = currentIdx < revealedCount;
                return (
                  <span
                    key={`${lineIndex}-${currentIdx}`}
                    ref={(el) => {
                      wordRefs.current[currentIdx] = el;
                    }}
                    className={`inline-block mr-2.5 transition-opacity duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                      active ? 'opacity-100 text-white' : 'opacity-30 text-white'
                    }`}
                  >
                    {word}
                  </span>
                );
              })}
            </span>
          ))}
        </h2>
      </div>
    </section>
  );
};

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

  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [activeNavSection, setActiveNavSection] = useState<string>('benefits');
  const [openFaqIndex, setOpenFaqIndex] = useState<number>(0);
  const [legalDoc, setLegalDoc] = useState<LegalDocType>(null);

  const authEmailInputRef = useRef<HTMLInputElement | null>(null);
  const regNameInputRef = useRef<HTMLInputElement | null>(null);

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

  const validateEmailFormat = (value: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
  };

  const scrollToSection = (sectionId: string) => {
    setActiveNavSection(sectionId);
    setMobileNavOpen(false);
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const focusAuthPortal = () => {
    setMobileNavOpen(false);
    const portal = document.getElementById('access-portal');
    portal?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    window.setTimeout(() => {
      if (authMode === 'register') {
        regNameInputRef.current?.focus();
      } else {
        authEmailInputRef.current?.focus();
      }
    }, 320);
  };

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

    if (!validateEmailFormat(email)) {
      setError('Enter a valid email address such as name@domain.com.');
      return;
    }
    if (!password) {
      setError('Enter your password to sign in.');
      return;
    }

    setBusy(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Email or password did not match an account.');
        return;
      }
      onAuthComplete(data.user as UserSession, String(data.token));
    } catch {
      setError('Could not reach the authentication service. Try again shortly.');
    } finally {
      setBusy(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!displayName.trim()) {
      setError('Enter your full name to create an account.');
      return;
    }
    if (!validateEmailFormat(email)) {
      setError('Enter a valid email address such as name@domain.com.');
      return;
    }
    if (password.length < 6) {
      setError('Use at least 6 characters for your password.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Password entries do not match.');
      return;
    }
    if (recoveryPhrase.trim().length < 3) {
      setError('Enter a security recovery word with at least 3 characters.');
      return;
    }

    setBusy(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          password,
          displayName: displayName.trim(),
          role: selectedRole,
          organization: organization.trim(),
          recoveryPhrase: recoveryPhrase.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Account registration failed. Check your details and retry.');
        return;
      }
      onAuthComplete(data.user as UserSession, String(data.token));
    } catch {
      setError('Could not reach the authentication service. Try again shortly.');
    } finally {
      setBusy(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!validateEmailFormat(email)) {
      setError('Enter the registered email address for your account.');
      return;
    }
    if (recoveryPhrase.trim().length < 3) {
      setError('Enter your security recovery word.');
      return;
    }
    if (password.length < 6) {
      setError('New password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('New password entries do not match.');
      return;
    }

    setBusy(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          recoveryPhrase: recoveryPhrase.trim(),
          newPassword: password,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not reset password. Check your recovery word and retry.');
        return;
      }
      setSuccessMsg(data.message || 'Password updated. You can now sign in.');
      setConfirmPassword('');
      setRecoveryPhrase('');
    } catch {
      setError('Could not reach the authentication service. Try again shortly.');
    } finally {
      setBusy(false);
    }
  };

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (adminMode === 'unclaimed') {
      if (!validateEmailFormat(adminEmail)) {
        setError('Enter a valid administrator email address.');
        return;
      }
      if (adminPasscode.length < 6) {
        setError('Admin passcode must be at least 6 characters.');
        return;
      }
      if (adminPasscode !== adminConfirmPasscode) {
        setError('Admin passcode entries do not match.');
        return;
      }
    } else if (!adminPasscode) {
      setError('Enter your administrator passcode.');
      return;
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
        setError(data.error || 'Administrator sign in failed.');
        return;
      }
      onAuthComplete(data.user as UserSession, String(data.token));
    } catch {
      setError('Could not reach the authentication service. Try again shortly.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative min-h-screen text-[#111827]">
      <LiveMobilityBackground />

      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-[#111827] focus:px-3 focus:py-2 focus:button-sm focus:text-white"
      >
        Skip to content
      </a>

      {/* Floating Translucent Compact Header */}
      <header className="sticky top-3 z-40 mx-auto max-w-[1360px] px-4 sm:px-6">
        <nav
          aria-label="Primary navigation"
          className="flex items-center justify-between gap-4 rounded-2xl border border-black/[0.08] bg-white/85 px-4 py-2 shadow-sm backdrop-blur-xl"
        >
          <a
            href="#top"
            className="flex items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111827]"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#111827] text-white">
              <MapPin className="h-4 w-4 text-[#FF8A5C]" weight="fill" />
            </span>
            <span className="heading-6 text-[#111827]">
              ParkPool <span className="text-[#C83709]">AI</span>
            </span>
          </a>

          <div className="hidden items-center gap-6 md:flex">
            {NAV_ITEMS.map((item) => {
              const active = activeNavSection === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => scrollToSection(item.id)}
                  aria-current={active ? 'location' : undefined}
                  className={`title-4 transition-colors duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111827] rounded-md px-1 py-0.5 ${
                    active ? 'text-[#C83709]' : 'text-[#4B5563] hover:text-[#111827]'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={focusAuthPortal}
              className="hidden rounded-xl bg-[#111827] px-3 py-2 button-sm text-white transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-black active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C83709] sm:inline-flex"
            >
              Sign in
            </button>

            <button
              type="button"
              onClick={() => setMobileNavOpen((prev) => !prev)}
              aria-expanded={mobileNavOpen}
              aria-label={mobileNavOpen ? 'Close navigation menu' : 'Open navigation menu'}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-black/[0.1] bg-white text-[#111827] transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111827] md:hidden"
            >
              <span
                className={`inline-flex transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                  mobileNavOpen ? 'rotate-90 scale-105' : 'rotate-0 scale-100'
                }`}
              >
                {mobileNavOpen ? <X className="h-5 w-5" /> : <List className="h-5 w-5" />}
              </span>
            </button>
          </div>
        </nav>
      </header>

      {/* Full-Height Mobile Navigation Overlay (B7) */}
      {mobileNavOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Mobile menu"
          className="fixed inset-0 z-50 flex flex-col justify-between bg-[#F8F7F4]/95 p-6 backdrop-blur-xl md:hidden"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#111827] text-white">
                <MapPin className="h-4 w-4 text-[#FF8A5C]" weight="fill" />
              </span>
              <span className="heading-6 text-[#111827]">ParkPool AI</span>
            </div>
            <button
              type="button"
              onClick={() => setMobileNavOpen(false)}
              aria-label="Close mobile menu"
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-black/[0.1] bg-white text-[#111827]"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex flex-col gap-4">
            {NAV_ITEMS.map((item, idx) => (
              <button
                key={item.id}
                type="button"
                onClick={() => scrollToSection(item.id)}
                style={{
                  transitionDelay: `${Math.min(idx * 60, 400)}ms`,
                }}
                className="heading-4 text-left text-[#111827] transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] translate-y-0 opacity-100 hover:text-[#C83709]"
              >
                {item.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={focusAuthPortal}
            className="w-full rounded-xl bg-[#C83709] px-3 py-2 button-md text-white transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.98]"
          >
            Sign in to reserve
          </button>
        </div>
      )}

      <main id="main-content" className="pb-16">
        {/* HERO SECTION (Layout Type A) */}
        <section id="top" className="mx-auto max-w-[1360px] px-4 pt-8 pb-12 sm:px-6 sm:pt-12 sm:pb-16">
          <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12 lg:gap-12">
            {/* Hero Copy Column (max-w-680px per B5) */}
            <div className="lg:col-span-6 lg:pt-4">
              <div className="inline-flex items-center gap-2 rounded-lg border border-black/[0.08] bg-white px-3 py-1.5 caption-3 text-[#374151]">
                <MapPin className="h-3.5 w-3.5 text-[#C83709]" weight="fill" />
                <span>Bengaluru shared parking network</span>
              </div>

              <h1 className="mt-6 max-w-[680px] heading-2 sm:heading-1 bg-gradient-to-r from-[#000000] to-[#666666] bg-clip-text text-transparent">
                Verified Bengaluru parking
                <br />
                without gate surprises
              </h1>

              <p className="mt-6 max-w-[680px] body-3 text-[#4B5563]">
                Reserve residential, apartment, and commercial parking bays across key Bengaluru
                corridors with upfront hourly pricing, live gate walking routes, and built in delay
                protection.
              </p>

              {/* Single Primary CTA above the fold */}
              <div className="mt-8">
                <button
                  type="button"
                  onClick={focusAuthPortal}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#C83709] px-3 py-2 button-md text-white transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-[#B23008] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111827] focus-visible:ring-offset-2"
                >
                  <span>Sign in to reserve</span>
                  <ArrowRight className="h-4 w-4" weight="bold" />
                </button>
              </div>

              {/* Single Grounded Proof Signal */}
              <div className="mt-8 rounded-2xl border border-black/[0.08] bg-white p-4">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2 body-5 text-[#111827]">
                    <ShieldCheck className="h-4 w-4 text-[#047857]" weight="fill" />
                    <span>15 minute turnaround buffer</span>
                  </div>
                  <div className="flex items-center gap-2 body-5 text-[#111827]">
                    <CheckCircle className="h-4 w-4 text-[#047857]" weight="fill" />
                    <span>10% service fee, minimum ₹10</span>
                  </div>
                  <div className="flex items-center gap-2 body-5 text-[#111827]">
                    <Wallet className="h-4 w-4 text-[#4338CA]" weight="fill" />
                    <span>₹50 delay protection credit</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Hero Visual / Live Workspace Auth Card */}
            <div
              id="access-portal"
              className="rounded-3xl border border-black/[0.08] bg-white p-6 shadow-sm lg:col-span-6"
            >
              {/* Visible 3 Role Selector (Driver, Provider, Admin) */}
              <div className="mb-4">
                <div className="mb-2 caption-3 uppercase tracking-wider text-[#4B5563]">
                  Select workspace role
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
                        className={`rounded-2xl border p-3 text-left transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111827] ${
                          active
                            ? `${opt.accentBorder} ${opt.accentBg}`
                            : 'border-black/[0.08] bg-[#F8F7F4] hover:border-black/20'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Icon
                            className={`h-4 w-4 shrink-0 ${
                              active ? opt.accentText : 'text-[#4B5563]'
                            }`}
                            weight={active ? 'fill' : 'regular'}
                          />
                          <span className="title-4 text-[#111827]">{opt.title}</span>
                        </div>
                        <div className="mt-1 truncate caption-5 text-[#4B5563]">
                          {opt.subtitle}
                        </div>
                      </button>
                    );
                  })}

                  <button
                    type="button"
                    onClick={() => switchMode('admin')}
                    className={`rounded-2xl border p-3 text-left transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4338CA] ${
                      authMode === 'admin'
                        ? 'border-[#4338CA] bg-indigo-50 ring-1 ring-[#4338CA]'
                        : 'border-black/[0.08] bg-[#F8F7F4] hover:border-indigo-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <ShieldCheck
                        className={`h-4 w-4 shrink-0 ${
                          authMode === 'admin' ? 'text-[#4338CA]' : 'text-[#4B5563]'
                        }`}
                        weight={authMode === 'admin' ? 'fill' : 'regular'}
                      />
                      <span className="title-4 text-[#111827]">Admin</span>
                    </div>
                    <div className="mt-1 truncate caption-5 text-[#4B5563]">Verify &amp; ops</div>
                  </button>
                </div>
              </div>

              {authMode === 'forgot' ? (
                <div className="space-y-4">
                  <div>
                    <button
                      type="button"
                      onClick={() => switchMode('signin')}
                      className="mb-3 inline-flex items-center gap-2 caption-3 text-[#4B5563] transition-colors duration-300 hover:text-[#111827]"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" />
                      <span>Back to sign in</span>
                    </button>
                    <h2 className="heading-5 text-[#111827]">Reset your password</h2>
                    <p className="mt-1 caption-2 text-[#4B5563]">
                      Enter your registered email and security recovery word to set a new password.
                    </p>
                  </div>

                  {error && (
                    <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 caption-1 text-rose-700">
                      {error}
                    </div>
                  )}

                  {successMsg && (
                    <div className="space-y-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 caption-1 text-emerald-900">
                      <div>{successMsg}</div>
                      <button
                        type="button"
                        onClick={() => switchMode('signin')}
                        className="button-sm text-[#047857] underline"
                      >
                        Sign in now
                      </button>
                    </div>
                  )}

                  <form
                    noValidate
                    onSubmit={(e) => void handleForgotSubmit(e)}
                    className="space-y-4"
                  >
                    <div>
                      <label htmlFor="forgot-email" className="mb-1 block title-5 text-[#374151]">
                        Registered email address
                      </label>
                      <div className="relative">
                        <Envelope className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-[#4B5563]" />
                        <input
                          id="forgot-email"
                          type="email"
                          required
                          autoComplete="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="you@example.com"
                          className="w-full rounded-xl border border-black/[0.1] bg-[#F8F7F4] py-2 pl-9 pr-3 body-5 text-[#111827] transition-colors duration-300 focus:border-[#C83709] focus:bg-white focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="forgot-recovery"
                        className="mb-1 block title-5 text-[#374151]"
                      >
                        Security recovery word
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
                        className="w-full rounded-xl border border-black/[0.1] bg-[#F8F7F4] px-3 py-2 body-5 text-[#111827] transition-colors duration-300 focus:border-[#C83709] focus:bg-white focus:outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label
                          htmlFor="forgot-new-password"
                          className="mb-1 block title-5 text-[#374151]"
                        >
                          New password
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
                          className="w-full rounded-xl border border-black/[0.1] bg-[#F8F7F4] px-3 py-2 body-5 text-[#111827] transition-colors duration-300 focus:border-[#C83709] focus:bg-white focus:outline-none"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="forgot-confirm-password"
                          className="mb-1 block title-5 text-[#374151]"
                        >
                          Confirm password
                        </label>
                        <input
                          id="forgot-confirm-password"
                          type={showPassword ? 'text' : 'password'}
                          required
                          minLength={6}
                          autoComplete="new-password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="Confirm password"
                          className="w-full rounded-xl border border-black/[0.1] bg-[#F8F7F4] px-3 py-2 body-5 text-[#111827] transition-colors duration-300 focus:border-[#C83709] focus:bg-white focus:outline-none"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={busy}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#C83709] px-3 py-2 button-md text-white transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-[#B23008] active:scale-[0.98] disabled:opacity-60"
                    >
                      <span>{busy ? 'Updating password...' : 'Reset password'}</span>
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </form>
                </div>
              ) : authMode === 'admin' ? (
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-5 w-5 text-[#4338CA]" weight="fill" />
                      <h2 className="heading-5 text-[#111827]">
                        {adminMode === 'unclaimed'
                          ? 'First run admin setup'
                          : 'Admin operations sign in'}
                      </h2>
                    </div>
                    <p className="mt-1 caption-2 text-[#4B5563]">
                      {adminMode === 'unclaimed'
                        ? 'Claim administrator access by setting a passcode for this workspace.'
                        : 'Enter your administrator passcode to verify providers, facilities, and disputes.'}
                    </p>
                  </div>

                  {error && (
                    <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 caption-1 text-rose-700">
                      {error}
                    </div>
                  )}

                  {adminMode === 'loading' ? (
                    <div className="space-y-3 rounded-xl border border-black/[0.08] bg-[#F8F7F4] p-4">
                      <div className="h-4 w-2/3 animate-pulse rounded bg-black/[0.08]" />
                      <div className="h-8 w-full animate-pulse rounded-lg bg-black/[0.06]" />
                      <div className="h-8 w-full animate-pulse rounded-lg bg-black/[0.06]" />
                    </div>
                  ) : (
                    <form
                      noValidate
                      onSubmit={(e) => void handleAdminSubmit(e)}
                      className="space-y-4"
                    >
                      <div>
                        <label htmlFor="admin-email" className="mb-1 block title-5 text-[#374151]">
                          {adminMode === 'unclaimed'
                            ? 'Administrator email'
                            : 'Administrator email (optional)'}
                        </label>
                        <input
                          id="admin-email"
                          type="email"
                          required={adminMode === 'unclaimed'}
                          value={adminEmail}
                          onChange={(e) => setAdminEmail(e.target.value)}
                          placeholder="admin@parkpool.local"
                          className="w-full rounded-xl border border-black/[0.1] bg-[#F8F7F4] px-3 py-2 body-5 text-[#111827] transition-colors duration-300 focus:border-[#4338CA] focus:bg-white focus:outline-none"
                        />
                      </div>

                      {adminMode === 'unclaimed' && (
                        <div>
                          <label htmlFor="admin-name" className="mb-1 block title-5 text-[#374151]">
                            Administrator name
                          </label>
                          <input
                            id="admin-name"
                            type="text"
                            required
                            maxLength={100}
                            value={adminName}
                            onChange={(e) => setAdminName(e.target.value)}
                            className="w-full rounded-xl border border-black/[0.1] bg-[#F8F7F4] px-3 py-2 body-5 text-[#111827] transition-colors duration-300 focus:border-[#4338CA] focus:bg-white focus:outline-none"
                          />
                        </div>
                      )}

                      <div>
                        <label
                          htmlFor="admin-passcode"
                          className="mb-1 block title-5 text-[#374151]"
                        >
                          {adminMode === 'unclaimed' ? 'Set admin passcode' : 'Admin passcode'}
                        </label>
                        <input
                          id="admin-passcode"
                          type={showPassword ? 'text' : 'password'}
                          required
                          minLength={6}
                          value={adminPasscode}
                          onChange={(e) => setAdminPasscode(e.target.value)}
                          placeholder="Min 6 characters"
                          className="w-full rounded-xl border border-black/[0.1] bg-[#F8F7F4] px-3 py-2 body-5 text-[#111827] transition-colors duration-300 focus:border-[#4338CA] focus:bg-white focus:outline-none"
                        />
                      </div>

                      {adminMode === 'unclaimed' && (
                        <div>
                          <label
                            htmlFor="admin-confirm-passcode"
                            className="mb-1 block title-5 text-[#374151]"
                          >
                            Confirm admin passcode
                          </label>
                          <input
                            id="admin-confirm-passcode"
                            type={showPassword ? 'text' : 'password'}
                            required
                            minLength={6}
                            value={adminConfirmPasscode}
                            onChange={(e) => setAdminConfirmPasscode(e.target.value)}
                            placeholder="Confirm passcode"
                            className="w-full rounded-xl border border-black/[0.1] bg-[#F8F7F4] px-3 py-2 body-5 text-[#111827] transition-colors duration-300 focus:border-[#4338CA] focus:bg-white focus:outline-none"
                          />
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={busy}
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#4338CA] px-3 py-2 button-md text-white transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-[#3730A3] active:scale-[0.98] disabled:opacity-60"
                      >
                        <span>
                          {busy
                            ? 'Authenticating...'
                            : adminMode === 'unclaimed'
                            ? 'Claim admin access'
                            : 'Sign in as admin'}
                        </span>
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    </form>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <h2 className="heading-5 text-[#111827]">
                      {authMode === 'signin'
                        ? `Sign in as ${selectedRole === 'host' ? 'Provider' : 'Driver'}`
                        : `Register as ${selectedRole === 'host' ? 'Provider' : 'Driver'}`}
                    </h2>
                    <p className="mt-1 caption-2 text-[#4B5563]">
                      {authMode === 'signin'
                        ? 'Enter your email and password to open your workspace.'
                        : 'Create your Driver or Parking Provider account in seconds.'}
                    </p>
                  </div>

                  <div
                    role="tablist"
                    aria-label="Authentication mode"
                    className="grid grid-cols-2 gap-2 rounded-2xl border border-black/[0.08] bg-[#F3F2EE] p-1"
                  >
                    <button
                      type="button"
                      role="tab"
                      aria-selected={authMode === 'signin'}
                      onClick={() => switchMode('signin')}
                      className={`rounded-xl py-2 button-sm transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                        authMode === 'signin'
                          ? 'bg-white text-[#111827] shadow-xs'
                          : 'text-[#4B5563] hover:text-[#111827]'
                      }`}
                    >
                      Sign in
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={authMode === 'register'}
                      onClick={() => switchMode('register')}
                      className={`rounded-xl py-2 button-sm transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                        authMode === 'register'
                          ? 'bg-white text-[#111827] shadow-xs'
                          : 'text-[#4B5563] hover:text-[#111827]'
                      }`}
                    >
                      Register
                    </button>
                  </div>

                  {!hasRegisteredUsers && authMode === 'register' && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 caption-1 text-amber-900">
                      First time here? Create your Driver or Provider account below to begin.
                    </div>
                  )}

                  {error && (
                    <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 caption-1 text-rose-700">
                      <div>{error}</div>
                      {authMode === 'signin' && (
                        <button
                          type="button"
                          onClick={() => switchMode('register')}
                          className="mt-2 button-xsm text-[#C83709] underline"
                        >
                          Create a new account
                        </button>
                      )}
                    </div>
                  )}

                  {authMode === 'signin' ? (
                    <form
                      noValidate
                      onSubmit={(e) => void handleSignInSubmit(e)}
                      className="space-y-4"
                    >
                      <div>
                        <label
                          htmlFor="signin-email"
                          className="mb-1 block title-5 text-[#374151]"
                        >
                          Email address
                        </label>
                        <div className="relative">
                          <Envelope className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-[#4B5563]" />
                          <input
                            ref={authEmailInputRef}
                            id="signin-email"
                            type="email"
                            required
                            autoComplete="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@example.com"
                            className="w-full rounded-xl border border-black/[0.1] bg-[#F8F7F4] py-2 pl-9 pr-3 body-5 text-[#111827] transition-colors duration-300 focus:border-[#C83709] focus:bg-white focus:outline-none"
                          />
                        </div>
                      </div>

                      <div>
                        <div className="mb-1 flex items-center justify-between">
                          <label htmlFor="signin-password" className="title-5 text-[#374151]">
                            Password
                          </label>
                          <button
                            type="button"
                            onClick={() => switchMode('forgot')}
                            className="caption-3 text-[#C83709] hover:underline"
                          >
                            Forgot password?
                          </button>
                        </div>
                        <div className="relative">
                          <LockSimple className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-[#4B5563]" />
                          <input
                            id="signin-password"
                            type={showPassword ? 'text' : 'password'}
                            required
                            autoComplete="current-password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Enter your password"
                            className="w-full rounded-xl border border-black/[0.1] bg-[#F8F7F4] py-2 pl-9 pr-9 body-5 text-[#111827] transition-colors duration-300 focus:border-[#C83709] focus:bg-white focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword((s) => !s)}
                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                            className="absolute right-3 top-2.5 text-[#4B5563] hover:text-[#111827]"
                          >
                            {showPassword ? (
                              <EyeSlash className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={busy}
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#C83709] px-3 py-2 button-md text-white transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-[#B23008] active:scale-[0.98] disabled:opacity-60"
                      >
                        <span>{busy ? 'Signing in...' : 'Sign in'}</span>
                        <ArrowRight className="h-4 w-4" />
                      </button>

                      <div className="rounded-xl border border-black/[0.08] bg-[#F8F7F4] px-4 py-3 text-center caption-2 text-[#4B5563]">
                        New to ParkPool AI?{' '}
                        <button
                          type="button"
                          onClick={() => switchMode('register')}
                          className="button-xsm text-[#C83709] hover:underline"
                        >
                          Register an account
                        </button>
                      </div>
                    </form>
                  ) : (
                    <form
                      noValidate
                      onSubmit={(e) => void handleRegisterSubmit(e)}
                      className="space-y-3"
                    >
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                          <label htmlFor="reg-name" className="mb-1 block title-5 text-[#374151]">
                            Full name
                          </label>
                          <input
                            ref={regNameInputRef}
                            id="reg-name"
                            type="text"
                            required
                            maxLength={100}
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            placeholder="Your full name"
                            className="w-full rounded-xl border border-black/[0.1] bg-[#F8F7F4] px-3 py-2 body-5 text-[#111827] transition-colors duration-300 focus:border-[#C83709] focus:bg-white focus:outline-none"
                          />
                        </div>

                        <div>
                          <label htmlFor="reg-org" className="mb-1 block title-5 text-[#374151]">
                            {selectedRole === 'host'
                              ? 'Organization name'
                              : 'City or commuter label'}
                          </label>
                          <input
                            id="reg-org"
                            type="text"
                            required
                            maxLength={120}
                            value={organization}
                            onChange={(e) => setOrganization(e.target.value)}
                            className="w-full rounded-xl border border-black/[0.1] bg-[#F8F7F4] px-3 py-2 body-5 text-[#111827] transition-colors duration-300 focus:border-[#C83709] focus:bg-white focus:outline-none"
                          />
                        </div>
                      </div>

                      <div>
                        <label htmlFor="reg-email" className="mb-1 block title-5 text-[#374151]">
                          Email address
                        </label>
                        <div className="relative">
                          <Envelope className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-[#4B5563]" />
                          <input
                            id="reg-email"
                            type="email"
                            required
                            autoComplete="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@example.com"
                            className="w-full rounded-xl border border-black/[0.1] bg-[#F8F7F4] py-2 pl-9 pr-3 body-5 text-[#111827] transition-colors duration-300 focus:border-[#C83709] focus:bg-white focus:outline-none"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                          <label
                            htmlFor="reg-password"
                            className="mb-1 block title-5 text-[#374151]"
                          >
                            Password
                          </label>
                          <div className="relative">
                            <LockSimple className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-[#4B5563]" />
                            <input
                              id="reg-password"
                              type={showPassword ? 'text' : 'password'}
                              required
                              minLength={6}
                              autoComplete="new-password"
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              placeholder="Min 6 characters"
                              className="w-full rounded-xl border border-black/[0.1] bg-[#F8F7F4] py-2 pl-9 pr-9 body-5 text-[#111827] transition-colors duration-300 focus:border-[#C83709] focus:bg-white focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword((s) => !s)}
                              aria-label={showPassword ? 'Hide password' : 'Show password'}
                              className="absolute right-2.5 top-2.5 text-[#4B5563] hover:text-[#111827]"
                            >
                              {showPassword ? (
                                <EyeSlash className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        </div>

                        <div>
                          <label
                            htmlFor="reg-confirm"
                            className="mb-1 block title-5 text-[#374151]"
                          >
                            Confirm password
                          </label>
                          <input
                            id="reg-confirm"
                            type={showPassword ? 'text' : 'password'}
                            required
                            minLength={6}
                            autoComplete="new-password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Confirm password"
                            className="w-full rounded-xl border border-black/[0.1] bg-[#F8F7F4] px-3 py-2 body-5 text-[#111827] transition-colors duration-300 focus:border-[#C83709] focus:bg-white focus:outline-none"
                          />
                        </div>
                      </div>

                      <div>
                        <label
                          htmlFor="reg-recovery"
                          className="mb-1 block title-5 text-[#374151]"
                        >
                          Security recovery word
                        </label>
                        <input
                          id="reg-recovery"
                          type="text"
                          required
                          minLength={3}
                          maxLength={120}
                          value={recoveryPhrase}
                          onChange={(e) => setRecoveryPhrase(e.target.value)}
                          placeholder="Hometown, pet name, or memorable PIN"
                          className="w-full rounded-xl border border-black/[0.1] bg-[#F8F7F4] px-3 py-2 body-5 text-[#111827] transition-colors duration-300 focus:border-[#C83709] focus:bg-white focus:outline-none"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={busy}
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#C83709] px-3 py-2 button-md text-white transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-[#B23008] active:scale-[0.98] disabled:opacity-60"
                      >
                        <span>
                          {busy ? 'Creating account...' : 'Create account and enter'}
                        </span>
                        <ArrowRight className="h-4 w-4" />
                      </button>

                      <div className="text-center caption-2 text-[#4B5563]">
                        Already registered?{' '}
                        <button
                          type="button"
                          onClick={() => switchMode('signin')}
                          className="button-xsm text-[#C83709] hover:underline"
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
        </section>

        {/* PROBLEM TO SOLUTION & BENEFITS */}
        <section id="benefits" className="mx-auto max-w-[1360px] px-4 py-12 sm:px-6 sm:py-16">
          <RevealBlock>
            <div className="max-w-[680px]">
              <div className="caption-3 uppercase tracking-wider text-[#C83709]">
                From street hunting to predictable arrival
              </div>
              <h2 className="mt-3 heading-3 text-[#111827]">
                Shared urban bays backed by gate verification and buffer rules
              </h2>
              <p className="mt-3 body-3 text-[#4B5563]">
                Public lots fill unpredictably and unverified curb spaces leave drivers blocked at
                security booms. ParkPool verifies hosts, locks turnaround gaps, and clears gate
                entry before you leave home.
              </p>
            </div>

            <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {BENEFITS.map((b) => {
                const Icon = b.icon;
                return (
                  <article
                    key={b.title}
                    className="rounded-2xl border border-black/[0.08] bg-white p-6 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F8F7F4] text-[#C83709]">
                      <Icon className="h-5 w-5" weight="duotone" />
                    </div>
                    <h3 className="mt-4 heading-6 text-[#111827]">{b.title}</h3>
                    <p className="mt-2 body-6 text-[#4B5563]">{b.detail}</p>
                  </article>
                );
              })}
            </div>
          </RevealBlock>
        </section>

        {/* MANDATORY TAGLINE REVEAL SECTION (Part B11) */}
        <TaglineRevealSection />

        {/* HOW IT WORKS (3 STEPS) */}
        <section id="how-it-works" className="mx-auto max-w-[1360px] px-4 py-12 sm:px-6 sm:py-16">
          <RevealBlock>
            <div className="max-w-[680px]">
              <div className="caption-3 uppercase tracking-wider text-[#047857]">How it works</div>
              <h2 className="mt-3 heading-3 text-[#111827]">
                Three steps from hub search to gate clearance
              </h2>
            </div>

            <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
              {HOW_STEPS.map((st) => {
                const Icon = st.icon;
                return (
                  <article
                    key={st.step}
                    className="rounded-2xl border border-black/[0.08] bg-white p-6"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono caption-3 text-[#C83709]">Step {st.step}</span>
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#F8F7F4] text-[#111827]">
                        <Icon className="h-5 w-5" weight="duotone" />
                      </div>
                    </div>
                    <h3 className="mt-4 heading-6 text-[#111827]">{st.title}</h3>
                    <p className="mt-2 body-6 text-[#4B5563]">{st.detail}</p>
                  </article>
                );
              })}
            </div>
          </RevealBlock>
        </section>

        {/* RISK REVERSAL & GUARANTEES */}
        <section id="guarantees" className="mx-auto max-w-[1360px] px-4 py-12 sm:px-6 sm:py-16">
          <RevealBlock>
            <div className="rounded-3xl border border-black/[0.08] bg-white p-6 sm:p-10">
              <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-center">
                <div className="lg:col-span-6">
                  <div className="caption-3 uppercase tracking-wider text-[#047857]">
                    Rider and host protection
                  </div>
                  <h2 className="mt-3 heading-3 text-[#111827]">
                    Built in guarantees when schedules shift
                  </h2>
                  <p className="mt-3 body-3 text-[#4B5563]">
                    If a previous vehicle overstays or a facility closes unexpectedly, you stay
                    covered without phone tag or forfeited wallet funds.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:col-span-6">
                  <div className="rounded-2xl border border-black/[0.08] bg-[#F8F7F4] p-4">
                    <div className="font-mono heading-5 text-[#111827]">15 min</div>
                    <div className="mt-1 caption-4 text-[#4B5563]">
                      Mandatory clearance gap between slots
                    </div>
                  </div>
                  <div className="rounded-2xl border border-black/[0.08] bg-[#F8F7F4] p-4">
                    <div className="font-mono heading-5 text-[#047857]">₹0 fee</div>
                    <div className="mt-1 caption-4 text-[#4B5563]">
                      Relocation when a bay is blocked
                    </div>
                  </div>
                  <div className="rounded-2xl border border-black/[0.08] bg-[#F8F7F4] p-4">
                    <div className="font-mono heading-5 text-[#C83709]">₹50</div>
                    <div className="mt-1 caption-4 text-[#4B5563]">
                      Added delay credit if no backup bay fits
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </RevealBlock>
        </section>

        {/* FAQ ACCORDION */}
        <section id="faq" className="mx-auto max-w-[1360px] px-4 py-12 sm:px-6 sm:py-16">
          <RevealBlock>
            <div className="max-w-[680px]">
              <div className="caption-3 uppercase tracking-wider text-[#4338CA]">
                Common questions
              </div>
              <h2 className="mt-3 heading-3 text-[#111827]">
                Everything drivers and hosts verify before booking
              </h2>
            </div>

            <div className="mt-8 space-y-3">
              {FAQ_ITEMS.map((item, index) => {
                const open = openFaqIndex === index;
                return (
                  <div
                    key={item.q}
                    className="rounded-2xl border border-black/[0.08] bg-white"
                  >
                    <button
                      type="button"
                      aria-expanded={open}
                      onClick={() => setOpenFaqIndex(open ? -1 : index)}
                      className="flex w-full items-center justify-between gap-4 px-6 py-4 text-left transition-colors duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-[#F8F7F4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111827] rounded-2xl"
                    >
                      <span className="title-3 text-[#111827]">{item.q}</span>
                      <CaretDown
                        className={`h-4 w-4 shrink-0 text-[#4B5563] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                          open ? 'rotate-180 text-[#C83709]' : 'rotate-0'
                        }`}
                      />
                    </button>
                    {open && (
                      <div className="px-6 pb-4">
                        <p className="body-6 text-[#4B5563]">{item.a}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </RevealBlock>
        </section>

        {/* FINAL CTA */}
        <section className="mx-auto max-w-[1360px] px-4 py-12 sm:px-6 sm:py-16">
          <RevealBlock>
            <div className="flex flex-col items-start justify-between gap-6 rounded-3xl bg-[#181818] p-8 text-white sm:flex-row sm:items-center sm:p-12">
              <div className="max-w-[680px]">
                <h2 className="heading-3 text-white">
                  Reserve your next verified parking bay in Bengaluru
                </h2>
                <p className="mt-2 body-3 text-white/75">
                  Sign in as a Driver, register idle property bays as a Provider, or audit active
                  operations as an Admin.
                </p>
              </div>
              <button
                type="button"
                onClick={focusAuthPortal}
                className="shrink-0 inline-flex items-center gap-2 rounded-xl bg-[#C83709] px-3 py-2 button-md text-white transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-[#B23008] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <span>Sign in to reserve</span>
                <ArrowRight className="h-4 w-4" weight="bold" />
              </button>
            </div>
          </RevealBlock>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="mx-auto max-w-[1360px] px-4 pb-12 sm:px-6">
        <div className="flex flex-col justify-between gap-6 rounded-2xl border border-black/[0.08] bg-white p-6 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#111827] text-white">
              <MapPin className="h-4 w-4 text-[#FF8A5C]" weight="fill" />
            </span>
            <div>
              <div className="title-4 text-[#111827]">ParkPool AI</div>
              <div className="caption-5 text-[#4B5563]">
                Bengaluru shared parking coordination platform
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={() => scrollToSection('benefits')}
              className="caption-4 text-[#4B5563] hover:text-[#111827]"
            >
              Benefits
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('how-it-works')}
              className="caption-4 text-[#4B5563] hover:text-[#111827]"
            >
              How it works
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('faq')}
              className="caption-4 text-[#4B5563] hover:text-[#111827]"
            >
              Questions
            </button>
            <button
              type="button"
              onClick={() => setLegalDoc('privacy')}
              className="caption-4 text-[#4B5563] hover:text-[#111827]"
            >
              Privacy policy
            </button>
            <button
              type="button"
              onClick={() => setLegalDoc('terms')}
              className="caption-4 text-[#4B5563] hover:text-[#111827]"
            >
              Terms of use
            </button>
          </div>
        </div>
      </footer>

      {/* LEGAL DOCUMENT MODAL */}
      {legalDoc && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={legalDoc === 'privacy' ? 'Privacy policy' : 'Terms of use'}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
        >
          <div className="w-full max-w-lg rounded-2xl border border-black/[0.1] bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="heading-6 text-[#111827]">
                {legalDoc === 'privacy' ? 'Privacy policy' : 'Terms of use'}
              </h3>
              <button
                type="button"
                onClick={() => setLegalDoc(null)}
                aria-label="Close legal dialog"
                className="rounded-lg border border-black/[0.08] p-2 text-[#4B5563] hover:text-[#111827]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-4 space-y-3 body-6 text-[#4B5563]">
              {legalDoc === 'privacy' ? (
                <>
                  <p>
                    ParkPool AI collects only your account identity, registered vehicle plates, and
                    booking schedule required to verify gate entry and reconcile Prepaid Wallet
                    settlements.
                  </p>
                  <p>
                    Provider financial records and facilities are scoped to the owning account
                    and audited operations administrators. Driver location coordinates are used
                    strictly during active route requests and departure checks.
                  </p>
                </>
              ) : (
                <>
                  <p>
                    Every confirmed reservation enforces a 15 minute turnaround buffer before the
                    subsequent booking begins. Staying beyond your scheduled window incurs time
                    pro rata charges settled through your Prepaid Wallet.
                  </p>
                  <p>
                    Providers are responsible for maintaining safe gate access, accurate closing
                    cutoffs, and matching spot signage during active booking hours.
                  </p>
                </>
              )}
            </div>
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setLegalDoc(null)}
                className="rounded-xl bg-[#111827] px-3 py-2 button-sm text-white hover:bg-black"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
