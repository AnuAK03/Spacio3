import React, { useMemo, useState } from 'react';
import {
  ArrowsClockwise,
  CheckCircle,
  CreditCard,
  Eye,
  LockSimple,
  Pulse,
  Robot,
  SealCheck,
  ShieldCheck,
  ShieldWarning,
  Wallet,
  Warning,
  X,
  XCircle,
} from '@phosphor-icons/react';
import {
  AdminAnalytics,
  AutonomousLifecycleEvent,
  BookingRecord,
  DisputeRecord,
  Facility,
  HostSettlementRecord,
  IncidentRecord,
  OperationalCheckRecord,
  ParkingSpace,
  PaymentOrder,
  PaymentWebhookEvent,
  PrepaidWallet,
  ProviderRecord,
  ProviderVerificationStatus,
  RefundRecord,
  UserReportRecord,
  UserSession,
} from '../types/parkpool';

export type AdminSubTab = 'providers' | 'spaces' | 'payments' | 'ops';

interface AdminPortalViewProps {
  user: UserSession;
  subTab: AdminSubTab;
  onChangeSubTab: (tab: AdminSubTab) => void;
  providers: ProviderRecord[];
  facilities: Facility[];
  spaces: ParkingSpace[];
  bookings: BookingRecord[];
  paymentOrders: PaymentOrder[];
  webhookEvents: PaymentWebhookEvent[];
  refunds: RefundRecord[];
  settlements: HostSettlementRecord[];
  disputes: DisputeRecord[];
  incidents: IncidentRecord[];
  userReports: UserReportRecord[];
  wallets: PrepaidWallet[];
  lifecycleEvents: AutonomousLifecycleEvent[];
  analytics: AdminAnalytics;
  auditLogs: Array<{
    id: string;
    timestamp: string;
    actor: string;
    action: string;
    detail: string;
  }>;
  onAdminVerifyProvider: (
    providerId: string,
    payload: {
      decision: ProviderVerificationStatus;
      evidenceRefs: string[];
      reviewerId: string;
      reason: string;
      expiresAt?: string;
    }
  ) => Promise<void>;
  onAdminIssueDocLink: (
    docId: string
  ) => Promise<{
    docId: string;
    expiresAt: string;
    signedUrl: string;
    content?: {
      fileName: string;
      providerName?: string;
      docType?: string;
      uploadedAt?: string;
      contentText: string;
      accessedBy: string;
    };
  } | null>;
  onAdminOperationalCheck: (
    facilityId: string,
    payload: {
      checks: Partial<OperationalCheckRecord>;
      notes?: string;
      propertyEligibleForUse: boolean;
    }
  ) => Promise<void>;
  onAdminApproveSpace: (spaceId: string) => Promise<{
    ok: boolean;
    error?: string;
    checks?: Array<{ name: string; passed: boolean; detail: string }>;
  }>;
  onAdminPeriodicReview: () => Promise<void>;
  onAdminResolveDispute: (
    disputeId: string,
    decision: 'refunded' | 'dismissed',
    adminNote: string
  ) => Promise<void>;
  onAdminSettlePayout: (settlementId: string) => Promise<void>;
  onAdminUpdateIncident: (
    incidentId: string,
    status: IncidentRecord['status'],
    resolutionNote: string
  ) => Promise<void>;
  onAdminModerateReport: (
    reportId: string,
    status: UserReportRecord['status'],
    moderatorNote: string
  ) => Promise<void>;
}

const VERIFY_DECISIONS: ProviderVerificationStatus[] = [
  'UNDER_REVIEW',
  'NEEDS_MORE_INFORMATION',
  'APPROVED',
  'REJECTED',
  'SUSPENDED',
  'EXPIRED',
];

const STATUS_PRIORITY: Record<ProviderVerificationStatus, number> = {
  SUBMITTED: 0,
  UNDER_REVIEW: 1,
  NEEDS_MORE_INFORMATION: 2,
  EXPIRED: 3,
  NOT_SUBMITTED: 4,
  SUSPENDED: 5,
  REJECTED: 6,
  APPROVED: 7,
};

function statusTone(status: ProviderVerificationStatus): string {
  switch (status) {
    case 'APPROVED':
      return 'text-[#047857]';
    case 'SUBMITTED':
    case 'UNDER_REVIEW':
    case 'NEEDS_MORE_INFORMATION':
      return 'text-[#C83709]';
    case 'REJECTED':
    case 'SUSPENDED':
    case 'EXPIRED':
      return 'text-rose-700';
    default:
      return 'text-[#4B5563]';
  }
}

export const AdminPortalView: React.FC<AdminPortalViewProps> = ({
  user,
  subTab,
  onChangeSubTab,
  providers,
  facilities,
  spaces,
  bookings,
  paymentOrders,
  webhookEvents,
  refunds,
  settlements,
  disputes,
  incidents,
  userReports,
  wallets,
  lifecycleEvents,
  analytics,
  auditLogs,
  onAdminVerifyProvider,
  onAdminIssueDocLink,
  onAdminOperationalCheck,
  onAdminApproveSpace,
  onAdminPeriodicReview,
  onAdminResolveDispute,
  onAdminSettlePayout,
  onAdminUpdateIncident,
  onAdminModerateReport,
}) => {
  const sortedProviders = useMemo(
    () =>
      [...providers].sort(
        (a, b) =>
          (STATUS_PRIORITY[a.verificationStatus] ?? 9) -
          (STATUS_PRIORITY[b.verificationStatus] ?? 9)
      ),
    [providers]
  );

  const [selectedProviderId, setSelectedProviderId] = useState<string>(
    () => sortedProviders[0]?.id || ''
  );
  const activeProvider =
    sortedProviders.find((p) => p.id === selectedProviderId) || sortedProviders[0];

  const [decision, setDecision] = useState<ProviderVerificationStatus>('APPROVED');
  const [reason, setReason] = useState(
    'Identity, property authority, and permitted visitor parking use verified.'
  );
  const [expiresAt, setExpiresAt] = useState('2027-06-30');
  const [verifyBusy, setVerifyBusy] = useState(false);

  const [inspectedDoc, setInspectedDoc] = useState<{
    docId: string;
    expiresAt: string;
    signedUrl: string;
    fileName: string;
    providerName?: string;
    docType?: string;
    uploadedAt?: string;
    contentText: string;
    accessedBy: string;
  } | null>(null);
  const [docBusyId, setDocBusyId] = useState<string | null>(null);

  // Space & Operational checks state
  const [spaceCheckFeedback, setSpaceCheckFeedback] = useState<{
    spaceId: string;
    error?: string;
    checks: Array<{ name: string; passed: boolean; detail: string }>;
  } | null>(null);
  const [facDraftChecks, setFacDraftChecks] = useState<
    Record<string, OperationalCheckRecord & { propertyEligibleForUse: boolean; notes: string }>
  >({});

  // Disputes, Incidents, Reports notes
  const [noteMap, setNoteMap] = useState<Record<string, string>>({});
  const [auditFilter, setAuditFilter] = useState('');

  const getFacCheckState = (fac: Facility) => {
    const existing = facDraftChecks[fac.id];
    if (existing) return existing;
    return {
      ...fac.operationalChecks,
      propertyEligibleForUse: fac.propertyEligibleForUse,
      notes: fac.operationalChecks.notes || '',
    };
  };

  const setFacCheckField = (
    fac: Facility,
    patch: Partial<OperationalCheckRecord & { propertyEligibleForUse: boolean; notes: string }>
  ) => {
    const curr = getFacCheckState(fac);
    setFacDraftChecks((prev) => ({
      ...prev,
      [fac.id]: { ...curr, ...patch },
    }));
  };

  const handleInspectDocument = async (docId: string) => {
    setDocBusyId(docId);
    try {
      const res = await onAdminIssueDocLink(docId);
      if (res?.content) {
        setInspectedDoc({
          docId: res.docId,
          expiresAt: res.expiresAt,
          signedUrl: res.signedUrl,
          ...res.content,
        });
      }
    } finally {
      setDocBusyId(null);
    }
  };

  const filteredAudits = useMemo(() => {
    const q = auditFilter.trim().toLowerCase();
    if (!q) return auditLogs;
    return auditLogs.filter(
      (a) =>
        a.actor.toLowerCase().includes(q) ||
        a.action.toLowerCase().includes(q) ||
        a.detail.toLowerCase().includes(q)
    );
  }, [auditLogs, auditFilter]);

  return (
    <div className="space-y-6">
      {/* Admin Command Header & Sub-Tabs */}
      <section className="rounded-2xl border border-black/[0.08] bg-white p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="heading-5 text-[#111827]">
              Platform Trust, Verification &amp; Operations
            </h1>
            <p className="mt-1 body-6 text-[#4B5563]">
              Human evidence review, 6 check space publication gate, idempotent payment audits, and safety moderation.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => void onAdminPeriodicReview()}
              className="flex items-center gap-2 whitespace-nowrap shrink-0 rounded-xl border border-black/[0.1] bg-[#F8F7F4] px-3 py-2 button-xsm text-[#111827] transition-colors duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-black/[0.05] active:scale-[0.98]"
            >
              <ArrowsClockwise className="h-3.5 w-3.5 text-[#4338CA]" weight="bold" />
              <span>Run Periodic Review Sweep</span>
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 rounded-xl border border-black/[0.06] bg-[#FAF9F6] p-2">
          {(
            [
              {
                id: 'providers',
                label: `Providers & Docs (${analytics.pendingProviders} pending)`,
              },
              {
                id: 'spaces',
                label: `Space Approvals (${analytics.pendingSpaces} pending)`,
              },
              {
                id: 'payments',
                label: `Payments & Refunds (${analytics.openDisputes} disputes)`,
              },
              {
                id: 'ops',
                label: `Ops & Analytics (${analytics.openIncidents} incidents)`,
              },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChangeSubTab(tab.id)}
              className={`whitespace-nowrap shrink-0 rounded-xl px-4 py-2 button-xsm transition-colors duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.98] ${
                subTab === tab.id
                  ? 'bg-[#4338CA] text-white'
                  : 'bg-white text-[#374151] hover:bg-black/[0.04]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      {/* ================================================================= */}
      {/* TAB 1: PROVIDERS, PRIVATE DOCUMENTS & HUMAN VERIFICATION */}
      {/* ================================================================= */}
      {subTab === 'providers' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Provider Queue */}
          <section className="rounded-2xl border border-black/[0.08] bg-white p-6 lg:col-span-5">
            <h2 className="title-3 text-[#111827]">
              Provider Verification Queue ({sortedProviders.length})
            </h2>
            <p className="mt-1 caption-5 text-[#4B5563]">
              Select a provider to inspect private vault documents and issue a human decision.
            </p>
            <div className="mt-4 space-y-2">
              {sortedProviders.map((prov) => {
                const selected = activeProvider?.id === prov.id;
                return (
                  <button
                    key={prov.id}
                    type="button"
                    onClick={() => setSelectedProviderId(prov.id)}
                    className={`w-full rounded-xl border p-3 text-left transition-colors duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                      selected
                        ? 'border-[#4338CA] bg-indigo-50/70'
                        : 'border-black/[0.07] bg-[#F8F7F4] hover:border-black/20'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate title-4 text-[#111827]">
                          {prov.organizationName}
                        </div>
                        <div className="mt-0.5 caption-5 text-[#4B5563]">
                          {prov.name} · {prov.providerType.replace('_', ' ')} ·{' '}
                          {prov.documents.length} doc(s)
                        </div>
                      </div>
                      <span
                        className={`shrink-0 font-mono caption-3 ${statusTone(
                          prov.verificationStatus
                        )}`}
                      >
                        {prov.verificationStatus}
                      </span>
                    </div>
                    {(prov.complaintsCount > 0 ||
                      prov.operatorChangeFlagged ||
                      prov.aiPrecheckWarnings.length > 0) && (
                      <div className="mt-2 flex flex-wrap gap-3 caption-3 text-amber-800">
                        {prov.aiPrecheckWarnings.length > 0 && (
                          <span>{prov.aiPrecheckWarnings.length} AI advisory flag(s)</span>
                        )}
                        {prov.complaintsCount > 0 && (
                          <span>{prov.complaintsCount} complaint(s)</span>
                        )}
                        {prov.operatorChangeFlagged && <span>Operator change flagged</span>}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Selected Provider Inspection & Decision */}
          <section className="space-y-4 lg:col-span-7">
            {activeProvider && (
              <div className="rounded-2xl border border-black/[0.08] bg-white p-6 space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-black/[0.06] bg-[#FAF9F6] p-4">
                  <div>
                    <div className="font-mono caption-3 text-[#4338CA]">
                      {activeProvider.id} · {activeProvider.providerType.replace('_', ' ')}
                    </div>
                    <h2 className="mt-1 heading-6 text-[#111827]">
                      {activeProvider.organizationName}
                    </h2>
                    <div className="mt-1 caption-5 text-[#4B5563]">
                      {activeProvider.contactName} · {activeProvider.contactEmail} ·{' '}
                      {activeProvider.contactPhone}
                      {activeProvider.registrationNumber
                        ? ` · Reg: ${activeProvider.registrationNumber}`
                        : ''}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="caption-5 text-[#4B5563]">Current Status</div>
                    <div
                      className={`font-mono title-4 ${statusTone(
                        activeProvider.verificationStatus
                      )}`}
                    >
                      {activeProvider.verificationStatus}
                    </div>
                    {activeProvider.expiresAt && (
                      <div className="font-mono caption-5 text-[#6B7280]">
                        Exp: {activeProvider.expiresAt}
                      </div>
                    )}
                  </div>
                </div>

                {activeProvider.aiPrecheckWarnings.length > 0 && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 caption-5 text-amber-950">
                    <div className="caption-3">
                      AI Missing field precheck (Advisory only, human admin makes final decision)
                    </div>
                    <ul className="mt-1 list-disc pl-4">
                      {activeProvider.aiPrecheckWarnings.map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Private Evidence Vault */}
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="flex items-center gap-2 caption-3 uppercase tracking-wide text-[#374151]">
                      <LockSimple className="h-3.5 w-3.5 text-[#4338CA]" weight="bold" />
                      <span>Private Object Storage Evidence ({activeProvider.documents.length})</span>
                    </h3>
                    <span className="caption-5 text-[#6B7280]">
                      5 min HMAC signed viewer links only
                    </span>
                  </div>

                  {activeProvider.documents.length === 0 ? (
                    <div className="mt-2 rounded-xl border border-black/[0.06] bg-[#F8F7F4] p-3 caption-5 text-[#4B5563]">
                      No verification documents submitted yet.
                    </div>
                  ) : (
                    <div className="mt-2 space-y-2">
                      {activeProvider.documents.map((doc) => (
                        <div
                          key={doc.id}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-black/[0.06] bg-[#F8F7F4] px-3 py-2 caption-5"
                        >
                          <div className="min-w-0">
                            <div className="caption-3 text-[#111827]">
                              {doc.fileName} ·{' '}
                              <span className="font-mono text-[#4338CA]">{doc.docType}</span>
                            </div>
                            <div className="caption-5 text-[#4B5563]">
                              {doc.id} · Status: {doc.status} · Uploaded{' '}
                              {doc.uploadedAt.slice(0, 10)}
                            </div>
                          </div>
                          <button
                            type="button"
                            disabled={docBusyId === doc.id}
                            onClick={() => void handleInspectDocument(doc.id)}
                            className="flex items-center gap-2 whitespace-nowrap shrink-0 rounded-lg border border-black/[0.1] bg-white px-3 py-2 button-xsm text-[#111827] transition-colors duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:border-[#4338CA] hover:text-[#4338CA] active:scale-[0.98]"
                          >
                            <Eye className="h-3.5 w-3.5" weight="bold" />
                            <span>
                              {docBusyId === doc.id ? 'Signing...' : 'Inspect Private Doc'}
                            </span>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Human Verification Decision Form */}
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setVerifyBusy(true);
                    try {
                      await onAdminVerifyProvider(activeProvider.id, {
                        decision,
                        evidenceRefs: activeProvider.documents.map((d) => d.id),
                        reviewerId: user.id,
                        reason,
                        expiresAt: decision === 'APPROVED' ? expiresAt : undefined,
                      });
                    } finally {
                      setVerifyBusy(false);
                    }
                  }}
                  className="space-y-3 rounded-xl border border-black/[0.06] bg-[#FAF9F6] p-4"
                >
                  <div className="caption-3 uppercase tracking-wide text-[#374151]">
                    Record Human Verification Decision (POST /admin/providers/{activeProvider.id}/verification)
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block caption-4 text-[#4B5563]">
                        Verification Decision
                      </label>
                      <select
                        value={decision}
                        onChange={(e) =>
                          setDecision(e.target.value as ProviderVerificationStatus)
                        }
                        className="w-full rounded-xl border border-black/[0.1] bg-white px-3 py-2 font-mono caption-3 text-[#111827]"
                      >
                        {VERIFY_DECISIONS.map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block caption-4 text-[#4B5563]">
                        Permission Expiry Date
                      </label>
                      <input
                        type="date"
                        value={expiresAt}
                        onChange={(e) => setExpiresAt(e.target.value)}
                        className="w-full rounded-xl border border-black/[0.1] bg-white px-3 py-2 font-mono caption-5 text-[#111827]"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block caption-4 text-[#4B5563]">
                      Review Reason &amp; Evidence Assessment
                    </label>
                    <input
                      type="text"
                      required
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      className="w-full rounded-xl border border-black/[0.1] bg-white px-3 py-2 caption-5 text-[#111827]"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={verifyBusy}
                    className="flex items-center gap-2 rounded-xl bg-[#4338CA] px-4 py-2 button-xsm text-white transition-colors duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-[#3730A3] active:scale-[0.98] disabled:opacity-60"
                  >
                    <ShieldCheck className="h-4 w-4" weight="bold" />
                    <span>
                      {verifyBusy ? 'Saving Decision...' : `Submit ${decision} Decision`}
                    </span>
                  </button>
                </form>
              </div>
            )}

            {/* Signed Private Document Inspection Drawer */}
            {inspectedDoc && (
              <div className="rounded-2xl border border-[#4338CA]/30 bg-indigo-50/60 p-4 caption-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-mono caption-3 text-[#4338CA]">
                      Signed Short lived Document View · {inspectedDoc.fileName}
                    </div>
                    <div className="mt-1 caption-5 text-[#4B5563]">
                      Accessed by {inspectedDoc.accessedBy} · Link expires{' '}
                      {new Date(inspectedDoc.expiresAt).toLocaleTimeString()}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setInspectedDoc(null)}
                    aria-label="Close document preview"
                    className="rounded-lg bg-white p-1 text-[#4B5563] hover:text-[#111827]"
                  >
                    <X className="h-4 w-4" weight="bold" />
                  </button>
                </div>
                <div className="mt-3 rounded-xl border border-black/[0.08] bg-white p-3 font-mono caption-5 text-[#111827]">
                  <div>
                    <strong className="caption-3">Provider:</strong> {inspectedDoc.providerName} ·{' '}
                    <strong className="caption-3">Doc Type:</strong> {inspectedDoc.docType}
                  </div>
                  <div className="mt-2 whitespace-pre-wrap text-[#374151]">
                    {inspectedDoc.contentText}
                  </div>
                </div>
                <div className="mt-2 truncate font-mono caption-5 text-[#4B5563]">
                  Signed URI: {inspectedDoc.signedUrl}
                </div>
              </div>
            )}
          </section>
        </div>
      )}

      {/* ================================================================= */}
      {/* TAB 2: FACILITY OPERATIONAL CHECKS & 6-INVARIANT SPACE PUBLICATION */}
      {/* ================================================================= */}
      {subTab === 'spaces' && (
        <div className="space-y-6">
          {spaceCheckFeedback && (
            <section className="rounded-2xl border border-black/[0.1] bg-white p-6">
              <div className="flex items-center justify-between gap-2">
                <div className="title-4 text-[#111827]">
                  Space Publication Gate Verification ({spaceCheckFeedback.spaceId})
                </div>
                <button
                  type="button"
                  onClick={() => setSpaceCheckFeedback(null)}
                  className="button-xsm text-[#4B5563] transition-colors duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:text-[#111827]"
                >
                  Dismiss
                </button>
              </div>
              {spaceCheckFeedback.error && (
                <div className="mt-2 caption-3 text-rose-700">
                  {spaceCheckFeedback.error}
                </div>
              )}
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {spaceCheckFeedback.checks.map((c) => (
                  <div
                    key={c.name}
                    className={`rounded-xl border p-3 caption-5 ${
                      c.passed
                        ? 'border-emerald-200 bg-emerald-50/70 text-emerald-950'
                        : 'border-rose-200 bg-rose-50/80 text-rose-950'
                    }`}
                  >
                    <div className="flex items-center gap-2 caption-3">
                      {c.passed ? (
                        <CheckCircle className="h-3.5 w-3.5 text-[#047857]" weight="fill" />
                      ) : (
                        <XCircle className="h-3.5 w-3.5 text-rose-600" weight="fill" />
                      )}
                      <span>{c.name}</span>
                    </div>
                    <div className="mt-1 caption-5">{c.detail}</div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {facilities.map((fac) => {
              const facSpaces = spaces.filter((s) => s.facilityId === fac.id);
              const facProvider = providers.find((p) => p.id === fac.providerId);
              const chk = getFacCheckState(fac);

              return (
                <article
                  key={fac.id}
                  className="rounded-2xl border border-black/[0.08] bg-white p-6 space-y-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-mono caption-5 text-[#4B5563]">
                        {fac.id} · Provider: {facProvider?.organizationName || fac.providerName} (
                        {facProvider?.verificationStatus || 'UNKNOWN'})
                      </div>
                      <h3 className="mt-1 title-3 text-[#111827]">
                        {fac.name}
                      </h3>
                      <div className="caption-5 text-[#4B5563]">
                        {fac.entranceLabel} · {fac.address}
                      </div>
                    </div>
                    <span
                      className={`font-mono caption-3 uppercase ${
                        fac.operationalChecksPassed ? 'text-[#047857]' : 'text-[#C83709]'
                      }`}
                    >
                      {fac.operationalChecksPassed ? 'OPS PASSED' : 'OPS PENDING'}
                    </span>
                  </div>

                  {/* Operational Checklist */}
                  <div className="rounded-xl border border-black/[0.06] bg-[#F8F7F4] p-4 caption-5">
                    <div className="mb-2 caption-3 text-[#111827]">
                      Step 4: Facility Operational Readiness Check
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {(
                        [
                          { key: 'entranceVerified', label: 'Entrance & Gate' },
                          { key: 'locationVerified', label: 'GPS Pin Accurate' },
                          { key: 'dimensionsVerified', label: 'Slot Dimensions' },
                          { key: 'operatingHoursVerified', label: 'Operating Hours' },
                          { key: 'restrictionsVerified', label: 'Restrictions Listed' },
                          { key: 'accessArrangementsVerified', label: 'Access Control' },
                          { key: 'propertyEligibleForUse', label: 'Property Eligible' },
                        ] as const
                      ).map((item) => (
                        <label key={item.key} className="flex items-center gap-2 text-[#374151]">
                          <input
                            type="checkbox"
                            checked={Boolean(chk[item.key])}
                            onChange={(e) =>
                              setFacCheckField(fac, { [item.key]: e.target.checked })
                            }
                            className="accent-[#4338CA]"
                          />
                          <span>{item.label}</span>
                        </label>
                      ))}
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <input
                        type="text"
                        value={chk.notes}
                        onChange={(e) => setFacCheckField(fac, { notes: e.target.value })}
                        placeholder="Field inspector verification note"
                        className="min-w-0 flex-1 rounded-lg border border-black/[0.1] bg-white px-3 py-2 caption-5"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          void onAdminOperationalCheck(fac.id, {
                            checks: {
                              entranceVerified: chk.entranceVerified,
                              locationVerified: chk.locationVerified,
                              dimensionsVerified: chk.dimensionsVerified,
                              operatingHoursVerified: chk.operatingHoursVerified,
                              restrictionsVerified: chk.restrictionsVerified,
                              accessArrangementsVerified: chk.accessArrangementsVerified,
                            },
                            notes: chk.notes,
                            propertyEligibleForUse: chk.propertyEligibleForUse,
                          })
                        }
                        className="whitespace-nowrap shrink-0 rounded-lg bg-[#111827] px-3 py-2 button-xsm text-white transition-colors duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-black active:scale-[0.98]"
                      >
                        Save Ops Check
                      </button>
                    </div>
                  </div>

                  {/* Step 5: Space Publication Approval Gate */}
                  <div className="space-y-2">
                    {facSpaces.map((sp) => (
                      <div
                        key={sp.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-black/[0.06] bg-[#FAF9F6] px-3 py-2 caption-5"
                      >
                        <div>
                          <span className="font-mono caption-3 text-[#111827]">{sp.spaceCode}</span>
                          <span className="mx-2 text-[#D1D5DB]">·</span>
                          <span className="font-mono tabular-nums text-[#374151]">
                            ₹{sp.hourlyPriceInr}/hr
                          </span>
                          <span className="mx-2 text-[#D1D5DB]">·</span>
                          <span
                            className={`font-mono caption-3 uppercase ${
                              sp.publicationStatus === 'approved'
                                ? 'text-[#047857]'
                                : 'text-[#C83709]'
                            }`}
                          >
                            {sp.publicationStatus}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={async () => {
                            const res = await onAdminApproveSpace(sp.id);
                            setSpaceCheckFeedback({
                              spaceId: sp.spaceCode,
                              error: res.error,
                              checks: res.checks || [],
                            });
                          }}
                          className="flex items-center gap-2 whitespace-nowrap shrink-0 rounded-lg bg-[#047857] px-3 py-2 button-xsm text-white transition-colors duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-[#065F46] active:scale-[0.98]"
                        >
                          <SealCheck className="h-3.5 w-3.5" weight="bold" />
                          <span>
                            {sp.publicationStatus === 'approved'
                              ? 'Verify 6 checks again'
                              : 'Approve Space Publication'}
                          </span>
                        </button>
                      </div>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* TAB 3: PAYMENTS, WEBHOOKS, DISPUTES & HOST SETTLEMENTS */}
      {/* ================================================================= */}
      {subTab === 'payments' && (
        <div className="space-y-6">
          {/* Disputes & Refund Management */}
          <section className="rounded-2xl border border-black/[0.08] bg-white p-6">
            <h2 className="title-2 text-[#111827]">
              Refund &amp; Dispute Resolution ({disputes.length})
            </h2>
            <div className="mt-3 space-y-2">
              {disputes.map((dsp) => (
                <div
                  key={dsp.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-black/[0.07] bg-[#F8F7F4] p-3 caption-5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-mono caption-3 text-[#111827]">
                      {dsp.id} · Booking {dsp.bookingId} · ₹{dsp.requestedRefundInr} ·{' '}
                      <span className="uppercase text-[#4338CA]">{dsp.status}</span>
                    </div>
                    <div className="mt-1 text-[#374151]">
                      Raised by {dsp.raisedBy}: {dsp.reason}
                    </div>
                    {dsp.adminNote && (
                      <div className="mt-1 caption-5 text-[#047857]">Note: {dsp.adminNote}</div>
                    )}
                  </div>
                  {(dsp.status === 'open' || dsp.status === 'under_review') && (
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="text"
                        value={noteMap[dsp.id] || ''}
                        onChange={(e) =>
                          setNoteMap((prev) => ({ ...prev, [dsp.id]: e.target.value }))
                        }
                        placeholder="Resolution note..."
                        className="rounded-lg border border-black/[0.1] bg-white px-3 py-2 caption-5"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          void onAdminResolveDispute(
                            dsp.id,
                            'refunded',
                            noteMap[dsp.id] || 'Refund approved by admin review'
                          )
                        }
                        className="whitespace-nowrap shrink-0 rounded-lg bg-[#047857] px-3 py-2 button-xsm text-white transition-colors duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-[#065F46] active:scale-[0.98]"
                      >
                        Issue Refund
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          void onAdminResolveDispute(
                            dsp.id,
                            'dismissed',
                            noteMap[dsp.id] || 'Dispute dismissed after verification'
                          )
                        }
                        className="whitespace-nowrap shrink-0 rounded-lg border border-black/[0.1] bg-white px-3 py-2 button-xsm text-[#374151]"
                      >
                        Dismiss
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Host Settlements */}
            <section className="rounded-2xl border border-black/[0.08] bg-white p-6">
              <h2 className="title-3 text-[#111827]">
                Host Settlement Records ({settlements.length})
              </h2>
              <div className="mt-3 space-y-2">
                {settlements.map((stl) => (
                  <div
                    key={stl.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-black/[0.06] bg-[#F8F7F4] p-3 caption-5"
                  >
                    <div>
                      <div className="caption-3 text-[#111827]">
                        {stl.providerName} · {stl.facilityName}
                      </div>
                      <div className="font-mono caption-5 text-[#4B5563]">
                        {stl.bookingId} · Net ₹{stl.netPayoutInr} (Gross ₹{stl.grossInr}) ·{' '}
                        {stl.status}
                      </div>
                    </div>
                    {stl.status === 'scheduled' || stl.status === 'pending_checkout' ? (
                      <button
                        type="button"
                        onClick={() => void onAdminSettlePayout(stl.id)}
                        className="whitespace-nowrap shrink-0 rounded-lg bg-[#4338CA] px-3 py-2 button-xsm text-white transition-colors duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-[#3730A3] active:scale-[0.98]"
                      >
                        Settle Payout
                      </button>
                    ) : (
                      <span className="font-mono caption-3 text-[#047857]">
                        {stl.utrRef || stl.status}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* Idempotent Webhook Events & Payment Orders */}
            <section className="rounded-2xl border border-black/[0.08] bg-white p-6 space-y-3">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-[#4338CA]" weight="bold" />
                <h2 className="title-3 text-[#111827]">
                  Payment Orders &amp; Webhook Idempotency Log
                </h2>
              </div>
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {webhookEvents.map((ev) => (
                  <div
                    key={ev.eventId}
                    className="flex items-center justify-between gap-2 rounded-xl border border-black/[0.06] bg-[#F8F7F4] px-3 py-2 caption-5"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-mono caption-3 text-[#111827]">
                        {ev.eventId} · {ev.eventType}
                      </div>
                      <div className="caption-5 text-[#4B5563]">
                        Order {ev.orderId} · Booking {ev.bookingId} · HMAC{' '}
                        {ev.signatureVerified ? 'Verified' : 'Rejected'}
                      </div>
                    </div>
                    <div className="shrink-0 text-right font-mono caption-5 tabular-nums">
                      <div className="caption-3 text-[#047857]">₹{ev.amountInr}</div>
                      <div className="text-[#4B5563]">
                        {ev.duplicateIgnoredCount > 0
                          ? `${ev.duplicateIgnoredCount} dup ignored`
                          : '1x processed'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="rounded-xl border border-black/[0.06] bg-[#FAF9F6] p-3 caption-5 text-[#4B5563]">
                Server Orders: {paymentOrders.length} · Refunds Processed: {refunds.length} · Total Bookings Tracked: {bookings.length}
              </div>
            </section>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* TAB 4: PLATFORM ANALYTICS, INCIDENTS, REPORTS & AUDIT LOGS */}
      {/* ================================================================= */}
      {subTab === 'ops' && (
        <div className="space-y-6">
          {/* Platform Analytics */}
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border border-black/[0.08] bg-white p-4">
              <div className="caption-4 text-[#4B5563]">Platform GMV</div>
              <div className="mt-1 font-mono heading-5 tabular-nums text-[#111827]">
                ₹{analytics.totalGmvInr}
              </div>
              <div className="mt-1 caption-5 text-[#047857]">
                Fee Revenue ₹{analytics.platformRevenueInr}
              </div>
            </div>
            <div className="rounded-2xl border border-black/[0.08] bg-white p-4">
              <div className="caption-4 text-[#4B5563]">Verified Supply</div>
              <div className="mt-1 font-mono heading-5 tabular-nums text-[#047857]">
                {analytics.approvedSpaces} bays
              </div>
              <div className="mt-1 caption-5 text-[#4B5563]">
                {analytics.approvedProviders} approved · {analytics.pendingProviders} pending providers
              </div>
            </div>
            <div className="rounded-2xl border border-black/[0.08] bg-white p-4">
              <div className="caption-4 text-[#4B5563]">Webhook Replay Guard</div>
              <div className="mt-1 font-mono heading-5 tabular-nums text-[#4338CA]">
                {analytics.duplicateWebhooksBlocked}
              </div>
              <div className="mt-1 caption-5 text-[#4B5563]">
                Duplicate events blocked safely
              </div>
            </div>
            <div className="rounded-2xl border border-black/[0.08] bg-white p-4">
              <div className="caption-4 text-[#4B5563]">Trust &amp; Safety Queue</div>
              <div className="mt-1 font-mono heading-5 tabular-nums text-[#C83709]">
                {analytics.openIncidents + analytics.openDisputes}
              </div>
              <div className="mt-1 caption-5 text-[#4B5563]">
                {analytics.expiringProviders} expiring provider(s)
              </div>
            </div>
          </section>

          {/* Autonomous Occupancy, Driver Protection & Wallet Restrictions */}
          <section className="rounded-2xl border border-black/[0.08] bg-white p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Robot className="h-4 w-4 text-[#4338CA]" weight="bold" />
                <h2 className="title-3 text-[#111827]">
                  Autonomous Occupancy, Driver Protection &amp; Wallet Restrictions
                </h2>
              </div>
              <span className="font-mono caption-5 text-[#4B5563] tabular-nums">
                {spaces.filter((s) => s.occupancyState && s.occupancyState !== 'AVAILABLE').length}{' '}
                unavailable bay(s) · {wallets.filter((w) => w.bookingRestricted).length}{' '}
                restricted wallet(s)
              </span>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
              {/* Live Bay Occupancy States */}
              <div className="rounded-xl border border-black/[0.07] bg-[#F8F7F4] p-4">
                <div className="caption-3 uppercase tracking-wide text-[#374151]">
                  Live Bay Occupancy States
                </div>
                <div className="mt-3 max-h-56 space-y-2 overflow-y-auto pr-1 caption-5">
                  {spaces.filter((s) => s.occupancyState && s.occupancyState !== 'AVAILABLE')
                    .length === 0 ? (
                    <div className="rounded-lg border border-black/[0.05] bg-white p-3 text-[#4B5563]">
                      All approved bays are currently AVAILABLE with confirmed vacancy.
                    </div>
                  ) : (
                    spaces
                      .filter((s) => s.occupancyState && s.occupancyState !== 'AVAILABLE')
                      .map((space) => {
                        const facName =
                          facilities.find((f) => f.id === space.facilityId)?.name ||
                          space.facilityId;
                        return (
                          <div
                            key={space.id}
                            className="rounded-lg border border-black/[0.06] bg-white p-3"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-mono caption-3 text-[#111827]">
                                {space.spaceCode}
                              </span>
                              <span className="font-mono caption-3 uppercase text-[#C83709]">
                                {space.occupancyState}
                              </span>
                            </div>
                            <div className="mt-1 caption-5 text-[#4B5563]">
                              {facName}
                              {space.lastOccupancyEvent ? ` · ${space.lastOccupancyEvent}` : ''}
                            </div>
                          </div>
                        );
                      })
                  )}
                </div>
              </div>

              {/* Driver Prepaid Wallets & Restrictions */}
              <div className="rounded-xl border border-black/[0.07] bg-[#F8F7F4] p-4">
                <div className="flex items-center gap-2 caption-3 uppercase tracking-wide text-[#374151]">
                  <Wallet className="h-4 w-4 text-[#047857]" weight="bold" />
                  <span>Prepaid Wallets &amp; Booking Holds</span>
                </div>
                <div className="mt-3 max-h-56 space-y-2 overflow-y-auto pr-1 caption-5">
                  {wallets.length === 0 ? (
                    <div className="rounded-lg border border-black/[0.05] bg-white p-3 text-[#4B5563]">
                      No driver wallets provisioned yet.
                    </div>
                  ) : (
                    wallets.map((w) => (
                      <div
                        key={w.driverEmail}
                        className={`rounded-lg border p-3 ${
                          w.bookingRestricted
                            ? 'border-rose-300 bg-rose-50'
                            : 'border-black/[0.06] bg-white'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="caption-3 text-[#111827]">{w.driverName}</span>
                          <span
                            className={`font-mono caption-3 tabular-nums ${
                              w.bookingRestricted ? 'text-rose-700' : 'text-[#047857]'
                            }`}
                          >
                            Bal ₹{w.balanceInr}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center justify-between gap-2 caption-5 text-[#4B5563] tabular-nums">
                          <span>Unpaid due: ₹{w.unpaidDueInr}</span>
                          {w.bookingRestricted ? (
                            <span className="font-mono caption-3 uppercase text-rose-700">
                              BOOKING RESTRICTED
                            </span>
                          ) : (
                            <span className="font-mono text-[#047857]">Active</span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Recent Autonomous Lifecycle Agent Decisions */}
              <div className="rounded-xl border border-black/[0.07] bg-[#F8F7F4] p-4">
                <div className="caption-3 uppercase tracking-wide text-[#374151]">
                  Autonomous Agent Lifecycle Log ({lifecycleEvents.length})
                </div>
                <div className="mt-3 max-h-56 space-y-2 overflow-y-auto pr-1 caption-5">
                  {lifecycleEvents.length === 0 ? (
                    <div className="rounded-lg border border-black/[0.05] bg-white p-3 text-[#4B5563]">
                      No autonomous overstay or clearance cycles triggered yet.
                    </div>
                  ) : (
                    lifecycleEvents.slice(0, 8).map((ev) => (
                      <div
                        key={ev.id}
                        className="rounded-lg border border-black/[0.06] bg-white p-3"
                      >
                        <div className="flex items-center justify-between gap-2 font-mono caption-5">
                          <span className="caption-3 text-[#4338CA]">
                            {ev.spaceCode} · {ev.resultingOccupancyState}
                          </span>
                          <span className="text-[#6B7280]">{ev.trigger}</span>
                        </div>
                        <div className="mt-1 caption-5 text-[#374151]">
                          {ev.outcomeSummary}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </section>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Incidents */}
            <section className="rounded-2xl border border-black/[0.08] bg-white p-6">
              <div className="flex items-center gap-2">
                <Warning className="h-4 w-4 text-[#C83709]" weight="bold" />
                <h2 className="title-3 text-[#111827]">
                  Incident Management ({incidents.length})
                </h2>
              </div>
              <div className="mt-3 space-y-2">
                {incidents.map((inc) => (
                  <div
                    key={inc.id}
                    className="rounded-xl border border-black/[0.06] bg-[#F8F7F4] p-3 caption-5"
                  >
                    <div className="flex items-center justify-between font-mono caption-3">
                      <span>
                        {inc.id} · {inc.category} ({inc.severity})
                      </span>
                      <span className="uppercase text-[#4338CA]">{inc.status}</span>
                    </div>
                    <div className="mt-1 text-[#374151]">
                      {inc.reporterName} ({inc.reporterRole}): {inc.description}
                    </div>
                    {inc.status !== 'resolved' && (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <input
                          type="text"
                          value={noteMap[inc.id] || ''}
                          onChange={(e) =>
                            setNoteMap((prev) => ({ ...prev, [inc.id]: e.target.value }))
                          }
                          placeholder="Ops resolution note..."
                          className="min-w-0 flex-1 rounded-lg border border-black/[0.1] bg-white px-3 py-2 caption-5"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            void onAdminUpdateIncident(
                              inc.id,
                              'investigating',
                              noteMap[inc.id] || 'Assigned to field ops'
                            )
                          }
                          className="rounded-lg border border-black/[0.1] bg-white px-3 py-2 button-xsm transition-colors duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.98]"
                        >
                          Investigate
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void onAdminUpdateIncident(
                              inc.id,
                              'resolved',
                              noteMap[inc.id] || 'Resolved by ops'
                            )
                          }
                          className="rounded-lg bg-[#047857] px-3 py-2 button-xsm text-white transition-colors duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.98]"
                        >
                          Resolve
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* User Reports & Moderation */}
            <section className="rounded-2xl border border-black/[0.08] bg-white p-6">
              <div className="flex items-center gap-2">
                <ShieldWarning className="h-4 w-4 text-rose-700" weight="bold" />
                <h2 className="title-3 text-[#111827]">
                  User Reports &amp; Moderation ({userReports.length})
                </h2>
              </div>
              <div className="mt-3 space-y-2">
                {userReports.map((rep) => (
                  <div
                    key={rep.id}
                    className="rounded-xl border border-black/[0.06] bg-[#F8F7F4] p-3 caption-5"
                  >
                    <div className="flex items-center justify-between font-mono caption-3">
                      <span>
                        {rep.id} · Target: {rep.reportedEntity}
                      </span>
                      <span className="uppercase text-[#C83709]">{rep.status}</span>
                    </div>
                    <div className="mt-1 text-[#374151]">
                      Reporter {rep.reporterName}: {rep.reason}
                    </div>
                    {rep.status === 'open' && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            void onAdminModerateReport(
                              rep.id,
                              'warned',
                              'Formal warning issued'
                            )
                          }
                          className="rounded-lg border border-black/[0.1] bg-white px-3 py-2 button-xsm transition-colors duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.98]"
                        >
                          Warn
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void onAdminModerateReport(
                              rep.id,
                              'suspended',
                              'Account suspended pending compliance review'
                            )
                          }
                          className="rounded-lg bg-rose-700 px-3 py-2 button-xsm text-white transition-colors duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.98]"
                        >
                          Suspend
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void onAdminModerateReport(rep.id, 'dismissed', 'No policy breach')
                          }
                          className="rounded-lg bg-[#111827] px-3 py-2 button-xsm text-white transition-colors duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.98]"
                        >
                          Dismiss
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Audit Log Review */}
          <section className="rounded-2xl border border-black/[0.08] bg-white p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Pulse className="h-4 w-4 text-[#4338CA]" weight="bold" />
                <h2 className="title-3 text-[#111827]">
                  Immutable Audit Log ({filteredAudits.length})
                </h2>
              </div>
              <input
                type="text"
                value={auditFilter}
                onChange={(e) => setAuditFilter(e.target.value)}
                placeholder="Filter by actor, action, or detail..."
                className="w-64 rounded-xl border border-black/[0.1] bg-[#F8F7F4] px-3 py-2 caption-5"
              />
            </div>
            <div className="mt-3 max-h-72 space-y-2 overflow-y-auto font-mono caption-5">
              {filteredAudits.map((log) => (
                <div
                  key={log.id}
                  className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg bg-[#F8F7F4] px-3 py-2 text-[#111827]"
                >
                  <div>
                    <span className="caption-3 text-[#4338CA]">{log.action}</span>
                    <span className="mx-2 text-[#9CA3AF]">·</span>
                    <span className="font-semibold">{log.actor}</span>
                    <span className="mx-2 text-[#9CA3AF]">·</span>
                    <span className="text-[#374151]">{log.detail}</span>
                  </div>
                  <span className="caption-5 text-[#6B7280]">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
};
