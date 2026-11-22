import crypto from 'crypto';
import { UserRole, UserSession } from '../src/types/parkpool';

const EPHEMERAL_DOC_SECRET = crypto.randomBytes(32).toString('hex');
const EPHEMERAL_WEBHOOK_SECRET = crypto.randomBytes(32).toString('hex');
const EPHEMERAL_QR_SECRET = crypto.randomBytes(32).toString('hex');
const EPHEMERAL_SESSION_SECRET = crypto.randomBytes(32).toString('hex');

function getSessionSecret(): string {
  return process.env.AUTH_SESSION_SECRET?.trim() || EPHEMERAL_SESSION_SECRET;
}

function getDocSecret(): string {
  return process.env.DOCUMENT_SIGNING_SECRET?.trim() || EPHEMERAL_DOC_SECRET;
}

function getWebhookSecret(): string {
  return process.env.PAYMENT_WEBHOOK_SECRET?.trim() || EPHEMERAL_WEBHOOK_SECRET;
}

function getQrSecret(): string {
  return process.env.QR_SIGNING_SECRET?.trim() || EPHEMERAL_QR_SECRET;
}

function safeEqualHex(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
  } catch {
    return false;
  }
}

export function hashSecret(plain: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(plain, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifySecret(plain: string, storedHash: string): boolean {
  if (!plain || !storedHash || !storedHash.includes(':')) return false;
  const [salt, expectedHex] = storedHash.split(':');
  if (!salt || !expectedHex || expectedHex.length !== 128) return false;
  try {
    const derived = crypto.scryptSync(plain, salt, 64);
    const expected = Buffer.from(expectedHex, 'hex');
    if (derived.length !== expected.length) return false;
    return crypto.timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

export function verifyConstantTimeString(provided: string, expected: string): boolean {
  if (!provided || !expected) return false;
  const a = crypto.createHash('sha256').update(provided, 'utf8').digest();
  const b = crypto.createHash('sha256').update(expected, 'utf8').digest();
  return crypto.timingSafeEqual(a, b);
}

export function signSessionToken(user: UserSession, ttlSeconds = 86400): string {
  const now = Date.now();
  const payload = Buffer.from(
    JSON.stringify({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      organization: user.organization,
      accentHex: user.accentHex,
      iat: now,
      exp: now + ttlSeconds * 1000,
    }),
    'utf8'
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', getSessionSecret()).update(payload).digest('hex');
  return `${payload}.${sig}`;
}

export function verifySessionToken(token: string | undefined): UserSession | null {
  if (!token || !token.includes('.')) return null;
  const parts = token.trim().split('.');
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  if (!payload || !sig) return null;
  const expectedSig = crypto
    .createHmac('sha256', getSessionSecret())
    .update(payload)
    .digest('hex');
  if (!safeEqualHex(sig, expectedSig)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      id?: string;
      name?: string;
      email?: string;
      role?: UserRole;
      organization?: string;
      accentHex?: string;
      exp?: number;
    };
    if (!parsed.exp || Date.now() > parsed.exp) return null;
    if (!parsed.id || !parsed.email || !parsed.name) return null;
    if (parsed.role !== 'driver' && parsed.role !== 'host' && parsed.role !== 'admin') {
      return null;
    }
    return {
      id: parsed.id,
      name: parsed.name,
      email: parsed.email,
      role: parsed.role,
      organization: parsed.organization || 'ParkPool AI',
      accentHex:
        parsed.accentHex ||
        (parsed.role === 'host'
          ? '#047857'
          : parsed.role === 'admin'
          ? '#4338CA'
          : '#C83709'),
    };
  } catch {
    return null;
  }
}

export function signDocumentAccessToken(
  docId: string,
  viewerId: string,
  ttlSeconds = 300
): { token: string; expiresAt: string } {
  const expMs = Date.now() + ttlSeconds * 1000;
  const payload = Buffer.from(
    JSON.stringify({
      docId,
      viewerId,
      exp: expMs,
    }),
    'utf8'
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', getDocSecret()).update(payload).digest('hex');
  return {
    token: `${payload}.${sig}`,
    expiresAt: new Date(expMs).toISOString(),
  };
}

export function verifyDocumentAccessToken(
  expectedDocId: string,
  token: string | undefined
): { valid: boolean; viewerId?: string; error?: string } {
  if (!token || !token.includes('.')) {
    return { valid: false, error: 'Missing or malformed access token' };
  }
  const [payload, sig] = token.split('.');
  if (!payload || !sig) {
    return { valid: false, error: 'Malformed access token' };
  }
  const expectedSig = crypto.createHmac('sha256', getDocSecret()).update(payload).digest('hex');
  if (!safeEqualHex(sig, expectedSig)) {
    return { valid: false, error: 'Invalid access token signature' };
  }
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      docId?: string;
      viewerId?: string;
      exp?: number;
    };
    if (parsed.docId !== expectedDocId) {
      return { valid: false, error: 'Token does not match document ID' };
    }
    if (!parsed.exp || Date.now() > parsed.exp) {
      return { valid: false, error: 'Short-lived document access link expired' };
    }
    return { valid: true, viewerId: parsed.viewerId };
  } catch {
    return { valid: false, error: 'Invalid token payload' };
  }
}

export function signWebhookPayload(rawPayload: string): string {
  return crypto.createHmac('sha256', getWebhookSecret()).update(rawPayload).digest('hex');
}

export function verifyWebhookSignature(
  rawPayload: string,
  providedSignature: string | undefined
): boolean {
  if (!providedSignature) return false;
  const expected = signWebhookPayload(rawPayload);
  return safeEqualHex(providedSignature.trim(), expected);
}

export function signBookingQrToken(
  bookingId: string,
  facilityId: string,
  accessCode: string
): string {
  const payload = `PKP-RIDER:${bookingId}:${facilityId}:${accessCode}`;
  const sig = crypto.createHmac('sha256', getQrSecret()).update(payload).digest('hex').slice(0, 16);
  return `${payload}:${sig}`;
}

export function verifyBookingQrToken(
  token: string
): { valid: boolean; bookingId?: string; facilityId?: string; accessCode?: string } {
  const parts = token.trim().split(':');
  if (parts.length !== 5 || parts[0] !== 'PKP-RIDER') return { valid: false };
  const [, bookingId, facilityId, accessCode, sig] = parts;
  const payload = `PKP-RIDER:${bookingId}:${facilityId}:${accessCode}`;
  const expected = crypto
    .createHmac('sha256', getQrSecret())
    .update(payload)
    .digest('hex')
    .slice(0, 16);
  if (!safeEqualHex(sig, expected)) return { valid: false };
  return { valid: true, bookingId, facilityId, accessCode };
}

export function signFacilityGateQrToken(facilityId: string, entranceLabel: string): string {
  const cleanGate = entranceLabel.replace(/:/g, ' ').trim();
  const payload = `PKP-GATE:${facilityId}:${cleanGate}`;
  const sig = crypto.createHmac('sha256', getQrSecret()).update(payload).digest('hex').slice(0, 16);
  return `${payload}:${sig}`;
}

export function verifyFacilityGateQrToken(
  token: string
): { valid: boolean; facilityId?: string; entranceLabel?: string } {
  const parts = token.trim().split(':');
  if (parts.length !== 4 || parts[0] !== 'PKP-GATE') return { valid: false };
  const [, facilityId, entranceLabel, sig] = parts;
  const payload = `PKP-GATE:${facilityId}:${entranceLabel}`;
  const expected = crypto
    .createHmac('sha256', getQrSecret())
    .update(payload)
    .digest('hex')
    .slice(0, 16);
  if (!safeEqualHex(sig, expected)) return { valid: false };
  return { valid: true, facilityId, entranceLabel };
}
