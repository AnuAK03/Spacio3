import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bot,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  FileCheck2,
  FileText,
  IndianRupee,
  Lock,
  Plus,
  QrCode,
  ScanLine,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Upload,
  UserCheck,
  XCircle,
} from 'lucide-react';
import { QrCodeDisplay } from './QrCodeDisplay';
import {
  AutonomousLifecycleEvent,
  BengaluruLocation,
  BookingRecord,
  DetailedProviderType,
  EvidenceRequirement,
  Facility,
  HostSettlementRecord,
  IncidentRecord,
  ParkingSpace,
  ProviderRecord,
  ProviderType,
  UserSession,
  VehicleType,
} from '../types/parkpool';

export interface NewFacilityPayload {
  providerId?: string;
  name: string;
  providerName: string;
  providerType: ProviderType;
  address: string;
  zone?: string;
  lat?: number;
  lng?: number;
  entranceLabel: string;
  walkingDistanceM: number;
  hourlyPriceInr: number;
  covered: boolean;
  evCharging: boolean;
  allowedTypes: VehicleType[];
  hardDepartureMin: number;
  restrictions: string[];
  accessInstructions: string;
}

interface ProviderPortalViewProps {
  user: UserSession;
  subTab: 'onboarding' | 'facilities' | 'bookings' | 'settlements';
  onChangeSubTab: (tab: 'onboarding' | 'facilities' | 'bookings' | 'settlements') => void;
  locations: BengaluruLocation[];
  providers: ProviderRecord[];
  evidenceChecklists: Record<DetailedProviderType, EvidenceRequirement[]>;
  facilities: Facility[];
  spaces: ParkingSpace[];
  bookings: BookingRecord[];
  settlements: HostSettlementRecord[];
  incidents: IncidentRecord[];
  lifecycleEvents: AutonomousLifecycleEvent[];
  onRegisterProvider: (payload: {
    name: string;
    contactName: string;
    contactEmail: string;
    contactPhone: string;
    organizationName: string;
    registrationNumber?: string;
    providerType: DetailedProviderType;
  }) => Promise<ProviderRecord | null>;
  onUploadEvidence: (
    providerId: string,
    payload: { docType: string; fileName: string; contentText: string }
  ) => Promise<void>;
  onAddFacility: (payload: NewFacilityPayload) => Promise<void>;
  onUpdateSpacePricing: (
    spaceId: string,
    payload: { hourlyPriceInr: number; hardDepartureMin: number; restrictions: string[] }
  ) => Promise<void>;
  onAddOwnerBlock: (
    spaceId: string,
    payload: { startMin: number; endMin: number; label: string }
  ) => Promise<void>;
  onWithdrawAvailability: (
    spaceId: string,
    payload: { startMin: number; endMin: number; reason: string }
  ) => Promise<void>;
  onDecideExtension: (
    bookingId: string,
    requestId: string,
    decision: 'approve' | 'reject'
  ) => Promise<void>;
  onReportOverstay: (bookingId: string, overstayMinutes: number) => Promise<void>;
  onHostScanDriverQr: (payload: {
    scannedInput: string;
    expectedFacilityId?: string;
    arrivalMinutesLate?: number;
  }) => Promise<{ ok: boolean; error?: string }>;
  onRunLifecycleCheck: (bookingId: string, requestedExtensionMinutes?: number) => Promise<void>;
  onConfirmDeparture: (bookingId: string) => Promise<void>;
  onCompleteClearance: (spaceId: string) => Promise<void>;
  onSubmitIncident: (payload: {
    facilityId?: string;
    bookingId?: string;
    category: IncidentRecord['category'];
    severity: IncidentRecord['severity'];
    description: string;
  }) => Promise<void>;
  onUpdateFacility: (facilityId: string, payload: Partial<Facility>) => Promise<void>;
  onDeleteFacility: (facilityId: string) => Promise<void>;
  onAssignFacilityDriver: (facilityId: string, driverEmail?: string) => Promise<void>;
  onCancelBookingHost: (bookingId: string, reason: string) => Promise<void>;
}

const PROVIDER_TYPES: Array<{ id: DetailedProviderType; label: string }> = [
  { id: 'commercial_operator', label: 'Commercial Parking Operator' },
  { id: 'mall_office', label: 'Mall or Office Facility' },
  { id: 'property_owner', label: 'Property Owner' },
  { id: 'property_manager', label: 'Property Manager' },
  { id: 'apartment_residential', label: 'Apartment / Residential Facility' },
];

const VERIFICATION_STEPS = [
  'NOT_SUBMITTED',
  'SUBMITTED',
  'UNDER_REVIEW',
  'NEEDS_MORE_INFORMATION',
  'APPROVED',
] as const;

const VEHICLE_CHOICES: Array<{ id: VehicleType; label: string }> = [
  { id: 'two_wheeler', label: '2-Wheeler' },
  { id: 'hatchback', label: 'Hatchback' },
  { id: 'sedan', label: 'Sedan' },
  { id: 'suv', label: 'SUV' },
];

const HOURS = Array.from({ length: 18 }, (_, i) => i + 6); // 06:00 to 23:00

function fmt(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export const ProviderPortalView: React.FC<ProviderPortalViewProps> = ({
  user,
  subTab,
  onChangeSubTab,
  locations,
  providers,
  evidenceChecklists,
  facilities,
  spaces,
  bookings,
  settlements,
  incidents,
  lifecycleEvents,
  onRegisterProvider,
  onUploadEvidence,
  onAddFacility,
  onUpdateSpacePricing,
  onAddOwnerBlock,
  onWithdrawAvailability,
  onDecideExtension,
  onReportOverstay,
  onHostScanDriverQr,
  onRunLifecycleCheck,
  onConfirmDeparture,
  onCompleteClearance,
  onSubmitIncident,
  onUpdateFacility,
  onDeleteFacility,
  onAssignFacilityDriver,
  onCancelBookingHost,
}) => {
  const matchedProvider = useMemo(
    () =>
      providers.find((p) => p.contactEmail.toLowerCase() === user.email.toLowerCase()) ||
      providers.find((p) => p.id === 'PRV-05') ||
      providers[0],
    [providers, user.email]
  );

  // Registration state
  const [orgName, setOrgName] = useState(
    matchedProvider?.organizationName || user.organization || ''
  );
  const [contactPhone, setContactPhone] = useState(
    matchedProvider?.contactPhone || '+91 98452 71004'
  );
  const [regNo, setRegNo] = useState(matchedProvider?.registrationNumber || '');
  const [detailedType, setDetailedType] = useState<DetailedProviderType>(
    matchedProvider?.providerType || 'property_owner'
  );
  const [regBusy, setRegBusy] = useState(false);
  const [regSavedSuccess, setRegSavedSuccess] = useState(false);

  // Evidence upload state
  const checklist = evidenceChecklists[matchedProvider?.providerType || detailedType] || [];
  const [docType, setDocType] = useState<string>(checklist[0]?.docType || 'ownership_title');
  const [fileName, setFileName] = useState('property_authority_record.txt');
  const [docSummary, setDocSummary] = useState(
    'Verified Khata/Agreement Ref #BLR-2026-881 authorizing public visitor bay pooling 07:00-22:00.'
  );
  const [uploadBusy, setUploadBusy] = useState(false);

  // Facility creation state
  const [facName, setFacName] = useState('');
  const [selectedLocId, setSelectedLocId] = useState(locations[0]?.id || 'LOC-PHX');
  const [address, setAddress] = useState('Kodigehalli Main Rd, Bengaluru');
  const [entranceLabel, setEntranceLabel] = useState('Main Spot Entrance');
  const [accessInstructions, setAccessInstructions] = useState(
    'Scan booking QR or enter Spot Access PIN at keypad; park in designated bay.'
  );
  const [restrictionsText, setRestrictionsText] = useState(
    'Max height 210cm, No overnight stay past closing time'
  );
  const [walkingDistanceM, setWalkingDistanceM] = useState(260);
  const [hourlyPriceInr, setHourlyPriceInr] = useState(50);
  const [hardDepartureMin, setHardDepartureMin] = useState(21 * 60);
  const [covered, setCovered] = useState(true);
  const [evCharging, setEvCharging] = useState(false);
  const [allowedTypes, setAllowedTypes] = useState<VehicleType[]>([
    'hatchback',
    'sedan',
    'suv',
  ]);
  const [facBusy, setFacBusy] = useState(false);

  // Facility Editing Modal / State
  const [editingFacilityId, setEditingFacilityId] = useState<string | null>(null);
  const [editFacName, setEditFacName] = useState('');
  const [editFacAddress, setEditFacAddress] = useState('');
  const [editEntranceLabel, setEditEntranceLabel] = useState('');

  // Booking Search & Filters
  const [bookingSearch, setBookingSearch] = useState('');
  const [bookingStatusFilter, setBookingStatusFilter] = useState<'all' | 'confirmed' | 'checked-in' | 'completed' | 'cancelled'>('all');

  // Calendar, Blocks & Withdrawals state
  const ownFacilities = useMemo(() => {
    if (!matchedProvider) return facilities;
    const owned = facilities.filter((f) => f.providerId === matchedProvider.id);
    return owned.length > 0 ? owned : facilities.slice(0, 3);
  }, [facilities, matchedProvider]);

  const ownSpaces = useMemo(() => {
    const ids = new Set(ownFacilities.map((f) => f.id));
    return spaces.filter((s) => ids.has(s.facilityId));
  }, [spaces, ownFacilities]);

  const [selectedSpaceId, setSelectedSpaceId] = useState<string>(
    () => ownSpaces[0]?.id || spaces[0]?.id || 'BAY-E1'
  );
  const activeSpace =
    ownSpaces.find((s) => s.id === selectedSpaceId) || ownSpaces[0] || spaces[0];

  const [blockStartHour, setBlockStartHour] = useState(16);
  const [blockEndHour, setBlockEndHour] = useState(18);
  const [blockLabel, setBlockLabel] = useState('Host Personal Vehicle Window');
  const [withdrawReason, setWithdrawReason] = useState('Scheduled facility maintenance');

  // Pricing edit state
  const [editPrice, setEditPrice] = useState<number>(activeSpace?.hourlyPriceInr || 45);
  const [editCutoffHour, setEditCutoffHour] = useState<number>(
    Math.floor((activeSpace?.hardDepartureMin || 21 * 60) / 60)
  );
  const [editRestrictions, setEditRestrictions] = useState(
    activeSpace?.restrictions.join(', ') || ''
  );

  // Incident & Host Scanner state
  const [incCategory, setIncCategory] = useState<IncidentRecord['category']>('vehicle_overstay');
  const [incSeverity, setIncSeverity] = useState<IncidentRecord['severity']>('medium');
  const [incDesc, setIncDesc] = useState('');
  const [scannerInput, setScannerInput] = useState('');
  const [scannerBusy, setScannerBusy] = useState(false);
  const [scannerFeedback, setScannerFeedback] = useState<string | null>(null);

  const ownFacIds = new Set(ownFacilities.map((f) => f.id));
  const ownBookings = bookings.filter((b) => ownFacIds.has(b.facilityId));
  
  const filteredOwnBookings = useMemo(() => {
    return ownBookings.filter((b) => {
      const q = bookingSearch.toLowerCase();
      const matchQ =
        !q ||
        b.id.toLowerCase().includes(q) ||
        b.driverName.toLowerCase().includes(q) ||
        (b.vehiclePlate && b.vehiclePlate.toLowerCase().includes(q)) ||
        b.spaceCode.toLowerCase().includes(q);
      const matchStatus =
        bookingStatusFilter === 'all' || b.status === bookingStatusFilter;
      return matchQ && matchStatus;
    });
  }, [ownBookings, bookingSearch, bookingStatusFilter]);

  const pendingExtensions = bookings.flatMap((bk) =>
    bk.extensionRequests
      .filter((r) => r.status === 'pending_host_approval')
      .map((req) => ({ bk, req }))
  );

  const ownSettlements = settlements.filter(
    (s) => !matchedProvider || s.providerId === matchedProvider.id
  );
  const totalNetEarnings = ownSettlements
    .filter((s) => s.status !== 'reversed')
    .reduce((sum, s) => sum + s.netPayoutInr, 0);

  const toggleVehicle = (type: VehicleType) => {
    setAllowedTypes((prev) =>
      prev.includes(type) ? (prev.length > 1 ? prev.filter((t) => t !== type) : prev) : [...prev, type]
    );
  };

  const downloadSettlementInvoice = (stl: HostSettlementRecord) => {
    const content = `PARKPOOL AI - HOST SETTLEMENT INVOICE
----------------------------------------
Settlement ID: ${stl.id}
Provider: ${stl.providerName}
Booking ID: ${stl.bookingId}
Gross Amount: ₹${stl.grossInr}
Platform Commission (10%): ₹${stl.platformCommissionInr}
Net Payout: ₹${stl.netPayoutInr}
Status: ${stl.status.toUpperCase()}
UTR Reference: ${stl.utrRef || 'PENDING'}
Settled At: ${stl.settledAt ? new Date(stl.settledAt).toLocaleString() : 'Pending'}
----------------------------------------
ParkPool Automated Clearing House Bengaluru`;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${stl.id}_settlement_invoice.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportBookingsCsv = () => {
    const headers = ['BookingID', 'SpaceCode', 'DriverName', 'VehiclePlate', 'Status', 'StartMin', 'EndMin', 'TotalInr'];
    const rows = ownBookings.map((b) => [
      b.id,
      b.spaceCode,
      `"${b.driverName}"`,
      b.vehiclePlate || 'N/A',
      b.status,
      b.startMin,
      b.endMin,
      b.totalAmountInr,
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `parkpool_host_bookings_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportSettlementsCsv = () => {
    const headers = ['SettlementID', 'BookingID', 'GrossInr', 'CommissionInr', 'NetPayoutInr', 'Status', 'UTR'];
    const rows = ownSettlements.map((s) => [
      s.id,
      s.bookingId,
      s.grossInr,
      s.platformCommissionInr,
      s.netPayoutInr,
      s.status,
      s.utrRef || 'N/A',
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `parkpool_host_settlements_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Provider Workspace Header & Sub-Tabs */}
      <section className="rounded-2xl border border-black/[0.08] bg-white/92 p-6 shadow-sm backdrop-blur-md">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-[#111827]">
              Provider Command Center
            </h1>
            <p className="mt-0.5 text-xs text-[#4B5563]">
              Manage facilities, driver assignments, dynamic calendar, verification evidence, and CSV exports.
            </p>
          </div>
          {matchedProvider && (
            <div className="flex items-center gap-2.5 rounded-xl border border-black/[0.08] bg-[#F8F7F4] px-4 py-2 text-xs">
              <span className="text-[#4B5563]">Verification:</span>
              <span
                className={`font-mono text-xs font-bold uppercase ${
                  matchedProvider.verificationStatus === 'APPROVED'
                    ? 'text-[#047857]'
                    : matchedProvider.verificationStatus === 'REJECTED' ||
                      matchedProvider.verificationStatus === 'SUSPENDED'
                    ? 'text-rose-700'
                    : 'text-[#C83709]'
                }`}
              >
                {matchedProvider.verificationStatus}
              </span>
            </div>
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-1.5 border-t border-black/[0.06] pt-4">
          {(
            [
              { id: 'onboarding', label: 'Onboarding & Evidence' },
              { id: 'facilities', label: 'Facility Management & Calendar' },
              {
                id: 'bookings',
                label: `Bookings & Extensions${
                  pendingExtensions.length > 0 ? ` (${pendingExtensions.length})` : ''
                }`,
              },
              { id: 'settlements', label: 'Settlements & CSV Export' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onChangeSubTab(t.id)}
              className={`whitespace-nowrap shrink-0 rounded-xl px-4 py-2 text-xs font-bold transition-colors ${
                subTab === t.id
                  ? 'bg-[#047857] text-white shadow-sm'
                  : 'bg-[#F3F2EE] text-[#374151] hover:bg-black/[0.06]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </section>

      {/* TAB 1: ONBOARDING & PRIVATE EVIDENCE */}
      {subTab === 'onboarding' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Provider Registration */}
          <section className="rounded-2xl border border-black/[0.08] bg-white/92 p-6 shadow-sm backdrop-blur-md lg:col-span-5">
            <h2 className="font-display text-lg font-bold text-[#111827]">
              1. Provider Registration
            </h2>
            <p className="mt-0.5 text-xs text-[#4B5563]">
              Initial registration starts as <span className="font-mono font-semibold">NOT_SUBMITTED</span>. Admin review grants approval.
            </p>

            {regSavedSuccess && (
              <div className="mt-3 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-bold text-[#047857]">
                ✓ Saved Successfully!
              </div>
            )}

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setRegBusy(true);
                try {
                  const res = await onRegisterProvider({
                    name: user.name,
                    contactName: user.name,
                    contactEmail: user.email,
                    contactPhone,
                    organizationName: orgName,
                    registrationNumber: regNo || undefined,
                    providerType: detailedType,
                  });
                  if (res) {
                    setRegSavedSuccess(true);
                    setOrgName('');
                    setContactPhone('');
                    setRegNo('');
                    setTimeout(() => setRegSavedSuccess(false), 4000);
                  }
                } finally {
                  setRegBusy(false);
                }
              }}
              className="mt-4 space-y-3.5"
            >
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#374151]">
                  Provider / Property Arrangement Type
                </label>
                <select
                  value={detailedType}
                  onChange={(e) => {
                    const nextType = e.target.value as DetailedProviderType;
                    setDetailedType(nextType);
                    const nextChecklist = evidenceChecklists[nextType];
                    if (nextChecklist?.[0]) setDocType(nextChecklist[0].docType);
                  }}
                  className="w-full rounded-xl border border-black/[0.1] bg-[#F8F7F4] px-3 py-2 text-sm text-[#111827]"
                >
                  {PROVIDER_TYPES.map((pt) => (
                    <option key={pt.id} value={pt.id}>
                      {pt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-[#374151]">
                  Organisation / Facility Entity Name
                </label>
                <input
                  type="text"
                  required
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="e.g., Brigade Gateway Bays"
                  className="w-full rounded-xl border border-black/[0.1] bg-[#F8F7F4] px-3.5 py-2 text-sm text-[#111827]"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#374151]">
                    Contact Phone
                  </label>
                  <input
                    type="text"
                    required
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    className="w-full rounded-xl border border-black/[0.1] bg-[#F8F7F4] px-3.5 py-2 text-sm text-[#111827]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#374151]">
                    Reg / Khata / RWA Ref
                  </label>
                  <input
                    type="text"
                    value={regNo}
                    onChange={(e) => setRegNo(e.target.value)}
                    placeholder="KA-BLR-2026-..."
                    className="w-full rounded-xl border border-black/[0.1] bg-[#F8F7F4] px-3.5 py-2 font-mono text-sm text-[#111827]"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={regBusy}
                className="w-full rounded-xl bg-[#047857] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#065F46] disabled:opacity-60"
              >
                {regBusy ? 'Saving...' : 'Save Provider Registration'}
              </button>
            </form>
          </section>

          {/* Status Tracker & Type-Specific Evidence Upload */}
          <section className="rounded-2xl border border-black/[0.08] bg-white/92 p-6 shadow-sm backdrop-blur-md lg:col-span-7">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-lg font-bold text-[#111827]">
                2. Verification Status &amp; Private Evidence Vault
              </h2>
              <span className="flex items-center gap-1 text-xs font-semibold text-[#4338CA]">
                <Lock className="h-3.5 w-3.5" />
                Private Storage
              </span>
            </div>

            {matchedProvider && (
              <>
                {/* Redone Verification Status Steps (Compact & Small) */}
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {VERIFICATION_STEPS.map((st) => {
                    const active = matchedProvider.verificationStatus === st;
                    return (
                      <span
                        key={st}
                        className={`rounded-md border px-2 py-1 font-mono text-[10px] font-bold uppercase transition-colors ${
                          active
                            ? st === 'APPROVED'
                              ? 'border-[#047857] bg-emerald-50 text-[#047857]'
                              : 'border-[#C83709] bg-[#FFF0EA] text-[#C83709]'
                            : 'border-black/[0.08] bg-[#F8F7F4] text-[#6B7280]'
                        }`}
                      >
                        {st.replace(/_/g, ' ')}
                      </span>
                    );
                  })}
                </div>

                {matchedProvider.decisionReason && (
                  <div className="mt-3 rounded-xl border border-black/[0.07] bg-[#F8F7F4] px-3.5 py-2.5 text-xs text-[#374151]">
                    <strong>Admin Note:</strong> {matchedProvider.decisionReason}
                  </div>
                )}

                <div className="mt-4">
                  <div className="text-xs font-bold text-[#111827]">
                    Required Evidence Checklist ({matchedProvider.providerType.replace('_', ' ')})
                  </div>
                  <div className="mt-2 space-y-2">
                    {checklist.map((req) => {
                      const uploaded = matchedProvider.documents.find(
                        (d) => d.docType === req.docType
                      );
                      return (
                        <div
                          key={req.docType}
                          className="flex items-center justify-between gap-3 rounded-xl border border-black/[0.06] bg-[#F8F7F4] px-3.5 py-2 text-xs"
                        >
                          <div>
                            <div className="font-semibold text-[#111827]">
                              {req.label} {req.required ? '(Required)' : '(Optional)'}
                            </div>
                            <div className="text-[11px] text-[#4B5563]">{req.description}</div>
                          </div>
                          {uploaded ? (
                            <span className="flex items-center gap-1 shrink-0 font-semibold text-[#047857]">
                              <FileCheck2 className="h-3.5 w-3.5" />
                              {uploaded.status}
                            </span>
                          ) : (
                            <span className="shrink-0 font-semibold text-[#C83709]">Pending</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setUploadBusy(true);
                    try {
                      await onUploadEvidence(matchedProvider.id, {
                        docType,
                        fileName,
                        contentText: docSummary,
                      });
                    } finally {
                      setUploadBusy(false);
                    }
                  }}
                  className="mt-4 space-y-3 border-t border-black/[0.06] pt-4"
                >
                  <div className="text-xs font-bold text-[#111827]">
                    Submit Verification Document to Private Object Vault
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <select
                      value={docType}
                      onChange={(e) => setDocType(e.target.value)}
                      className="rounded-xl border border-black/[0.1] bg-[#F8F7F4] px-3 py-2 text-xs text-[#111827]"
                    >
                      {checklist.map((c) => (
                        <option key={c.docType} value={c.docType}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      required
                      value={fileName}
                      onChange={(e) => setFileName(e.target.value)}
                      placeholder="document_filename.pdf"
                      className="rounded-xl border border-black/[0.1] bg-[#F8F7F4] px-3 py-2 font-mono text-xs text-[#111827]"
                    />
                  </div>
                  <textarea
                    rows={2}
                    required
                    value={docSummary}
                    onChange={(e) => setDocSummary(e.target.value)}
                    placeholder="Document details, folio/registration reference, signatory..."
                    className="w-full rounded-xl border border-black/[0.1] bg-[#F8F7F4] px-3.5 py-2 text-xs text-[#111827]"
                  />
                  <button
                    type="submit"
                    disabled={uploadBusy}
                    className="flex items-center gap-1.5 rounded-xl bg-[#111827] px-4 py-2 text-xs font-bold text-white hover:bg-black disabled:opacity-60"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    <span>{uploadBusy ? 'Uploading...' : 'Submit Evidence for Human Review'}</span>
                  </button>
                </form>
              </>
            )}
          </section>
        </div>
      )}

      {/* TAB 2: FACILITIES, EDIT/DELETE, DRIVER ASSIGNMENT & DYNAMIC CALENDAR */}
      {subTab === 'facilities' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Facility & Slot Listing Form */}
            <section className="rounded-2xl border border-black/[0.08] bg-white/92 p-6 shadow-sm backdrop-blur-md lg:col-span-5">
              <h2 className="font-display text-lg font-bold text-[#111827]">
                List New Facility &amp; Bay
              </h2>
              <p className="mt-0.5 text-xs text-[#4B5563]">
                New listings enter <span className="font-mono font-semibold">pending_approval</span> until Admin verification.
              </p>

              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!facName.trim() || !address.trim()) return;
                  setFacBusy(true);
                  try {
                    const loc = locations.find((l) => l.id === selectedLocId);
                    await onAddFacility({
                      providerId: matchedProvider?.id,
                      name: facName.trim(),
                      providerName: matchedProvider?.name || user.name,
                      providerType: matchedProvider?.legacyType || 'individual',
                      address: address.trim(),
                      zone: loc?.area || loc?.name,
                      lat: loc?.lat,
                      lng: loc?.lng,
                      entranceLabel: entranceLabel.trim() || 'Main Entrance',
                      walkingDistanceM: Number(walkingDistanceM) || 260,
                      hourlyPriceInr: Number(hourlyPriceInr) || 50,
                      covered,
                      evCharging,
                      allowedTypes,
                      hardDepartureMin,
                      restrictions: restrictionsText
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean),
                      accessInstructions,
                    });
                    setFacName('');
                  } finally {
                    setFacBusy(false);
                  }
                }}
                className="mt-4 space-y-3"
              >
                <input
                  type="text"
                  required
                  value={facName}
                  onChange={(e) => setFacName(e.target.value)}
                  placeholder="Facility Name (e.g., Hebbal Covered Bay)"
                  className="w-full rounded-xl border border-black/[0.1] bg-[#F8F7F4] px-3.5 py-2 text-sm text-[#111827]"
                />
                <select
                  value={selectedLocId}
                  onChange={(e) => setSelectedLocId(e.target.value)}
                  className="w-full rounded-xl border border-black/[0.1] bg-[#F8F7F4] px-3 py-2 text-sm text-[#111827]"
                >
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name} ({l.area})
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  required
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Street Address"
                  className="w-full rounded-xl border border-black/[0.1] bg-[#F8F7F4] px-3.5 py-2 text-sm text-[#111827]"
                />
                <div className="grid grid-cols-3 gap-2.5">
                  <input
                    type="text"
                    value={entranceLabel}
                    onChange={(e) => setEntranceLabel(e.target.value)}
                    placeholder="Entrance"
                    className="rounded-xl border border-black/[0.1] bg-[#F8F7F4] px-3 py-2 text-xs text-[#111827]"
                  />
                  <input
                    type="number"
                    min={50}
                    value={walkingDistanceM}
                    onChange={(e) => setWalkingDistanceM(Number(e.target.value))}
                    placeholder="Walk (m)"
                    className="rounded-xl border border-black/[0.1] bg-[#F8F7F4] px-3 py-2 font-mono text-xs text-[#111827]"
                  />
                  <input
                    type="number"
                    min={20}
                    value={hourlyPriceInr}
                    onChange={(e) => setHourlyPriceInr(Number(e.target.value))}
                    placeholder="₹/hr"
                    className="rounded-xl border border-black/[0.1] bg-[#F8F7F4] px-3 py-2 font-mono text-xs text-[#111827]"
                  />
                </div>
                <input
                  type="text"
                  required
                  value={accessInstructions}
                  onChange={(e) => setAccessInstructions(e.target.value)}
                  placeholder="Spot access instructions"
                  className="w-full rounded-xl border border-black/[0.1] bg-[#F8F7F4] px-3.5 py-2 text-xs text-[#111827]"
                />
                <input
                  type="text"
                  required
                  value={restrictionsText}
                  onChange={(e) => setRestrictionsText(e.target.value)}
                  placeholder="Restrictions (comma-separated)"
                  className="w-full rounded-xl border border-black/[0.1] bg-[#F8F7F4] px-3 py-2 text-xs text-[#111827]"
                />
                <div className="flex flex-wrap gap-1.5">
                  {VEHICLE_CHOICES.map((vc) => (
                    <button
                      key={vc.id}
                      type="button"
                      onClick={() => toggleVehicle(vc.id)}
                      className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
                        allowedTypes.includes(vc.id)
                          ? 'bg-[#111827] text-white'
                          : 'bg-[#F3F2EE] text-[#374151]'
                      }`}
                    >
                      {vc.label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-4 text-xs">
                  <label className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={covered}
                      onChange={(e) => setCovered(e.target.checked)}
                      className="accent-[#047857]"
                    />
                    Covered
                  </label>
                  <label className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={evCharging}
                      onChange={(e) => setEvCharging(e.target.checked)}
                      className="accent-[#047857]"
                    />
                    EV Charger
                  </label>
                  <select
                    value={hardDepartureMin}
                    onChange={(e) => setHardDepartureMin(Number(e.target.value))}
                    className="rounded-lg border border-black/[0.1] bg-[#F8F7F4] px-2 py-1 text-xs"
                  >
                    <option value={18 * 60}>Close 18:00</option>
                    <option value={20 * 60}>Close 20:00</option>
                    <option value={21 * 60}>Close 21:00</option>
                    <option value={22 * 60 + 30}>Close 22:30</option>
                  </select>
                </div>
                <button
                  type="submit"
                  disabled={facBusy}
                  className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#047857] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#065F46] disabled:opacity-60"
                >
                  <Plus className="h-4 w-4" />
                  <span>{facBusy ? 'Submitting...' : 'Submit Space for Approval'}</span>
                </button>
              </form>
            </section>

            {/* Dynamic Calendar & Owner-Use Blocks */}
            <section className="rounded-2xl border border-black/[0.08] bg-white/92 p-6 shadow-sm backdrop-blur-md lg:col-span-7">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-[#047857]" />
                  <h2 className="font-display text-lg font-bold text-[#111827]">
                    Dynamic Calendar &amp; Slot Blocks
                  </h2>
                </div>
                <select
                  value={activeSpace?.id || ''}
                  onChange={(e) => setSelectedSpaceId(e.target.value)}
                  className="rounded-xl border border-black/[0.1] bg-[#F8F7F4] px-3 py-1.5 text-xs font-bold text-[#111827]"
                >
                  {ownSpaces.map((sp) => (
                    <option key={sp.id} value={sp.id}>
                      {sp.spaceCode} ({sp.publicationStatus})
                    </option>
                  ))}
                </select>
              </div>

              {activeSpace && (
                <>
                  <div className="mt-4">
                    <div className="mb-2 flex flex-wrap items-center gap-4 text-[11px] text-[#4B5563]">
                      <span className="font-semibold text-[#047857]">Green: Open</span>
                      <span className="font-semibold text-[#4338CA]">Indigo: Booked</span>
                      <span className="font-semibold text-[#C83709]">Amber: Owner Block</span>
                    </div>
                    {/* Clickable Dynamic Calendar Hours */}
                    <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-9">
                      {HOURS.map((hr) => {
                        const slotStart = hr * 60;
                        const slotEnd = (hr + 1) * 60;
                        const isBooked = bookings.some(
                          (b) =>
                            b.spaceId === activeSpace.id &&
                            (b.status === 'held' || b.status === 'confirmed' || b.status === 'checked-in') &&
                            slotStart < b.endMin &&
                            slotEnd > b.startMin
                        );
                        const isOwner = activeSpace.ownerBlocks.some(
                          (ob) => slotStart < ob.endMin && slotEnd > ob.startMin
                        );
                        const cellStyle = isBooked
                          ? 'border-indigo-300 bg-indigo-50 text-[#4338CA]'
                          : isOwner
                          ? 'border-amber-300 bg-[#FFF0EA] text-[#C83709]'
                          : 'border-emerald-200 bg-emerald-50 text-[#047857]';

                        return (
                          <button
                            key={hr}
                            type="button"
                            onClick={() => {
                              setBlockStartHour(hr);
                              setBlockEndHour(hr + 1);
                            }}
                            className={`rounded-lg border p-2 text-center font-mono text-[11px] font-bold tabular-nums transition-transform hover:scale-105 ${cellStyle}`}
                            title="Click to select hours for owner block"
                          >
                            {String(hr).padStart(2, '0')}:00
                            <div className="mt-0.5 text-[10px] font-sans font-medium">
                              {isBooked ? 'Booked' : isOwner ? 'Owner' : 'Open'}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Owner Block Form */}
                  <div className="mt-5 grid grid-cols-1 gap-4 border-t border-black/[0.06] pt-4 sm:grid-cols-2">
                    <div className="space-y-2.5">
                      <div className="text-xs font-bold text-[#111827]">
                        Add Owner-Use Block ({blockStartHour}:00 - {blockEndHour}:00)
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          min={6}
                          max={22}
                          value={blockStartHour}
                          onChange={(e) => setBlockStartHour(Number(e.target.value))}
                          className="w-20 rounded-lg border border-black/[0.1] bg-[#F8F7F4] px-2.5 py-1.5 font-mono text-xs"
                        />
                        <span className="self-center text-xs text-[#4B5563]">to</span>
                        <input
                          type="number"
                          min={7}
                          max={23}
                          value={blockEndHour}
                          onChange={(e) => setBlockEndHour(Number(e.target.value))}
                          className="w-20 rounded-lg border border-black/[0.1] bg-[#F8F7F4] px-2.5 py-1.5 font-mono text-xs"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          void onAddOwnerBlock(activeSpace.id, {
                            startMin: blockStartHour * 60,
                            endMin: blockEndHour * 60,
                            label: blockLabel,
                          })
                        }
                        className="rounded-lg bg-[#111827] px-3.5 py-2 text-xs font-bold text-white hover:bg-black"
                      >
                        Block Selected Time
                      </button>
                    </div>

                    <div className="space-y-2.5">
                      <div className="text-xs font-bold text-[#111827]">
                        Pricing &amp; Rules ({activeSpace.spaceCode})
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          min={15}
                          value={editPrice}
                          onChange={(e) => setEditPrice(Number(e.target.value))}
                          className="w-24 rounded-lg border border-black/[0.1] bg-[#F8F7F4] px-2.5 py-1.5 font-mono text-xs"
                        />
                        <span className="self-center text-xs text-[#4B5563]">₹/hr</span>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          void onUpdateSpacePricing(activeSpace.id, {
                            hourlyPriceInr: editPrice,
                            hardDepartureMin: editCutoffHour * 60,
                            restrictions: activeSpace.restrictions,
                          })
                        }
                        className="rounded-lg bg-[#047857] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#065F46]"
                      >
                        Save Pricing
                      </button>
                    </div>
                  </div>
                </>
              )}
            </section>
          </div>

          {/* Facility Management: Edit, Delete & Assign Driver */}
          <section className="rounded-2xl border border-black/[0.08] bg-white/92 p-6 shadow-sm backdrop-blur-md">
            <h3 className="font-display text-base font-bold text-[#111827]">
              Facility Management &amp; Driver Assignment
            </h3>
            <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {ownFacilities.map((f) => {
                const sp = spaces.find((s) => s.facilityId === f.id);
                const assignedDriver = (f as any).assignedDriverEmail || '';
                const isEditing = editingFacilityId === f.id;

                return (
                  <div
                    key={f.id}
                    className="flex flex-col justify-between rounded-xl border border-black/[0.08] bg-[#F8F7F4] p-4 text-xs shadow-xs"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-display text-sm font-bold text-[#111827]">
                          {f.name}
                        </span>
                        <span className="font-mono text-[10px] font-bold text-[#047857] uppercase">
                          {sp?.publicationStatus || f.verificationStatus}
                        </span>
                      </div>
                      <div className="text-[#4B5563]">
                        {f.address} · Entrance: {f.entranceLabel}
                      </div>

                      {/* Driver Assignment Dropdown */}
                      <div className="pt-2 border-t border-black/[0.06]">
                        <label className="mb-1 block text-[11px] font-semibold text-[#374151]">
                          Assigned Driver User:
                        </label>
                        <select
                          value={assignedDriver}
                          onChange={(e) => void onAssignFacilityDriver(f.id, e.target.value)}
                          className="w-full rounded-lg border border-black/[0.1] bg-white px-2.5 py-1.5 text-xs text-[#111827]"
                        >
                          <option value="">-- Public Pool (Any Driver) --</option>
                          <option value={user.email}>{user.email} (You)</option>
                          <option value="anuak2628@gmail.com">anuak2628@gmail.com</option>
                        </select>
                      </div>

                      {isEditing && (
                        <div className="space-y-2 pt-2 border-t border-black/[0.06]">
                          <input
                            type="text"
                            value={editFacName}
                            onChange={(e) => setEditFacName(e.target.value)}
                            placeholder="Facility name"
                            className="w-full rounded-lg border border-black/[0.1] bg-white px-2.5 py-1.5 text-xs"
                          />
                          <input
                            type="text"
                            value={editFacAddress}
                            onChange={(e) => setEditFacAddress(e.target.value)}
                            placeholder="Address"
                            className="w-full rounded-lg border border-black/[0.1] bg-white px-2.5 py-1.5 text-xs"
                          />
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                void onUpdateFacility(f.id, {
                                  name: editFacName,
                                  address: editFacAddress,
                                });
                                setEditingFacilityId(null);
                              }}
                              className="rounded-lg bg-[#047857] px-3 py-1 font-bold text-white"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingFacilityId(null)}
                              className="rounded-lg border border-black/[0.1] bg-white px-3 py-1 font-semibold"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {!isEditing && (
                      <div className="mt-4 flex items-center justify-between gap-2 border-t border-black/[0.06] pt-3">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingFacilityId(f.id);
                            setEditFacName(f.name);
                            setEditFacAddress(f.address);
                            setEditEntranceLabel(f.entranceLabel);
                          }}
                          className="rounded-lg border border-black/[0.1] bg-white px-3 py-1.5 font-semibold text-[#111827] hover:bg-black/[0.05]"
                        >
                          Edit Facility
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`Delete facility ${f.name}?`)) {
                              void onDeleteFacility(f.id);
                            }
                          }}
                          className="flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 font-semibold text-rose-700 hover:bg-rose-100"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>Delete</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      )}

      {/* TAB 3: BOOKINGS, SEARCH & FILTER, CANCELLATION & HOST SCANNER */}
      {subTab === 'bookings' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Host Scanner Terminal */}
            <section className="rounded-2xl border border-black/[0.08] bg-white/92 p-6 shadow-sm backdrop-blur-md lg:col-span-5">
              <div className="flex items-center gap-2 font-display text-lg font-bold text-[#111827]">
                <ScanLine className="h-5 w-5 text-[#047857]" />
                <h2>Single Host Entry Scanner</h2>
              </div>
              <p className="mt-0.5 text-xs text-[#4B5563]">
                Scan arriving driver QR pass or Spot Access PIN to verify and check-in.
              </p>

              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!scannerInput.trim()) return;
                  setScannerBusy(true);
                  setScannerFeedback(null);
                  try {
                    const res = await onHostScanDriverQr({ scannedInput: scannerInput });
                    if (res.ok) {
                      setScannerFeedback('Verified! Booking checked in and bay marked OCCUPIED.');
                      setScannerInput('');
                    } else {
                      setScannerFeedback(res.error || 'Verification failed.');
                    }
                  } finally {
                    setScannerBusy(false);
                  }
                }}
                className="mt-4 space-y-2.5"
              >
                <input
                  type="text"
                  value={scannerInput}
                  onChange={(e) => setScannerInput(e.target.value)}
                  placeholder="Paste QR token, Spot Access PIN (PKP-...), or Booking ID"
                  className="w-full rounded-xl border border-black/[0.1] bg-[#F8F7F4] px-3.5 py-2 font-mono text-xs text-[#111827]"
                />
                <button
                  type="submit"
                  disabled={scannerBusy || !scannerInput.trim()}
                  className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#047857] px-4 py-2 text-xs font-bold text-white hover:bg-[#065F46] disabled:opacity-50"
                >
                  <QrCode className="h-4 w-4" />
                  <span>{scannerBusy ? 'Verifying...' : 'Verify Driver QR &amp; Check In'}</span>
                </button>
              </form>

              {scannerFeedback && (
                <div className="mt-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-950">
                  {scannerFeedback}
                </div>
              )}
            </section>

            {/* Bookings Search & Filter + List with Cancellation */}
            <section className="rounded-2xl border border-black/[0.08] bg-white/92 p-6 shadow-sm backdrop-blur-md lg:col-span-7">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-display text-lg font-bold text-[#111827]">
                  Facility Bookings ({filteredOwnBookings.length})
                </h2>
                <button
                  type="button"
                  onClick={exportBookingsCsv}
                  className="flex items-center gap-1.5 rounded-xl border border-black/[0.08] bg-[#F8F7F4] px-3 py-1.5 text-xs font-semibold text-[#111827] hover:bg-black/[0.04]"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Export Bookings CSV</span>
                </button>
              </div>

              {/* Search & Filter Bar */}
              <div className="mt-4 flex flex-wrap items-center gap-2.5">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#9CA3AF]" />
                  <input
                    type="text"
                    value={bookingSearch}
                    onChange={(e) => setBookingSearch(e.target.value)}
                    placeholder="Search by driver name, vehicle, or space..."
                    className="w-full rounded-xl border border-black/[0.1] bg-[#F8F7F4] py-2 pl-9 pr-3 text-xs text-[#111827]"
                  />
                </div>
                <select
                  value={bookingStatusFilter}
                  onChange={(e) => setBookingStatusFilter(e.target.value as any)}
                  className="rounded-xl border border-black/[0.1] bg-[#F8F7F4] px-3 py-2 text-xs font-semibold text-[#111827]"
                >
                  <option value="all">All Statuses</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="checked-in">Checked-In</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              <div className="mt-4 max-h-96 space-y-3 overflow-y-auto">
                {filteredOwnBookings.length === 0 ? (
                  <div className="rounded-xl border border-black/[0.06] bg-[#F8F7F4] p-4 text-xs text-[#4B5563]">
                    No bookings matching criteria.
                  </div>
                ) : (
                  filteredOwnBookings.map((bk) => (
                    <div
                      key={bk.id}
                      className="rounded-xl border border-black/[0.07] bg-[#F8F7F4] p-3.5 text-xs"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-mono font-bold text-[#111827]">
                          {bk.id} · {bk.spaceCode}
                        </span>
                        <span className="font-semibold capitalize text-[#047857]">
                          {bk.status} · ₹{bk.totalAmountInr}
                        </span>
                      </div>
                      <div className="mt-1 text-[#374151]">
                        Driver: <strong>{bk.driverName}</strong> ({bk.vehicleLabel}) ·{' '}
                        <span className="font-mono">
                          {fmt(bk.startMin)}–{fmt(bk.endMin)}
                        </span>
                      </div>

                      {bk.status !== 'cancelled' && bk.status !== 'completed' && (
                        <div className="mt-2.5 flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              const reason = window.prompt('Reason for cancelling booking:', 'Host schedule adjustment');
                              if (reason) {
                                void onCancelBookingHost(bk.id, reason);
                              }
                            }}
                            className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1 font-bold text-rose-700 hover:bg-rose-100"
                          >
                            Cancel &amp; Refund Driver
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        </div>
      )}

      {/* TAB 4: SETTLEMENTS, CSV EXPORT & SETTLEMENT PDF DOWNLOAD */}
      {subTab === 'settlements' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <section className="rounded-2xl border border-black/[0.08] bg-white/92 p-6 shadow-sm backdrop-blur-md lg:col-span-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 font-display text-lg font-bold text-[#111827]">
                <IndianRupee className="h-5 w-5 text-[#047857]" />
                <span>Earnings &amp; Settlement Documents</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={exportSettlementsCsv}
                  className="flex items-center gap-1.5 rounded-xl border border-black/[0.08] bg-[#F8F7F4] px-3 py-1.5 text-xs font-semibold text-[#111827] hover:bg-black/[0.04]"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Export CSV</span>
                </button>
                <div className="font-mono text-lg font-extrabold tabular-nums text-[#047857]">
                  Net ₹{totalNetEarnings}
                </div>
              </div>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-black/[0.08] text-[#4B5563]">
                  <tr>
                    <th className="py-2 pr-3">Settlement</th>
                    <th className="py-2 pr-3">Booking</th>
                    <th className="py-2 pr-3 text-right">Gross</th>
                    <th className="py-2 pr-3 text-right">Net Payout</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 text-right">Invoice</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.06]">
                  {ownSettlements.map((st) => (
                    <tr key={st.id}>
                      <td className="py-3 pr-3 font-mono font-bold text-[#111827]">{st.id}</td>
                      <td className="py-3 pr-3 font-mono text-[#374151]">{st.bookingId}</td>
                      <td className="py-3 pr-3 text-right font-mono tabular-nums">₹{st.grossInr}</td>
                      <td className="py-3 pr-3 text-right font-mono font-bold tabular-nums text-[#047857]">
                        ₹{st.netPayoutInr}
                      </td>
                      <td className="py-3 pr-3 capitalize">
                        {st.status.replace('_', ' ')}
                      </td>
                      <td className="py-3 text-right">
                        <button
                          type="button"
                          onClick={() => downloadSettlementInvoice(st)}
                          className="inline-flex items-center gap-1 rounded-lg border border-black/[0.1] bg-white px-2.5 py-1 font-semibold text-[#111827] hover:bg-black/[0.04]"
                        >
                          <FileText className="h-3.5 w-3.5 text-[#047857]" />
                          <span>Download</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-2xl border border-black/[0.08] bg-white/92 p-6 shadow-sm backdrop-blur-md lg:col-span-4">
            <div className="flex items-center gap-2 font-display text-lg font-bold text-[#111827]">
              <AlertTriangle className="h-4 w-4 text-[#C83709]" />
              <span>Incident Report</span>
            </div>
            <p className="mt-0.5 text-xs text-[#4B5563]">
              Report overstays or facility obstacles.
            </p>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!incDesc.trim()) return;
                await onSubmitIncident({
                  facilityId: ownFacilities[0]?.id,
                  category: incCategory,
                  severity: incSeverity,
                  description: incDesc,
                });
                setIncDesc('');
              }}
              className="mt-4 space-y-3"
            >
              <select
                value={incCategory}
                onChange={(e) => setIncCategory(e.target.value as IncidentRecord['category'])}
                className="w-full rounded-xl border border-black/[0.1] bg-[#F8F7F4] px-3 py-2 text-xs"
              >
                <option value="vehicle_overstay">Vehicle Overstay</option>
                <option value="access_blocked">Spot Access Blocked</option>
                <option value="safety_hazard">Safety Hazard</option>
                <option value="other">Other</option>
              </select>
              <textarea
                rows={3}
                required
                value={incDesc}
                onChange={(e) => setIncDesc(e.target.value)}
                placeholder="Describe issue..."
                className="w-full rounded-xl border border-black/[0.1] bg-[#F8F7F4] px-3.5 py-2 text-xs"
              />
              <button
                type="submit"
                className="w-full rounded-xl bg-[#111827] px-4 py-2 text-xs font-bold text-white hover:bg-black"
              >
                Submit Incident
              </button>
            </form>
          </section>
        </div>
      )}
    </div>
  );
};
