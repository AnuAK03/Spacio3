import 'dotenv/config';
import express from 'express';
import type { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import {
  askDriverGenAiAgent,
  askPolicyRagAssistant,
  evaluateAutonomousOverstayLifecycle,
  runSupervisedMultiAgentWorkflow,
} from './server/agents.ts';
import { BENGALURU_LOCATIONS, parseTimeToMinutes, store } from './server/domain.ts';
import {
  claimAdminPasscode,
  getAdminAuthStatus,
  loginAdminPasscode,
  loginSimpleUser,
  registerSimpleUser,
  resetSimpleUserPassword,
} from './server/auth.ts';
import {
  signDocumentAccessToken,
  verifyDocumentAccessToken,
  verifySessionToken,
} from './server/security.ts';
import type {
  AgentStreamEvent,
  BengaluruLocation,
  DetailedProviderType,
  ProviderVerificationStatus,
  UserRole,
  UserSession,
  VerificationStatus,
} from './src/types/parkpool.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function extractBearerUser(req: Request): Promise<UserSession | null> {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return null;
  const token = auth.slice(7).trim();
  return verifySessionToken(token);
}

async function requireAuth(
  req: Request,
  res: Response,
  allowedRoles?: UserRole[]
): Promise<UserSession | null> {
  const user = await extractBearerUser(req);
  if (!user) {
    res.status(401).json({ error: 'Authentication required. Please sign in.' });
    return null;
  }
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    res.status(403).json({
      error: `Forbidden: requires ${allowedRoles.join(' or ')} role (current: ${user.role}).`,
    });
    return null;
  }
  return user;
}

function checkBookingAccess(
  bookingId: string,
  user: UserSession
): { found: boolean; authorized: boolean; booking?: (typeof store.bookings)[number] } {
  const bk = store.bookings.find((b) => b.id === bookingId);
  if (!bk) return { found: false, authorized: false };
  if (user.role === 'admin') return { found: true, authorized: true, booking: bk };
  if (user.role === 'host') {
    return {
      found: true,
      authorized: store.isFacilityOwnedByHost(bk.facilityId, user),
      booking: bk,
    };
  }
  const authorized = Boolean(
    bk.driverEmail && bk.driverEmail.toLowerCase() === user.email.toLowerCase()
  );
  return { found: true, authorized, booking: bk };
}

function checkHostBookingAccess(
  bookingId: string,
  user: UserSession
): { found: boolean; authorized: boolean; booking?: (typeof store.bookings)[number] } {
  const bk = store.bookings.find((b) => b.id === bookingId);
  if (!bk) return { found: false, authorized: false };
  if (user.role === 'admin') return { found: true, authorized: true, booking: bk };
  if (user.role !== 'host') return { found: true, authorized: false, booking: bk };
  return {
    found: true,
    authorized: store.isFacilityOwnedByHost(bk.facilityId, user),
    booking: bk,
  };
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    const openRouterKey = process.env.OPENROUTER_API_KEY?.trim();
    const openRouterConfigured = Boolean(
      openRouterKey && openRouterKey !== 'MY_OPENROUTER_API_KEY'
    );
    res.json({
      status: 'healthy',
      service: 'parkpool-ai-multi-agent-platform',
      aiProvider: 'openrouter',
      openRouterConfigured,
      openRouterModel: process.env.OPENROUTER_MODEL?.trim() || 'openrouter/auto',
      authProvider: 'parkpool-simple-auth',
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/api/maps/config', (_req, res) => {
    const apiKey = (
      process.env.VITE_GOOGLE_MAPS_API_KEY ||
      process.env.GOOGLE_MAPS_API_KEY ||
      ''
    ).trim();
    res.json({ apiKey });
  });

  app.get('/api/auth/status', (_req, res) => {
    res.json(getAdminAuthStatus());
  });

  app.post('/api/auth/register', (req, res) => {
    const { email, password, displayName, role, organization, recoveryPhrase } = req.body ?? {};
    const result = registerSimpleUser({
      email,
      password,
      displayName,
      role,
      organization,
      recoveryPhrase,
    });
    if (!result.ok) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    store.addAudit(
      'Spacio Auth',
      'USER_REGISTERED',
      `${result.user.name} (${result.user.email}) registered as ${result.user.role}.`
    );
    res.status(201).json({ token: result.token, user: result.user });
  });

  app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body ?? {};
    const result = loginSimpleUser({ email, password });
    if (!result.ok) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    store.addAudit(
      'Spacio Auth',
      'USER_AUTHENTICATED',
      `${result.user.name} (${result.user.email}) signed in as ${result.user.role}.`
    );
    res.json({ token: result.token, user: result.user });
  });

  app.post('/api/auth/reset-password', (req, res) => {
    const { email, recoveryPhrase, newPassword } = req.body ?? {};
    const result = resetSimpleUserPassword({ email, recoveryPhrase, newPassword });
    if (!result.ok) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    store.addAudit('Spacio Auth', 'PASSWORD_RESET', `Password updated for ${String(email || '').trim().toLowerCase()}.`);
    res.json({ ok: true, message: result.message });
  });

  app.post('/api/auth/admin/claim', (req, res) => {
    const { email, displayName, passcode } = req.body ?? {};
    const result = claimAdminPasscode({ email, displayName, passcode });
    if (!result.ok) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    store.addAudit(
      'Spacio Auth',
      'ADMIN_PASSCODE_CLAIMED',
      `First-run administrator claimed by ${result.user.email}.`
    );
    res.status(201).json({ token: result.token, user: result.user });
  });

  app.post('/api/auth/admin/login', (req, res) => {
    const { email, passcode } = req.body ?? {};
    const result = loginAdminPasscode({ email, passcode });
    if (!result.ok) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    store.addAudit(
      'Spacio Auth',
      'ADMIN_AUTHENTICATED',
      `Administrator ${result.user.email} signed in.`
    );
    res.json({ token: result.token, user: result.user });
  });

  app.get('/api/auth/me', async (req, res) => {
    const user = await requireAuth(req, res);
    if (!user) return;
    res.json({ user });
  });

  app.get('/api/workspace', async (req, res) => {
    const user = await requireAuth(req, res);
    if (!user) return;
    res.json(store.getSnapshotForUser(user));
  });

  // =========================================================================
  // DRIVER: LOCATION SEARCH & DISCOVERABILITY (ONLY APPROVED SPACES)
  // =========================================================================

  app.get('/api/locations/search', async (req, res) => {
    const query = String(req.query.q || '').trim();
    if (!query) {
      res.json({ results: BENGALURU_LOCATIONS });
      return;
    }

    const qLower = query.toLowerCase();
    const localMatches = BENGALURU_LOCATIONS.filter(
      (loc) =>
        loc.name.toLowerCase().includes(qLower) || loc.area.toLowerCase().includes(qLower)
    );

    const nominatimResults: BengaluruLocation[] = [];
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(
        `${query}, Bengaluru, Karnataka, India`
      )}&bounded=1&viewbox=77.42,13.18,77.82,12.78&countrycodes=in&limit=10`;

      const apiRes = await fetch(url, {
        headers: {
          'User-Agent': 'Spacio/1.0 (Bengaluru Shared Parking Platform)',
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(3500),
      });

      if (apiRes.ok) {
        const items = (await apiRes.json()) as Array<{
          place_id: number;
          name?: string;
          display_name: string;
          lat: string;
          lon: string;
        }>;
        for (const item of items) {
          const lat = Number(item.lat);
          const lng = Number(item.lon);
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
          const parts = item.display_name.split(',').map((p) => p.trim());
          const title = item.name || parts[0] || query;
          const area = parts.slice(1, 3).join(', ') || 'Bengaluru';
          const tooClose = localMatches.some(
            (m) => Math.abs(m.lat - lat) < 0.0005 && Math.abs(m.lng - lng) < 0.0005
          );
          if (!tooClose) {
            nominatimResults.push({
              id: `NOM-${item.place_id}`,
              name: title,
              area,
              lat,
              lng,
              source: 'nominatim',
            });
          }
        }
      }
    } catch {
      // Fallback gracefully to curated Bengaluru locations if Nominatim times out
    }

    res.json({ results: [...localMatches, ...nominatimResults].slice(0, 12) });
  });

  app.post('/api/locations/select', async (req, res) => {
    const user = await requireAuth(req, res);
    if (!user) return;
    const loc = req.body?.location as BengaluruLocation | undefined;
    if (
      !loc ||
      typeof loc.lat !== 'number' ||
      typeof loc.lng !== 'number' ||
      !Number.isFinite(loc.lat) ||
      !Number.isFinite(loc.lng)
    ) {
      res.status(400).json({ error: 'Valid Bengaluru location coordinates are required.' });
      return;
    }
    const cleanLoc: BengaluruLocation = {
      id: String(loc.id || `LOC-${Date.now()}`),
      name: String(loc.name || 'Bengaluru Destination').trim(),
      area: String(loc.area || 'Bengaluru').trim(),
      lat: Number(loc.lat),
      lng: Number(loc.lng),
      source: loc.source === 'hub' ? 'hub' : 'nominatim',
    };
    const { addedFacilities } = store.ensureLocationSupply(cleanLoc);
    res.json({
      location: cleanLoc,
      addedFacilities,
      snapshot: store.getSnapshotForUser(user),
    });
  });

  app.get('/api/search', async (req, res) => {
    const user = await requireAuth(req, res);
    if (!user) return;
    const vehicleId = String(req.query.vehicleId || 'VEH-SUV-01');
    const startMin = parseTimeToMinutes(String(req.query.start || '14:00'), 14 * 60);
    const endMin = parseTimeToMinutes(String(req.query.end || '17:30'), 17 * 60 + 30);
    const prioritize = String(req.query.prioritize || 'balanced') as
      | 'balanced'
      | 'closest_walk'
      | 'lowest_price'
      | 'covered_ev';

    const vehicle = store.vehicles.find((v) => v.id === vehicleId) || store.vehicles[0];
    const result = store.evaluateAllCandidates(startMin, endMin, vehicle, prioritize);
    res.json({
      vehicle,
      startMin,
      endMin,
      prioritize,
      ...result,
    });
  });

  app.get('/api/pooling/compare', async (req, res) => {
    const user = await requireAuth(req, res);
    if (!user) return;
    const strategies = store.computePoolingComparison();
    res.json({ strategies });
  });

  // =========================================================================
  // OPENROUTER MULTI-AGENT WORKFLOW & POLICY RAG
  // =========================================================================

  app.post('/api/agents/run', async (req, res) => {
    try {
      const {
        prompt,
        vehicleId,
        defaultStartTime,
        defaultEndTime,
        faultInjectionEnabled,
        targetSpaceId,
        destinationCoords,
      } = req.body ?? {};
      const cleanPrompt = typeof prompt === 'string' ? prompt.trim() : '';
      if (!cleanPrompt || cleanPrompt.length > 4000) {
        res.status(400).json({ error: 'A valid parking request prompt (1–4000 chars) is required.' });
        return;
      }
      const run = await runSupervisedMultiAgentWorkflow({
        prompt: cleanPrompt,
        vehicleId: String(vehicleId || 'VEH-SUV-01'),
        defaultStartTime,
        defaultEndTime,
        faultInjectionEnabled: Boolean(faultInjectionEnabled),
        targetSpaceId: typeof targetSpaceId === 'string' ? targetSpaceId : undefined,
        destinationCoords:
          destinationCoords &&
          typeof destinationCoords.lat === 'number' &&
          typeof destinationCoords.lng === 'number' &&
          Number.isFinite(destinationCoords.lat) &&
          Number.isFinite(destinationCoords.lng)
            ? { lat: Number(destinationCoords.lat), lng: Number(destinationCoords.lng) }
            : undefined,
      });
      res.json(run);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Unexpected error during supervised multi-agent run.';
      console.error('[Agent Workflow Error]', err);
      res.status(502).json({ error: message });
    }
  });

  app.post('/api/agents/stream', async (req, res) => {
    const {
      prompt,
      vehicleId,
      defaultStartTime,
      defaultEndTime,
      faultInjectionEnabled,
      targetSpaceId,
      destinationCoords,
    } = req.body ?? {};
    const cleanPrompt = typeof prompt === 'string' ? prompt.trim() : '';
    if (!cleanPrompt || cleanPrompt.length > 4000) {
      res.status(400).json({ error: 'A valid parking request prompt (1–4000 chars) is required.' });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const sendEvent = (ev: AgentStreamEvent) => {
      res.write(`data: ${JSON.stringify(ev)}\n\n`);
    };

    try {
      await runSupervisedMultiAgentWorkflow(
        {
          prompt: cleanPrompt,
          vehicleId: String(vehicleId || 'VEH-SUV-01'),
          defaultStartTime,
          defaultEndTime,
          faultInjectionEnabled: Boolean(faultInjectionEnabled),
          targetSpaceId: typeof targetSpaceId === 'string' ? targetSpaceId : undefined,
          destinationCoords:
            destinationCoords &&
            typeof destinationCoords.lat === 'number' &&
            typeof destinationCoords.lng === 'number' &&
            Number.isFinite(destinationCoords.lat) &&
            Number.isFinite(destinationCoords.lng)
              ? { lat: Number(destinationCoords.lat), lng: Number(destinationCoords.lng) }
              : undefined,
        },
        sendEvent
      );
      res.end();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Unexpected error during supervised multi-agent run.';
      console.error('[Agent Stream Error]', err);
      sendEvent({ type: 'workflow_error', error: message });
      res.end();
    }
  });

  app.post('/api/assistant/chat', async (req, res) => {
    try {
      const user = await extractBearerUser(req);
      const { question, vehicleId, activeBookingId, history } = req.body ?? {};
      const cleanQuestion = typeof question === 'string' ? question.trim() : '';
      if (!cleanQuestion || cleanQuestion.length > 2500) {
        res.status(400).json({ error: 'A valid question (1–2500 chars) is required.' });
        return;
      }
      const response = await askDriverGenAiAgent({
        question: cleanQuestion,
        userEmail: user?.email,
        userName: user?.name,
        userRole: user?.role,
        vehicleId: typeof vehicleId === 'string' && vehicleId.trim() ? vehicleId.trim() : undefined,
        activeBookingId:
          typeof activeBookingId === 'string' && activeBookingId.trim()
            ? activeBookingId.trim()
            : undefined,
        history: Array.isArray(history) ? history : undefined,
      });
      res.json(response);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Assistant failed to generate response.';
      console.error('[Driver Agent Error]', err);
      res.status(500).json({ error: message });
    }
  });

  app.post('/api/rag/ask', async (req, res) => {
    try {
      const user = await extractBearerUser(req);
      const { question } = req.body ?? {};
      const cleanQuestion = typeof question === 'string' ? question.trim() : '';
      if (!cleanQuestion || cleanQuestion.length > 2500) {
        res.status(400).json({ error: 'A valid policy question (1–2500 chars) is required.' });
        return;
      }
      const answer = await askDriverGenAiAgent({
        question: cleanQuestion,
        userEmail: user?.email,
        userName: user?.name,
        userRole: user?.role,
      });
      res.json(answer);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Policy RAG query failed.';
      console.error('[RAG Error]', err);
      res.status(502).json({ error: message });
    }
  });

  // =========================================================================
  // DRIVER PROFILE, BOOKINGS, SAFE EXTENSIONS & CHECK-IN/OUT
  // =========================================================================

  app.post('/api/driver/profile', async (req, res) => {
    const user = await requireAuth(req, res);
    if (!user) return;
    const {
      fullName,
      email,
      phone,
      licenseNumber,
      licenseValidTill,
      wheelerCategory,
      vehicleType,
      vehicleModel,
      plateNumber,
      isEv,
      registeredVehicleId,
    } = req.body ?? {};

    const effectiveEmail =
      user.role === 'admin' && typeof email === 'string' && email.trim()
        ? email.trim()
        : user.email;

    const result = store.upsertDriverProfile({
      fullName: String(fullName || user.name),
      email: effectiveEmail,
      phone: String(phone || ''),
      licenseNumber: String(licenseNumber || ''),
      licenseValidTill: String(licenseValidTill || '2032-12-31'),
      wheelerCategory: wheelerCategory === 'two_wheeler' ? 'two_wheeler' : 'four_wheeler',
      vehicleType:
        vehicleType === 'two_wheeler' ||
        vehicleType === 'hatchback' ||
        vehicleType === 'sedan' ||
        vehicleType === 'suv'
          ? vehicleType
          : wheelerCategory === 'two_wheeler'
          ? 'two_wheeler'
          : 'hatchback',
      vehicleModel: String(vehicleModel || ''),
      plateNumber: String(plateNumber || ''),
      isEv: Boolean(isEv),
      vehicleId:
        typeof registeredVehicleId === 'string' && registeredVehicleId.trim()
          ? registeredVehicleId.trim()
          : undefined,
    });

    if (!result.ok) {
      res.status(400).json({ error: result.error || 'Invalid driver profile details' });
      return;
    }

    res.status(201).json({
      profile: result.profile,
      vehicle: result.vehicle,
      snapshot: store.getSnapshotForUser(user),
    });
  });

  app.post('/api/driver/vehicles', async (req, res) => {
    const user = await requireAuth(req, res);
    if (!user) return;
    const { wheelerCategory, vehicleType, vehicleModel, plateNumber, isEv } = req.body ?? {};

    const result = store.addDriverVehicle({
      ownerEmail: user.email,
      ownerName: user.name,
      wheelerCategory: wheelerCategory === 'two_wheeler' ? 'two_wheeler' : 'four_wheeler',
      vehicleType:
        vehicleType === 'two_wheeler' ||
        vehicleType === 'hatchback' ||
        vehicleType === 'sedan' ||
        vehicleType === 'suv'
          ? vehicleType
          : wheelerCategory === 'two_wheeler'
          ? 'two_wheeler'
          : 'hatchback',
      vehicleModel: String(vehicleModel || ''),
      plateNumber: String(plateNumber || ''),
      isEv: Boolean(isEv),
    });

    if (!result.ok) {
      res.status(400).json({ error: result.error || 'Could not add vehicle' });
      return;
    }

    res.status(201).json({
      vehicle: result.vehicle,
      vehicles: result.vehicles,
      snapshot: store.getSnapshotForUser(user),
    });
  });

  app.post('/api/driver/vehicles/sync', async (req, res) => {
    const user = await requireAuth(req, res);
    if (!user) return;
    const rawVehicles = Array.isArray(req.body?.vehicles) ? req.body.vehicles : [];
    const vehicles = store.syncDriverVehicles(user.email, rawVehicles);
    res.json({ vehicles, snapshot: store.getSnapshotForUser(user) });
  });

  app.delete('/api/driver/vehicles/:vehicleId', async (req, res) => {
    const user = await requireAuth(req, res);
    if (!user) return;
    const result = store.removeDriverVehicle(req.params.vehicleId, user.email);
    if (!result.ok) {
      res.status(400).json({ error: result.error || 'Could not remove vehicle' });
      return;
    }
    res.json({
      nextActiveVehicleId: result.nextActiveVehicleId,
      vehicles: result.vehicles,
      snapshot: store.getSnapshotForUser(user),
    });
  });

  app.post('/api/bookings/hold', async (req, res) => {
    const user = await requireAuth(req, res);
    if (!user) return;
    const { spaceId, vehicleId, driverName, driverEmail, driverLicense, startMin, endMin } =
      req.body ?? {};
    const effectiveEmail =
      user.role === 'admin' && typeof driverEmail === 'string' && driverEmail.trim()
        ? driverEmail.trim()
        : user.email;
    const matchedProfile = store.driverProfiles.find(
      (p) => p.email.toLowerCase() === effectiveEmail.toLowerCase()
    );
    const effectiveLicense = String(driverLicense || matchedProfile?.licenseNumber || '').trim();
    if (user.role === 'driver' && effectiveLicense.length < 6) {
      res.status(400).json({
        error: 'Please complete your driver profile (Driving License & Vehicle Number) before booking.',
      });
      return;
    }
    const result = store.createTransactionalHold({
      spaceId: String(spaceId),
      vehicleId: String(vehicleId),
      driverName: String(driverName || matchedProfile?.fullName || user.name),
      driverEmail: effectiveEmail,
      driverLicense: effectiveLicense || undefined,
      startMin: Number(startMin),
      endMin: Number(endMin),
    });
    if (!result.ok) {
      res.status(409).json({ error: result.error });
      return;
    }
    res.status(201).json({ booking: result.booking, snapshot: store.getSnapshotForUser(user) });
  });

  app.post('/api/bookings/:id/action', async (req, res) => {
    const user = await requireAuth(req, res);
    if (!user) return;
    const { id } = req.params;
    const access = checkBookingAccess(id, user);
    if (!access.found) {
      res.status(404).json({ error: 'Booking not found' });
      return;
    }
    if (!access.authorized) {
      res.status(403).json({ error: 'Forbidden: you do not have access to modify this booking.' });
      return;
    }
    const { action, arrivalMinutesLate } = req.body ?? {};
    const result = store.performBookingAction(id, action, {
      arrivalMinutesLate:
        typeof arrivalMinutesLate === 'number' ? arrivalMinutesLate : undefined,
    }) as {
      ok: boolean;
      booking?: unknown;
      wallet?: unknown;
      extraHoursDeductedInr?: number;
      extraMinutesCharged?: number;
      remainingBalanceInr?: number;
      unpaidDueInr?: number;
      error?: string;
    };
    if (!result.ok) {
      res.status(409).json({ error: result.error });
      return;
    }
    res.json({
      booking: result.booking,
      wallet: result.wallet,
      extraHoursDeductedInr: result.extraHoursDeductedInr,
      extraMinutesCharged: result.extraMinutesCharged,
      remainingBalanceInr: result.remainingBalanceInr,
      unpaidDueInr: result.unpaidDueInr,
      snapshot: store.getSnapshotForUser(user),
    });
  });

  app.post('/api/bookings/:id/extend', async (req, res) => {
    const user = await requireAuth(req, res);
    if (!user) return;
    const { id } = req.params;
    const access = checkBookingAccess(id, user);
    if (!access.found) {
      res.status(404).json({ error: 'Booking not found' });
      return;
    }
    if (!access.authorized) {
      res.status(403).json({ error: 'Forbidden: you can only extend your own booking.' });
      return;
    }
    const addMinutes = Number(req.body?.additionalMinutes || 30);
    const result = store.requestBookingExtension(id, addMinutes);
    if (!result.ok) {
      res.status(409).json({
        error: result.error,
        alternatives: result.alternatives || [],
      });
      return;
    }
    res.status(201).json({
      extensionRequest: result.extensionRequest,
      booking: result.booking,
      snapshot: store.getSnapshotForUser(user),
    });
  });

  app.post('/api/bookings/:id/extensions/:reqId/decide', async (req, res) => {
    const user = await requireAuth(req, res, ['host', 'admin']);
    if (!user) return;
    const { id, reqId } = req.params;
    const access = checkHostBookingAccess(id, user);
    if (!access.found) {
      res.status(404).json({ error: 'Booking not found' });
      return;
    }
    if (!access.authorized) {
      res.status(403).json({ error: 'Forbidden: you can only decide extensions for your own facilities.' });
      return;
    }
    const decision = req.body?.decision === 'reject' ? 'reject' : 'approve';
    const result = store.decideExtensionRequest(id, reqId, decision, user.name);
    if (!result.ok) {
      res.status(409).json({ error: result.error });
      return;
    }
    res.json({ booking: result.booking, snapshot: store.getSnapshotForUser(user) });
  });

  app.post('/api/bookings/:id/withdrawal-resolve', async (req, res) => {
    const user = await requireAuth(req, res);
    if (!user) return;
    const access = checkBookingAccess(req.params.id, user);
    if (!access.found) {
      res.status(404).json({ error: 'Booking not found' });
      return;
    }
    if (!access.authorized) {
      res.status(403).json({ error: 'Forbidden: you do not have access to this booking.' });
      return;
    }
    const choice = req.body?.choice === 'rebook' ? 'rebook' : 'refund';
    const result = store.resolveAffectedWithdrawal(req.params.id, choice);
    if (!result.ok) {
      res.status(409).json({ error: result.error });
      return;
    }
    res.json({ booking: result.booking, snapshot: store.getSnapshotForUser(user) });
  });

  app.post('/api/bookings/:id/qr-checkin', async (req, res) => {
    const user = await requireAuth(req, res);
    if (!user) return;
    const { scannedToken, scanMethod, arrivalMinutesLate } = req.body ?? {};
    const access = checkBookingAccess(req.params.id, user);
    if (!access.found) {
      res.status(404).json({ error: 'Booking not found' });
      return;
    }
    if (!access.authorized) {
      res.status(403).json({ error: 'Forbidden: you do not have access to check in this booking.' });
      return;
    }
    const allowedMethods = ['camera', 'upload', 'gate_placard', 'manual_token'] as const;
    const cleanMethod = allowedMethods.includes(scanMethod) ? scanMethod : 'gate_placard';
    const result = store.verifyQrCheckin({
      bookingId: req.params.id,
      scannedToken: String(scannedToken || ''),
      scanMethod: cleanMethod,
      arrivalMinutesLate:
        typeof arrivalMinutesLate === 'number' ? arrivalMinutesLate : undefined,
      actorName: user.name,
    });
    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({ booking: result.booking, snapshot: store.getSnapshotForUser(user) });
  });

  app.post('/api/bookings/:id/overstay', async (req, res) => {
    const user = await requireAuth(req, res, ['host', 'admin']);
    if (!user) return;
    const access = checkHostBookingAccess(req.params.id, user);
    if (!access.found) {
      res.status(404).json({ error: 'Booking not found' });
      return;
    }
    if (!access.authorized) {
      res.status(403).json({ error: 'Forbidden: you can only report overstays for your own facilities.' });
      return;
    }
    const overstayMinutes = Number(req.body?.overstayMinutes || 45);
    const result = store.reportOverstay({
      bookingId: req.params.id,
      overstayMinutes,
      actorName: user.name,
    });
    if (!result.ok) {
      res.status(409).json({ error: result.error });
      return;
    }
    res.json({
      overstayBooking: result.overstayBooking,
      impactedBookings: result.impactedBookings,
      summary: result.summary,
      snapshot: store.getSnapshotForUser(user),
    });
  });

  app.post('/api/bookings/:id/overstay-resolve', async (req, res) => {
    const user = await requireAuth(req, res);
    if (!user) return;
    const access = checkBookingAccess(req.params.id, user);
    if (!access.found) {
      res.status(404).json({ error: 'Booking not found' });
      return;
    }
    if (!access.authorized) {
      res.status(403).json({ error: 'Forbidden: you do not have access to this booking.' });
      return;
    }
    const choice = req.body?.choice === 'reschedule' ? 'reschedule' : 'refund_with_credit';
    const result = store.resolveOverstayImpact(req.params.id, choice);
    if (!result.ok) {
      res.status(409).json({ error: result.error });
      return;
    }
    res.json({ booking: result.booking, snapshot: store.getSnapshotForUser(user) });
  });

  // =========================================================================
  // PREPAID WALLET, HOST SCANNER, SMART DEPARTURE & AUTONOMOUS LIFECYCLE
  // =========================================================================

  app.get('/api/wallet', async (req, res) => {
    const user = await requireAuth(req, res);
    if (!user) return;
    const wallet = store.getOrCreateWallet(user.email, user.name);
    res.json({ wallet });
  });

  app.post('/api/wallet/topup', async (req, res) => {
    const user = await requireAuth(req, res);
    if (!user) return;
    const amountInr = Number(req.body?.amountInr || 0);
    const result = store.topUpWallet(user.email, user.name, amountInr);
    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({ wallet: result.wallet, snapshot: store.getSnapshotForUser(user) });
  });

  app.post('/api/bookings/:id/pay-wallet', async (req, res) => {
    const user = await requireAuth(req, res);
    if (!user) return;
    const access = checkBookingAccess(req.params.id, user);
    if (!access.found) {
      res.status(404).json({ error: 'Booking not found' });
      return;
    }
    if (!access.authorized) {
      res.status(403).json({ error: 'Forbidden: you can only pay for your own booking.' });
      return;
    }
    const result = store.payHoldWithWallet(req.params.id, user.email, user.name);
    if (!result.ok) {
      res.status(409).json({ error: result.error, wallet: result.wallet });
      return;
    }
    res.json({
      booking: result.booking,
      wallet: result.wallet,
      deductedInr: result.deductedInr ?? result.booking?.totalAmountInr ?? 0,
      remainingBalanceInr: result.remainingBalanceInr ?? result.wallet?.balanceInr ?? 0,
      snapshot: store.getSnapshotForUser(user),
    });
  });

  app.post('/api/host/scanner/verify-entry', async (req, res) => {
    const user = await requireAuth(req, res, ['host', 'admin']);
    if (!user) return;
    const { scannedInput, expectedFacilityId, arrivalMinutesLate } = req.body ?? {};
    const expectedFacId =
      typeof expectedFacilityId === 'string' && expectedFacilityId.trim()
        ? expectedFacilityId.trim()
        : undefined;
    if (expectedFacId && user.role === 'host') {
      const facExists = store.facilities.some((f) => f.id === expectedFacId);
      if (!facExists) {
        res.status(404).json({ error: 'Facility not found' });
        return;
      }
      if (!store.isFacilityOwnedByHost(expectedFacId, user)) {
        res.status(403).json({ error: 'Forbidden: you do not own this facility.' });
        return;
      }
    }
    const allowedFacilityIds =
      user.role === 'host'
        ? store.facilities
            .filter((f) => store.isFacilityOwnedByHost(f.id, user))
            .map((f) => f.id)
        : undefined;

    const result = store.verifyDriverQrAtHostScanner({
      scannedInput: String(scannedInput || ''),
      expectedFacilityId: expectedFacId,
      allowedFacilityIds,
      actorName: user.name,
      arrivalMinutesLate: typeof arrivalMinutesLate === 'number' ? arrivalMinutesLate : undefined,
    });
    if (!result.ok) {
      const code = result.error?.startsWith('Forbidden:') ? 403 : 400;
      res.status(code).json({ error: result.error });
      return;
    }
    res.json({
      booking: result.booking,
      lifecycleEvent: result.lifecycleEvent,
      snapshot: store.getSnapshotForUser(user),
    });
  });

  app.post('/api/agents/lifecycle/evaluate', async (req, res) => {
    const user = await requireAuth(req, res);
    if (!user) return;
    const { bookingId, requestedExtensionMinutes, simulateOverstayMinutes } = req.body ?? {};
    if (!bookingId) {
      res.status(400).json({ error: 'bookingId is required.' });
      return;
    }
    const access = checkBookingAccess(String(bookingId), user);
    if (!access.found) {
      res.status(404).json({ error: 'Booking not found' });
      return;
    }
    if (!access.authorized) {
      res.status(403).json({ error: 'Forbidden: you do not have access to evaluate this booking.' });
      return;
    }
    const result = await evaluateAutonomousOverstayLifecycle({
      bookingId: String(bookingId),
      requestedExtensionMinutes:
        typeof requestedExtensionMinutes === 'number' ? requestedExtensionMinutes : undefined,
      simulateOverstayMinutes:
        typeof simulateOverstayMinutes === 'number' ? simulateOverstayMinutes : undefined,
      actorName: user.name,
    });
    if (!result.ok) {
      res.status(409).json({ error: result.error });
      return;
    }
    res.json({
      booking: result.booking,
      space: result.space,
      offer: result.offer,
      impactedBookings: result.impactedBookings,
      wallet: result.wallet,
      lifecycleEvent: result.lifecycleEvent,
      snapshot: store.getSnapshotForUser(user),
    });
  });

  app.post('/api/bookings/:id/extension-offers/:offerId/respond', async (req, res) => {
    const user = await requireAuth(req, res);
    if (!user) return;
    const access = checkBookingAccess(req.params.id, user);
    if (!access.found) {
      res.status(404).json({ error: 'Booking not found' });
      return;
    }
    if (!access.authorized) {
      res.status(403).json({ error: 'Forbidden: you do not have access to this booking.' });
      return;
    }
    const decision = req.body?.decision === 'decline' ? 'decline' : 'accept';
    const result = store.respondToExtensionOffer({
      bookingId: req.params.id,
      offerId: req.params.offerId,
      decision,
      actorEmail: user.email,
      actorName: user.name,
    });
    if (!result.ok) {
      res.status(409).json({ error: result.error, wallet: result.wallet });
      return;
    }
    res.json({
      booking: result.booking,
      offer: result.offer,
      wallet: result.wallet,
      snapshot: store.getSnapshotForUser(user),
    });
  });

  app.post('/api/bookings/:id/departure-signal', async (req, res) => {
    const user = await requireAuth(req, res);
    if (!user) return;
    const access = checkBookingAccess(req.params.id, user);
    if (!access.found) {
      res.status(404).json({ error: 'Booking not found' });
      return;
    }
    if (!access.authorized) {
      res.status(403).json({ error: 'Forbidden: you do not have access to this booking.' });
      return;
    }
    const signalType =
      req.body?.signalType === 'geofence_exit' ? 'geofence_exit' : 'im_leaving_button';
    const distanceFromGateM =
      typeof req.body?.distanceFromGateM === 'number' ? req.body.distanceFromGateM : undefined;
    const result = store.recordSmartDepartureSignal({
      bookingId: req.params.id,
      signalType,
      distanceFromGateM,
      actorName: user.name,
    });
    if (!result.ok) {
      res.status(409).json({ error: result.error });
      return;
    }
    res.json({
      booking: result.booking,
      lifecycleEvent: result.lifecycleEvent,
      snapshot: store.getSnapshotForUser(user),
    });
  });

  app.post('/api/bookings/:id/confirm-departure', async (req, res) => {
    const user = await requireAuth(req, res);
    if (!user) return;
    const access = checkBookingAccess(req.params.id, user);
    if (!access.found) {
      res.status(404).json({ error: 'Booking not found' });
      return;
    }
    if (!access.authorized) {
      res.status(403).json({ error: 'Forbidden: you do not have access to confirm departure for this booking.' });
      return;
    }
    const confirmedBy = user.role === 'host' || user.role === 'admin' ? 'host' : 'driver';
    const result = store.confirmDepartureAndStartClearance({
      bookingId: req.params.id,
      confirmedBy,
      actorName: user.name,
    });
    if (!result.ok) {
      res.status(409).json({ error: result.error });
      return;
    }
    res.json({
      booking: result.booking,
      wallet: result.wallet,
      extraHoursDeductedInr: result.extraHoursDeductedInr ?? 0,
      extraMinutesCharged: result.extraMinutesCharged ?? 0,
      remainingBalanceInr: result.remainingBalanceInr ?? result.wallet?.balanceInr ?? 0,
      unpaidDueInr: result.unpaidDueInr ?? result.wallet?.unpaidDueInr ?? 0,
      lifecycleEvent: result.lifecycleEvent,
      snapshot: store.getSnapshotForUser(user),
    });
  });

  app.post('/api/spaces/:spaceId/complete-clearance', async (req, res) => {
    const user = await requireAuth(req, res);
    if (!user) return;
    const sp = store.spaces.find((s) => s.id === req.params.spaceId);
    if (!sp) {
      res.status(404).json({ error: 'Space not found' });
      return;
    }
    if (user.role === 'host' && !store.isSpaceOwnedByHost(sp.id, user)) {
      res.status(403).json({ error: 'Forbidden: you do not own this parking space.' });
      return;
    }
    if (user.role === 'driver') {
      const activeBk = sp.activeOccupancyBookingId
        ? store.bookings.find((b) => b.id === sp.activeOccupancyBookingId)
        : undefined;
      const latestCompletedForSpace = store.bookings.find(
        (b) => b.spaceId === sp.id && b.driverEmail?.toLowerCase() === user.email.toLowerCase()
      );
      if (
        !(activeBk && activeBk.driverEmail?.toLowerCase() === user.email.toLowerCase()) &&
        !latestCompletedForSpace
      ) {
        res.status(403).json({ error: 'Forbidden: you do not have access to this space.' });
        return;
      }
    }
    const result = store.completeClearanceBufferAndReopen(req.params.spaceId, user.name);
    if (!result.ok) {
      res.status(409).json({ error: result.error });
      return;
    }
    res.json({
      space: result.space,
      lifecycleEvent: result.lifecycleEvent,
      snapshot: store.getSnapshotForUser(user),
    });
  });

  app.post('/api/bookings/:id/review', async (req, res) => {
    const user = await requireAuth(req, res);
    if (!user) return;
    const { id } = req.params;
    const access = checkBookingAccess(id, user);
    if (!access.found) {
      res.status(404).json({ error: 'Booking not found' });
      return;
    }
    if (!access.authorized) {
      res.status(403).json({ error: 'Forbidden: you can only review your own booking.' });
      return;
    }
    const { rating, comment, authorName } = req.body ?? {};
    const result = store.addBookingReview(
      id,
      Number(rating || 5),
      String(comment || ''),
      String(authorName || user.name)
    );
    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({ snapshot: store.getSnapshotForUser(user) });
  });

  // =========================================================================
  // SERVER-GENERATED PAYMENT ORDERS & SIGNED IDEMPOTENT WEBHOOKS
  // =========================================================================

  app.post('/api/payments/orders', async (req, res) => {
    const user = await requireAuth(req, res);
    if (!user) return;
    const bookingId = String(req.body?.bookingId || '');
    const access = checkBookingAccess(bookingId, user);
    if (!access.found) {
      res.status(404).json({ error: 'Booking not found' });
      return;
    }
    if (!access.authorized) {
      res.status(403).json({ error: 'Forbidden: you do not have access to create a payment order for this booking.' });
      return;
    }
    const result = store.createPaymentOrder(bookingId);
    if (!result.ok) {
      res.status(409).json({ error: result.error });
      return;
    }
    res.status(201).json({
      order: result.order,
      booking: result.booking,
      snapshot: store.getSnapshotForUser(user),
    });
  });

  app.post('/api/payments/webhook', (req, res) => {
    const signature = req.headers['x-parkpool-signature'] as string | undefined;
    const rawPayload = JSON.stringify(req.body ?? {});
    const { eventId, eventType, orderId, amountInr } = req.body ?? {};
    const result = store.processPaymentWebhook({
      rawPayload,
      signature,
      event: {
        eventId: String(eventId || ''),
        eventType: eventType === 'payment.failed' ? 'payment.failed' : 'payment.succeeded',
        orderId: String(orderId || ''),
        amountInr: Number(amountInr || 0),
      },
    });
    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({
      ok: true,
      duplicate: Boolean(result.duplicate),
      webhookEvent: result.webhookEvent,
      bookingId: result.booking?.id,
    });
  });

  app.post('/api/payments/orders/:orderId/gateway-dispatch', async (req, res) => {
    const user = await requireAuth(req, res);
    if (!user) return;
    const order = store.paymentOrders.find((o) => o.id === req.params.orderId);
    if (!order) {
      res.status(404).json({ error: 'Payment order not found' });
      return;
    }
    const access = checkBookingAccess(order.bookingId, user);
    if (access.found && !access.authorized) {
      res.status(403).json({ error: 'Forbidden: you do not have access to dispatch payment for this order.' });
      return;
    }
    const outcome =
      req.body?.outcome === 'payment.failed' ? 'payment.failed' : 'payment.succeeded';
    const customEventId =
      typeof req.body?.eventId === 'string' ? req.body.eventId : undefined;
    const result = store.dispatchGatewayWebhook(req.params.orderId, outcome, customEventId);
    if (!result.ok) {
      res.status(409).json({ error: result.error });
      return;
    }
    res.json({
      ok: true,
      duplicate: Boolean(result.duplicate),
      webhookEvent: result.webhookEvent,
      booking: result.booking,
      snapshot: store.getSnapshotForUser(user),
    });
  });

  // =========================================================================
  // PROVIDER ONBOARDING, EVIDENCE UPLOAD, CALENDAR BLOCKS & WITHDRAWALS
  // =========================================================================

  app.post('/api/providers/register', async (req, res) => {
    const user = await requireAuth(req, res, ['host', 'admin']);
    if (!user) return;
    const {
      name,
      contactName,
      contactEmail,
      contactPhone,
      organizationName,
      registrationNumber,
      providerType,
      verificationStatus,
      status,
    } = req.body ?? {};

    const allowedTypes: DetailedProviderType[] = [
      'commercial_operator',
      'mall_office',
      'property_owner',
      'property_manager',
      'apartment_residential',
    ];
    const cleanType = allowedTypes.includes(providerType)
      ? (providerType as DetailedProviderType)
      : 'property_owner';

    const effectiveEmail =
      user.role === 'admin' && typeof contactEmail === 'string' && contactEmail.trim()
        ? contactEmail.trim()
        : user.email;

    const result = store.registerProvider({
      name: String(name || user.name),
      contactName: String(contactName || user.name),
      contactEmail: effectiveEmail,
      contactPhone: String(contactPhone || ''),
      organizationName: String(organizationName || ''),
      registrationNumber:
        typeof registrationNumber === 'string' ? registrationNumber : undefined,
      providerType: cleanType,
      requestedStatus:
        typeof verificationStatus === 'string'
          ? verificationStatus
          : typeof status === 'string'
          ? status
          : undefined,
    });

    if (!result.ok) {
      const code = result.error?.startsWith('FORBIDDEN') ? 403 : 400;
      res.status(code).json({ error: result.error });
      return;
    }
    res.status(201).json({ provider: result.provider, snapshot: store.getSnapshotForUser(user) });
  });

  app.post('/api/providers/:providerId/evidence', async (req, res) => {
    const user = await requireAuth(req, res, ['host', 'admin']);
    if (!user) return;
    const providerExists = store.providers.some((p) => p.id === req.params.providerId);
    if (!providerExists) {
      res.status(404).json({ error: 'Provider not found' });
      return;
    }
    if (user.role === 'host' && !store.isProviderOwnedByHost(req.params.providerId, user)) {
      res.status(403).json({ error: 'Forbidden: you can only submit evidence for your own provider account.' });
      return;
    }
    const { docType, fileName, mimeType, contentText, verificationStatus, status } = req.body ?? {};
    const result = store.submitProviderEvidence({
      providerId: req.params.providerId,
      docType: String(docType || 'ownership_title'),
      fileName: String(fileName || 'verification_evidence.txt'),
      mimeType: typeof mimeType === 'string' ? mimeType : 'text/plain',
      contentText: String(contentText || ''),
      requestedStatus:
        typeof verificationStatus === 'string'
          ? verificationStatus
          : typeof status === 'string'
          ? status
          : undefined,
    });
    if (!result.ok) {
      const code = result.error?.startsWith('FORBIDDEN') ? 403 : 400;
      res.status(code).json({ error: result.error });
      return;
    }
    res.status(201).json({
      provider: result.provider,
      document: result.document,
      snapshot: store.getSnapshotForUser(user),
    });
  });

  app.post('/api/facilities', async (req, res) => {
    const user = await requireAuth(req, res, ['host', 'admin']);
    if (!user) return;
    const {
      providerId,
      name,
      providerName,
      providerType,
      address,
      zone,
      lat,
      lng,
      entranceLabel,
      walkingDistanceM,
      hourlyPriceInr,
      covered,
      evCharging,
      allowedTypes,
      hardDepartureMin,
      restrictions,
      accessInstructions,
    } = req.body ?? {};
    if (!name || !address || !hourlyPriceInr) {
      res.status(400).json({ error: 'Name, address, and hourly price are required.' });
      return;
    }
    const requestedProviderId =
      typeof providerId === 'string' && providerId.trim() ? providerId.trim() : undefined;
    if (requestedProviderId && user.role === 'host') {
      const prvExists = store.providers.some((p) => p.id === requestedProviderId);
      if (!prvExists) {
        res.status(404).json({ error: 'Provider not found' });
        return;
      }
      if (!store.isProviderOwnedByHost(requestedProviderId, user)) {
        res.status(403).json({ error: 'Forbidden: you cannot create facilities under another provider.' });
        return;
      }
    }
    const resolvedProviderId =
      user.role === 'host'
        ? requestedProviderId || store.ensureProviderForHost(user).id
        : requestedProviderId;

    const created = store.addFacilityWithSpace({
      providerId: resolvedProviderId,
      ownerUser: user,
      name: String(name),
      providerName: String(providerName || user.name),
      providerType:
        providerType === 'commercial' || providerType === 'community' || providerType === 'individual'
          ? providerType
          : 'individual',
      address: String(address),
      zone: typeof zone === 'string' && zone.trim() ? zone.trim() : undefined,
      lat: typeof lat === 'number' ? lat : undefined,
      lng: typeof lng === 'number' ? lng : undefined,
      entranceLabel: String(entranceLabel || 'Main Gate Entry'),
      walkingDistanceM: Number(walkingDistanceM || 320),
      hourlyPriceInr: Number(hourlyPriceInr || 50),
      covered: Boolean(covered),
      evCharging: Boolean(evCharging),
      allowedTypes:
        Array.isArray(allowedTypes) && allowedTypes.length > 0
          ? allowedTypes
          : ['hatchback', 'sedan', 'suv'],
      hardDepartureMin: Number(hardDepartureMin || 21 * 60),
      restrictions: Array.isArray(restrictions) ? restrictions : undefined,
      accessInstructions:
        typeof accessInstructions === 'string' ? accessInstructions : undefined,
    });
    res.status(201).json({ ...created, snapshot: store.getSnapshotForUser(user) });
  });

  app.post('/api/spaces/:spaceId/pricing', async (req, res) => {
    const user = await requireAuth(req, res, ['host', 'admin']);
    if (!user) return;
    const spaceExists = store.spaces.some((s) => s.id === req.params.spaceId);
    if (!spaceExists) {
      res.status(404).json({ error: 'Space not found' });
      return;
    }
    if (user.role === 'host' && !store.isSpaceOwnedByHost(req.params.spaceId, user)) {
      res.status(403).json({ error: 'Forbidden: you do not own this parking space.' });
      return;
    }
    const { hourlyPriceInr, hardDepartureMin, restrictions } = req.body ?? {};
    const result = store.updateSpacePricingAndRestrictions({
      spaceId: req.params.spaceId,
      hourlyPriceInr: typeof hourlyPriceInr === 'number' ? hourlyPriceInr : undefined,
      hardDepartureMin: typeof hardDepartureMin === 'number' ? hardDepartureMin : undefined,
      restrictions: Array.isArray(restrictions) ? restrictions : undefined,
      actorName: user.name,
    });
    if (!result.ok) {
      res.status(404).json({ error: result.error });
      return;
    }
    res.json({ space: result.space, snapshot: store.getSnapshotForUser(user) });
  });

  app.post('/api/spaces/:spaceId/owner-blocks', async (req, res) => {
    const user = await requireAuth(req, res, ['host', 'admin']);
    if (!user) return;
    const spaceExists = store.spaces.some((s) => s.id === req.params.spaceId);
    if (!spaceExists) {
      res.status(404).json({ error: 'Space not found' });
      return;
    }
    if (user.role === 'host' && !store.isSpaceOwnedByHost(req.params.spaceId, user)) {
      res.status(403).json({ error: 'Forbidden: you do not own this parking space.' });
      return;
    }
    const { startMin, endMin, label, date } = req.body ?? {};
    const result = store.addOwnerUseBlock({
      spaceId: req.params.spaceId,
      startMin: Number(startMin),
      endMin: Number(endMin),
      label: String(label || 'Owner Use Block'),
      date: typeof date === 'string' && date.trim() ? date.trim() : undefined,
      actorName: user.name,
    });
    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.status(201).json({
      protectedBookings: result.protectedBookings,
      snapshot: store.getSnapshotForUser(user),
    });
  });

  app.post('/api/spaces/:spaceId/withdraw', async (req, res) => {
    const user = await requireAuth(req, res, ['host', 'admin']);
    if (!user) return;
    const spaceExists = store.spaces.some((s) => s.id === req.params.spaceId);
    if (!spaceExists) {
      res.status(404).json({ error: 'Space not found' });
      return;
    }
    if (user.role === 'host' && !store.isSpaceOwnedByHost(req.params.spaceId, user)) {
      res.status(403).json({ error: 'Forbidden: you do not own this parking space.' });
      return;
    }
    const { startMin, endMin, reason, date } = req.body ?? {};
    const result = store.withdrawFutureAvailability({
      spaceId: req.params.spaceId,
      startMin: Number(startMin),
      endMin: Number(endMin),
      reason: String(reason || 'Host Schedule Withdrawal'),
      date: typeof date === 'string' && date.trim() ? date.trim() : undefined,
      actorName: user.name,
    });
    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.status(201).json({
      withdrawal: result.withdrawal,
      affectedBookings: result.affectedBookings,
      snapshot: store.getSnapshotForUser(user),
    });
  });

  app.put('/api/facilities/:id', async (req, res) => {
    const user = await requireAuth(req, res, ['host', 'admin']);
    if (!user) return;
    const facExists = store.facilities.some((f) => f.id === req.params.id);
    if (!facExists) {
      res.status(404).json({ error: 'Facility not found' });
      return;
    }
    if (user.role === 'host' && !store.isFacilityOwnedByHost(req.params.id, user)) {
      res.status(403).json({ error: 'Forbidden: you do not own this facility.' });
      return;
    }
    const result = store.updateFacility(req.params.id, req.body ?? {}, user.name);
    if (!result.ok) {
      res.status(404).json({ error: result.error });
      return;
    }
    res.json({ facility: result.facility, snapshot: store.getSnapshotForUser(user) });
  });

  app.delete('/api/facilities/:id', async (req, res) => {
    const user = await requireAuth(req, res, ['host', 'admin']);
    if (!user) return;
    const facExists = store.facilities.some((f) => f.id === req.params.id);
    if (!facExists) {
      res.status(404).json({ error: 'Facility not found' });
      return;
    }
    if (user.role === 'host' && !store.isFacilityOwnedByHost(req.params.id, user)) {
      res.status(403).json({ error: 'Forbidden: you do not own this facility.' });
      return;
    }
    const result = store.deleteFacility(req.params.id, user.name);
    if (!result.ok) {
      res.status(404).json({ error: result.error });
      return;
    }
    res.json({ ok: true, snapshot: store.getSnapshotForUser(user) });
  });

  app.post('/api/facilities/:id/assign', async (req, res) => {
    const user = await requireAuth(req, res, ['host', 'admin']);
    if (!user) return;
    const facExists = store.facilities.some((f) => f.id === req.params.id);
    if (!facExists) {
      res.status(404).json({ error: 'Facility not found' });
      return;
    }
    if (user.role === 'host' && !store.isFacilityOwnedByHost(req.params.id, user)) {
      res.status(403).json({ error: 'Forbidden: you do not own this facility.' });
      return;
    }
    const { driverEmail } = req.body ?? {};
    const result = store.assignFacilityDriver(req.params.id, driverEmail, user.name);
    if (!result.ok) {
      res.status(404).json({ error: result.error });
      return;
    }
    res.json({ facility: result.facility, snapshot: store.getSnapshotForUser(user) });
  });

  app.post('/api/bookings/:id/cancel-host', async (req, res) => {
    const user = await requireAuth(req, res, ['host', 'admin']);
    if (!user) return;
    const access = checkHostBookingAccess(req.params.id, user);
    if (!access.found) {
      res.status(404).json({ error: 'Booking not found' });
      return;
    }
    if (!access.authorized) {
      res.status(403).json({ error: 'Forbidden: you can only cancel bookings at your own facilities.' });
      return;
    }
    const { reason } = req.body ?? {};
    const result = store.cancelBookingHost(req.params.id, String(reason || 'Host cancellation'), user.name);
    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({ booking: result.booking, snapshot: store.getSnapshotForUser(user) });
  });

  // =========================================================================
  // ADMIN VERIFICATION, PRIVATE DOCUMENT ACCESS LINKS & SPACE APPROVAL
  // =========================================================================

  app.post('/admin/providers/:provider_id/verification', async (req, res) => {
    const admin = await requireAuth(req, res, ['admin']);
    if (!admin) return;
    const { provider_id } = req.params;
    const { decision, evidenceRefs, reviewerId, reason, expiresAt } = req.body ?? {};

    const result = store.verifyProviderByAdmin({
      providerId: provider_id,
      decision: String(decision || '') as ProviderVerificationStatus,
      evidenceRefs: Array.isArray(evidenceRefs) ? evidenceRefs.map(String) : [],
      reviewerId: String(reviewerId || admin.id),
      reason: String(reason || ''),
      expiresAt: typeof expiresAt === 'string' && expiresAt.trim() ? expiresAt.trim() : undefined,
    });

    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({ provider: result.provider, snapshot: store.getSnapshotForUser(admin) });
  });

  app.post('/admin/spaces/:space_id/approve', async (req, res) => {
    const admin = await requireAuth(req, res, ['admin']);
    if (!admin) return;
    const { space_id } = req.params;
    const result = store.approveSpacePublication(space_id, admin.id);
    if (!result.ok) {
      res.status(409).json({
        error: result.error,
        checks: result.checks || [],
      });
      return;
    }
    res.json({
      space: result.space,
      facility: result.facility,
      checks: result.checks,
      snapshot: store.getSnapshotForUser(admin),
    });
  });

  app.post('/api/admin/facilities/:id/operational-check', async (req, res) => {
    const admin = await requireAuth(req, res, ['admin']);
    if (!admin) return;
    const { checks, notes, propertyEligibleForUse } = req.body ?? {};
    const result = store.updateFacilityOperationalChecks(
      req.params.id,
      admin.id,
      checks || {},
      typeof notes === 'string' ? notes : undefined,
      propertyEligibleForUse !== false
    );
    if (!result.ok) {
      res.status(404).json({ error: result.error });
      return;
    }
    res.json({ facility: result.facility, snapshot: store.getSnapshotForUser(admin) });
  });

  app.post('/api/admin/periodic-review', async (req, res) => {
    const admin = await requireAuth(req, res, ['admin']);
    if (!admin) return;
    const summary = store.runPeriodicReviewSweep(admin.id);
    res.json({ ...summary, snapshot: store.getSnapshotForUser(admin) });
  });

  app.post('/api/admin/documents/:docId/access-link', async (req, res) => {
    const user = await requireAuth(req, res, ['admin', 'host']);
    if (!user) return;
    const meta = store.findDocumentMeta(req.params.docId);
    if (!meta) {
      res.status(404).json({ error: 'Private document not found' });
      return;
    }
    if (
      user.role === 'host' &&
      meta.provider.contactEmail.toLowerCase() !== user.email.toLowerCase()
    ) {
      res.status(403).json({ error: 'Forbidden: cannot access another provider’s private evidence.' });
      return;
    }
    const { token, expiresAt } = signDocumentAccessToken(req.params.docId, user.id, 300);
    store.addAudit(
      user.name,
      'SHORT_LIVED_DOC_LINK_ISSUED',
      `Issued 5m signed access link for ${req.params.docId} (exp ${expiresAt}).`
    );
    res.json({
      docId: req.params.docId,
      expiresAt,
      signedUrl: `/api/documents/${encodeURIComponent(req.params.docId)}/view?token=${encodeURIComponent(token)}`,
    });
  });

  app.get('/api/documents/:docId/view', (req, res) => {
    const docId = req.params.docId;
    const token = String(req.query.token || '');
    const verification = verifyDocumentAccessToken(docId, token);
    if (!verification.valid) {
      res.status(403).json({ error: verification.error || 'Unauthorized document access' });
      return;
    }
    const docBlob = store.getPrivateDocument(docId);
    if (!docBlob) {
      res.status(404).json({ error: 'Document not found in private vault' });
      return;
    }
    const meta = store.findDocumentMeta(docId);
    res.json({
      docId,
      fileName: docBlob.fileName,
      mimeType: docBlob.mimeType,
      providerId: docBlob.providerId,
      providerName: meta?.provider.organizationName,
      docType: meta?.doc.docType,
      uploadedAt: meta?.doc.uploadedAt,
      contentText: docBlob.contentText,
      accessedBy: verification.viewerId,
    });
  });

  app.post('/api/facilities/:id/verify', async (req, res) => {
    const admin = await requireAuth(req, res, ['admin']);
    if (!admin) return;
    const { id } = req.params;
    const { status, authorityDocRef } = req.body ?? {};
    const allowed: VerificationStatus[] = ['verified', 'pending', 'suspended'];
    if (!allowed.includes(status)) {
      res.status(400).json({ error: 'Invalid verification status' });
      return;
    }
    const updated = store.updateFacilityVerification(id, status, authorityDocRef);
    if (!updated) {
      res.status(404).json({ error: 'Facility not found' });
      return;
    }
    res.json({ facility: updated, snapshot: store.getSnapshotForUser(admin) });
  });

  app.post('/api/admin/settlements/:id/settle', async (req, res) => {
    const admin = await requireAuth(req, res, ['admin']);
    if (!admin) return;
    const result = store.settleHostPayout(req.params.id, admin.id);
    if (!result.ok) {
      res.status(409).json({ error: result.error });
      return;
    }
    res.json({ settlement: result.settlement, snapshot: store.getSnapshotForUser(admin) });
  });

  // =========================================================================
  // INCIDENTS, DISPUTES, USER REPORTS & NOTIFICATIONS
  // =========================================================================

  app.post('/api/incidents', async (req, res) => {
    const user = await requireAuth(req, res);
    if (!user) return;
    const { facilityId, bookingId, category, severity, description } = req.body ?? {};
    if (!description || !String(description).trim()) {
      res.status(400).json({ error: 'Incident description is required.' });
      return;
    }
    const inc = store.submitIncident({
      reporterRole: user.role,
      reporterName: user.name,
      facilityId: typeof facilityId === 'string' && facilityId ? facilityId : undefined,
      bookingId: typeof bookingId === 'string' && bookingId ? bookingId : undefined,
      category: category || 'other',
      severity: severity || 'medium',
      description: String(description),
    });
    res.status(201).json({ incident: inc, snapshot: store.getSnapshotForUser(user) });
  });

  app.post('/api/admin/incidents/:id', async (req, res) => {
    const admin = await requireAuth(req, res, ['admin']);
    if (!admin) return;
    const { status, resolutionNote } = req.body ?? {};
    const inc = store.updateIncident(
      req.params.id,
      status || 'resolved',
      String(resolutionNote || ''),
      admin.id
    );
    if (!inc) {
      res.status(404).json({ error: 'Incident not found' });
      return;
    }
    res.json({ incident: inc, snapshot: store.getSnapshotForUser(admin) });
  });

  app.post('/api/disputes', async (req, res) => {
    const user = await requireAuth(req, res);
    if (!user) return;
    const { bookingId, reason, requestedRefundInr } = req.body ?? {};
    if (!bookingId || !reason) {
      res.status(400).json({ error: 'Booking ID and dispute reason are required.' });
      return;
    }
    const access = checkBookingAccess(String(bookingId), user);
    if (!access.found) {
      res.status(404).json({ error: 'Booking not found' });
      return;
    }
    if (!access.authorized) {
      res.status(403).json({ error: 'Forbidden: you can only raise disputes for your own booking.' });
      return;
    }
    const result = store.raiseDispute({
      bookingId: String(bookingId),
      raisedBy: user.name,
      reason: String(reason),
      requestedRefundInr: Number(requestedRefundInr || 0),
    });
    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.status(201).json({ dispute: result.dispute, snapshot: store.getSnapshotForUser(user) });
  });

  app.post('/api/admin/disputes/:id/resolve', async (req, res) => {
    const admin = await requireAuth(req, res, ['admin']);
    if (!admin) return;
    const decision = req.body?.decision === 'dismissed' ? 'dismissed' : 'refunded';
    const result = store.resolveDispute(
      req.params.id,
      decision,
      String(req.body?.adminNote || ''),
      admin.id
    );
    if (!result.ok) {
      res.status(404).json({ error: result.error });
      return;
    }
    res.json({ dispute: result.dispute, snapshot: store.getSnapshotForUser(admin) });
  });

  app.post('/api/reports', async (req, res) => {
    const user = await requireAuth(req, res);
    if (!user) return;
    const { reportedEntity, reason } = req.body ?? {};
    if (!reportedEntity || !reason) {
      res.status(400).json({ error: 'Reported target and reason are required.' });
      return;
    }
    const report = store.submitUserReport({
      reportedEntity: String(reportedEntity),
      reporterName: user.name,
      reason: String(reason),
    });
    res.status(201).json({ report, snapshot: store.getSnapshotForUser(user) });
  });

  app.post('/api/admin/reports/:id', async (req, res) => {
    const admin = await requireAuth(req, res, ['admin']);
    if (!admin) return;
    const { status, moderatorNote } = req.body ?? {};
    const rep = store.moderateUserReport(
      req.params.id,
      status || 'dismissed',
      String(moderatorNote || ''),
      admin.id
    );
    if (!rep) {
      res.status(404).json({ error: 'Report not found' });
      return;
    }
    res.json({ report: rep, snapshot: store.getSnapshotForUser(admin) });
  });

  app.post('/api/notifications/:id/read', async (req, res) => {
    const user = await requireAuth(req, res);
    if (!user) return;
    const ntf = store.notifications.find((n) => n.id === req.params.id);
    if (!ntf) {
      res.status(404).json({ error: 'Notification not found' });
      return;
    }
    if (
      user.role !== 'admin' &&
      ntf.driverEmail &&
      ntf.driverEmail.toLowerCase() !== user.email.toLowerCase()
    ) {
      res.status(403).json({ error: 'Forbidden: you cannot update another user’s notification.' });
      return;
    }
    ntf.read = true;
    res.json({ snapshot: store.getSnapshotForUser(user) });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Spacio server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start Spacio server:', err);
  process.exit(1);
});
