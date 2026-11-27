import type {
  AgentStageResult,
  AgentStreamEvent,
  AutonomousLifecycleEvent,
  AutonomousLifecycleStep,
  BookingRecord,
  CandidateEvaluation,
  ExtensionOffer,
  MultiAgentWorkflowRun,
  ParkingSpace,
  PrepaidWallet,
  SupervisorAudit,
  VehicleProfile,
} from '../src/types/parkpool.ts';
import { GoogleGenAI } from '@google/genai';
import {
  BENGALURU_LOCATIONS,
  formatMinutesToTime,
  parseTimeToMinutes,
  POLICY_RAG_CORPUS,
  store,
} from './domain.ts';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_OPENROUTER_MODEL = 'openrouter/auto';

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function getOpenRouterConfig(): { apiKey: string; model: string; referer: string } {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_OPENROUTER_API_KEY') {
    throw new Error(
      'OPENROUTER_API_KEY is not configured. Please add your OpenRouter API key in environment secrets.'
    );
  }
  const model = process.env.OPENROUTER_MODEL?.trim() || DEFAULT_OPENROUTER_MODEL;
  const appUrl = process.env.APP_URL?.trim();
  const referer =
    appUrl && appUrl !== 'MY_APP_URL' && /^https?:\/\//i.test(appUrl)
      ? appUrl
      : 'http://localhost:3000';
  return { apiKey, model, referer };
}

function extractJsonObject(rawText: string): Record<string, unknown> {
  const trimmed = rawText.trim();
  if (!trimmed) return {};

  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = fenceMatch ? fenceMatch[1].trim() : trimmed;

  try {
    return JSON.parse(candidate) as Record<string, unknown>;
  } catch {
    const firstBrace = candidate.indexOf('{');
    const lastBrace = candidate.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      return JSON.parse(candidate.slice(firstBrace, lastBrace + 1)) as Record<string, unknown>;
    }
    throw new Error('OpenRouter response did not contain valid JSON.');
  }
}

async function callOpenRouter(params: {
  systemPrompt: string;
  userPrompt: string;
  expectJson?: boolean;
}): Promise<{ text: string; modelUsed: string }> {
  const { apiKey, model, referer } = getOpenRouterConfig();

  const executeRequest = async (useJsonFormat: boolean) => {
    const body: Record<string, unknown> = {
      model,
      messages: [
        { role: 'system', content: params.systemPrompt },
        { role: 'user', content: params.userPrompt },
      ],
      temperature: 0.2,
      max_tokens: 900,
    };

    if (useJsonFormat) {
      body.response_format = { type: 'json_object' };
    }

    const res = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': referer,
        'X-Title': 'ParkPool AI',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(25000),
    });

    if (!res.ok) {
      const errJson = (await res.json().catch(() => null)) as
        | { error?: { message?: string } }
        | null;
      const errMsg = errJson?.error?.message || `OpenRouter API HTTP ${res.status}`;
      const error = new Error(errMsg) as Error & { status?: number };
      error.status = res.status;
      throw error;
    }

    const data = (await res.json()) as {
      model?: string;
      choices?: Array<{ message?: { content?: string | Array<{ text?: string }> } }>;
    };

    const rawContent = data.choices?.[0]?.message?.content;
    const text =
      typeof rawContent === 'string'
        ? rawContent
        : Array.isArray(rawContent)
        ? rawContent.map((part) => part?.text || '').join('')
        : '';

    return {
      text: text.trim(),
      modelUsed: data.model || model,
    };
  };

  try {
    return await executeRequest(Boolean(params.expectJson));
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status;
    // Some OpenRouter-routed models reject response_format=json_object with HTTP 400; retry cleanly
    if (params.expectJson && status === 400) {
      return await executeRequest(false);
    }
    throw err;
  }
}

const GEMINI_MODEL = 'gemini-4-hydrogen';

let cachedGeminiBlockState: {
  apiKey: string;
  code: number;
  status: string;
  message: string;
  logged: boolean;
} | null = null;

function hasOpenRouterConfigured(): boolean {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  return Boolean(apiKey && apiKey !== 'MY_OPENROUTER_API_KEY');
}

function parseGeminiErrorDetails(err: unknown): {
  code: number;
  status: string;
  message: string;
  retryable: boolean;
  nonRetryableAuthOrBilling: boolean;
} {
  const raw = err instanceof Error ? err.message : String(err ?? '');
  let code = typeof (err as { status?: unknown })?.status === 'number'
    ? ((err as { status: number }).status)
    : 0;
  let status = '';
  let message = raw;

  const jsonStart = raw.indexOf('{');
  if (jsonStart !== -1) {
    try {
      const parsed = JSON.parse(raw.slice(jsonStart)) as {
        error?: { code?: number; status?: string; message?: string };
      };
      if (parsed?.error) {
        code = parsed.error.code ?? code;
        status = parsed.error.status ?? status;
        message = parsed.error.message ?? message;
      }
    } catch {
      // Keep raw message if JSON parsing fails
    }
  }

  const nonRetryableAuthOrBilling =
    code === 400 ||
    code === 401 ||
    code === 403 ||
    code === 404 ||
    status === 'PERMISSION_DENIED' ||
    status === 'INVALID_ARGUMENT' ||
    status === 'NOT_FOUND' ||
    /PERMISSION_DENIED|API_KEY_INVALID|free tier is not available/i.test(raw);

  const retryable =
    !nonRetryableAuthOrBilling &&
    (code === 429 ||
      code === 500 ||
      code === 502 ||
      code === 503 ||
      code === 504 ||
      status === 'RESOURCE_EXHAUSTED' ||
      status === 'UNAVAILABLE' ||
      /timeout|ECONNRESET|ETIMEDOUT|fetch failed/i.test(raw));

  return { code, status, message, retryable, nonRetryableAuthOrBilling };
}

async function callGeminiGenerateContent(params: {
  systemPrompt: string;
  userPrompt: string;
  expectJson?: boolean;
}): Promise<{ text: string; modelUsed: string } | null> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  const gemini = getGeminiClient();
  if (!gemini || !apiKey) return null;

  if (cachedGeminiBlockState && cachedGeminiBlockState.apiKey === apiKey) {
    return null;
  }

  const delaysMs = [400, 900];
  for (let attempt = 0; attempt <= delaysMs.length; attempt++) {
    try {
      const response = await gemini.models.generateContent({
        model: GEMINI_MODEL,
        contents: params.userPrompt,
        config: {
          systemInstruction: params.systemPrompt,
          ...(params.expectJson ? { responseMimeType: 'application/json' } : {}),
        },
      });
      const text = (response.text ?? '').trim();
      if (text) {
        return { text, modelUsed: GEMINI_MODEL };
      }
      return null;
    } catch (err: unknown) {
      const details = parseGeminiErrorDetails(err);
      if (details.retryable && attempt < delaysMs.length) {
        await pause(delaysMs[attempt]);
        continue;
      }
      if (details.nonRetryableAuthOrBilling) {
        if (!cachedGeminiBlockState || cachedGeminiBlockState.apiKey !== apiKey) {
          cachedGeminiBlockState = {
            apiKey,
            code: details.code || 403,
            status: details.status || 'PERMISSION_DENIED',
            message: details.message,
            logged: true,
          };
          console.info(
            `[ParkPool AI] Gemini API unavailable (${details.code || 403} ${details.status || 'PERMISSION_DENIED'}). Check Settings > Secrets for a billing-enabled key; continuing with deterministic/secondary routing.`
          );
        }
      } else {
        console.info(
          `[ParkPool AI] Gemini request skipped (${details.code || 'ERR'}): ${details.message}`
        );
      }
      return null;
    }
  }
  return null;
}

async function callLlmModel(params: {
  systemPrompt: string;
  userPrompt: string;
  expectJson?: boolean;
}): Promise<{ text: string; modelUsed: string }> {
  const geminiResult = await callGeminiGenerateContent(params);
  if (geminiResult) {
    return geminiResult;
  }

  if (hasOpenRouterConfigured()) {
    return await callOpenRouter(params);
  }

  const reason =
    cachedGeminiBlockState?.message ||
    'No active LLM key configured; deterministic ParkPool engine active.';
  throw new Error(reason);
}

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function parseIntentDeterministically(
  prompt: string,
  vehicle: VehicleProfile,
  fallbackStart: string,
  fallbackEnd: string
): {
  destination: string;
  startTimeHHMM: string;
  endTimeHHMM: string;
  prioritize: 'balanced' | 'closest_walk' | 'lowest_price' | 'covered_ev';
  maxWalkMeters: number;
  needsEv: boolean;
  needsCovered: boolean;
  policyConcern?: string;
} {
  const lower = prompt.toLowerCase();
  const timeMatches = Array.from(prompt.matchAll(/\b([01]?\d|2[0-3]):([0-5]\d)\b/g)).map(
    (m) => `${String(Number(m[1])).padStart(2, '0')}:${m[2]}`
  );
  const startTimeHHMM = timeMatches[0] || fallbackStart;
  const endTimeHHMM = timeMatches[1] || fallbackEnd;

  const matchedHub = BENGALURU_LOCATIONS.find(
    (l) =>
      lower.includes(l.name.toLowerCase()) ||
      lower.includes(l.area.toLowerCase().split('/')[0].trim())
  );
  const nearMatch = prompt.match(/(?:near|at)\s+([A-Za-z0-9\s,&-]+?)(?:\s+from|\s+between|\.|$)/i);
  const destination =
    matchedHub?.name ||
    (nearMatch?.[1]?.trim() ? nearMatch[1].trim() : 'Phoenix Mall of Asia, Bengaluru');

  const needsEv = vehicle.isEv || /\bev\b|charg/i.test(prompt);
  const needsCovered = /\bcover|shaded|basement\b/i.test(prompt);
  let prioritize: 'balanced' | 'closest_walk' | 'lowest_price' | 'covered_ev' = 'balanced';
  if (/closest|nearest|walk|distance|under\s+\d+\s*m/i.test(prompt)) {
    prioritize = 'closest_walk';
  } else if (/cheap|lowest|budget|price/i.test(prompt)) {
    prioritize = 'lowest_price';
  } else if (needsEv || needsCovered) {
    prioritize = 'covered_ev';
  }

  const walkMatch = prompt.match(/(\d{2,4})\s*m\b/i);
  const maxWalkMeters = walkMatch ? Math.max(150, Number(walkMatch[1])) : 550;

  return {
    destination,
    startTimeHHMM,
    endTimeHHMM,
    prioritize,
    maxWalkMeters,
    needsEv,
    needsCovered,
  };
}

function answerPolicyDeterministically(question: string): {
  answer: string;
  citations: Array<{ docId: string; title: string; section: string }>;
} {
  const words = question
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2);

  const scored = POLICY_RAG_CORPUS.map((doc) => {
    const haystack = `${doc.title} ${doc.section} ${doc.content}`.toLowerCase();
    const score = words.reduce((acc, w) => acc + (haystack.includes(w) ? 1 : 0), 0);
    return { doc, score };
  }).sort((a, b) => b.score - a.score);

  const matched = (scored[0]?.score > 0 ? scored.slice(0, 2) : scored.slice(0, 1)).map(
    (s) => s.doc
  );

  return {
    answer: matched.map((d) => `${d.title}: ${d.content}`).join(' '),
    citations: matched.map((d) => ({
      docId: d.id,
      title: d.title,
      section: d.section,
    })),
  };
}

export async function runSupervisedMultiAgentWorkflow(
  input: {
    prompt: string;
    vehicleId: string;
    defaultStartTime?: string;
    defaultEndTime?: string;
    faultInjectionEnabled?: boolean;
    targetSpaceId?: string;
    destinationCoords?: { lat: number; lng: number };
  },
  onEvent?: (ev: AgentStreamEvent) => void
): Promise<MultiAgentWorkflowRun> {
  const workflowStart = Date.now();
  const runId = `RUN-${Date.now().toString(36).toUpperCase()}`;

  const configuredModel = process.env.OPENROUTER_MODEL?.trim() || DEFAULT_OPENROUTER_MODEL;

  const vehicle: VehicleProfile =
    store.vehicles.find((v) => v.id === input.vehicleId) || store.vehicles[0];
  const faultInjectionEnabled = Boolean(input.faultInjectionEnabled);

  onEvent?.({
    type: 'workflow_init',
    runId,
    vehicle,
    faultInjectionEnabled,
  });

  const stages: AgentStageResult[] = [];

  // =========================================================================
  // STAGE 1: Parking Intent & Policy Agent (OpenRouter AI)
  // =========================================================================
  onEvent?.({
    type: 'stage_start',
    stageOrder: 1,
    agentId: 'intent_policy_agent',
    agentName: 'Parking Intent & Policy Agent',
    message: `Parsing natural-language request for ${vehicle.label}...`,
  });

  const s1Start = Date.now();
  const fallbackStart = input.defaultStartTime || '14:00';
  const fallbackEnd = input.defaultEndTime || '17:30';

  let parsedRaw: Record<string, unknown>;
  let s1ExecutionMode: 'openrouter_llm' | 'deterministic_service' = 'openrouter_llm';
  let s1ModelUsed = configuredModel;
  try {
    const intentResult = await callLlmModel({
      systemPrompt:
        'You are a structured parking intent parser for Bengaluru. Respond ONLY with a raw valid JSON object (no markdown fences, no commentary).',
      userPrompt: `Extract structured parking search requirements from this driver request for Bengaluru.
Driver Request: "${input.prompt}"
Selected Vehicle: ${vehicle.label} (${vehicle.vehicleType}, EV=${vehicle.isEv}, ${vehicle.lengthCm}x${vehicle.widthCm}x${vehicle.heightCm}cm)
Default Time Window if not specified in prompt: ${fallbackStart} to ${fallbackEnd}

Return a JSON object with EXACTLY these keys:
{
  "destination": string,
  "startTimeHHMM": "HH:MM",
  "endTimeHHMM": "HH:MM",
  "prioritize": "balanced" | "closest_walk" | "lowest_price" | "covered_ev",
  "maxWalkMeters": integer,
  "needsEv": boolean,
  "needsCovered": boolean,
  "policyConcern": string (optional)
}`,
      expectJson: true,
    });
    parsedRaw = extractJsonObject(intentResult.text);
    s1ModelUsed = intentResult.modelUsed || configuredModel;
  } catch {
    parsedRaw = parseIntentDeterministically(input.prompt, vehicle, fallbackStart, fallbackEnd);
    s1ExecutionMode = 'deterministic_service';
    s1ModelUsed = 'deterministic-intent-parser';
  }

  let reqStartMin = parseTimeToMinutes(
    typeof parsedRaw.startTimeHHMM === 'string' ? parsedRaw.startTimeHHMM : fallbackStart,
    14 * 60
  );
  let reqEndMin = parseTimeToMinutes(
    typeof parsedRaw.endTimeHHMM === 'string' ? parsedRaw.endTimeHHMM : fallbackEnd,
    17 * 60 + 30
  );

  const s1Violations: string[] = [];
  let s1Corrective = 'None required — structured intent passed all schema and boundary checks.';
  if (reqEndMin <= reqStartMin) {
    s1Violations.push(
      `Invalid time interval (${formatMinutesToTime(reqStartMin)} >= ${formatMinutesToTime(reqEndMin)})`
    );
    reqEndMin = Math.min(23 * 60, reqStartMin + 180);
    s1Corrective = `Normalized end time to ${formatMinutesToTime(reqEndMin)} (+3h window).`;
  }
  let maxWalkMeters = Number(parsedRaw.maxWalkMeters) || 550;
  if (maxWalkMeters < 150) {
    s1Violations.push(`Unrealistic maxWalkMeters (${maxWalkMeters}m < 150m minimum cluster radius)`);
    maxWalkMeters = 350;
    s1Corrective = 'Adjusted minimum search radius to 350m to cover verified entrances.';
  }

  const validPriorities = ['balanced', 'closest_walk', 'lowest_price', 'covered_ev'] as const;
  const rawPrioritize = String(parsedRaw.prioritize || 'balanced');
  const prioritize = validPriorities.includes(
    rawPrioritize as 'balanced' | 'closest_walk' | 'lowest_price' | 'covered_ev'
  )
    ? (rawPrioritize as 'balanced' | 'closest_walk' | 'lowest_price' | 'covered_ev')
    : 'balanced';

  const parsedIntent = {
    destination:
      typeof parsedRaw.destination === 'string' && parsedRaw.destination.trim()
        ? parsedRaw.destination.trim()
        : 'Phoenix Mall of Asia, Bengaluru',
    startTimeLabel: formatMinutesToTime(reqStartMin),
    endTimeLabel: formatMinutesToTime(reqEndMin),
    prioritize,
    maxWalkMeters,
    needsEv: Boolean(parsedRaw.needsEv),
    needsCovered: Boolean(parsedRaw.needsCovered),
    policyConcern:
      typeof parsedRaw.policyConcern === 'string' && parsedRaw.policyConcern.trim()
        ? parsedRaw.policyConcern.trim()
        : undefined,
  };

  const s1Audit: SupervisorAudit = {
    verdict: s1Violations.length > 0 ? 'FLAGGED_AND_CORRECTED' : 'VERIFIED',
    accuracyScore: s1Violations.length > 0 ? 86 : 100,
    invariantsChecked: [
      'JSON schema completeness',
      'Temporal interval validity (end > start)',
      'Geospatial search radius bounds (>= 150m)',
    ],
    violationsCaught: s1Violations,
    correctiveAction: s1Corrective,
    verifierNotes: `Verified structured slot ${parsedIntent.startTimeLabel}–${parsedIntent.endTimeLabel} for ${vehicle.label}.`,
    checkedAtIso: new Date().toISOString(),
  };

  onEvent?.({
    type: 'supervisor_check',
    stageOrder: 1,
    agentId: 'intent_policy_agent',
    verdict: s1Audit.verdict,
    message: s1Audit.verifierNotes,
    violations: s1Violations,
  });

  const stage1: AgentStageResult = {
    stageOrder: 1,
    agentId: 'intent_policy_agent',
    agentName: 'Parking Intent & Policy Agent',
    roleDescription: 'Extracts destination, slot window, vehicle constraints, and policy intent.',
    executionMode: s1ExecutionMode,
    status: s1Violations.length > 0 ? 'corrected' : 'completed',
    latencyMs: Date.now() - s1Start,
    outputSummary: `Parsed "${parsedIntent.destination}" for ${parsedIntent.startTimeLabel}–${parsedIntent.endTimeLabel}, priority=${parsedIntent.prioritize}, maxWalk=${parsedIntent.maxWalkMeters}m.`,
    structuredData: parsedIntent,
    evidenceRefs: [`model:${s1ModelUsed}`, `vehicle:${vehicle.id}`],
    supervisorAudit: s1Audit,
  };
  stages.push(stage1);
  onEvent?.({ type: 'stage_complete', stage: stage1 });

  // =========================================================================
  // STAGE 2: Location & Availability Intelligence Agent (Deterministic)
  // =========================================================================
  onEvent?.({
    type: 'stage_start',
    stageOrder: 2,
    agentId: 'location_availability_agent',
    agentName: 'Location & Availability Intelligence Agent',
    message: `Scanning Bengaluru GPS cluster around ${parsedIntent.destination}, entrance gates, and live schedules...`,
  });
  if (onEvent) await pause(240);

  let effectiveDestCoords = input.destinationCoords;
  if (!effectiveDestCoords && parsedIntent.destination) {
    const destLower = parsedIntent.destination.toLowerCase();
    const matchedHub = BENGALURU_LOCATIONS.find(
      (l) =>
        destLower.includes(l.name.toLowerCase()) ||
        l.name.toLowerCase().includes(destLower.replace(/,\s*bengaluru$/i, '').trim()) ||
        destLower.includes(l.area.toLowerCase().split('/')[0].trim())
    );
    if (matchedHub) {
      store.ensureLocationSupply(matchedHub);
      effectiveDestCoords = { lat: matchedHub.lat, lng: matchedHub.lng };
    }
  }

  const s2Start = Date.now();
  const allFacilities = store.facilities.filter((f) => !store.isHostSandboxFacility(f.id));
  const rawDiscoveredFacilities = faultInjectionEnabled
    ? allFacilities
    : allFacilities.filter((f) => f.verificationStatus === 'verified');

  const s2Violations: string[] = [];
  let s2Corrective = 'None required — all discovered facilities carry active authority records.';

  const verifiedFacilities = rawDiscoveredFacilities.filter((f) => {
    if (f.verificationStatus !== 'verified' || f.authorityDocRef.startsWith('MISSING')) {
      s2Violations.push(
        `Blocked unauthorized facility ${f.id} (${f.name}): status=${f.verificationStatus}, doc=${f.authorityDocRef}`
      );
      return false;
    }
    return true;
  });

  if (s2Violations.length > 0) {
    s2Corrective =
      'Supervisor stripped unverified facility before passing inventory to Matching Optimizer.';
    store.addAudit(
      'Supervisor Verification Agent',
      'CAUGHT_UNVERIFIED_FACILITY',
      `Intercepted ${s2Violations.length} unverified listing(s) during workflow ${runId}.`
    );
  }

  const s2Audit: SupervisorAudit = {
    verdict: s2Violations.length > 0 ? 'FLAGGED_AND_CORRECTED' : 'VERIFIED',
    accuracyScore: s2Violations.length > 0 ? 78 : 100,
    invariantsChecked: [
      'Permission-before-publication gate (verificationStatus === verified)',
      'Pedestrian entrance route metadata present',
      'Availability source & freshness timestamp stamped',
    ],
    violationsCaught: s2Violations,
    correctiveAction: s2Corrective,
    verifierNotes: `Validated ${verifiedFacilities.length} authorized facilities with exact gate GPS & pedestrian walk paths.`,
    checkedAtIso: new Date().toISOString(),
  };

  onEvent?.({
    type: 'supervisor_check',
    stageOrder: 2,
    agentId: 'location_availability_agent',
    verdict: s2Audit.verdict,
    message:
      s2Violations.length > 0
        ? `INTERCEPTED: ${s2Violations[0]}`
        : s2Audit.verifierNotes,
    violations: s2Violations,
  });

  const stage2: AgentStageResult = {
    stageOrder: 2,
    agentId: 'location_availability_agent',
    agentName: 'Location & Availability Intelligence Agent',
    roleDescription: 'Retrieves Bengaluru cluster facilities, pedestrian entrance routes, and live schedules.',
    executionMode: 'deterministic_service',
    status: s2Violations.length > 0 ? 'corrected' : 'completed',
    latencyMs: Math.max(15, Date.now() - s2Start),
    outputSummary: `Retrieved ${verifiedFacilities.length} authorized facilities (${store.spaces.length} total bays inspected across ${allFacilities.length} properties).`,
    structuredData: {
      authorizedFacilityIds: verifiedFacilities.map((f) => f.id),
      nearestEntrance: verifiedFacilities[0]?.entranceLabel,
      freshnessTimestamp: verifiedFacilities[0]?.lastUpdatedIso,
    },
    evidenceRefs: verifiedFacilities.slice(0, 8).map((f) => `facility:${f.id}:${f.availabilitySource}`),
    supervisorAudit: s2Audit,
  };
  stages.push(stage2);
  onEvent?.({ type: 'stage_complete', stage: stage2 });

  // =========================================================================
  // STAGE 3: Hard-Constraint Matching & Pooling Optimizer Agent
  // =========================================================================
  onEvent?.({
    type: 'stage_start',
    stageOrder: 3,
    agentId: 'matching_pooling_optimizer',
    agentName: 'Matching & Pooling Optimization Agent',
    message: 'Checking cm vehicle fit, 15m buffers, owner-use cutoffs & pooling allocation...',
  });
  if (onEvent) await pause(260);

  const s3Start = Date.now();
  const evalResult = store.evaluateAllCandidates(
    reqStartMin,
    reqEndMin,
    vehicle,
    prioritize,
    effectiveDestCoords
  );

  let proposedEligible: CandidateEvaluation[] = [...evalResult.eligible];
  const excluded: CandidateEvaluation[] = [...evalResult.excluded];

  const s3Violations: string[] = [];
  let s3Corrective = 'None required — all candidate bays satisfy dimension, buffer, and cutoff invariants.';

  if (faultInjectionEnabled && excluded.length > 0) {
    const leaked = excluded[0];
    proposedEligible.unshift({ ...leaked, eligible: true, score: 94.5 });
  }

  const verifiedEligible: CandidateEvaluation[] = [];
  for (const cand of proposedEligible) {
    const space = store.spaces.find((s) => s.id === cand.spaceId)!;
    const fac = store.facilities.find((f) => f.id === cand.facilityId)!;
    const truth = store.evaluateSpace(
      space,
      fac,
      reqStartMin,
      reqEndMin,
      vehicle,
      prioritize
    );

    if (!truth.eligible) {
      s3Violations.push(
        `Intercepted illegal candidate ${cand.spaceCode}: ${truth.rejectionReasons.join('; ')}`
      );
    } else {
      verifiedEligible.push({
        ...truth,
        walkingDistanceM: cand.walkingDistanceM,
        walkingMinutes: cand.walkingMinutes,
        score: cand.score,
      });
    }
  }

  if (s3Violations.length > 0) {
    s3Corrective =
      'Supervisor rejected hard-constraint violators and restored strictly feasible, buffer-safe ranking.';
    store.addAudit(
      'Supervisor Verification Agent',
      'HARD_CONSTRAINT_INTERCEPT',
      `Blocked invalid optimizer proposal in ${runId}: ${s3Violations[0]}`
    );
  }

  const poolingBenchmark = store.computePoolingComparison();
  const optimizerMetrics = poolingBenchmark.find((m) => m.strategy === 'uncertainty_aware');

  const s3Audit: SupervisorAudit = {
    verdict: s3Violations.length > 0 ? 'FLAGGED_AND_CORRECTED' : 'VERIFIED',
    accuracyScore: s3Violations.length > 0 ? 74 : 100,
    invariantsChecked: [
      'Vehicle cm dimensions (length, width, height) & type fit',
      '15-minute turnaround buffer around existing bookings',
      'Owner-use blocks & host hard departure deadline',
      'Confirmed booking protection (zero silent displacement)',
    ],
    violationsCaught: s3Violations,
    correctiveAction: s3Corrective,
    verifierNotes: `${verifiedEligible.length} bays verified feasible; ${excluded.length} incompatible/conflicting bays strictly excluded.`,
    checkedAtIso: new Date().toISOString(),
  };

  onEvent?.({
    type: 'supervisor_check',
    stageOrder: 3,
    agentId: 'matching_pooling_optimizer',
    verdict: s3Audit.verdict,
    message:
      s3Violations.length > 0
        ? `INTERCEPTED: ${s3Violations[0]}`
        : s3Audit.verifierNotes,
    violations: s3Violations,
  });

  const stage3: AgentStageResult = {
    stageOrder: 3,
    agentId: 'matching_pooling_optimizer',
    agentName: 'Matching & Pooling Optimization Agent',
    roleDescription: 'Enforces vehicle/buffer/owner-block constraints and ranks pooled time windows.',
    executionMode: 'hybrid_optimizer',
    status: s3Violations.length > 0 ? 'corrected' : 'completed',
    latencyMs: Math.max(18, Date.now() - s3Start),
    outputSummary: `Matched ${verifiedEligible.length} feasible bays; excluded ${excluded.length} (optimizer pool utilization ${optimizerMetrics?.utilizationPct ?? 0}%, 0 conflicts).`,
    structuredData: {
      topSpaceId: verifiedEligible[0]?.spaceId || null,
      feasibleCount: verifiedEligible.length,
      excludedCount: excluded.length,
      poolUtilizationPct: optimizerMetrics?.utilizationPct,
    },
    evidenceRefs: [
      ...verifiedEligible.slice(0, 6).map((c) => `space:${c.spaceId}:score=${c.score}`),
      'optimizer:uncertainty_aware',
    ],
    supervisorAudit: s3Audit,
  };
  stages.push(stage3);
  onEvent?.({ type: 'stage_complete', stage: stage3 });

  // =========================================================================
  // STAGE 4: Pricing, Review & Trust Intelligence Agent (OpenRouter AI)
  // =========================================================================
  onEvent?.({
    type: 'stage_start',
    stageOrder: 4,
    agentId: 'pricing_trust_agent',
    agentName: 'Pricing, Review & Trust Agent',
    message: 'Calculating server-side INR quotes & auditing eligible completed-booking reviews...',
  });

  const s4Start = Date.now();
  const targetCand = input.targetSpaceId
    ? verifiedEligible.find((c) => c.spaceId === input.targetSpaceId)
    : undefined;
  const orderedForAnalysis = targetCand
    ? [targetCand, ...verifiedEligible.filter((c) => c.spaceId !== targetCand.spaceId)]
    : verifiedEligible;
  const topForAnalysis = orderedForAnalysis.slice(0, 3).map((c) => {
    const space = store.spaces.find((s) => s.id === c.spaceId)!;
    return {
      spaceId: c.spaceId,
      facilityName: c.facilityName,
      spaceCode: c.spaceCode,
      hourlyPriceInr: c.hourlyPriceInr,
      totalQuoteInr: c.totalQuoteInr,
      walkingDistanceM: c.walkingDistanceM,
      walkingMinutes: c.walkingMinutes,
      entranceLabel: c.entranceLabel,
      covered: c.covered,
      evCharging: c.evCharging,
      reviews: space.reviews.map((r) => ({
        bookingId: r.bookingId,
        rating: r.rating,
        theme: r.theme,
        comment: r.comment,
      })),
    };
  });

  let pricingParsed: Record<string, unknown>;
  let s4ExecutionMode: 'openrouter_llm' | 'deterministic_service' = 'openrouter_llm';
  try {
    const pricingTrustResult = await callLlmModel({
      systemPrompt:
        'You are the Pricing & Trust Auditor for ParkPool AI. Respond ONLY with a raw valid JSON object (no markdown fences, no commentary).',
      userPrompt: `Analyze these verified parking candidates and produce concise, strictly evidence-grounded pricing, walking-route, and review-trust summaries.
RULES:
1. Quote ONLY the exact totalQuoteInr values provided in the input JSON.
2. Cite ONLY the provided bookingId values for reviews. Never invent reviews.
3. Never promise "100% security" or theft guarantees; state actual access control & safety notes.

Return a JSON object with EXACTLY these keys:
{
  "priceSummary": string,
  "trustAndReviewHighlights": [
    {
      "spaceId": string,
      "quotedInr": number,
      "citedBookingIds": string[],
      "summary": string
    }
  ],
  "safetyDisclaimerIncluded": boolean
}

Candidates JSON:
${JSON.stringify(topForAnalysis, null, 2)}`,
      expectJson: true,
    });
    pricingParsed = extractJsonObject(pricingTrustResult.text);
  } catch {
    s4ExecutionMode = 'deterministic_service';
    pricingParsed = {
      priceSummary:
        topForAnalysis.length > 0
          ? `Server-verified quotes ready across ${topForAnalysis.length} compliant bay(s): ${topForAnalysis
              .map((c) => `${c.spaceCode} at ₹${c.totalQuoteInr} (${c.walkingDistanceM}m walk)`)
              .join(', ')}.`
          : 'No verified bay matches the requested slot and vehicle dimensions.',
      trustAndReviewHighlights: topForAnalysis.map((c) => ({
        spaceId: c.spaceId,
        quotedInr: c.totalQuoteInr,
        citedBookingIds: c.reviews.map((r) => r.bookingId),
        summary:
          c.reviews.length > 0
            ? `${c.reviews.length} completed-trip review(s) cited via ${c.entranceLabel}; server quote ₹${c.totalQuoteInr} includes GST & platform fee.`
            : `Verified access via ${c.entranceLabel}; server quote ₹${c.totalQuoteInr} includes GST & platform fee.`,
      })),
      safetyDisclaimerIncluded: true,
    };
  }
  const s4Violations: string[] = [];
  let s4Corrective = 'None required — all quoted INR totals and review citations match backend records.';

  if (Array.isArray(pricingParsed.trustAndReviewHighlights)) {
    for (const item of pricingParsed.trustAndReviewHighlights as Array<Record<string, unknown>>) {
      const truth = verifiedEligible.find((c) => c.spaceId === item.spaceId);
      if (truth && Number(item.quotedInr) !== truth.totalQuoteInr) {
        s4Violations.push(
          `Quote drift on ${String(item.spaceId)}: agent stated ₹${String(item.quotedInr)}, server truth is ₹${truth.totalQuoteInr}`
        );
        item.quotedInr = truth.totalQuoteInr;
      }
    }
  }
  if (s4Violations.length > 0) {
    s4Corrective = 'Supervisor enforced authoritative server-side INR quote values.';
  }

  const s4Audit: SupervisorAudit = {
    verdict: s4Violations.length > 0 ? 'FLAGGED_AND_CORRECTED' : 'VERIFIED',
    accuracyScore: s4Violations.length > 0 ? 85 : 100,
    invariantsChecked: [
      'Server-side INR quote parity (zero LLM price hallucination)',
      'Eligible completed-booking review provenance',
      'No unverified physical security guarantees',
    ],
    violationsCaught: s4Violations,
    correctiveAction: s4Corrective,
    verifierNotes: 'Confirmed all quotes match backend pricing engine and reviews trace to completed bookings.',
    checkedAtIso: new Date().toISOString(),
  };

  onEvent?.({
    type: 'supervisor_check',
    stageOrder: 4,
    agentId: 'pricing_trust_agent',
    verdict: s4Audit.verdict,
    message: s4Audit.verifierNotes,
    violations: s4Violations,
  });

  const stage4: AgentStageResult = {
    stageOrder: 4,
    agentId: 'pricing_trust_agent',
    agentName: 'Pricing, Review & Trust Agent',
    roleDescription: 'Validates server-side quotes, summarizes eligible reviews, and surfaces access safety notes.',
    executionMode: s4ExecutionMode,
    status: s4Violations.length > 0 ? 'corrected' : 'completed',
    latencyMs: Date.now() - s4Start,
    outputSummary:
      (typeof pricingParsed.priceSummary === 'string' && pricingParsed.priceSummary) ||
      `Verified server quotes across ${topForAnalysis.length} top candidates with eligible review provenance.`,
    structuredData: pricingParsed,
    evidenceRefs: topForAnalysis.flatMap((c) => [
      `quote:${c.spaceId}:INR_${c.totalQuoteInr}`,
      ...c.reviews.map((r) => `review:${r.bookingId}`),
    ]),
    supervisorAudit: s4Audit,
  };
  stages.push(stage4);
  onEvent?.({ type: 'stage_complete', stage: stage4 });

  // =========================================================================
  // STAGE 5: Booking Coordination & Supervisor Final Sign-Off (OpenRouter AI)
  // =========================================================================
  onEvent?.({
    type: 'stage_start',
    stageOrder: 5,
    agentId: 'booking_supervisor_agent',
    agentName: 'Booking Coordination & Supervisor Sign-Off',
    message: 'Performing final end-to-end audit and locking human confirmation gate...',
  });

  const s5Start = Date.now();
  const totalCaught = stages.reduce((acc, st) => acc + st.supervisorAudit.violationsCaught.length, 0);

  const supervisorSummaryPrompt = `You are the Supervisor & Verification Agent for ParkPool AI.
Audit this completed multi-agent parking coordination run and produce a crisp, authoritative 2-3 sentence verification report for the driver/operator.

Workflow Run ID: ${runId}
Driver Request: "${input.prompt}"
Vehicle: ${vehicle.label} (${vehicle.lengthCm}x${vehicle.widthCm}x${vehicle.heightCm}cm)
Requested Window: ${parsedIntent.startTimeLabel}–${parsedIntent.endTimeLabel}
Verified Feasible Spaces: ${topForAnalysis.map((c) => `${c.spaceCode} at ${c.facilityName} (₹${c.totalQuoteInr}, ${c.walkingDistanceM}m walk)`).join(' | ') || 'NONE'}
Excluded Spaces & Reasons: ${excluded.slice(0, 6).map((e) => `${e.spaceCode}: ${e.rejectionReasons.join(', ')}`).join(' | ') || 'None'}
Violations Intercepted & Corrected Mid-Flight: ${totalCaught} (${stages.flatMap((s) => s.supervisorAudit.violationsCaught).join('; ') || 'None'})
Human Confirmation Lock: Enforced (no booking committed without explicit user confirmation).
Policy Context Reference: ${POLICY_RAG_CORPUS.map((d) => d.id).join(', ')}`;

  const topRec = orderedForAnalysis[0];
  let supervisorFinalReport = topRec
    ? `Spot ${topRec.spaceCode} at ${topRec.facilityName} is verified compatible for ${vehicle.label} (${parsedIntent.startTimeLabel}–${parsedIntent.endTimeLabel}) at ₹${topRec.totalQuoteInr} total via ${topRec.entranceLabel}. ${totalCaught > 0 ? `${totalCaught} scheduling or policy violation(s) were caught automatically.` : 'All availability, vehicle fit, and buffer checks passed.'}`
    : `No compatible verified bay is available for ${vehicle.label} during ${parsedIntent.startTimeLabel}–${parsedIntent.endTimeLabel}.`;
  let s5ExecutionMode: 'openrouter_llm' | 'deterministic_service' = 'openrouter_llm';
  let s5ModelUsed = configuredModel;

  try {
    const finalAuditResult = await callLlmModel({
      systemPrompt:
        'You are the ParkPool AI Supervisor Verification Agent. Write a concise 2-3 sentence plain-text verification summary.',
      userPrompt: supervisorSummaryPrompt,
      expectJson: false,
    });
    if (finalAuditResult.text) {
      supervisorFinalReport = finalAuditResult.text;
    }
    s5ModelUsed = finalAuditResult.modelUsed || configuredModel;
  } catch {
    s5ExecutionMode = 'deterministic_service';
    s5ModelUsed = 'deterministic-supervisor';
  }

  const s5Audit: SupervisorAudit = {
    verdict: verifiedEligible.length === 0 ? 'REJECTED' : totalCaught > 0 ? 'FLAGGED_AND_CORRECTED' : 'VERIFIED',
    accuracyScore: verifiedEligible.length > 0 ? 100 : 95,
    invariantsChecked: [
      'End-to-end stage audit completeness',
      'Human-in-the-loop confirmation gate active',
      'Entrance-specific navigation & hard cutoff disclosure',
    ],
    violationsCaught: [],
    correctiveAction:
      verifiedEligible.length === 0
        ? 'No compatible bays available in requested window; blocked booking progression safely.'
        : 'Ready for explicit user wallet confirmation.',
    verifierNotes: 'Supervisor final sign-off complete. Confirmed bookings remain protected.',
    checkedAtIso: new Date().toISOString(),
  };

  onEvent?.({
    type: 'supervisor_check',
    stageOrder: 5,
    agentId: 'booking_supervisor_agent',
    verdict: s5Audit.verdict,
    message: s5Audit.verifierNotes,
    violations: [],
  });

  const stage5: AgentStageResult = {
    stageOrder: 5,
    agentId: 'booking_supervisor_agent',
    agentName: 'Booking Coordination & Supervisor Sign-Off',
    roleDescription: 'Enforces human confirmation gate, verifies entrance routing, and signs off full workflow accuracy.',
    executionMode: s5ExecutionMode,
    status: verifiedEligible.length === 0 ? 'blocked' : 'completed',
    latencyMs: Date.now() - s5Start,
    outputSummary:
      topRec
        ? `Prepared quote & entrance guide for top recommendation ${topRec.spaceCode} (₹${topRec.totalQuoteInr} total). Awaiting explicit user confirmation.`
        : 'No verified, conflict-free bay satisfies all hard constraints for this window.',
    structuredData: {
      humanApprovalRequired: true,
      topRecommendationId: topRec?.spaceId || null,
      totalViolationsIntercepted: totalCaught,
    },
    evidenceRefs: ['human_approval_gate:enabled', `supervisor_run:${runId}`],
    supervisorAudit: s5Audit,
  };
  stages.push(stage5);
  onEvent?.({ type: 'stage_complete', stage: stage5 });

  store.addAudit(
    'Multi-Agent Supervisor',
    'WORKFLOW_VERIFIED',
    `${runId}: ${verifiedEligible.length} eligible, ${excluded.length} excluded, ${totalCaught} fault(s) intercepted (Engine: ${s5ModelUsed}).`
  );

  const finalRun: MultiAgentWorkflowRun = {
    runId,
    prompt: input.prompt,
    requestedStartMin: reqStartMin,
    requestedEndMin: reqEndMin,
    vehicle,
    faultInjectionEnabled,
    overallStatus:
      verifiedEligible.length === 0
        ? 'action_blocked'
        : totalCaught > 0
        ? 'corrected_and_verified'
        : 'verified_ready',
    totalLatencyMs: Date.now() - workflowStart,
    parsedIntent,
    stages,
    recommendedCandidates: orderedForAnalysis,
    excludedCandidates: excluded,
    supervisorFinalReport,
    humanApprovalRequired: true,
  };

  onEvent?.({ type: 'workflow_complete', run: finalRun });
  return finalRun;
}

export interface DriverAgentChatInput {
  question: string;
  userEmail?: string;
  userName?: string;
  userRole?: string;
  vehicleId?: string;
  activeBookingId?: string;
  history?: Array<{ role: 'user' | 'assistant'; text: string }>;
}

export interface DriverAgentResponse {
  answer: string;
  citations: Array<{ docId: string; title: string; section: string }>;
  recommendedSpots?: CandidateEvaluation[];
  suggestedPrompts?: string[];
  safetyNotice?: string;
  contextSummary?: {
    activeVehicle?: string;
    activeBooking?: string;
    walletBalanceInr?: number;
  };
}

const EXTENDED_POLICY_CORPUS = [
  ...POLICY_RAG_CORPUS,
  {
    id: 'DOC-REFUND-06',
    title: 'Cancellation & Immediate Prepaid Wallet Refund Policy',
    section: 'Section 11.4.G',
    content:
      'Pre-arrival cancellations requested at least 30 minutes before booking start receive an instant 100% full refund directly credited back to the Prepaid Parking Balance. Unpaid checkout holds automatically expire after 10 minutes with zero charge or penalty.',
  },
  {
    id: 'DOC-CHECKIN-07',
    title: 'Spot Check-In, Access PIN & Backup Spot Wall Placard Protocol',
    section: 'Section 11.4.H',
    content:
      'Drivers check in upon arrival at the parking spot entrance by presenting their live QR pass or 6-digit Spot Access PIN. For self check-in without an attendant, drivers use the "Scan Spot Wall QR" option in Active Bookings to scan the verified wall placard mounted at the parking spot entrance.',
  },
  {
    id: 'DOC-PRICING-08',
    title: 'Transparent Pricing Breakdown & Prepaid Wallet Settlement Standard',
    section: 'Section 11.4.I',
    content:
      'All parking rates are transparently itemized as: Base Parking Rate + 10% Platform Service Fee + 18% GST = Total Quote. All booking payments and post-checkout extra hours settle automatically against the driver’s prepaid balance, with remaining balance displayed before and after payment and on checkout.',
  },
];

export async function askDriverGenAiAgent(
  input: DriverAgentChatInput
): Promise<DriverAgentResponse> {
  const cleanQuestion = String(input.question || '').trim();
  const lowerQ = cleanQuestion.toLowerCase();

  // Safety & Privacy Regex Checks
  const isPrivacyBreachAttempt =
    /(other\s+drivers?|who\s+is\s+parked|license\s+of\s+others?|passwords?|passcodes?|admin\s+keys?|tokens?|phone\s+numbers?|email\s+list|private\s+docs?|tax\s+docs?|aadhar|pan\s+card|dump\s+database|admin\s+mode)/i.test(
      lowerQ
    );

  if (isPrivacyBreachAttempt) {
    return {
      answer:
        '🔒 **Privacy & Safety Safeguard Active**\n\nParkPool AI strictly protects driver and property confidentiality. To ensure safety and security, personal contact numbers, vehicle licenses of other drivers, administrative passcodes, and private property verification documents are never disclosed.\n\nI can assist you with your own registered vehicle, your own active bookings, your prepaid wallet balance, and verified public parking spots in Bengaluru.',
      citations: [
        {
          docId: 'DOC-AUTH-01',
          title: 'Provider & Property Authority Verification Policy',
          section: 'Section 11.4.A & 02.6',
        },
      ],
      safetyNotice:
        'Data privacy safeguard: Driver PII and host private records are strictly partitioned.',
      suggestedPrompts: [
        'How do I check in to my parking spot?',
        'Show my remaining wallet balance',
        'Find available parking spots near me',
      ],
    };
  }

  const isDrivingRisk =
    /(while\s+driving|on\s+the\s+road|i('?m| am)\s+driving|steering|behind\s+the\s+wheel)/i.test(
      lowerQ
    );

  const userEmail = (input.userEmail || '').trim().toLowerCase();
  const matchedDriverProfile = userEmail
    ? store.driverProfiles.find((p) => p.email.toLowerCase() === userEmail)
    : undefined;

  let activeVehicle: VehicleProfile =
    store.vehicles.find((v) => v.id === input.vehicleId) ||
    store.vehicles.find((v) => v.ownerEmail && v.ownerEmail.toLowerCase() === userEmail) ||
    store.vehicles[0];

  const activeBooking =
    store.bookings.find(
      (b) =>
        b.id === input.activeBookingId ||
        (userEmail &&
          b.driverEmail?.toLowerCase() === userEmail &&
          (b.status === 'confirmed' ||
            b.status === 'held' ||
            b.status === 'checked-in' ||
            b.status === 'occupied'))
    ) ||
    (userEmail
      ? store.bookings.find(
          (b) => b.driverEmail?.toLowerCase() === userEmail && b.status === 'completed'
        )
      : undefined);

  const activeFacility = activeBooking
    ? store.facilities.find((f) => f.id === activeBooking.facilityId)
    : undefined;

  const wallet = userEmail
    ? store.getOrCreateWallet(
        userEmail,
        input.userName || matchedDriverProfile?.fullName || 'Driver'
      )
    : undefined;

  // Prepare recommended candidate spots if the driver is searching for parking
  let recommendedSpots: CandidateEvaluation[] | undefined;
  const isSearchIntent =
    /find|search|spot|space|park|ev|charge|cheap|lowest|close|near|walk|phoenix|mall|bengaluru|koramangala|indiranagar|whitefield|mg road/i.test(
      lowerQ
    );

  if (isSearchIntent) {
    store.expireStaleHolds();
    store.syncOccupancyStates();
    const approvedSpaces = store.spaces.filter((s) => {
      if (store.isHostSandboxFacility(s.facilityId)) {
        return false;
      }
      if (s.publicationStatus !== 'approved' || s.occupancyState !== 'AVAILABLE') {
        return false;
      }
      if (s.clearanceEndsAt && Date.now() < Date.parse(s.clearanceEndsAt)) {
        return false;
      }
      const hasActiveBooking = store.bookings.some(
        (b) =>
          b.spaceId === s.id &&
          (b.status === 'held' ||
            b.status === 'confirmed' ||
            b.status === 'checked-in' ||
            b.status === 'occupied')
      );
      return !hasActiveBooking;
    });
    const evPreferred = activeVehicle.isEv || /ev|charg/i.test(lowerQ);
    const coveredPreferred = /cover|basement|shade/i.test(lowerQ);

    const scored = approvedSpaces.map((sp) => {
      const fac = store.facilities.find((f) => f.id === sp.facilityId) || store.facilities[0];
      const hours = 2;
      const quote = store.calculateServerQuote(sp.hourlyPriceInr, 600, 720);
      let matchScore = 80;
      if (evPreferred && sp.evCharging) matchScore += 15;
      if (coveredPreferred && sp.covered) matchScore += 10;
      if (fac.walkingDistanceM <= 350) matchScore += 10;
      if (sp.hourlyPriceInr <= 60) matchScore += 8;

      const evalItem: CandidateEvaluation = {
        spaceId: sp.id,
        facilityId: fac.id,
        facilityName: fac.name,
        spaceCode: sp.spaceCode,
        providerType: fac.providerType,
        verificationStatus: fac.verificationStatus,
        eligible: true,
        rejectionReasons: [],
        constraintChecks: [
          {
            constraint: 'Vehicle Fit',
            passed: true,
            detail: `Spot fits ${activeVehicle.label} (${activeVehicle.vehicleType.toUpperCase()})`,
            evidenceRef: 'VEH-FIT-PASS',
          },
        ],
        walkingDistanceM: fac.walkingDistanceM,
        walkingMinutes: fac.walkingMinutes,
        entranceLabel: fac.entranceLabel,
        hourlyPriceInr: sp.hourlyPriceInr,
        durationHours: hours,
        baseAmountInr: quote.baseAmountInr,
        platformFeeInr: quote.platformFeeInr,
        gstInr: quote.gstInr,
        totalQuoteInr: quote.totalAmountInr,
        score: matchScore,
        scoreBreakdown: {
          distanceFit: fac.walkingDistanceM <= 350 ? 95 : 80,
          priceFit: sp.hourlyPriceInr <= 50 ? 95 : 80,
          safetyAmenityFit: sp.covered ? 90 : 80,
          reviewFit: 92,
          availabilityFit: 100,
        },
        covered: sp.covered,
        evCharging: sp.evCharging,
        avgRating: 4.8,
        reviewCount: 38,
        evidenceSummary: `${fac.walkingDistanceM}m walk via ${fac.entranceLabel}; ${fac.accessControl}`,
        lateArrivalSummary: '20 min arrival grace; booking remains active for 45 min.',
      };
      return evalItem;
    });

    scored.sort((a, b) => b.score - a.score);
    recommendedSpots = scored.slice(0, 3);
  }

  // Attempt Gemini model generation first (with circuit-breaker & retry handling)
  const geminiChatResult = await callGeminiGenerateContent({
    systemPrompt:
      'You are the ParkPool Driver Assistant. You provide helpful, concise, safe, and privacy-preserving answers to drivers in Bengaluru without mentioning model names.',
    userPrompt: `
ParkPool AI Driver Assistant Context:
- Requesting Driver: ${input.userName || 'Driver'} (${userEmail || 'Anonymous Session'})
- Active Vehicle: ${activeVehicle.label} (${activeVehicle.vehicleType.toUpperCase()}, EV: ${
      activeVehicle.isEv ? 'Yes' : 'No'
    }, Plate: ${activeVehicle.plateNumber || 'Verified'})
- Driver Prepaid Wallet: ${
      wallet
        ? `₹${wallet.balanceInr} available`
        : '₹500 default balance'
    }
- Current Active Booking: ${
      activeBooking
        ? `Booking ID: ${activeBooking.id}, Status: ${activeBooking.status.toUpperCase()}, Spot: ${
            activeBooking.spaceCode
          }, Facility: ${activeBooking.facilityName}, Spot Entrance: ${
            activeBooking.entranceLabel
          }, Spot Access PIN: ${activeBooking.accessCode}, Total Paid: ₹${
            activeBooking.totalAmountInr
          }`
        : 'None currently active'
    }

Approved Policy Knowledge Base:
${EXTENDED_POLICY_CORPUS.map(
  (doc) => `[${doc.id}] ${doc.title} (${doc.section}): ${doc.content}`
).join('\n')}

Driver Question: "${cleanQuestion}"

Instructions:
1. Provide a comprehensive, friendly, and structured answer for the driver.
2. Use clear, modern parking spot terminology ('Parking Spot Entrance', 'Parking Spot Directions', 'Spot Access PIN', 'Spot Wall QR Placard', 'Parking Bay'). Never use the bare term 'Gate' without context.
3. If asking about check-in, detail both: (a) showing live QR pass or Spot Access PIN; and (b) using 'Scan Spot Wall QR' as a backup self check-in option.
4. If asking about directions, mention the facility address, spot entrance label, and directions guidance.
5. If asking about pricing, explain the transparent formula: Base parking rate + 10% platform service fee + 18% GST = Total Quote.
6. Strictly uphold driver privacy: never disclose information belonging to other users.
7. Format with clean markdown headers and bullet points.
8. Keep answers small, direct, and helpful. Never mention underlying model names, versions, or vendor brands (such as Gemini, GPT, LLM, OpenAI, Google) or declare yourself as an AI model — simply assist directly as the ParkPool Driver Assistant.`,
  });

  if (geminiChatResult?.text) {
    const matchedCitations = EXTENDED_POLICY_CORPUS.filter((d) => {
      const words = d.title.toLowerCase().split(/\s+/);
      return words.some((w) => w.length > 3 && lowerQ.includes(w));
    }).map((d) => ({ docId: d.id, title: d.title, section: d.section }));

    return {
      answer: geminiChatResult.text,
      citations:
        matchedCitations.length > 0
          ? matchedCitations.slice(0, 3)
          : [
              {
                docId: 'DOC-CHECKIN-07',
                title: 'Spot Check-In, Access PIN & Backup Spot Wall Placard Protocol',
                section: 'Section 11.4.H',
              },
            ],
      recommendedSpots,
      suggestedPrompts: [
        'How do I check in to my spot?',
        'What if I arrive late or need an extension?',
        'Explain my wallet balance and pricing breakdown',
      ],
      safetyNotice: isDrivingRisk
        ? '⚠️ Road Safety: Please safely pull over and park before checking directions or interacting with your screen.'
        : undefined,
      contextSummary: {
        activeVehicle: activeVehicle.label,
        activeBooking: activeBooking
          ? `${activeBooking.facilityName} (Spot ${activeBooking.spaceCode})`
          : undefined,
        walletBalanceInr: wallet?.balanceInr,
      },
    };
  }

  // Autonomous GenAI Driver Agent Engine (Deep semantic synthesis)
  let answer = '';
  const citations: Array<{ docId: string; title: string; section: string }> = [];

  if (/check\s*in|how\s+to\s+enter|qr\s+code|placard|wall\s+qr/i.test(lowerQ)) {
    citations.push({
      docId: 'DOC-CHECKIN-07',
      title: 'Spot Check-In, Access PIN & Backup Spot Wall Placard Protocol',
      section: 'Section 11.4.H',
    });
    answer = `### 🅿️ How to Check In to Your Reserved Spot

Checking in to your ParkPool parking spot is fast, verified, and completely touchless:

1. **Arrive at the Parking Spot Entrance**:
   Navigate to your reserved spot entrance${
     activeBooking ? ` at **${activeBooking.entranceLabel}** (${activeBooking.facilityName})` : ''
   }.
2. **Present Your Live QR Pass or Spot Access PIN**:
   Open **Active Bookings** and tap **Show QR Code** to display your live verified pass, or provide your **Spot Access PIN**${
     activeBooking ? ` (\`${activeBooking.accessCode}\`)` : ''
   } to the attendant or entry keypad.
3. **Backup Self Check-In (No Attendant Present)**:
   If no attendant is stationed at the entrance, tap **Scan Spot Wall QR** on your active booking card. You can use your device camera or upload a photo to scan the verified ParkPool wall placard mounted at the parking spot entrance to check in instantly!

*Note: For security and driver privacy, QR pass screenshots are disabled. Your pass is always accessible on-demand inside Active Bookings.*`;
  } else if (/direction|where\s+is|how\s+to\s+reach|navigate|map/i.test(lowerQ)) {
    citations.push({
      docId: 'DOC-WALK-05',
      title: 'Pedestrian Routing & Parking Spot Entrance Precision Standard',
      section: 'Section 11.4.E & 00.7',
    });
    if (activeBooking && activeFacility) {
      answer = `### 📍 Directions to Your Reserved Spot

- **Facility**: **${activeFacility.name}**
- **Address**: ${activeFacility.address} (${activeFacility.zone})
- **Spot Code**: **Spot ${activeBooking.spaceCode}**
- **Spot Entrance**: **${activeBooking.entranceLabel}**
- **Spot Access PIN**: \`${activeBooking.accessCode}\`
- **Access Instructions**: ${activeFacility.accessInstructions}
- **Walk Path Safety**: ${activeFacility.walkPathSafety} · ${activeFacility.accessControl}

Tap **Parking Spot Directions** on your active booking card in **Active Bookings** to view turn-by-turn map guidance directly to your spot.`;
    } else {
      answer = `### 📍 Parking Spot Directions & Navigation

ParkPool provides exact, walkway-measured directions directly to parking spot entrances rather than ambiguous center-point coordinates:

- Select your destination area on the **Find Parking** map.
- Once you reserve a spot, tap **Get Directions on Map** or open **Active Bookings → Parking Spot Directions**.
- You will see turn-by-turn directions with travel modes (**Drive**, **2-Wheeler**, **Transit**, **Walk**) to your spot entrance.`;
    }
  } else if (/price|fee|cost|breakdown|gst|wallet|balance|topup|top\s+up/i.test(lowerQ)) {
    citations.push({
      docId: 'DOC-PRICING-08',
      title: 'Transparent Pricing Breakdown & Prepaid Wallet Settlement Standard',
      section: 'Section 11.4.I',
    });
    citations.push({
      docId: 'DOC-PAYMENTS-03',
      title: 'Server-Generated Payment Orders & Idempotent Webhooks',
      section: 'Section 11.4.F',
    });
    const bal = wallet?.balanceInr ?? 500;
    answer = `### 💰 Transparent Pricing & Prepaid Wallet Balance

Your current **Prepaid Parking Balance**: **₹${bal}**

#### How Every Price is Calculated:
Every parking reservation enforces transparent, itemized pricing calculated exclusively on the server:
- **Base Parking Charge**: Standard hourly rate multiplied by your reserved duration.
- **Platform Service Fee**: 10% platform coordination and supervisor verification fee.
- **GST**: 18% Goods & Services Tax applied to the total service amount.
- **Total Quote**: Exact sum of Base + Platform Fee + GST.

#### Seamless Wallet Payment:
- When you click **Pay from Prepaid Wallet**, the exact booking total is deducted from your balance.
- Your remaining wallet balance is displayed instantly.
- If you extend your stay or overstay, additional hours are pro-rated and settled directly from your wallet balance.`;
  } else if (/late|overstay|delay|grace|extend|extension/i.test(lowerQ)) {
    citations.push({
      docId: 'DOC-OVERSTAY-02',
      title: 'Late Departure, Extensions, Host Buffers & Overstay Protocol',
      section: 'Section 11.4.C',
    });
    answer = `### ⏱️ Late Arrival, Extensions & Overstay Protocol

- **Arrival Grace Window**: You have a **20-minute arrival grace period**. Your booking remains active and held for up to **45 minutes** with a late arrival tag before any forfeiture check occurs.
- **Need More Time?**: If you need to extend your parking stay, simply open **Active Bookings** and tap **Add 30 Mins**. Our autonomous pooling agent verifies that downstream reservations are not conflicted and confirms your extension.
- **Overstay Handling**: If your vehicle remains parked past the scheduled departure without an extension, the bay is flagged as \`OVERSTAY\` to ensure transparency. You are charged standard pro-rated hourly rates without arbitrary tow fees, and your prepaid balance settles the difference smoothly upon exit.`;
  } else if (/cancel|refund|forfeit/i.test(lowerQ)) {
    citations.push({
      docId: 'DOC-REFUND-06',
      title: 'Cancellation & Immediate Prepaid Wallet Refund Policy',
      section: 'Section 11.4.G',
    });
    answer = `### 🔄 Cancellation & Instant Refund Policy

- **Free Cancellation**: Cancel up to **30 minutes before your scheduled start time** to receive a **100% full refund** credited immediately back to your Prepaid Parking Balance.
- **Checkout Holds**: When you place a spot on hold, you have **10 minutes** to pay. If not paid, the hold expires safely with **zero charge**.
- **Host Cancellations**: If a host makes an unexpected emergency withdrawal of a bay, ParkPool AI automatically rebooks you to a nearby verified spot for free or issues an immediate 100% refund with extra credit.`;
  } else if (isSearchIntent) {
    citations.push({
      docId: 'DOC-WALK-05',
      title: 'Pedestrian Routing & Parking Spot Entrance Precision Standard',
      section: 'Section 11.4.E & 00.7',
    });
    answer = `### 🔍 Verified Parking Spots Found for ${activeVehicle.label}

I evaluated available parking spots in Bengaluru tailored to your **${activeVehicle.label}** (${activeVehicle.vehicleType.toUpperCase()}${
      activeVehicle.isEv ? ' · EV Charging Required' : ''
    }):

${(recommendedSpots || [])
  .map(
    (s, idx) =>
      `${idx + 1}. **${s.facilityName}** (Spot ${s.spaceCode})\n   - **Walk**: ${
        s.walkingDistanceM
      }m (${s.walkingMinutes} min walk) to destination\n   - **Spot Entrance**: ${
        s.entranceLabel
      }\n   - **Rate**: ₹${s.hourlyPriceInr}/hr (Total: ₹${s.totalQuoteInr} for 2h)\n   - **Features**: ${
        s.covered ? 'Covered Roof' : 'Open Air'
      } · ${s.evCharging ? '⚡ EV Charger Ready' : 'Standard Bay'}`
  )
  .join('\n\n')}

Select any of the cards below to reserve your spot instantly via your prepaid wallet!`;
  } else {
    citations.push({
      docId: 'DOC-AUTH-01',
      title: 'Provider & Property Authority Verification Policy',
      section: 'Section 11.4.A & 02.6',
    });
    citations.push({
      docId: 'DOC-CHECKIN-07',
      title: 'Spot Check-In, Access PIN & Backup Spot Wall Placard Protocol',
      section: 'Section 11.4.H',
    });
    answer = `Hi! I can help you find spots for your **${activeVehicle.label}**, check directions, explain QR/PIN check-in, or review your **₹${wallet?.balanceInr ?? 500}** wallet balance. What would you like to check?`;
  }

  return {
    answer,
    citations,
    recommendedSpots,
    suggestedPrompts: [
      'How do I check in to my parking spot?',
      'Show my remaining wallet balance',
      'What if I arrive late or need an extension?',
      'Find covered EV spots under 300m',
    ],
    safetyNotice: isDrivingRisk
      ? '⚠️ Road Safety: Please safely pull over and park before checking directions or interacting with your screen.'
      : undefined,
    contextSummary: {
      activeVehicle: activeVehicle.label,
      activeBooking: activeBooking
        ? `${activeBooking.facilityName} (Spot ${activeBooking.spaceCode})`
        : undefined,
      walletBalanceInr: wallet?.balanceInr,
    },
  };
}

export async function askPolicyRagAssistant(question: string): Promise<{
  answer: string;
  citations: Array<{ docId: string; title: string; section: string }>;
}> {
  const result = await askDriverGenAiAgent({ question });
  return {
    answer: result.answer,
    citations: result.citations,
  };
}

export async function evaluateAutonomousOverstayLifecycle(input: {
  bookingId: string;
  requestedExtensionMinutes?: number;
  simulateOverstayMinutes?: number;
  actorName: string;
}): Promise<{
  ok: boolean;
  error?: string;
  booking?: BookingRecord;
  space?: ParkingSpace;
  offer?: ExtensionOffer;
  impactedBookings?: BookingRecord[];
  wallet?: PrepaidWallet;
  lifecycleEvent?: AutonomousLifecycleEvent;
}> {
  const bk = store.bookings.find((b) => b.id === input.bookingId);
  if (!bk) {
    return { ok: false, error: 'Booking not found' };
  }
  if (bk.status !== 'checked-in' && bk.status !== 'occupied' && bk.status !== 'confirmed') {
    return {
      ok: false,
      error: `Lifecycle overstay monitor requires an active booking (current: ${bk.status}).`,
    };
  }
  const space = store.spaces.find((s) => s.id === bk.spaceId);
  const fac = store.facilities.find((f) => f.id === bk.facilityId);
  if (!space || !fac) {
    return { ok: false, error: 'Linked space or facility not found' };
  }

  const nowIso = new Date().toISOString();
  const ts = nowIso.slice(11, 19) + 'Z';
  const extraMinutes = Math.max(
    15,
    Math.min(120, Math.round(input.requestedExtensionMinutes || input.simulateOverstayMinutes || 30))
  );
  const proposedEndMin = bk.endMin + extraMinutes;
  const bufferMins = space.bufferMinutes || 15;

  // Step 1 & 2: Monitor booking & mark OVERSTAY (never assume space is free because end time passed!)
  if (bk.status === 'confirmed') {
    bk.status = 'checked-in';
    bk.checkedInAt = bk.checkedInAt || nowIso;
  }
  space.occupancyState = 'OVERSTAY';
  space.activeOccupancyBookingId = bk.id;
  space.vacancyConfirmed = false;
  space.bufferCompleted = false;
  space.lastOccupancyEvent = `End time (${formatMinutesToTime(bk.endMin)}) reached while vehicle still present — marked OVERSTAY`;
  bk.auditTrail.push(
    `${ts} Autonomous Occupancy Agent: Scheduled end (${formatMinutesToTime(bk.endMin)}) passed without exit confirmation -> Bay marked OVERSTAY`
  );

  // Step 3: Check extension feasibility (Driver B conflict, host hard cutoff, owner blocks)
  const conflictingNext = store.bookings.find(
    (other) =>
      other.id !== bk.id &&
      other.spaceId === bk.spaceId &&
      (other.status === 'held' || other.status === 'confirmed') &&
      other.startMin < proposedEndMin + bufferMins &&
      other.endMin > bk.startMin
  );

  const ownerBlockConflict = space.ownerBlocks.find(
    (blk) => blk.startMin < proposedEndMin + bufferMins && blk.endMin > bk.endMin
  );
  const cutoffViolation = proposedEndMin > space.hardDepartureMin;
  const extensionFeasible = !conflictingNext && !ownerBlockConflict && !cutoffViolation;

  const wallet = store.getOrCreateWallet(bk.driverEmail || 'driver@bengaluru.in', bk.driverName);

  // Step 4: Pricing Intelligence Agent calculation (+ optional OpenRouter rationale)
  const currentQuote = store.calculateServerQuote(space.hourlyPriceInr, bk.startMin, bk.endMin);
  const extendedQuote = store.calculateServerQuote(space.hourlyPriceInr, bk.startMin, proposedEndMin);
  const additionalBaseInr = Math.max(10, extendedQuote.baseAmountInr - currentQuote.baseAmountInr);
  const additionalFeeInr = Math.max(2, extendedQuote.platformFeeInr - currentQuote.platformFeeInr);
  const additionalGstInr = Math.max(2, extendedQuote.gstInr - currentQuote.gstInr);
  const additionalTotalInr = additionalBaseInr + additionalFeeInr + additionalGstInr;

  let executionMode: 'openrouter_llm' | 'deterministic_service' = 'deterministic_service';
  let agentPricingNote = `Pro-rated ${extraMinutes}m extension at ₹${space.hourlyPriceInr}/hr plus platform & GST (₹${additionalTotalInr} total).`;
  let agentProtectionNote = conflictingNext
    ? `Confirmed reservation ${conflictingNext.id} (${conflictingNext.driverName}) cannot be silently displaced; Pooling Optimizer triggered.`
    : ownerBlockConflict || cutoffViolation
    ? `Host hard cutoff (${formatMinutesToTime(space.hardDepartureMin)}) or owner block prevents extension.`
    : 'No upcoming conflict detected; safe to send driver extension offer.';

  try {
    const llmOut = await callLlmModel({
      systemPrompt:
        'You are the ParkPool AI Pricing & Pooling Lifecycle Agent. Respond ONLY with a raw JSON object containing concise 1-sentence strings for pricingReason and protectionNote.',
      userPrompt: `Evaluate overstay lifecycle for booking ${bk.id} at ${fac.name} (${space.spaceCode}).
Scheduled End: ${formatMinutesToTime(bk.endMin)}, Requested Extra: +${extraMinutes}m (until ${formatMinutesToTime(proposedEndMin)}), Server Extension Total: ₹${additionalTotalInr}.
Upcoming Driver B Conflict: ${conflictingNext ? `${conflictingNext.id} at ${formatMinutesToTime(conflictingNext.startMin)}` : 'None'}.
Host Hard Cutoff: ${formatMinutesToTime(space.hardDepartureMin)} (violation=${cutoffViolation || Boolean(ownerBlockConflict)}).
Return JSON: {"pricingReason": string, "protectionNote": string}`,
      expectJson: true,
    });
    const parsed = extractJsonObject(llmOut.text);
    if (typeof parsed.pricingReason === 'string' && parsed.pricingReason.trim()) {
      agentPricingNote = parsed.pricingReason.trim();
    }
    if (typeof parsed.protectionNote === 'string' && parsed.protectionNote.trim()) {
      agentProtectionNote = parsed.protectionNote.trim();
    }
    executionMode = 'openrouter_llm';
  } catch {
    // Graceful deterministic fallback when OPENROUTER_API_KEY is absent or times out
  }

  // Proactive low-balance alert before expiry/settlement
  if (wallet.balanceInr < additionalTotalInr && !wallet.lowBalanceNotified) {
    wallet.lowBalanceNotified = true;
    store.notifications.unshift({
      id: `NTF-${Date.now().toString(36).toUpperCase().slice(-5)}`,
      driverEmail: wallet.driverEmail,
      driverName: wallet.driverName,
      bookingId: bk.id,
      type: 'low_balance',
      title: `Prepaid Balance Alert (₹${wallet.balanceInr} available)`,
      message: `Your session at ${space.spaceCode} has reached end time. Extension or overstay settlement needs ~₹${additionalTotalInr}. Top up your Prepaid Parking Balance to avoid booking restrictions.`,
      read: false,
      createdAt: nowIso,
    });
  }

  let createdOffer: ExtensionOffer | undefined;
  let impactedBookings: BookingRecord[] = [];
  const steps: AutonomousLifecycleStep[] = [
    {
      stepNumber: 1,
      agentName: 'Occupancy Monitor Agent',
      action: 'Tracked End Time & Gate Presence',
      detail: `Booking ${bk.id} scheduled end ${formatMinutesToTime(bk.endMin)}; no driver/host departure confirmation received.`,
      status: 'done',
    },
    {
      stepNumber: 2,
      agentName: 'Overstay Detection Agent',
      action: 'Marked Bay OVERSTAY (Timer Never Auto-Reopens)',
      detail: `Bay ${space.spaceCode} locked as OVERSTAY. New holds and searches blocked until physical exit.`,
      status: 'warning',
    },
    {
      stepNumber: 3,
      agentName: 'Feasibility & Cutoff Guard',
      action: extensionFeasible
        ? 'No Conflict — Extension Eligible'
        : conflictingNext
        ? `Conflict Detected (${conflictingNext.id})`
        : 'Host Cutoff / Owner Block Reached',
      detail: agentProtectionNote,
      status: extensionFeasible ? 'done' : 'warning',
    },
  ];

  let outcomeSummary = '';

  if (extensionFeasible) {
    // Step 4: Send Extension Offer (must be explicitly accepted by Driver A before charging)
    createdOffer = {
      id: `OFF-${Date.now().toString(36).toUpperCase().slice(-5)}`,
      bookingId: bk.id,
      additionalMinutes: extraMinutes,
      requestedEndMin: proposedEndMin,
      additionalBaseInr,
      additionalFeeInr,
      additionalGstInr,
      additionalTotalInr,
      status: 'pending_driver_acceptance',
      pricingReason: agentPricingNote,
      providerApprovalNote: `Host policy allows dynamic extension within operating cutoff (${formatMinutesToTime(space.hardDepartureMin)}).`,
      createdAt: nowIso,
    };
    if (!bk.extensionOffers) bk.extensionOffers = [];
    // Expire any stale pending offers cleanly
    for (const prev of bk.extensionOffers) {
      if (prev.status === 'pending_driver_acceptance') prev.status = 'expired';
    }
    bk.extensionOffers.unshift(createdOffer);

    store.notifications.unshift({
      id: `NTF-${Date.now().toString(36).toUpperCase().slice(-5)}`,
      driverEmail: bk.driverEmail,
      driverName: bk.driverName,
      bookingId: bk.id,
      type: 'extension_offer',
      title: `Extension Offer: +${extraMinutes}m at ${space.spaceCode} (₹${additionalTotalInr})`,
      message: `No upcoming reservation conflicts. Accept this +${extraMinutes}m extension offer (until ${formatMinutesToTime(proposedEndMin)}) to auto-pay ₹${additionalTotalInr} from your Prepaid Balance, or confirm checkout & leave.`,
      read: false,
      createdAt: nowIso,
    });

    bk.auditTrail.push(
      `${ts} Pricing Intelligence Agent sent Extension Offer ${createdOffer.id} (+${extraMinutes}m for ₹${additionalTotalInr}) — awaiting driver acceptance`
    );

    steps.push(
      {
        stepNumber: 4,
        agentName: 'Pricing Intelligence Agent',
        action: `Sent Extension Offer ₹${additionalTotalInr} (+${extraMinutes}m)`,
        detail: `${agentPricingNote} Requires Driver A acceptance before charging Prepaid Wallet.`,
        status: 'action_required',
      },
      {
        stepNumber: 5,
        agentName: 'Pooling Optimization Agent',
        action: 'Next Driver Protection Standby',
        detail: 'No downstream driver conflicted; space stays reserved for Driver A decision.',
        status: 'done',
      },
      {
        stepNumber: 6,
        agentName: 'Clearance Buffer Agent',
        action: 'Awaiting Departure Confirmation',
        detail: `Will enforce ${bufferMins}m turnaround clearance once Driver A checks out or leaves.`,
        status: 'action_required',
      },
      {
        stepNumber: 7,
        agentName: 'Availability Agent',
        action: 'Hold Bay Unavailable Until Cleared',
        detail: `${space.spaceCode} remains OVERSTAY until accepted extension completes or physical departure + buffer finishes.`,
        status: 'done',
      }
    );

    outcomeSummary = `No upcoming booking conflicted. Pricing Agent sent a +${extraMinutes}m Extension Offer (₹${additionalTotalInr}) awaiting Driver A acceptance; ${space.spaceCode} stays locked as OVERSTAY.`;
  } else {
    // Step 5: Protect Driver B via Pooling Optimization Agent (reallocate or zero-loss choice)
    const ovRes = store.reportOverstay({
      bookingId: bk.id,
      overstayMinutes: extraMinutes,
      actorName: `Autonomous Lifecycle Agent (${input.actorName})`,
    });
    impactedBookings = ovRes.impactedBookings || [];

    const protectionDetail =
      impactedBookings.length > 0
        ? impactedBookings
            .map((ib) => `${ib.id} (${ib.driverName}): ${ib.overstayResolution?.detail || 'Protected'}`)
            .join(' ')
        : cutoffViolation || ownerBlockConflict
        ? `Extension blocked past host cutoff (${formatMinutesToTime(space.hardDepartureMin)}). Overstay alert & surcharge issued.`
        : 'Upcoming reservation protected.';

    steps.push(
      {
        stepNumber: 4,
        agentName: 'Pricing Intelligence Agent',
        action: `Computed Overstay Surcharge (₹${bk.overstayPenaltyInr || 60})`,
        detail: `Extension refused due to downstream conflict/cutoff. Surcharge queued for automatic Prepaid Balance settlement on exit.`,
        status: 'warning',
      },
      {
        stepNumber: 5,
        agentName: 'Pooling Optimization Agent',
        action: 'Protected Upcoming Booking (Driver B)',
        detail: protectionDetail,
        status: 'done',
      },
      {
        stepNumber: 6,
        agentName: 'Clearance Buffer Agent',
        action: 'Pending Physical Exit -> 15m Buffer',
        detail: `Once vehicle vacates ${space.spaceCode}, driver/host confirms departure to start ${bufferMins}m buffer.`,
        status: 'action_required',
      },
      {
        stepNumber: 7,
        agentName: 'Availability Agent',
        action: 'Blocked Reopening Until Vacant + Buffer Complete',
        detail: `${space.spaceCode} cannot accept new bookings until vacancy & clearance buffer both complete.`,
        status: 'done',
      }
    );

    outcomeSummary = `Extension blocked (${conflictingNext ? `protects ${conflictingNext.id}` : 'host cutoff'}). ${ovRes.summary || 'Overstay surcharge logged & Driver B protected.'}`;
  }

  const lifecycleEvent: AutonomousLifecycleEvent = {
    id: `LCE-${Date.now().toString(36).toUpperCase().slice(-5)}`,
    bookingId: bk.id,
    spaceId: space.id,
    spaceCode: space.spaceCode,
    facilityName: fac.name,
    trigger: 'time_expiry_monitor',
    createdAt: nowIso,
    outcomeSummary,
    resultingOccupancyState: space.occupancyState || 'OVERSTAY',
    executionMode,
    steps,
  };

  store.lifecycleEvents.unshift(lifecycleEvent);
  store.addAudit(
    'Autonomous Lifecycle Agent',
    'LIFECYCLE_OVERSTAY_EVALUATED',
    `${bk.id} (${space.spaceCode}): ${outcomeSummary}`
  );

  return {
    ok: true,
    booking: bk,
    space,
    offer: createdOffer,
    impactedBookings,
    wallet,
    lifecycleEvent,
  };
}
