import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  ArrowsClockwise,
  Buildings,
  CalendarCheck,
  Car,
  ChartBar,
  CheckCircle,
  ClockCounterClockwise,
  CreditCard,
  CurrencyInr,
  Eye,
  FileText,
  LockSimple,
  MapPin,
  Pulse,
  SealCheck,
  ShieldCheck,
  ShieldWarning,
  Users,
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

export type AdminSubTab = 'overview' | 'providers' | 'spaces' | 'payments' | 'ops';

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

const VERIFY_DECISIONS: Array<{ id: ProviderVerificationStatus; label: string }> = [
  { id: 'UNDER_REVIEW', label: 'Under review' },
  { id: 'NEEDS_MORE_INFORMATION', label: 'Needs more info' },
  { id: 'APPROVED', label: 'Approved' },
  { id: 'REJECTED', label: 'Rejected' },
  { id: 'SUSPENDED', label: 'Suspended' },
  { id: 'EXPIRED', label: 'Expired' },
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

function statusLabel(status: ProviderVerificationStatus): string {
  switch (status) {
    case 'APPROVED':
      return 'Verified';
    case 'SUBMITTED':
      return 'Submitted';
    case 'UNDER_REVIEW':
      return 'Under review';
    case 'NEEDS_MORE_INFORMATION':
      return 'Needs info';
    case 'NOT_SUBMITTED':
      return 'Not submitted';
    case 'EXPIRED':
      return 'Expired';
    case 'REJECTED':
      return 'Rejected';
    case 'SUSPENDED':
      return 'Suspended';
    default:
      return status;
  }
}

function statusTone(status: ProviderVerificationStatus): string {
  switch (status) {
    case 'APPROVED':
      return 'border-emerald-200 bg-emerald-50 text-[#047857]';
    case 'SUBMITTED':
    case 'UNDER_REVIEW':
    case 'NEEDS_MORE_INFORMATION':
      return 'border-amber-200 bg-amber-50 text-[#C83709]';
    case 'REJECTED':
    case 'SUSPENDED':
    case 'EXPIRED':
      return 'border-rose-200 bg-rose-50 text-rose-700';
    default:
      return 'border-black/[0.08] bg-[#F8F7F4] text-[#4B5563]';
  }
}

function formatInr(amount: number): string {
  return `₹${Math.round(amount).toLocaleString('en-IN')}`;
}

function formatShortTime(iso: string): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return iso;
  return new Date(ms).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
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
    'Identity, property authority, and parking permissions verified.'
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

  // Overview trend toggle
  const [trendMode, setTrendMode] = useState<'daily' | 'monthly'>('daily');

  // Space & Operational checks state
  const [spaceFilter, setSpaceFilter] = useState<'all' | 'pending' | 'approved'>('all');
  const [spaceSearch, setSpaceSearch] = useState('');
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

  const filteredFacilities = useMemo(() => {
    const q = spaceSearch.trim().toLowerCase();
    return facilities.filter((fac) => {
      const facSpaces = spaces.filter((s) => s.facilityId === fac.id);
      const hasPending =
        !fac.operationalChecksPassed ||
        facSpaces.some((s) => s.publicationStatus !== 'approved');
      if (spaceFilter === 'pending' && !hasPending) return false;
      if (spaceFilter === 'approved' && hasPending) return false;
      if (!q) return true;
      return (
        fac.name.toLowerCase().includes(q) ||
        fac.address.toLowerCase().includes(q) ||
        fac.zone.toLowerCase().includes(q) ||
        fac.providerName.toLowerCase().includes(q)
      );
    });
  }, [facilities, spaces, spaceFilter, spaceSearch]);

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

  const activeTrends = useMemo(() => {
    if (trendMode === 'monthly') {
      return analytics.monthlyBookingTrends || [];
    }
    return analytics.dailyBookingTrends || [];
  }, [trendMode, analytics.dailyBookingTrends, analytics.monthlyBookingTrends]);

  const maxBookingsInTrend = Math.max(1, ...activeTrends.map((t) => t.bookings));
  const maxRevenueInTrend = Math.max(1, ...activeTrends.map((t) => t.revenueInr));

  const bookingBreakdown = analytics.bookingBreakdown || {
    completed: bookings.filter((b) => b.status === 'completed').length,
    cancelled: bookings.filter((b) => b.status === 'cancelled').length,
    pending: bookings.filter((b) => b.status === 'held').length,
    active: analytics.activeBookings,
    expired: bookings.filter((b) => b.status === 'expired').length,
  };

  const revStats = analytics.revenueStats || {
    grossPaidInr: analytics.totalGmvInr,
    platformFeesInr: analytics.platformRevenueInr,
    taxCollectedInr: 0,
    settledToHostsInr: analytics.totalSettledHostInr,
    pendingHostPayoutInr: settlements
      .filter((s) => s.status === 'scheduled' || s.status === 'pending_checkout')
      .reduce((sum, s) => sum + s.netPayoutInr, 0),
    refundedInr: analytics.totalRefundedInr,
    averageOrderValueInr: analytics.averageBookingValueInr || 0,
  };

  const network = analytics.networkOverview || {
    activeSpaces: analytics.approvedSpaces,
    inactiveSpaces: analytics.pendingSpaces,
    availableSpaces: spaces.filter(
      (s) => s.publicationStatus === 'approved' && (!s.occupancyState || s.occupancyState === 'AVAILABLE')
    ).length,
    occupiedSpaces: spaces.filter((s) =>
      ['BOOKED', 'OCCUPIED', 'OVERSTAY', 'DEPARTURE_PENDING'].includes(s.occupancyState || '')
    ).length,
    clearanceOrBlockedSpaces: spaces.filter((s) => s.occupancyState === 'CLEARANCE').length,
    byZone: [],
  };

  return (
    <div className="space-y-6">
      {/* Admin Header & Navigation */}
      <section className="rounded-2xl border border-black/[0.08] bg-white p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="heading-5 text-[#111827]">
              Platform Operations Center
            </h1>
            <p className="mt-1 body-6 text-[#4B5563]">
              Monitor platform activity, approve providers and spaces, and manage payments and safety issues.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void onAdminPeriodicReview()}
            className="flex items-center gap-2 whitespace-nowrap shrink-0 rounded-xl border border-black/[0.1] bg-[#F8F7F4] px-3 py-2 button-xsm text-[#111827] transition-colors duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-black/[0.05] active:scale-[0.98]"
          >
            <ArrowsClockwise className="h-3.5 w-3.5 text-[#4338CA]" weight="bold" />
            <span>Check expiring licenses</span>
          </button>
        </div>

        <div className="flex flex-wrap gap-2 rounded-xl border border-black/[0.06] bg-[#FAF9F6] p-2">
          {(
            [
              { id: 'overview', label: 'Overview' },
              {
                id: 'providers',
                label: `Providers (${analytics.pendingProviders} pending)`,
              },
              {
                id: 'spaces',
                label: `Spaces (${analytics.pendingSpaces} pending)`,
              },
              {
                id: 'payments',
                label: `Payments (${analytics.openDisputes} disputes)`,
              },
              {
                id: 'ops',
                label: `Operations (${analytics.openIncidents} open)`,
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
      {/* TAB 0: OVERVIEW DASHBOARD (DEFAULT LANDING VIEW) */}
      {/* ================================================================= */}
      {subTab === 'overview' && (
        <div className="space-y-6">
          {/* 1. 8 KPI Cards */}
          <section aria-label="Key platform numbers" className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {(
              [
                {
                  label: 'Registered drivers',
                  value: String(analytics.totalRegisteredDrivers ?? 0),
                  hint: 'View wallets & ops',
                  tab: 'ops' as AdminSubTab,
                  icon: Users,
                  tone: 'text-[#111827]',
                },
                {
                  label: 'Total providers',
                  value: String(analytics.totalProviders ?? providers.length),
                  hint: `${analytics.pendingProviders} awaiting review`,
                  tab: 'providers' as AdminSubTab,
                  icon: Buildings,
                  tone: 'text-[#111827]',
                },
                {
                  label: 'Verified providers',
                  value: String(analytics.approvedProviders),
                  hint: 'Approved partners',
                  tab: 'providers' as AdminSubTab,
                  icon: SealCheck,
                  tone: 'text-[#047857]',
                },
                {
                  label: 'Total parking spaces',
                  value: String(analytics.totalSpaces ?? spaces.length),
                  hint: `${analytics.pendingSpaces} need approval`,
                  tab: 'spaces' as AdminSubTab,
                  icon: Car,
                  tone: 'text-[#111827]',
                },
                {
                  label: 'Active parking spaces',
                  value: String(network.activeSpaces),
                  hint: `${network.availableSpaces} open right now`,
                  tab: 'spaces' as AdminSubTab,
                  icon: CheckCircle,
                  tone: 'text-[#047857]',
                },
                {
                  label: 'Total bookings',
                  value: String(analytics.totalBookings ?? bookings.length),
                  hint: `${analytics.activeBookings} active now`,
                  tab: 'ops' as AdminSubTab,
                  icon: CalendarCheck,
                  tone: 'text-[#4338CA]',
                },
                {
                  label: "Today's bookings",
                  value: String(analytics.todayBookings ?? 0),
                  hint: 'Created today',
                  tab: 'ops' as AdminSubTab,
                  icon: Pulse,
                  tone: 'text-[#C83709]',
                },
                {
                  label: 'Booking revenue',
                  value: formatInr(revStats.grossPaidInr),
                  hint: `Fees ${formatInr(revStats.platformFeesInr)}`,
                  tab: 'payments' as AdminSubTab,
                  icon: CurrencyInr,
                  tone: 'text-[#047857]',
                },
              ] as const
            ).map((card) => {
              const Icon = card.icon;
              return (
                <button
                  key={card.label}
                  type="button"
                  onClick={() => onChangeSubTab(card.tab)}
                  className="group rounded-2xl border border-black/[0.08] bg-white p-4 text-left transition-colors duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:border-[#4338CA]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4338CA]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="caption-4 text-[#4B5563]">{card.label}</span>
                    <Icon className="h-4 w-4 text-[#6B7280] group-hover:text-[#4338CA]" weight="bold" />
                  </div>
                  <div className={`mt-2 font-mono heading-5 tabular-nums ${card.tone}`}>
                    {card.value}
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-2 caption-5 text-[#6B7280]">
                    <span className="truncate">{card.hint}</span>
                    <ArrowRight className="h-3 w-3 shrink-0 opacity-60 group-hover:translate-x-0.5 group-hover:text-[#4338CA] group-hover:opacity-100" />
                  </div>
                </button>
              );
            })}
          </section>

          {/* 2. Requires Your Attention */}
          <section className="rounded-2xl border border-black/[0.08] bg-white p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="title-2 text-[#111827]">Requires your attention</h2>
                <p className="caption-5 text-[#4B5563]">
                  Select any item below to jump straight to that queue.
                </p>
              </div>
              <span className="caption-4 text-[#4338CA]">
                Live platform checks
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {(
                [
                  {
                    label: 'Pending provider verifications',
                    count: analytics.pendingProviders,
                    note: 'Hosts waiting for identity review',
                    tab: 'providers' as AdminSubTab,
                  },
                  {
                    label: 'Pending space approvals',
                    count: analytics.pendingSpaces,
                    note: 'Parking bays waiting for approval',
                    tab: 'spaces' as AdminSubTab,
                  },
                  {
                    label: 'Missing or expired documents',
                    count: analytics.missingOrExpiredDocsCount ?? analytics.expiringProviders,
                    note: 'Providers needing updated paperwork',
                    tab: 'providers' as AdminSubTab,
                  },
                  {
                    label: 'Unresolved payment disputes',
                    count: analytics.openDisputes,
                    note: 'Driver refund claims to review',
                    tab: 'payments' as AdminSubTab,
                  },
                  {
                    label: 'Pending refunds',
                    count: analytics.pendingRefundsCount ?? 0,
                    note: 'Refund requests awaiting processing',
                    tab: 'payments' as AdminSubTab,
                  },
                  {
                    label: 'Critical incidents',
                    count: analytics.criticalIncidentsCount ?? analytics.openIncidents,
                    note: 'Medium or high severity safety issues',
                    tab: 'ops' as AdminSubTab,
                  },
                ] as const
              ).map((item) => {
                const needsAction = item.count > 0;
                return (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => onChangeSubTab(item.tab)}
                    className={`flex items-center justify-between gap-3 rounded-xl border p-4 text-left transition-colors duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:border-[#4338CA] ${
                      needsAction
                        ? 'border-amber-200 bg-amber-50/60'
                        : 'border-black/[0.07] bg-[#F8F7F4]'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="title-4 text-[#111827]">{item.label}</div>
                      <div className="mt-0.5 caption-5 text-[#4B5563]">{item.note}</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`font-mono title-2 tabular-nums ${
                          needsAction ? 'text-[#C83709]' : 'text-[#047857]'
                        }`}
                      >
                        {item.count}
                      </span>
                      <ArrowRight className="h-4 w-4 text-[#6B7280]" />
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* 3. Booking Analytics + Revenue Analytics */}
          <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Booking Analytics */}
            <div className="rounded-2xl border border-black/[0.08] bg-white p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <ChartBar className="h-5 w-5 text-[#4338CA]" weight="bold" />
                  <div>
                    <h2 className="title-2 text-[#111827]">Booking analytics</h2>
                    <p className="caption-5 text-[#4B5563]">
                      Volume trends and status summary
                    </p>
                  </div>
                </div>
                <div className="flex gap-1 rounded-xl border border-black/[0.08] bg-[#F8F7F4] p-1">
                  <button
                    type="button"
                    onClick={() => setTrendMode('daily')}
                    className={`rounded-lg px-3 py-1.5 button-xsm ${
                      trendMode === 'daily' ? 'bg-[#4338CA] text-white' : 'text-[#4B5563]'
                    }`}
                  >
                    Daily
                  </button>
                  <button
                    type="button"
                    onClick={() => setTrendMode('monthly')}
                    className={`rounded-lg px-3 py-1.5 button-xsm ${
                      trendMode === 'monthly' ? 'bg-[#4338CA] text-white' : 'text-[#4B5563]'
                    }`}
                  >
                    Monthly
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl border border-black/[0.07] bg-[#F8F7F4] p-3">
                  <div className="caption-5 text-[#4B5563]">Completed</div>
                  <div className="mt-1 font-mono title-2 tabular-nums text-[#047857]">
                    {bookingBreakdown.completed}
                  </div>
                </div>
                <div className="rounded-xl border border-black/[0.07] bg-[#F8F7F4] p-3">
                  <div className="caption-5 text-[#4B5563]">Cancelled</div>
                  <div className="mt-1 font-mono title-2 tabular-nums text-rose-700">
                    {bookingBreakdown.cancelled}
                  </div>
                </div>
                <div className="rounded-xl border border-black/[0.07] bg-[#F8F7F4] p-3">
                  <div className="caption-5 text-[#4B5563]">Pending holds</div>
                  <div className="mt-1 font-mono title-2 tabular-nums text-[#C83709]">
                    {bookingBreakdown.pending}
                  </div>
                </div>
              </div>

              <div className="space-y-2 rounded-xl border border-black/[0.07] bg-[#FAF9F6] p-4">
                <div className="flex items-center justify-between caption-4 text-[#374151]">
                  <span>
                    {trendMode === 'daily' ? 'Last 7 days bookings' : 'Last 6 months bookings'}
                  </span>
                  <span className="font-mono caption-5 text-[#6B7280]">
                    {bookingBreakdown.active} active right now
                  </span>
                </div>
                <div className="mt-2 space-y-2">
                  {activeTrends.map((pt) => {
                    const pct = pt.bookings > 0 ? Math.max(8, Math.round((pt.bookings / maxBookingsInTrend) * 100)) : 0;
                    return (
                      <div key={pt.key} className="flex items-center gap-3 caption-5">
                        <span className="w-16 shrink-0 font-mono text-[#4B5563]">{pt.label}</span>
                        <div className="h-3 flex-1 overflow-hidden rounded-full bg-black/[0.06]">
                          <div
                            className="h-full rounded-full bg-[#4338CA] transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="w-10 shrink-0 text-right font-mono tabular-nums text-[#111827]">
                          {pt.bookings}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Revenue Analytics */}
            <div className="rounded-2xl border border-black/[0.08] bg-white p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <CurrencyInr className="h-5 w-5 text-[#047857]" weight="bold" />
                  <div>
                    <h2 className="title-2 text-[#111827]">Revenue analytics</h2>
                    <p className="caption-5 text-[#4B5563]">
                      Booking values, platform earnings, and payouts
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onChangeSubTab('payments')}
                  className="button-xsm text-[#4338CA] hover:underline"
                >
                  Open payments
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-black/[0.07] bg-[#F8F7F4] p-3">
                  <div className="caption-5 text-[#4B5563]">Average booking</div>
                  <div className="mt-1 font-mono title-3 tabular-nums text-[#111827]">
                    {formatInr(revStats.averageOrderValueInr)}
                  </div>
                </div>
                <div className="rounded-xl border border-black/[0.07] bg-[#F8F7F4] p-3">
                  <div className="caption-5 text-[#4B5563]">Platform fees</div>
                  <div className="mt-1 font-mono title-3 tabular-nums text-[#047857]">
                    {formatInr(revStats.platformFeesInr)}
                  </div>
                </div>
                <div className="rounded-xl border border-black/[0.07] bg-[#F8F7F4] p-3">
                  <div className="caption-5 text-[#4B5563]">Host payouts pending</div>
                  <div className="mt-1 font-mono title-3 tabular-nums text-[#C83709]">
                    {formatInr(revStats.pendingHostPayoutInr)}
                  </div>
                </div>
              </div>

              <div className="space-y-2 rounded-xl border border-black/[0.07] bg-[#FAF9F6] p-4">
                <div className="flex items-center justify-between caption-4 text-[#374151]">
                  <span>
                    {trendMode === 'daily' ? 'Daily booking value' : 'Monthly booking value'}
                  </span>
                  <span className="font-mono caption-5 text-[#6B7280]">
                    Settled: {formatInr(revStats.settledToHostsInr)}
                  </span>
                </div>
                <div className="mt-2 space-y-2">
                  {activeTrends.map((pt) => {
                    const pct = pt.revenueInr > 0 ? Math.max(8, Math.round((pt.revenueInr / maxRevenueInTrend) * 100)) : 0;
                    return (
                      <div key={pt.key} className="flex items-center gap-3 caption-5">
                        <span className="w-16 shrink-0 font-mono text-[#4B5563]">{pt.label}</span>
                        <div className="h-3 flex-1 overflow-hidden rounded-full bg-black/[0.06]">
                          <div
                            className="h-full rounded-full bg-[#047857] transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="w-16 shrink-0 text-right font-mono tabular-nums text-[#111827]">
                          {formatInr(pt.revenueInr)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>

          {/* 4. Parking Network Overview + Recent Activity */}
          <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Parking Network Overview */}
            <div className="rounded-2xl border border-black/[0.08] bg-white p-6 space-y-4 lg:col-span-7">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-[#C83709]" weight="bold" />
                  <div>
                    <h2 className="title-2 text-[#111827]">Parking network overview</h2>
                    <p className="caption-5 text-[#4B5563]">
                      Active capacity and geographic coverage across Bengaluru
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onChangeSubTab('spaces')}
                  className="button-xsm text-[#4338CA] hover:underline"
                >
                  Manage spaces
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-black/[0.07] bg-[#F8F7F4] p-3">
                  <div className="caption-5 text-[#4B5563]">Active spaces</div>
                  <div className="mt-1 font-mono title-3 tabular-nums text-[#047857]">
                    {network.activeSpaces}
                  </div>
                </div>
                <div className="rounded-xl border border-black/[0.07] bg-[#F8F7F4] p-3">
                  <div className="caption-5 text-[#4B5563]">Inactive spaces</div>
                  <div className="mt-1 font-mono title-3 tabular-nums text-[#4B5563]">
                    {network.inactiveSpaces}
                  </div>
                </div>
                <div className="rounded-xl border border-black/[0.07] bg-[#F8F7F4] p-3">
                  <div className="caption-5 text-[#4B5563]">Available now</div>
                  <div className="mt-1 font-mono title-3 tabular-nums text-[#047857]">
                    {network.availableSpaces}
                  </div>
                </div>
                <div className="rounded-xl border border-black/[0.07] bg-[#F8F7F4] p-3">
                  <div className="caption-5 text-[#4B5563]">Occupied or booked</div>
                  <div className="mt-1 font-mono title-3 tabular-nums text-[#C83709]">
                    {network.occupiedSpaces}
                  </div>
                </div>
              </div>

              <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                {network.byZone.map((z) => (
                  <div
                    key={z.zone}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-black/[0.07] bg-[#FAF9F6] px-4 py-3"
                  >
                    <div className="min-w-0">
                      <div className="title-4 text-[#111827]">{z.zone}</div>
                      <div className="mt-0.5 font-mono caption-5 text-[#6B7280]">
                        {z.facilityCount} {z.facilityCount === 1 ? 'site' : 'sites'} ({z.avgLat}, {z.avgLng})
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 font-mono caption-4 tabular-nums">
                      <span className="text-[#047857]">{z.activeSpaces} active</span>
                      <span className="text-[#6B7280]">{z.inactiveSpaces} inactive</span>
                      <span className="rounded-lg border border-black/[0.08] bg-white px-2 py-1 text-[#111827]">
                        {z.availableSpaces} free / {z.occupiedSpaces} busy
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Activity */}
            <div className="rounded-2xl border border-black/[0.08] bg-white p-6 space-y-4 lg:col-span-5">
              <div className="flex items-center gap-2">
                <ClockCounterClockwise className="h-5 w-5 text-[#4338CA]" weight="bold" />
                <div>
                  <h2 className="title-2 text-[#111827]">Recent activity</h2>
                  <p className="caption-5 text-[#4B5563]">
                    Registrations, bookings, payments, and reviews
                  </p>
                </div>
              </div>

              <div className="max-h-88 space-y-2 overflow-y-auto pr-1">
                {(analytics.recentActivity || []).length === 0 ? (
                  <div className="rounded-xl border border-black/[0.07] bg-[#F8F7F4] p-4 caption-5 text-[#4B5563]">
                    No recent activity recorded yet.
                  </div>
                ) : (
                  (analytics.recentActivity || []).map((act) => (
                    <button
                      key={act.id}
                      type="button"
                      onClick={() => onChangeSubTab(act.targetTab)}
                      className="flex w-full items-start justify-between gap-3 rounded-xl border border-black/[0.07] bg-[#FAF9F6] px-4 py-3 text-left transition-colors duration-200 hover:border-[#4338CA]/40"
                    >
                      <div className="min-w-0">
                        <div className="truncate title-5 text-[#111827]">{act.title}</div>
                        <div className="mt-0.5 truncate caption-5 text-[#4B5563]">{act.detail}</div>
                      </div>
                      <span className="shrink-0 font-mono caption-5 text-[#6B7280]">
                        {formatShortTime(act.timestamp)}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
          </section>
        </div>
      )}

      {/* ================================================================= */}
      {/* TAB 1: PROVIDERS, DOCUMENTS & VERIFICATION WORKSPACE */}
      {/* ================================================================= */}
      {subTab === 'providers' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Provider Queue */}
          <section className="rounded-2xl border border-black/[0.08] bg-white p-6 lg:col-span-4">
            <h2 className="title-3 text-[#111827]">
              Providers ({sortedProviders.length})
            </h2>
            <p className="mt-1 caption-5 text-[#4B5563]">
              Pick a provider to inspect their documents and verify their account.
            </p>
            <div className="mt-4 max-h-[680px] space-y-2 overflow-y-auto pr-1">
              {sortedProviders.map((prov) => {
                const selected = activeProvider?.id === prov.id;
                return (
                  <button
                    key={prov.id}
                    type="button"
                    onClick={() => {
                      setSelectedProviderId(prov.id);
                      setInspectedDoc(null);
                    }}
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
                          {prov.name}
                        </div>
                      </div>
                      <span
                        className={`shrink-0 rounded-lg border px-2 py-0.5 caption-4 ${statusTone(
                          prov.verificationStatus
                        )}`}
                      >
                        {statusLabel(prov.verificationStatus)}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center justify-between caption-5 text-[#6B7280]">
                      <span>{prov.documents.length} document(s)</span>
                      {prov.aiPrecheckWarnings.length > 0 && (
                        <span className="text-amber-800">Needs document check</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Expanded Provider Review Workspace */}
          <section className="space-y-4 lg:col-span-8">
            {activeProvider && (
              <div className="rounded-2xl border border-black/[0.08] bg-white p-6 space-y-6">
                {/* Provider Profile Summary */}
                <div className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-black/[0.06] bg-[#FAF9F6] p-4">
                  <div className="space-y-1">
                    <div className="caption-4 text-[#4338CA]">
                      {activeProvider.providerType.replace(/_/g, ' ')}
                    </div>
                    <h2 className="heading-6 text-[#111827]">
                      {activeProvider.organizationName}
                    </h2>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span
                      className={`rounded-lg border px-3 py-1 caption-3 ${statusTone(
                        activeProvider.verificationStatus
                      )}`}
                    >
                      {statusLabel(activeProvider.verificationStatus)}
                    </span>
                    {activeProvider.expiresAt && (
                      <span className="caption-5 text-[#6B7280]">
                        Valid until {activeProvider.expiresAt}
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-xl border border-black/[0.07] bg-[#F8F7F4] p-3">
                    <div className="caption-5 text-[#6B7280]">Contact person</div>
                    <div className="mt-1 title-5 text-[#111827]">{activeProvider.contactName}</div>
                  </div>
                  <div className="rounded-xl border border-black/[0.07] bg-[#F8F7F4] p-3">
                    <div className="caption-5 text-[#6B7280]">Email</div>
                    <div className="mt-1 truncate caption-2 text-[#111827]">{activeProvider.contactEmail}</div>
                  </div>
                  <div className="rounded-xl border border-black/[0.07] bg-[#F8F7F4] p-3">
                    <div className="caption-5 text-[#6B7280]">Phone</div>
                    <div className="mt-1 font-mono caption-2 text-[#111827]">{activeProvider.contactPhone}</div>
                  </div>
                  <div className="rounded-xl border border-black/[0.07] bg-[#F8F7F4] p-3">
                    <div className="caption-5 text-[#6B7280]">Registration ID</div>
                    <div className="mt-1 font-mono caption-2 text-[#111827]">
                      {activeProvider.registrationNumber || 'Not provided'}
                    </div>
                  </div>
                </div>

                {activeProvider.aiPrecheckWarnings.length > 0 && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 caption-2 text-amber-950">
                    <div className="title-5">Document warnings</div>
                    <ul className="mt-1 list-disc pl-4 caption-5">
                      {activeProvider.aiPrecheckWarnings.map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Documents List & Side-by-side / Spacious Viewer */}
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="flex items-center gap-2 title-4 text-[#111827]">
                      <LockSimple className="h-4 w-4 text-[#4338CA]" weight="bold" />
                      <span>Uploaded documents ({activeProvider.documents.length})</span>
                    </h3>
                    <span className="caption-5 text-[#6B7280]">
                      Protected viewing links expire after 5 minutes
                    </span>
                  </div>

                  {activeProvider.documents.length === 0 ? (
                    <div className="rounded-xl border border-black/[0.06] bg-[#F8F7F4] p-4 caption-2 text-[#4B5563]">
                      No verification documents uploaded yet.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      {activeProvider.documents.map((doc) => (
                        <div
                          key={doc.id}
                          className="flex flex-col justify-between gap-3 rounded-xl border border-black/[0.08] bg-[#F8F7F4] p-4"
                        >
                          <div>
                            <div className="title-5 text-[#111827]">{doc.fileName}</div>
                            <div className="mt-1 caption-5 text-[#4B5563]">
                              Type: {doc.docType.replace(/_/g, ' ')}
                            </div>
                            <div className="mt-0.5 caption-5 text-[#6B7280]">
                              Status: {doc.status} · Added {doc.uploadedAt.slice(0, 10)}
                            </div>
                          </div>
                          <button
                            type="button"
                            disabled={docBusyId === doc.id}
                            onClick={() => void handleInspectDocument(doc.id)}
                            className="flex items-center justify-center gap-2 rounded-lg border border-black/[0.1] bg-white px-3 py-2 button-xsm text-[#111827] transition-colors duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:border-[#4338CA] hover:text-[#4338CA] active:scale-[0.98]"
                          >
                            <Eye className="h-3.5 w-3.5" weight="bold" />
                            <span>
                              {docBusyId === doc.id ? 'Opening...' : 'View document'}
                            </span>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {inspectedDoc && (
                    <div className="rounded-2xl border border-[#4338CA]/30 bg-indigo-50/50 p-5 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="title-4 text-[#4338CA]">
                            Document viewer: {inspectedDoc.fileName}
                          </div>
                          <div className="mt-0.5 caption-5 text-[#4B5563]">
                            Opened by {inspectedDoc.accessedBy} · Link valid until{' '}
                            {new Date(inspectedDoc.expiresAt).toLocaleTimeString()}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setInspectedDoc(null)}
                          aria-label="Close document preview"
                          className="rounded-lg border border-black/[0.08] bg-white p-1.5 text-[#4B5563] hover:text-[#111827]"
                        >
                          <X className="h-4 w-4" weight="bold" />
                        </button>
                      </div>
                      <div className="min-h-[160px] rounded-xl border border-black/[0.08] bg-white p-4 font-mono caption-2 text-[#111827]">
                        <div className="mb-2 caption-5 text-[#4B5563]">
                          Provider: {inspectedDoc.providerName} | Type: {inspectedDoc.docType}
                        </div>
                        <div className="whitespace-pre-wrap text-[#374151]">
                          {inspectedDoc.contentText}
                        </div>
                      </div>
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
                  className="space-y-4 rounded-xl border border-black/[0.08] bg-[#FAF9F6] p-5"
                >
                  <div className="title-4 text-[#111827]">
                    Review decision
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block caption-4 text-[#4B5563]">
                        Status decision
                      </label>
                      <select
                        value={decision}
                        onChange={(e) =>
                          setDecision(e.target.value as ProviderVerificationStatus)
                        }
                        className="w-full rounded-xl border border-black/[0.1] bg-white px-3 py-2 body-5 text-[#111827]"
                      >
                        {VERIFY_DECISIONS.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block caption-4 text-[#4B5563]">
                        Approval valid until
                      </label>
                      <input
                        type="date"
                        value={expiresAt}
                        onChange={(e) => setExpiresAt(e.target.value)}
                        className="w-full rounded-xl border border-black/[0.1] bg-white px-3 py-2 body-5 text-[#111827]"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block caption-4 text-[#4B5563]">
                      Review note
                    </label>
                    <input
                      type="text"
                      required
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      className="w-full rounded-xl border border-black/[0.1] bg-white px-3 py-2 body-5 text-[#111827]"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={verifyBusy}
                    className="flex items-center gap-2 rounded-xl bg-[#4338CA] px-4 py-2 button-xsm text-white transition-colors duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-[#3730A3] active:scale-[0.98] disabled:opacity-60"
                  >
                    <ShieldCheck className="h-4 w-4" weight="bold" />
                    <span>
                      {verifyBusy ? 'Saving...' : `Save ${statusLabel(decision).toLowerCase()} decision`}
                    </span>
                  </button>
                </form>
              </div>
            )}
          </section>
        </div>
      )}

      {/* ================================================================= */}
      {/* TAB 2: SPACE APPROVALS */}
      {/* ================================================================= */}
      {subTab === 'spaces' && (
        <div className="space-y-6">
          <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-black/[0.08] bg-white p-4">
            <div className="flex flex-wrap gap-2">
              {(
                [
                  { id: 'all', label: `All locations (${facilities.length})` },
                  { id: 'pending', label: 'Needs review' },
                  { id: 'approved', label: 'Ready & active' },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setSpaceFilter(f.id)}
                  className={`rounded-xl px-3 py-2 button-xsm ${
                    spaceFilter === f.id
                      ? 'bg-[#111827] text-white'
                      : 'border border-black/[0.08] bg-[#F8F7F4] text-[#374151]'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={spaceSearch}
              onChange={(e) => setSpaceSearch(e.target.value)}
              placeholder="Search site, zone, or provider..."
              className="w-full sm:w-64 rounded-xl border border-black/[0.1] bg-[#F8F7F4] px-3 py-2 caption-2 text-[#111827]"
            />
          </section>

          {spaceCheckFeedback && (
            <section className="rounded-2xl border border-black/[0.1] bg-white p-6">
              <div className="flex items-center justify-between gap-2">
                <div className="title-4 text-[#111827]">
                  Approval checklist for {spaceCheckFeedback.spaceId}
                </div>
                <button
                  type="button"
                  onClick={() => setSpaceCheckFeedback(null)}
                  className="button-xsm text-[#4B5563] hover:text-[#111827]"
                >
                  Close
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
            {filteredFacilities.map((fac) => {
              const facSpaces = spaces.filter((s) => s.facilityId === fac.id);
              const facProvider = providers.find((p) => p.id === fac.providerId);
              const chk = getFacCheckState(fac);

              return (
                <article
                  key={fac.id}
                  className="rounded-2xl border border-black/[0.08] bg-white p-6 space-y-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="title-3 text-[#111827]">{fac.name}</h3>
                      <div className="mt-1 caption-5 text-[#4B5563]">{fac.address}</div>
                      <div className="mt-1 caption-5 text-[#6B7280]">
                        Provider: {facProvider?.organizationName || fac.providerName}
                      </div>
                    </div>
                    <span
                      className={`shrink-0 rounded-lg border px-2.5 py-1 caption-4 ${
                        fac.operationalChecksPassed
                          ? 'border-emerald-200 bg-emerald-50 text-[#047857]'
                          : 'border-amber-200 bg-amber-50 text-[#C83709]'
                      }`}
                    >
                      {fac.operationalChecksPassed ? 'Site verified' : 'Checks needed'}
                    </span>
                  </div>

                  {/* Site Verification Checklist */}
                  <div className="rounded-xl border border-black/[0.06] bg-[#F8F7F4] p-4 caption-5">
                    <div className="mb-2 title-5 text-[#111827]">
                      Site readiness checklist
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {(
                        [
                          { key: 'entranceVerified', label: 'Clear entrance gate' },
                          { key: 'locationVerified', label: 'Accurate map pin' },
                          { key: 'dimensionsVerified', label: 'Bay size verified' },
                          { key: 'operatingHoursVerified', label: 'Hours confirmed' },
                          { key: 'restrictionsVerified', label: 'Rules listed' },
                          { key: 'accessArrangementsVerified', label: 'Entry access ready' },
                          { key: 'propertyEligibleForUse', label: 'Approved for parking' },
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
                        placeholder="Add inspection note..."
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
                        Save checklist
                      </button>
                    </div>
                  </div>

                  {/* Spaces in this facility */}
                  <div className="space-y-2">
                    {facSpaces.map((sp) => (
                      <div
                        key={sp.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-black/[0.06] bg-[#FAF9F6] px-3 py-2.5"
                      >
                        <div>
                          <div className="title-5 text-[#111827]">{sp.spaceCode}</div>
                          <div className="caption-5 text-[#4B5563]">
                            ₹{sp.hourlyPriceInr}/hr ·{' '}
                            <span
                              className={
                                sp.publicationStatus === 'approved'
                                  ? 'text-[#047857]'
                                  : 'text-[#C83709]'
                              }
                            >
                              {sp.publicationStatus === 'approved' ? 'Published' : 'Pending approval'}
                            </span>
                          </div>
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
                            {sp.publicationStatus === 'approved' ? 'Reverify' : 'Approve space'}
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
      {/* TAB 3: PAYMENTS, DISPUTES & HOST PAYOUTS */}
      {/* ================================================================= */}
      {subTab === 'payments' && (
        <div className="space-y-6">
          {/* Disputes & Refund Management */}
          <section className="rounded-2xl border border-black/[0.08] bg-white p-6">
            <h2 className="title-2 text-[#111827]">
              Disputes and refunds ({disputes.length})
            </h2>
            {disputes.length === 0 ? (
              <p className="mt-2 caption-2 text-[#4B5563]">
                No open disputes right now.
              </p>
            ) : (
              <div className="mt-3 space-y-2">
                {disputes.map((dsp) => (
                  <div
                    key={dsp.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-black/[0.07] bg-[#F8F7F4] p-4"
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="title-5 text-[#111827]">Booking {dsp.bookingId}</span>
                        <span className="font-mono caption-4 text-[#047857]">
                          {formatInr(dsp.requestedRefundInr)}
                        </span>
                        <span className="caption-4 uppercase text-[#4338CA]">
                          {dsp.status.replace('_', ' ')}
                        </span>
                      </div>
                      <div className="caption-5 text-[#374151]">
                        {dsp.raisedBy}: {dsp.reason}
                      </div>
                      {dsp.adminNote && (
                        <div className="caption-5 text-[#047857]">Decision note: {dsp.adminNote}</div>
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
                          placeholder="Add resolution note..."
                          className="rounded-lg border border-black/[0.1] bg-white px-3 py-2 caption-5"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            void onAdminResolveDispute(
                              dsp.id,
                              'refunded',
                              noteMap[dsp.id] || 'Refund approved after review'
                            )
                          }
                          className="whitespace-nowrap shrink-0 rounded-lg bg-[#047857] px-3 py-2 button-xsm text-white transition-colors duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-[#065F46] active:scale-[0.98]"
                        >
                          Approve refund
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void onAdminResolveDispute(
                              dsp.id,
                              'dismissed',
                              noteMap[dsp.id] || 'Dispute closed after review'
                            )
                          }
                          className="whitespace-nowrap shrink-0 rounded-lg border border-black/[0.1] bg-white px-3 py-2 button-xsm text-[#374151]"
                        >
                          Close
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Host Payouts */}
            <section className="rounded-2xl border border-black/[0.08] bg-white p-6">
              <h2 className="title-3 text-[#111827]">
                Provider payouts ({settlements.length})
              </h2>
              <div className="mt-3 space-y-2">
                {settlements.map((stl) => (
                  <div
                    key={stl.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-black/[0.06] bg-[#F8F7F4] p-3"
                  >
                    <div>
                      <div className="title-5 text-[#111827]">{stl.providerName}</div>
                      <div className="caption-5 text-[#4B5563]">{stl.facilityName}</div>
                      <div className="mt-0.5 font-mono caption-5 text-[#6B7280]">
                        Payout {formatInr(stl.netPayoutInr)} · {stl.status.replace('_', ' ')}
                      </div>
                    </div>
                    {stl.status === 'scheduled' || stl.status === 'pending_checkout' ? (
                      <button
                        type="button"
                        onClick={() => void onAdminSettlePayout(stl.id)}
                        className="whitespace-nowrap shrink-0 rounded-lg bg-[#4338CA] px-3 py-2 button-xsm text-white transition-colors duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-[#3730A3] active:scale-[0.98]"
                      >
                        Send payout
                      </button>
                    ) : (
                      <span className="font-mono caption-4 text-[#047857]">
                        {stl.utrRef || 'Paid'}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* Payment Events Log */}
            <section className="rounded-2xl border border-black/[0.08] bg-white p-6 space-y-3">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-[#4338CA]" weight="bold" />
                <h2 className="title-3 text-[#111827]">
                  Payment activity log
                </h2>
              </div>
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {webhookEvents.map((ev) => (
                  <div
                    key={ev.eventId}
                    className="flex items-center justify-between gap-2 rounded-xl border border-black/[0.06] bg-[#F8F7F4] px-3 py-2"
                  >
                    <div className="min-w-0">
                      <div className="truncate title-5 text-[#111827]">
                        Booking {ev.bookingId}
                      </div>
                      <div className="caption-5 text-[#4B5563]">
                        {ev.eventType.replace('.', ' ')} ·{' '}
                        {ev.signatureVerified ? 'Signature verified' : 'Rejected'}
                      </div>
                    </div>
                    <div className="shrink-0 text-right font-mono tabular-nums">
                      <div className="caption-3 text-[#047857]">{formatInr(ev.amountInr)}</div>
                      <div className="caption-5 text-[#6B7280]">
                        {ev.duplicateIgnoredCount > 0
                          ? `${ev.duplicateIgnoredCount} duplicate blocked`
                          : 'Processed'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="rounded-xl border border-black/[0.06] bg-[#FAF9F6] p-3 caption-5 text-[#4B5563]">
                {paymentOrders.length} payment orders · {refunds.length} refunds · {bookings.length} total bookings
              </div>
            </section>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* TAB 4: OPERATIONS, SAFETY & AUDIT LOGS */}
      {/* ================================================================= */}
      {subTab === 'ops' && (
        <div className="space-y-6">
          {/* Quick Operations Summary */}
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border border-black/[0.08] bg-white p-4">
              <div className="caption-4 text-[#4B5563]">Total booking value</div>
              <div className="mt-1 font-mono heading-5 tabular-nums text-[#111827]">
                {formatInr(analytics.totalGmvInr)}
              </div>
              <div className="mt-1 caption-5 text-[#047857]">
                Fees {formatInr(analytics.platformRevenueInr)}
              </div>
            </div>
            <div className="rounded-2xl border border-black/[0.08] bg-white p-4">
              <div className="caption-4 text-[#4B5563]">Active parking bays</div>
              <div className="mt-1 font-mono heading-5 tabular-nums text-[#047857]">
                {analytics.approvedSpaces}
              </div>
              <div className="mt-1 caption-5 text-[#4B5563]">
                {analytics.approvedProviders} verified providers
              </div>
            </div>
            <div className="rounded-2xl border border-black/[0.08] bg-white p-4">
              <div className="caption-4 text-[#4B5563]">Duplicate payments blocked</div>
              <div className="mt-1 font-mono heading-5 tabular-nums text-[#4338CA]">
                {analytics.duplicateWebhooksBlocked}
              </div>
              <div className="mt-1 caption-5 text-[#4B5563]">
                Automatic replay protection
              </div>
            </div>
            <div className="rounded-2xl border border-black/[0.08] bg-white p-4">
              <div className="caption-4 text-[#4B5563]">Open issues</div>
              <div className="mt-1 font-mono heading-5 tabular-nums text-[#C83709]">
                {analytics.openIncidents + analytics.openDisputes}
              </div>
              <div className="mt-1 caption-5 text-[#4B5563]">
                {analytics.expiringProviders} expiring license(s)
              </div>
            </div>
          </section>

          {/* Live Space Status, Driver Wallets & Automated Events */}
          <section className="rounded-2xl border border-black/[0.08] bg-white p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="title-3 text-[#111827]">
                Live bay status and driver wallets
              </h2>
              <span className="caption-5 text-[#4B5563]">
                {spaces.filter((s) => s.occupancyState && s.occupancyState !== 'AVAILABLE').length}{' '}
                busy bays · {wallets.filter((w) => w.bookingRestricted).length} restricted wallets
              </span>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
              {/* Live Bay Occupancy States */}
              <div className="rounded-xl border border-black/[0.07] bg-[#F8F7F4] p-4">
                <div className="title-5 text-[#111827]">Occupied or reserved bays</div>
                <div className="mt-3 max-h-56 space-y-2 overflow-y-auto pr-1 caption-5">
                  {spaces.filter((s) => s.occupancyState && s.occupancyState !== 'AVAILABLE')
                    .length === 0 ? (
                    <div className="rounded-lg border border-black/[0.05] bg-white p-3 text-[#4B5563]">
                      All approved spaces are open right now.
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
                              <span className="title-5 text-[#111827]">{space.spaceCode}</span>
                              <span className="font-mono caption-4 uppercase text-[#C83709]">
                                {space.occupancyState}
                              </span>
                            </div>
                            <div className="mt-1 caption-5 text-[#4B5563]">{facName}</div>
                          </div>
                        );
                      })
                  )}
                </div>
              </div>

              {/* Driver Prepaid Wallets */}
              <div className="rounded-xl border border-black/[0.07] bg-[#F8F7F4] p-4">
                <div className="flex items-center gap-2 title-5 text-[#111827]">
                  <Wallet className="h-4 w-4 text-[#047857]" weight="bold" />
                  <span>Driver wallets</span>
                </div>
                <div className="mt-3 max-h-56 space-y-2 overflow-y-auto pr-1 caption-5">
                  {wallets.length === 0 ? (
                    <div className="rounded-lg border border-black/[0.05] bg-white p-3 text-[#4B5563]">
                      No driver wallets created yet.
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
                          <span className="title-5 text-[#111827]">{w.driverName}</span>
                          <span
                            className={`font-mono caption-3 tabular-nums ${
                              w.bookingRestricted ? 'text-rose-700' : 'text-[#047857]'
                            }`}
                          >
                            {formatInr(w.balanceInr)}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center justify-between gap-2 caption-5 text-[#4B5563] tabular-nums">
                          <span>Due: {formatInr(w.unpaidDueInr)}</span>
                          <span className={w.bookingRestricted ? 'text-rose-700' : 'text-[#047857]'}>
                            {w.bookingRestricted ? 'Restricted' : 'Active'}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Automated Bay Events */}
              <div className="rounded-xl border border-black/[0.07] bg-[#F8F7F4] p-4">
                <div className="title-5 text-[#111827]">
                  Automated updates ({lifecycleEvents.length})
                </div>
                <div className="mt-3 max-h-56 space-y-2 overflow-y-auto pr-1 caption-5">
                  {lifecycleEvents.length === 0 ? (
                    <div className="rounded-lg border border-black/[0.05] bg-white p-3 text-[#4B5563]">
                      No recent checkouts or overstays recorded.
                    </div>
                  ) : (
                    lifecycleEvents.slice(0, 8).map((ev) => (
                      <div
                        key={ev.id}
                        className="rounded-lg border border-black/[0.06] bg-white p-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="title-5 text-[#4338CA]">{ev.spaceCode}</span>
                          <span className="caption-5 text-[#6B7280]">
                            {ev.resultingOccupancyState}
                          </span>
                        </div>
                        <div className="mt-1 caption-5 text-[#374151]">{ev.outcomeSummary}</div>
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
                  Safety incidents ({incidents.length})
                </h2>
              </div>
              <div className="mt-3 space-y-2">
                {incidents.map((inc) => (
                  <div
                    key={inc.id}
                    className="rounded-xl border border-black/[0.06] bg-[#F8F7F4] p-4"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="title-5 text-[#111827]">
                        {inc.category.replace('_', ' ')} ({inc.severity})
                      </span>
                      <span className="caption-4 uppercase text-[#4338CA]">{inc.status}</span>
                    </div>
                    <div className="mt-1 caption-5 text-[#374151]">
                      {inc.reporterName}: {inc.description}
                    </div>
                    {inc.status !== 'resolved' && (
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <input
                          type="text"
                          value={noteMap[inc.id] || ''}
                          onChange={(e) =>
                            setNoteMap((prev) => ({ ...prev, [inc.id]: e.target.value }))
                          }
                          placeholder="Add resolution note..."
                          className="min-w-0 flex-1 rounded-lg border border-black/[0.1] bg-white px-3 py-2 caption-5"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            void onAdminUpdateIncident(
                              inc.id,
                              'investigating',
                              noteMap[inc.id] || 'Assigned to field team'
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
                              noteMap[inc.id] || 'Resolved by operations'
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
                  User reports ({userReports.length})
                </h2>
              </div>
              {userReports.length === 0 ? (
                <p className="mt-3 caption-2 text-[#4B5563]">
                  No user reports waiting for action.
                </p>
              ) : (
                <div className="mt-3 space-y-2">
                  {userReports.map((rep) => (
                    <div
                      key={rep.id}
                      className="rounded-xl border border-black/[0.06] bg-[#F8F7F4] p-4"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="title-5 text-[#111827]">{rep.reportedEntity}</span>
                        <span className="caption-4 uppercase text-[#C83709]">{rep.status}</span>
                      </div>
                      <div className="mt-1 caption-5 text-[#374151]">
                        {rep.reporterName}: {rep.reason}
                      </div>
                      {rep.status === 'open' && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              void onAdminModerateReport(
                                rep.id,
                                'warned',
                                'Warning sent to user'
                              )
                            }
                            className="rounded-lg border border-black/[0.1] bg-white px-3 py-2 button-xsm active:scale-[0.98]"
                          >
                            Warn
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              void onAdminModerateReport(
                                rep.id,
                                'suspended',
                                'Account suspended pending review'
                              )
                            }
                            className="rounded-lg bg-rose-700 px-3 py-2 button-xsm text-white active:scale-[0.98]"
                          >
                            Suspend
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              void onAdminModerateReport(rep.id, 'dismissed', 'No issue found')
                            }
                            className="rounded-lg bg-[#111827] px-3 py-2 button-xsm text-white active:scale-[0.98]"
                          >
                            Dismiss
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* Activity Log */}
          <section className="rounded-2xl border border-black/[0.08] bg-white p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-[#4338CA]" weight="bold" />
                <h2 className="title-3 text-[#111827]">
                  Platform activity log ({filteredAudits.length})
                </h2>
              </div>
              <input
                type="text"
                value={auditFilter}
                onChange={(e) => setAuditFilter(e.target.value)}
                placeholder="Search log..."
                className="w-64 rounded-xl border border-black/[0.1] bg-[#F8F7F4] px-3 py-2 caption-5"
              />
            </div>
            <div className="mt-3 max-h-72 space-y-2 overflow-y-auto">
              {filteredAudits.map((log) => (
                <div
                  key={log.id}
                  className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg bg-[#F8F7F4] px-3 py-2 text-[#111827]"
                >
                  <div className="min-w-0">
                    <span className="title-5 text-[#4338CA]">
                      {log.action.replace(/_/g, ' ')}
                    </span>
                    <span className="mx-2 text-[#9CA3AF]">·</span>
                    <span className="caption-3">{log.actor}</span>
                    <div className="mt-0.5 caption-5 text-[#4B5563]">{log.detail}</div>
                  </div>
                  <span className="shrink-0 font-mono caption-5 text-[#6B7280]">
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
