import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { UserRole, UserSession } from '../src/types/parkpool';
import {
  hashSecret,
  signSessionToken,
  verifyConstantTimeString,
  verifySecret,
} from './security';

interface StoredUserAccount {
  uid: string;
  email: string;
  displayName: string;
  role: 'driver' | 'host';
  organization: string;
  passwordHash: string;
  recoveryHash: string;
  createdAt: string;
  lastLoginAt: string;
}

interface StoredAdminAccount {
  uid: string;
  email: string;
  displayName: string;
  passcodeHash: string;
  claimedAt: string;
  lastLoginAt: string;
}

interface PersistedAuthStore {
  users: StoredUserAccount[];
  adminAccount?: StoredAdminAccount;
}

const DATA_DIR = path.resolve(process.cwd(), '.data');
const AUTH_STORE_PATH = path.resolve(DATA_DIR, 'auth-store.json');

if (!AUTH_STORE_PATH.startsWith(DATA_DIR + path.sep)) {
  throw new Error('Unsafe auth store path configuration.');
}

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(key: string, maxAttempts = 10, windowMs = 15 * 60 * 1000): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= maxAttempts) {
    return false;
  }
  entry.count += 1;
  return true;
}

function clearRateLimit(key: string): void {
  rateLimitMap.delete(key);
}

function loadAuthStore(): PersistedAuthStore {
  try {
    if (!fs.existsSync(AUTH_STORE_PATH)) {
      return { users: [] };
    }
    const raw = JSON.parse(fs.readFileSync(AUTH_STORE_PATH, 'utf8')) as Partial<PersistedAuthStore>;
    return {
      users: Array.isArray(raw.users) ? raw.users : [],
      adminAccount: raw.adminAccount,
    };
  } catch {
    return { users: [] };
  }
}

function saveAuthStore(store: PersistedAuthStore): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
    }
    fs.writeFileSync(AUTH_STORE_PATH, JSON.stringify(store, null, 2), {
      encoding: 'utf8',
      mode: 0o600,
    });
  } catch (err) {
    console.error('Failed to persist auth store:', err);
  }
}

const authStore: PersistedAuthStore = loadAuthStore();

function accentForRole(role: UserRole): string {
  if (role === 'host') return '#047857';
  if (role === 'admin') return '#4338CA';
  return '#C83709';
}

function isValidEmail(email: string): boolean {
  return email.length <= 160 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function toUserSession(account: {
  uid: string;
  displayName: string;
  email: string;
  role: UserRole;
  organization: string;
}): UserSession {
  return {
    id: account.uid,
    name: account.displayName,
    email: account.email,
    role: account.role,
    organization: account.organization,
    accentHex: accentForRole(account.role),
  };
}

export function getAdminAuthStatus(): {
  adminConfigured: boolean;
  adminMode: 'env' | 'claimed' | 'unclaimed';
  hasRegisteredUsers: boolean;
} {
  const hasRegisteredUsers = authStore.users.length > 0;
  const envConfigured = Boolean(process.env.ADMIN_PASSCODE?.trim());
  if (envConfigured) {
    return { adminConfigured: true, adminMode: 'env', hasRegisteredUsers };
  }
  if (authStore.adminAccount?.passcodeHash) {
    return { adminConfigured: true, adminMode: 'claimed', hasRegisteredUsers };
  }
  return { adminConfigured: false, adminMode: 'unclaimed', hasRegisteredUsers };
}

export function registerSimpleUser(params: {
  email: unknown;
  password: unknown;
  displayName: unknown;
  role: unknown;
  organization: unknown;
  recoveryPhrase: unknown;
}):
  | { ok: true; token: string; user: UserSession }
  | { ok: false; status: number; error: string } {
  const email = typeof params.email === 'string' ? params.email.trim().toLowerCase() : '';
  const password = typeof params.password === 'string' ? params.password : '';
  const displayName =
    typeof params.displayName === 'string' ? params.displayName.trim().slice(0, 100) : '';
  const rawRole = params.role === 'provider' ? 'host' : params.role;
  const role: 'driver' | 'host' | null =
    rawRole === 'host' ? 'host' : rawRole === 'driver' ? 'driver' : null;
  const recoveryPhrase =
    typeof params.recoveryPhrase === 'string' ? params.recoveryPhrase.trim().toLowerCase() : '';

  if (!role) {
    return { ok: false, status: 403, error: 'Accounts can only register as Driver or Provider.' };
  }
  if (!isValidEmail(email)) {
    return { ok: false, status: 400, error: 'Please enter a valid email address.' };
  }
  if (!displayName) {
    return { ok: false, status: 400, error: 'Full name is required.' };
  }
  if (password.length < 6 || password.length > 200) {
    return { ok: false, status: 400, error: 'Password must be between 6 and 200 characters.' };
  }
  if (recoveryPhrase.length < 3 || recoveryPhrase.length > 120) {
    return {
      ok: false,
      status: 400,
      error: 'Please set a security recovery word (at least 3 characters) for password resets.',
    };
  }

  const existing = authStore.users.find((u) => u.email === email);
  if (existing) {
    return {
      ok: false,
      status: 409,
      error: 'An account with this email already exists. Please sign in or reset your password.',
    };
  }

  const defaultOrg =
    role === 'host' ? 'Bengaluru Parking Partner' : 'Bengaluru Commuter';
  const organization =
    typeof params.organization === 'string' && params.organization.trim()
      ? params.organization.trim().slice(0, 120)
      : defaultOrg;

  const now = new Date().toISOString();
  const account: StoredUserAccount = {
    uid: `USR-${crypto.randomUUID().slice(0, 12)}`,
    email,
    displayName,
    role,
    organization,
    passwordHash: hashSecret(password),
    recoveryHash: hashSecret(recoveryPhrase),
    createdAt: now,
    lastLoginAt: now,
  };

  authStore.users.push(account);
  saveAuthStore(authStore);

  const user = toUserSession(account);
  const token = signSessionToken(user);
  return { ok: true, token, user };
}

export function loginSimpleUser(params: {
  email: unknown;
  password: unknown;
}):
  | { ok: true; token: string; user: UserSession }
  | { ok: false; status: number; error: string } {
  const email = typeof params.email === 'string' ? params.email.trim().toLowerCase() : '';
  const password = typeof params.password === 'string' ? params.password : '';

  if (!isValidEmail(email) || !password) {
    return { ok: false, status: 400, error: 'Valid email and password are required.' };
  }
  if (!checkRateLimit(`login:${email}`)) {
    return {
      ok: false,
      status: 429,
      error: 'Too many sign-in attempts. Please wait a few minutes and try again.',
    };
  }

  if (authStore.users.length === 0) {
    return {
      ok: false,
      status: 401,
      error: 'No accounts registered yet. Please click Register to create your Driver or Provider account.',
    };
  }

  const account = authStore.users.find((u) => u.email === email);
  if (!account || !verifySecret(password, account.passwordHash)) {
    return {
      ok: false,
      status: 401,
      error: 'Invalid email or password. Check your details or use Forgot Password.',
    };
  }

  clearRateLimit(`login:${email}`);
  account.lastLoginAt = new Date().toISOString();
  saveAuthStore(authStore);

  const user = toUserSession(account);
  const token = signSessionToken(user);
  return { ok: true, token, user };
}

export function resetSimpleUserPassword(params: {
  email: unknown;
  recoveryPhrase: unknown;
  newPassword: unknown;
}):
  | { ok: true; message: string }
  | { ok: false; status: number; error: string } {
  const email = typeof params.email === 'string' ? params.email.trim().toLowerCase() : '';
  const recoveryPhrase =
    typeof params.recoveryPhrase === 'string' ? params.recoveryPhrase.trim().toLowerCase() : '';
  const newPassword = typeof params.newPassword === 'string' ? params.newPassword : '';

  if (!isValidEmail(email)) {
    return { ok: false, status: 400, error: 'Please enter a valid registered email address.' };
  }
  if (!recoveryPhrase || recoveryPhrase.length < 3) {
    return { ok: false, status: 400, error: 'Please enter your security recovery word.' };
  }
  if (newPassword.length < 6 || newPassword.length > 200) {
    return { ok: false, status: 400, error: 'New password must be at least 6 characters.' };
  }
  if (!checkRateLimit(`reset:${email}`, 8)) {
    return {
      ok: false,
      status: 429,
      error: 'Too many reset attempts. Please wait a few minutes and try again.',
    };
  }

  const account = authStore.users.find((u) => u.email === email);
  if (!account || !verifySecret(recoveryPhrase, account.recoveryHash)) {
    return {
      ok: false,
      status: 401,
      error: 'Email or security recovery word did not match an account.',
    };
  }

  clearRateLimit(`reset:${email}`);
  account.passwordHash = hashSecret(newPassword);
  saveAuthStore(authStore);

  return {
    ok: true,
    message: 'Password updated successfully. You can now sign in with your new password.',
  };
}

export function claimAdminPasscode(params: {
  email: unknown;
  displayName: unknown;
  passcode: unknown;
}):
  | { ok: true; token: string; user: UserSession }
  | { ok: false; status: number; error: string } {
  const status = getAdminAuthStatus();
  if (status.adminConfigured) {
    return {
      ok: false,
      status: 409,
      error: 'Admin passcode is already configured. Use Admin Sign In.',
    };
  }

  const email = typeof params.email === 'string' ? params.email.trim().toLowerCase() : '';
  const displayName =
    typeof params.displayName === 'string' && params.displayName.trim()
      ? params.displayName.trim().slice(0, 100)
      : 'ParkPool Operations Admin';
  const passcode = typeof params.passcode === 'string' ? params.passcode : '';

  if (!isValidEmail(email)) {
    return { ok: false, status: 400, error: 'Please enter a valid administrator email.' };
  }
  if (passcode.length < 6 || passcode.length > 200) {
    return { ok: false, status: 400, error: 'Admin passcode must be at least 6 characters.' };
  }

  const now = new Date().toISOString();
  authStore.adminAccount = {
    uid: `ADM-${crypto.randomUUID().slice(0, 8)}`,
    email,
    displayName,
    passcodeHash: hashSecret(passcode),
    claimedAt: now,
    lastLoginAt: now,
  };
  saveAuthStore(authStore);

  const user = toUserSession({
    uid: authStore.adminAccount.uid,
    displayName: authStore.adminAccount.displayName,
    email: authStore.adminAccount.email,
    role: 'admin',
    organization: 'Compliance & Operations Command',
  });
  const token = signSessionToken(user);
  return { ok: true, token, user };
}

export function loginAdminPasscode(params: {
  email?: unknown;
  passcode: unknown;
}):
  | { ok: true; token: string; user: UserSession }
  | { ok: false; status: number; error: string } {
  const passcode = typeof params.passcode === 'string' ? params.passcode : '';
  const requestedEmail =
    typeof params.email === 'string' ? params.email.trim().toLowerCase() : '';

  if (!passcode) {
    return { ok: false, status: 400, error: 'Admin passcode is required.' };
  }
  if (!checkRateLimit('admin-login', 8)) {
    return {
      ok: false,
      status: 429,
      error: 'Too many admin sign-in attempts. Please wait a few minutes.',
    };
  }

  const envPasscode = process.env.ADMIN_PASSCODE?.trim();
  if (envPasscode) {
    if (!verifyConstantTimeString(passcode, envPasscode)) {
      return { ok: false, status: 401, error: 'Invalid admin passcode.' };
    }
    clearRateLimit('admin-login');
    const adminEmail =
      requestedEmail && isValidEmail(requestedEmail)
        ? requestedEmail
        : authStore.adminAccount?.email || 'admin@parkpool.local';
    const user = toUserSession({
      uid: authStore.adminAccount?.uid || 'ADM-ENV-01',
      displayName: authStore.adminAccount?.displayName || 'ParkPool Operations Admin',
      email: adminEmail,
      role: 'admin',
      organization: 'Compliance & Operations Command',
    });
    const token = signSessionToken(user);
    return { ok: true, token, user };
  }

  if (!authStore.adminAccount?.passcodeHash) {
    return {
      ok: false,
      status: 403,
      error: 'Admin passcode has not been claimed yet. Complete first-run admin setup.',
    };
  }

  if (
    requestedEmail &&
    requestedEmail !== authStore.adminAccount.email.toLowerCase()
  ) {
    return { ok: false, status: 401, error: 'Invalid admin email or passcode.' };
  }

  if (!verifySecret(passcode, authStore.adminAccount.passcodeHash)) {
    return { ok: false, status: 401, error: 'Invalid admin passcode.' };
  }

  clearRateLimit('admin-login');
  authStore.adminAccount.lastLoginAt = new Date().toISOString();
  saveAuthStore(authStore);

  const user = toUserSession({
    uid: authStore.adminAccount.uid,
    displayName: authStore.adminAccount.displayName,
    email: authStore.adminAccount.email,
    role: 'admin',
    organization: 'Compliance & Operations Command',
  });
  const token = signSessionToken(user);
  return { ok: true, token, user };
}
