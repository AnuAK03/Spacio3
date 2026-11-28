import React, { useMemo, useState } from 'react';
import {
  Buildings,
  Calendar as CalendarIcon,
  CaretLeft,
  CaretRight,
  Check,
  CheckCircle,
  Clock,
  CurrencyInr,
  DownloadSimple,
  Eye,
  FileText,
  LockSimple,
  MagnifyingGlass,
  PencilSimple,
  Plus,
  QrCode,
  Scan,
  SealCheck,
  Trash,
  UploadSimple,
  UserCheck,
  Warning,
  X,
  XCircle,
} from '@phosphor-icons/react';
import {
  AutonomousLifecycleEvent,
  BengaluruLocation,
  BookingRecord,
  DetailedProviderType,
  DriverProfile,
  EvidenceRequirement,
  Facility,
  HostSettlementRecord,
  IncidentRecord,
  ParkingSpace,
  ProviderRecord,
  ProviderType,
  ProviderVerificationStatus,
  UserSession,
  VehicleProfile,
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
  driverProfiles?: DriverProfile[];
  vehicles?: VehicleProfile[];
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
    payload: { startMin: number; endMin: number; label: string; date?: string }
  ) => Promise<void>;
  onWithdrawAvailability: (
    spaceId: string,
    payload: { startMin: number; endMin: number; reason: string; date?: string }
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

const VERIFICATION_STEPS: Array<{
  id: ProviderVerificationStatus;
  shortLabel: string;
}> = [
  { id: 'NOT_SUBMITTED', shortLabel: 'Not Submitted' },
  { id: 'SUBMITTED', shortLabel: 'Submitted' },
  { id: 'UNDER_REVIEW', shortLabel: 'Under Review' },
  { id: 'NEEDS_MORE_INFORMATION', shortLabel: 'Needs Info' },
  { id: 'APPROVED', shortLabel: 'Approved' },
];

const VEHICLE_CHOICES: Array<{ id: VehicleType; label: string }> = [
  { id: 'two_wheeler', label: '2 Wheeler' },
  { id: 'hatchback', label: 'Hatchback' },
  { id: 'sedan', label: 'Sedan' },
  { id: 'suv', label: 'SUV' },
];

const HOURS = Array.from({ length: 18 }, (_, i) => i + 6); // 06:00 to 23:00
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function fmt(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function statusPillLabel(status: ProviderVerificationStatus): string {
  switch (status) {
    case 'NOT_SUBMITTED':
      return 'Not Submitted';
    case 'SUBMITTED':
      return 'Submitted';
    case 'UNDER_REVIEW':
      return 'Under Review';
    case 'NEEDS_MORE_INFORMATION':
      return 'Needs Info';
    case 'APPROVED':
      return 'Approved';
    case 'REJECTED':
      return 'Rejected';
    case 'SUSPENDED':
      return 'Suspended';
    case 'EXPIRED':
      return 'Expired';
    default:
      return status;
  }
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
  driverProfiles = [],
  vehicles = [],
  onRegisterProvider,
  onUploadEvidence,
  onAddFacility,
  onUpdateSpacePricing,
  onAddOwnerBlock,
  onWithdrawAvailability,
  onDecideExtension,
  onReportOverstay,
  onHostScanDriverQr,
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
      providers.find(
        (p) => p.contactEmail.toLowerCase() === user.email.toLowerCase()
      ) || null,
    [providers, user.email]
  );

  // Registration state — starts pre-populated on first load if not just saved, clears cleanly after Save
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
  const [regSavedMessage, setRegSavedMessage] = useState<string | null>(null);

  // Evidence verification state
  const checklist = evidenceChecklists[matchedProvider?.providerType || detailedType] || [];
  const [docType, setDocType] = useState<string>(checklist[0]?.docType || 'ownership_title');
  const [fileName, setFileName] = useState('');
  const [docSummary, setDocSummary] = useState('');
  const [uploadBusy, setUploadBusy] = useState(false);
  const [evidenceSavedNote, setEvidenceSavedNote] = useState<string | null>(null);

  // Owned facilities & spaces (strictly scoped to logged-in provider)
  const ownFacilities = useMemo(() => {
    if (!matchedProvider) return [];
    return facilities.filter((f) => f.providerId === matchedProvider.id);
  }, [facilities, matchedProvider]);

  const ownSpaces = useMemo(() => {
    const ids = new Set(ownFacilities.map((f) => f.id));
    return spaces.filter((s) => ids.has(s.facilityId));
  }, [spaces, ownFacilities]);

  // Add Facility Drawer Modal
  const [showAddFacilityModal, setShowAddFacilityModal] = useState(false);
  const [facName, setFacName] = useState('');
  const [selectedLocId, setSelectedLocId] = useState(locations[0]?.id || 'LOC-PHX');
  const [address, setAddress] = useState('');
  const [entranceLabel, setEntranceLabel] = useState('Main Spot Entrance');
  const [accessInstructions, setAccessInstructions] = useState(
    'Scan booking QR or enter Spot Access PIN at keypad; park in designated bay.'
  );
  const [restrictionsText, setRestrictionsText] = useState(
    'Max height 210cm, No overnight stay past closing time'
  );
  const [walkingDistanceM, setWalkingDistanceM] = useState(240);
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

  // Facility Edit Modal & Inline Delete / Driver Assign
  const [editingFacilityId, setEditingFacilityId] = useState<string | null>(null);
  const [editFacName, setEditFacName] = useState('');
  const [editFacAddress, setEditFacAddress] = useState('');
  const [editFacZone, setEditFacZone] = useState('');
  const [editEntranceLabel, setEditEntranceLabel] = useState('');
  const [editAccessInstructions, setEditAccessInstructions] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [customAssignFacilityId, setCustomAssignFacilityId] = useState<string | null>(null);
  const [customDriverEmail, setCustomDriverEmail] = useState('');

  // Dynamic Calendar State (clickable month grid + clicked date hours)
  const todayStr = useMemo(() => toIsoDate(new Date()), []);
  const [calMonth, setCalMonth] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDateStr, setSelectedDateStr] = useState<string>(todayStr);
  const [selectedSpaceId, setSelectedSpaceId] = useState<string>(
    () => ownSpaces[0]?.id || ''
  );
  const activeSpace =
    ownSpaces.find((s) => s.id === selectedSpaceId) || ownSpaces[0];

  const [calendarActionMode, setCalendarActionMode] = useState<'owner_block' | 'withdraw'>(
    'owner_block'
  );
  const [blockStartHour, setBlockStartHour] = useState(14);
  const [blockEndHour, setBlockEndHour] = useState(16);
  const [blockLabel, setBlockLabel] = useState('Host Personal Vehicle');
  const [withdrawReason, setWithdrawReason] = useState('Scheduled bay maintenance');
  const [calendarBusy, setCalendarBusy] = useState(false);

  // Space Pricing inline editor
  const [editPrice, setEditPrice] = useState<number>(activeSpace?.hourlyPriceInr || 45);
  const [editCutoffHour, setEditCutoffHour] = useState<number>(
    Math.floor((activeSpace?.hardDepartureMin || 21 * 60) / 60)
  );

  // Bookings Search, Filter & Inline Cancel (no window.prompt!)
  const [bookingSearch, setBookingSearch] = useState('');
  const [bookingStatusFilter, setBookingStatusFilter] = useState<
    'all' | 'held' | 'confirmed' | 'checked-in' | 'completed' | 'cancelled'
  >('all');
  const [bookingFacilityFilter, setBookingFacilityFilter] = useState<string>('all');
  const [cancellingBookingId, setCancellingBookingId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('Host schedule adjustment');
  const [cancelBusy, setCancelBusy] = useState(false);

  // Entry Scanner
  const [scannerInput, setScannerInput] = useState('');
  const [scannerBusy, setScannerBusy] = useState(false);
  const [scannerFeedback, setScannerFeedback] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  // Settlements Preview Modal & Incidents
  const [previewSettlement, setPreviewSettlement] = useState<HostSettlementRecord | null>(null);
  const [incCategory, setIncCategory] = useState<IncidentRecord['category']>('vehicle_overstay');
  const [incSeverity, setIncSeverity] = useState<IncidentRecord['severity']>('medium');
  const [incDesc, setIncDesc] = useState('');

  // Compile available driver choices from profiles, existing bookings, vehicles, and already-assigned emails
  const driverOptions = useMemo(() => {
    const map = new Map<string, { email: string; label: string }>();
    for (const dp of driverProfiles) {
      map.set(dp.email.toLowerCase(), {
        email: dp.email,
        label: `${dp.fullName} (${dp.email})`,
      });
    }
    for (const v of vehicles) {
      if (v.ownerEmail && !map.has(v.ownerEmail.toLowerCase())) {
        map.set(v.ownerEmail.toLowerCase(), {
          email: v.ownerEmail,
          label: `${v.label} Owner (${v.ownerEmail})`,
        });
      }
    }
    for (const bk of bookings) {
      if (bk.driverEmail && !map.has(bk.driverEmail.toLowerCase())) {
        map.set(bk.driverEmail.toLowerCase(), {
          email: bk.driverEmail,
          label: `${bk.driverName} (${bk.driverEmail})`,
        });
      }
    }
    for (const fac of ownFacilities) {
      if (fac.assignedDriverEmail && !map.has(fac.assignedDriverEmail.toLowerCase())) {
        map.set(fac.assignedDriverEmail.toLowerCase(), {
          email: fac.assignedDriverEmail,
          label: fac.assignedDriverEmail,
        });
      }
    }
    if (!map.has('anuak2628@gmail.com')) {
      map.set('anuak2628@gmail.com', {
        email: 'anuak2628@gmail.com',
        label: 'Ananya Kumar (anuak2628@gmail.com)',
      });
    }
    return Array.from(map.values());
  }, [driverProfiles, vehicles, bookings, ownFacilities]);

  const ownFacIds = useMemo(() => new Set(ownFacilities.map((f) => f.id)), [ownFacilities]);
  const ownBookings = useMemo(
    () => bookings.filter((b) => ownFacIds.has(b.facilityId)),
    [bookings, ownFacIds]
  );

  const filteredOwnBookings = useMemo(() => {
    const q = bookingSearch.trim().toLowerCase();
    return ownBookings.filter((b) => {
      const matchQ =
        !q ||
        b.id.toLowerCase().includes(q) ||
        b.driverName.toLowerCase().includes(q) ||
        (b.driverEmail && b.driverEmail.toLowerCase().includes(q)) ||
        (b.vehiclePlate && b.vehiclePlate.toLowerCase().includes(q)) ||
        b.facilityName.toLowerCase().includes(q) ||
        b.spaceCode.toLowerCase().includes(q);
      const matchStatus = bookingStatusFilter === 'all' || b.status === bookingStatusFilter;
      const matchFac = bookingFacilityFilter === 'all' || b.facilityId === bookingFacilityFilter;
      return matchQ && matchStatus && matchFac;
    });
  }, [ownBookings, bookingSearch, bookingStatusFilter, bookingFacilityFilter]);

  const pendingExtensions = useMemo(
    () =>
      ownBookings.flatMap((bk) =>
        bk.extensionRequests
          .filter((r) => r.status === 'pending_host_approval')
          .map((req) => ({ bk, req }))
      ),
    [ownBookings]
  );

  const ownSettlements = useMemo(
    () =>
      matchedProvider
        ? settlements.filter((s) => s.providerId === matchedProvider.id)
        : [],
    [settlements, matchedProvider]
  );

  const totalNetEarnings = useMemo(
    () =>
      ownSettlements
        .filter((s) => s.status !== 'reversed')
        .reduce((sum, s) => sum + s.netPayoutInr, 0),
    [ownSettlements]
  );

  const activeBookingsCount = useMemo(
    () =>
      ownBookings.filter(
        (b) => b.status === 'held' || b.status === 'confirmed' || b.status === 'checked-in' || b.status === 'occupied'
      ).length,
    [ownBookings]
  );

  // Build month days for clickable dynamic calendar
  const calendarDays = useMemo(() => {
    const year = calMonth.getFullYear();
    const month = calMonth.getMonth();
    const firstWeekday = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();
    const cells: Array<{ dateStr: string; dayNum: number } | null> = [];
    for (let i = 0; i < firstWeekday; i += 1) cells.push(null);
    for (let d = 1; d <= totalDays; d += 1) {
      cells.push({
        dateStr: toIsoDate(new Date(year, month, d)),
        dayNum: d,
      });
    }
    return cells;
  }, [calMonth]);

  const getDateActivity = (dateStr: string) => {
    if (!activeSpace) return { bookingCount: 0, blockCount: 0, withdrawalCount: 0 };
    const bookingCount = bookings.filter(
      (b) =>
        b.spaceId === activeSpace.id &&
        b.createdAt.slice(0, 10) === dateStr &&
        (b.status === 'held' || b.status === 'confirmed' || b.status === 'checked-in' || b.status === 'occupied')
    ).length;
    const blockCount = activeSpace.ownerBlocks.filter(
      (ob) => ob.date === dateStr || (!ob.date && dateStr === todayStr)
    ).length;
    const withdrawalCount = activeSpace.withdrawals.filter(
      (wd) => wd.date === dateStr || (!wd.date && dateStr === todayStr)
    ).length;
    return { bookingCount, blockCount, withdrawalCount };
  };

  const selectedDateBookings = useMemo(() => {
    if (!activeSpace) return [];
    return bookings.filter(
      (b) =>
        b.spaceId === activeSpace.id &&
        b.createdAt.slice(0, 10) === selectedDateStr &&
        (b.status === 'held' || b.status === 'confirmed' || b.status === 'checked-in' || b.status === 'occupied')
    );
  }, [activeSpace, bookings, selectedDateStr]);

  const selectedDateBlocks = useMemo(() => {
    if (!activeSpace) return [];
    return activeSpace.ownerBlocks.filter(
      (ob) => ob.date === selectedDateStr || (!ob.date && selectedDateStr === todayStr)
    );
  }, [activeSpace, selectedDateStr, todayStr]);

  const selectedDateWithdrawals = useMemo(() => {
    if (!activeSpace) return [];
    return activeSpace.withdrawals.filter(
      (wd) => wd.date === selectedDateStr || (!wd.date && selectedDateStr === todayStr)
    );
  }, [activeSpace, selectedDateStr, todayStr]);

  const toggleVehicle = (type: VehicleType) => {
    setAllowedTypes((prev) =>
      prev.includes(type) ? (prev.length > 1 ? prev.filter((t) => t !== type) : prev) : [...prev, type]
    );
  };

  const downloadSettlementDocument = (stl: HostSettlementRecord, format: 'html' | 'txt' = 'html') => {
    const settledStr = stl.settledAt ? new Date(stl.settledAt).toLocaleString() : 'Scheduled';
    if (format === 'txt') {
      const content = `SPACIO — SETTLEMENT STATEMENT
========================================
Settlement ID: ${stl.id}
Provider:      ${stl.providerName}
Facility:      ${stl.facilityName}
Booking Ref:   ${stl.bookingId}
Gross Amount:  ₹${stl.grossInr}
Commission:    -₹${stl.platformCommissionInr}
GST Withheld:  -₹${stl.gstWithheldInr}
Net Payout:    ₹${stl.netPayoutInr}
Status:        ${stl.status.toUpperCase()}
UTR Reference: ${stl.utrRef || 'PENDING'}
Date:          ${settledStr}
========================================`;
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${stl.id}_settlement_statement.txt`;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }

    const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Settlement Statement ${stl.id}</title>
<style>
  body { font-family: system-ui, -apple-system, sans-serif; color: #111827; padding: 36px; max-width: 680px; margin: 0 auto; background: #fff; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .meta { color: #4B5563; font-size: 13px; margin-bottom: 24px; }
  table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 14px; }
  th, td { text-align: left; padding: 10px 0; border-bottom: 1px solid #E5E7EB; }
  td.num { text-align: right; font-variant-numeric: tabular-nums; font-family: monospace; }
  .total td { font-weight: 700; font-size: 16px; border-top: 2px solid #111827; border-bottom: none; padding-top: 14px; color: #047857; }
</style></head><body>
  <h1>Spacio Settlement Statement</h1>
  <div class="meta">Statement ID: <strong>${stl.id}</strong> · UTR: ${stl.utrRef || 'PENDING'} · ${settledStr}</div>
  <table>
    <tr><th>Provider</th><td>${stl.providerName}</td></tr>
    <tr><th>Facility</th><td>${stl.facilityName}</td></tr>
    <tr><th>Booking Reference</th><td>${stl.bookingId}</td></tr>
    <tr><th>Status</th><td>${stl.status.replace(/_/g, ' ').toUpperCase()}</td></tr>
    <tr><th>Gross Parking Collected</th><td class="num">₹${stl.grossInr.toFixed(2)}</td></tr>
    <tr><th>Platform Fee</th><td class="num">-₹${stl.platformCommissionInr.toFixed(2)}</td></tr>
    <tr><th>GST Withheld</th><td class="num">-₹${stl.gstWithheldInr.toFixed(2)}</td></tr>
    <tr class="total"><td>Net Provider Payout</td><td class="num">₹${stl.netPayoutInr.toFixed(2)}</td></tr>
  </table>
</body></html>`;
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${stl.id}_settlement_statement.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportBookingsCsv = () => {
    const headers = [
      'BookingID',
      'Date',
      'Facility',
      'SpaceCode',
      'DriverName',
      'DriverEmail',
      'VehiclePlate',
      'Status',
      'Window',
      'TotalInr',
    ];
    const rows = filteredOwnBookings.map((b) => [
      b.id,
      b.createdAt.slice(0, 10),
      `"${b.facilityName.replace(/"/g, '""')}"`,
      b.spaceCode,
      `"${b.driverName.replace(/"/g, '""')}"`,
      b.driverEmail || '',
      b.vehiclePlate || 'N/A',
      b.status,
      `${fmt(b.startMin)}-${fmt(b.endMin)}`,
      b.totalAmountInr,
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `spacio_bookings_${toIsoDate(new Date())}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportSettlementsCsv = () => {
    const headers = [
      'SettlementID',
      'BookingID',
      'Facility',
      'GrossInr',
      'CommissionInr',
      'GstWithheldInr',
      'NetPayoutInr',
      'Status',
      'UTR',
      'SettledAt',
    ];
    const rows = ownSettlements.map((s) => [
      s.id,
      s.bookingId,
      `"${s.facilityName.replace(/"/g, '""')}"`,
      s.grossInr,
      s.platformCommissionInr,
      s.gstWithheldInr,
      s.netPayoutInr,
      s.status,
      s.utrRef || 'PENDING',
      s.settledAt || '',
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `spacio_settlements_${toIsoDate(new Date())}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const verificationTone = (status?: ProviderVerificationStatus) => {
    if (status === 'APPROVED') return 'border-emerald-200 bg-emerald-50 text-[#047857]';
    if (status === 'REJECTED' || status === 'SUSPENDED')
      return 'border-rose-200 bg-rose-50 text-rose-700';
    if (status === 'UNDER_REVIEW' || status === 'SUBMITTED')
      return 'border-indigo-200 bg-indigo-50 text-[#4338CA]';
    return 'border-amber-200 bg-amber-50 text-[#C83709]';
  };

  const navItems: Array<{
    id: 'onboarding' | 'facilities' | 'bookings' | 'settlements';
    label: string;
    icon: React.FC<{ className?: string; weight?: 'regular' | 'bold' | 'fill' }>;
    badge?: number;
  }> = [
    { id: 'onboarding', label: 'Onboarding & Evidence', icon: SealCheck },
    { id: 'facilities', label: 'Facilities & Calendar', icon: CalendarIcon },
    {
      id: 'bookings',
      label: 'Bookings & Entry',
      icon: Scan,
      badge: pendingExtensions.length > 0 ? pendingExtensions.length : undefined,
    },
    { id: 'settlements', label: 'Settlements & Docs', icon: CurrencyInr },
  ];

  const editingFacility = editingFacilityId
    ? ownFacilities.find((f) => f.id === editingFacilityId)
    : null;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[248px_1fr] lg:items-start">
      {/* LEFT COMMAND RAIL */}
      <aside className="rounded-2xl border border-black/[0.08] bg-white p-4 space-y-3 lg:sticky lg:top-20">
        <div className="rounded-xl border border-black/[0.06] bg-[#F8F7F4] p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate title-4 text-[#111827]">
                {matchedProvider?.organizationName || user.organization || 'Host Workspace'}
              </div>
              <div className="truncate caption-5 text-[#6B7280]">{user.email}</div>
            </div>
          </div>

          {matchedProvider && (
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="caption-5 text-[#6B7280]">Status</span>
              <span
                className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 caption-3 ${verificationTone(
                  matchedProvider.verificationStatus
                )}`}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                {statusPillLabel(matchedProvider.verificationStatus)}
              </span>
            </div>
          )}
        </div>

        <nav className="flex flex-col gap-1" aria-label="Provider sections">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = subTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onChangeSubTab(item.id)}
                className={`flex items-center justify-between gap-2 whitespace-nowrap rounded-xl px-3 py-2 text-left button-xsm transition-colors duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.98] ${
                  active
                    ? 'bg-[#047857] text-white'
                    : 'text-[#374151] hover:bg-[#F3F2EE] hover:text-[#111827]'
                }`}
              >
                <span className="flex items-center gap-2 min-w-0">
                  <Icon className="h-4 w-4 shrink-0" weight="bold" />
                  <span className="truncate">{item.label}</span>
                </span>
                {item.badge !== undefined && (
                  <span
                    className={`rounded-md px-2 py-0.5 font-mono caption-3 tabular-nums ${
                      active ? 'bg-white/20 text-white' : 'bg-[#FFF0EA] text-[#C83709]'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="space-y-2 pt-1">
          <button
            type="button"
            onClick={() => {
              onChangeSubTab('facilities');
              setShowAddFacilityModal(true);
            }}
            className="flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-[#111827] px-3 py-2 button-xsm text-white transition-colors duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-black active:scale-[0.98]"
          >
            <Plus className="h-3.5 w-3.5" weight="bold" />
            <span>Add Facility</span>
          </button>
          <button
            type="button"
            onClick={exportBookingsCsv}
            className="flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-black/[0.1] bg-[#F8F7F4] px-3 py-2 button-xsm text-[#111827] transition-colors duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-black/[0.04] active:scale-[0.98]"
          >
            <DownloadSimple className="h-3.5 w-3.5 text-[#047857]" weight="bold" />
            <span>Quick CSV Export</span>
          </button>
        </div>
      </aside>

      {/* MAIN INTERACTIVE WORKSPACE */}
      <div className="space-y-4 min-w-0">
        {/* Interactive Metric Summary Ribbon */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <button
            type="button"
            onClick={() => onChangeSubTab('facilities')}
            className={`group rounded-2xl border bg-white p-4 text-left transition-colors duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.98] ${
              subTab === 'facilities'
                ? 'border-[#047857]'
                : 'border-black/[0.08] hover:border-black/[0.2]'
            }`}
          >
            <div className="flex items-center justify-between caption-4 text-[#6B7280]">
              <span>Facilities</span>
              <Buildings className="h-4 w-4 text-[#047857]" weight="bold" />
            </div>
            <div className="mt-2 font-mono heading-5 tabular-nums text-[#111827]">
              {ownFacilities.length}
            </div>
            <div className="mt-1 caption-5 text-[#6B7280]">
              {ownSpaces.length} bays active
            </div>
          </button>

          <button
            type="button"
            onClick={() => onChangeSubTab('bookings')}
            className={`group rounded-2xl border bg-white p-4 text-left transition-colors duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.98] ${
              subTab === 'bookings'
                ? 'border-[#047857]'
                : 'border-black/[0.08] hover:border-black/[0.2]'
            }`}
          >
            <div className="flex items-center justify-between caption-4 text-[#6B7280]">
              <span>Active Bookings</span>
              <Clock className="h-4 w-4 text-[#4338CA]" weight="bold" />
            </div>
            <div className="mt-2 font-mono heading-5 tabular-nums text-[#111827]">
              {activeBookingsCount}
            </div>
            <div className="mt-1 caption-5 text-[#6B7280]">
              {ownBookings.length} total recorded
            </div>
          </button>

          <button
            type="button"
            onClick={() => onChangeSubTab('bookings')}
            className="group rounded-2xl border border-black/[0.08] bg-white p-4 text-left transition-colors duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:border-black/[0.2] active:scale-[0.98]"
          >
            <div className="flex items-center justify-between caption-4 text-[#6B7280]">
              <span>Pending Requests</span>
              <Scan className="h-4 w-4 text-[#C83709]" weight="bold" />
            </div>
            <div className="mt-2 font-mono heading-5 tabular-nums text-[#C83709]">
              {pendingExtensions.length}
            </div>
            <div className="mt-1 caption-5 text-[#6B7280]">
              Extensions &amp; check ins
            </div>
          </button>

          <button
            type="button"
            onClick={() => onChangeSubTab('settlements')}
            className={`group rounded-2xl border bg-white p-4 text-left transition-colors duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.98] ${
              subTab === 'settlements'
                ? 'border-[#047857]'
                : 'border-black/[0.08] hover:border-black/[0.2]'
            }`}
          >
            <div className="flex items-center justify-between caption-4 text-[#6B7280]">
              <span>Net Earnings</span>
              <CurrencyInr className="h-4 w-4 text-[#047857]" weight="bold" />
            </div>
            <div className="mt-2 font-mono heading-5 tabular-nums text-[#047857]">
              ₹{totalNetEarnings}
            </div>
            <div className="mt-1 caption-5 text-[#6B7280]">
              {ownSettlements.length} statements
            </div>
          </button>
        </div>

        {/* ================================================================ */}
        {/* TAB 1: ONBOARDING & EVIDENCE VERIFICATION                        */}
        {/* ================================================================ */}
        {subTab === 'onboarding' && (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
            {/* Provider Registration */}
            <section className="rounded-2xl border border-black/[0.08] bg-white p-6 xl:col-span-5">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="title-3 text-[#111827]">
                    Provider Registration
                  </h2>
                  <p className="mt-1 caption-5 text-[#6B7280]">
                    Save organisation and registration details for verification.
                  </p>
                </div>
              </div>

              {regSavedMessage && (
                <div
                  role="status"
                  className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 caption-3 text-[#047857]"
                >
                  <span className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 shrink-0" weight="fill" />
                    <span>{regSavedMessage}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setRegSavedMessage(null)}
                    className="caption-4 underline"
                  >
                    Dismiss
                  </button>
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
                      setRegSavedMessage(`Saved (${res.organizationName})`);
                      setOrgName('');
                      setContactPhone('');
                      setRegNo('');
                    }
                  } finally {
                    setRegBusy(false);
                  }
                }}
                className="mt-4 space-y-3"
              >
                <div>
                  <label className="mb-1 block caption-3 text-[#374151]">
                    Property / Operator Type
                  </label>
                  <select
                    value={detailedType}
                    onChange={(e) => {
                      const nextType = e.target.value as DetailedProviderType;
                      setDetailedType(nextType);
                      const nextChecklist = evidenceChecklists[nextType];
                      if (nextChecklist?.[0]) setDocType(nextChecklist[0].docType);
                    }}
                    className="w-full rounded-xl border border-black/[0.1] bg-[#F8F7F4] px-3 py-2 caption-5 text-[#111827] focus:border-[#047857] focus:bg-white focus:outline-none"
                  >
                    {PROVIDER_TYPES.map((pt) => (
                      <option key={pt.id} value={pt.id}>
                        {pt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block caption-3 text-[#374151]">
                    Organisation / Facility Entity Name
                  </label>
                  <input
                    type="text"
                    required
                    value={orgName}
                    onChange={(e) => {
                      setOrgName(e.target.value);
                      if (regSavedMessage) setRegSavedMessage(null);
                    }}
                    placeholder="Enter organisation or property name"
                    className="w-full rounded-xl border border-black/[0.1] bg-[#F8F7F4] px-3 py-2 caption-5 text-[#111827] focus:border-[#047857] focus:bg-white focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block caption-3 text-[#374151]">
                      Contact Phone
                    </label>
                    <input
                      type="text"
                      required
                      value={contactPhone}
                      onChange={(e) => {
                        setContactPhone(e.target.value);
                        if (regSavedMessage) setRegSavedMessage(null);
                      }}
                      placeholder="+91 98..."
                      className="w-full rounded-xl border border-black/[0.1] bg-[#F8F7F4] px-3 py-2 caption-5 text-[#111827] focus:border-[#047857] focus:bg-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block caption-3 text-[#374151]">
                      Reg / Khata / RWA Ref
                    </label>
                    <input
                      type="text"
                      value={regNo}
                      onChange={(e) => {
                        setRegNo(e.target.value);
                        if (regSavedMessage) setRegSavedMessage(null);
                      }}
                      placeholder="KA BLR 2026..."
                      className="w-full rounded-xl border border-black/[0.1] bg-[#F8F7F4] px-3 py-2 font-mono caption-5 text-[#111827] focus:border-[#047857] focus:bg-white focus:outline-none"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={regBusy}
                  className="w-full rounded-xl bg-[#047857] px-4 py-2 button-xsm text-white transition-colors duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-[#065F46] active:scale-[0.98] disabled:opacity-60"
                >
                  {regBusy ? 'Saving...' : 'Save Registration'}
                </button>
              </form>
            </section>

            {/* Verification Status Stepper (Compact & Small) + Evidence Verification */}
            <section className="rounded-2xl border border-black/[0.08] bg-white p-6 xl:col-span-7">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="title-3 text-[#111827]">
                    Verification Status &amp; Evidence
                  </h2>
                  <p className="mt-1 caption-5 text-[#6B7280]">
                    Select a checklist item below to attach supporting property evidence.
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 caption-4 text-[#4338CA]">
                  <LockSimple className="h-3.5 w-3.5" weight="bold" />
                  Private Vault
                </span>
              </div>

              {!matchedProvider ? (
                <div className="mt-4 rounded-xl border border-dashed border-black/[0.12] bg-[#FAF9F6] p-4 caption-5 text-[#6B7280]">
                  Save your Provider Registration details on the left first to initialize your account, view verification status, and upload private evidence documents.
                </div>
              ) : (
                <>
                  {/* Compact Mini Verification Stepper */}
                  <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-black/[0.06] bg-[#FAF9F6] px-3 py-2">
                    {VERIFICATION_STEPS.map((st, idx) => {
                      const active = matchedProvider.verificationStatus === st.id;
                      const currentIdx = VERIFICATION_STEPS.findIndex(
                        (s) => s.id === matchedProvider.verificationStatus
                      );
                      const completed = currentIdx > idx && currentIdx !== -1;
                      return (
                        <React.Fragment key={st.id}>
                          <span
                            className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 caption-3 transition-colors duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                              active
                                ? st.id === 'APPROVED'
                                  ? 'bg-[#047857] text-white'
                                  : 'bg-[#C83709] text-white'
                                : completed
                                ? 'text-[#047857]'
                                : 'text-[#6B7280]'
                            }`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                active
                                  ? 'bg-white'
                                  : completed
                                  ? 'bg-[#047857]'
                                  : 'bg-[#D1D5DB]'
                              }`}
                            />
                            {st.shortLabel}
                          </span>
                          {idx < VERIFICATION_STEPS.length - 1 && (
                            <span className="caption-5 text-[#D1D5DB]">/</span>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </div>

                  {matchedProvider.decisionReason && (
                    <div className="mt-3 rounded-xl border border-black/[0.07] bg-[#F8F7F4] px-3 py-2 caption-5 text-[#374151]">
                      <strong className="caption-3">Reviewer Note:</strong> {matchedProvider.decisionReason}
                    </div>
                  )}

                  {/* Interactive Evidence Checklist */}
                  <div className="mt-4 space-y-2">
                    {checklist.map((req) => {
                      const uploaded = matchedProvider.documents.find(
                        (d) => d.docType === req.docType
                      );
                      const isSelected = docType === req.docType;
                      return (
                        <button
                          key={req.docType}
                          type="button"
                          onClick={() => setDocType(req.docType)}
                          className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left caption-5 transition-colors duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                            isSelected
                              ? 'border-[#047857] bg-emerald-50/40'
                              : 'border-black/[0.06] bg-[#FAF9F6] hover:border-black/[0.15]'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="caption-3 text-[#111827]">
                              {req.label}{' '}
                              <span className="caption-5 text-[#6B7280]">
                                {req.required ? '· Required' : '· Optional'}
                              </span>
                            </div>
                            <div className="truncate caption-5 text-[#6B7280]">
                              {req.description}
                            </div>
                          </div>
                          {uploaded ? (
                            <span className="inline-flex shrink-0 items-center gap-1 caption-3 text-[#047857]">
                              <SealCheck className="h-3.5 w-3.5" weight="bold" />
                              <span className="capitalize">{uploaded.status}</span>
                            </span>
                          ) : (
                            <span className="shrink-0 caption-3 text-[#C83709]">Upload</span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Evidence Upload Form */}
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (!fileName.trim() || !docSummary.trim()) return;
                      setUploadBusy(true);
                      setEvidenceSavedNote(null);
                      try {
                        await onUploadEvidence(matchedProvider.id, {
                          docType,
                          fileName: fileName.trim(),
                          contentText: docSummary.trim(),
                        });
                        setEvidenceSavedNote(`Submitted "${fileName.trim()}" for review.`);
                        setFileName('');
                        setDocSummary('');
                      } finally {
                        setUploadBusy(false);
                      }
                    }}
                    className="mt-4 rounded-xl border border-black/[0.06] bg-[#FAF9F6] p-4 space-y-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="caption-3 text-[#111827]">
                        Attach Verification Document
                      </span>
                      <label className="cursor-pointer rounded-lg border border-black/[0.1] bg-white px-3 py-1 button-xsm text-[#111827] transition-colors duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-black/[0.05]">
                        <span>Choose File</span>
                        <input
                          type="file"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (!f) return;
                            setFileName(f.name);
                            if (!docSummary.trim()) {
                              setDocSummary(
                                `Uploaded ${f.name} (${Math.max(1, Math.round(f.size / 1024))} KB) for ${docType} verification.`
                              );
                            }
                          }}
                        />
                      </label>
                    </div>

                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <select
                        value={docType}
                        onChange={(e) => setDocType(e.target.value)}
                        className="rounded-xl border border-black/[0.1] bg-white px-3 py-2 caption-5 text-[#111827]"
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
                        placeholder="e.g., khata_certificate_2026.pdf"
                        className="rounded-xl border border-black/[0.1] bg-white px-3 py-2 font-mono caption-5 text-[#111827]"
                      />
                    </div>
                    <textarea
                      rows={2}
                      required
                      value={docSummary}
                      onChange={(e) => setDocSummary(e.target.value)}
                      placeholder="Reference ID, signatory name, or property folio summary..."
                      className="w-full rounded-xl border border-black/[0.1] bg-white px-3 py-2 caption-5 text-[#111827]"
                    />
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <button
                        type="submit"
                        disabled={uploadBusy || !fileName.trim() || !docSummary.trim()}
                        className="inline-flex items-center gap-2 rounded-xl bg-[#111827] px-4 py-2 button-xsm text-white transition-colors duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-black active:scale-[0.98] disabled:opacity-50"
                      >
                        <UploadSimple className="h-3.5 w-3.5" weight="bold" />
                        <span>{uploadBusy ? 'Submitting...' : 'Submit Evidence'}</span>
                      </button>
                      {evidenceSavedNote && (
                        <span className="caption-3 text-[#047857]">
                          {evidenceSavedNote}
                        </span>
                      )}
                    </div>
                  </form>

                  {/* Submitted Evidence Log */}
                  {matchedProvider.documents.length > 0 && (
                    <div className="mt-4 rounded-xl border border-black/[0.06] bg-[#FAF9F6] p-3">
                      <div className="mb-2 caption-4 text-[#6B7280]">
                        Submitted Documents ({matchedProvider.documents.length})
                      </div>
                      <div className="space-y-2">
                        {matchedProvider.documents.map((doc) => (
                          <div
                            key={doc.id}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-black/[0.05] bg-white px-3 py-2 caption-5"
                          >
                            <span className="font-mono caption-4 text-[#111827]">
                              {doc.fileName}
                            </span>
                            <span className="text-[#6B7280]">
                              {new Date(doc.uploadedAt).toLocaleDateString()} ·{' '}
                              <strong className="capitalize caption-3 text-[#047857]">{doc.status}</strong>
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </section>
          </div>
        )}

        {/* ================================================================ */}
        {/* TAB 2: FACILITY MANAGEMENT, DRIVER ASSIGNMENT & DYNAMIC CALENDAR */}
        {/* ================================================================ */}
        {subTab === 'facilities' && (
          <div className="space-y-4">
            {/* Top Facility Strip + Add Trigger */}
            <section className="rounded-2xl border border-black/[0.08] bg-white p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="title-3 text-[#111827]">
                    Facility Management &amp; Driver Assignment
                  </h2>
                  <p className="mt-1 caption-5 text-[#6B7280]">
                    Edit or remove facilities, assign specific drivers, or click a bay to inspect its calendar.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddFacilityModal(true)}
                  className="inline-flex items-center gap-2 whitespace-nowrap rounded-xl bg-[#047857] px-3 py-2 button-xsm text-white transition-colors duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-[#065F46] active:scale-[0.98]"
                >
                  <Plus className="h-3.5 w-3.5" weight="bold" />
                  <span>Add Facility</span>
                </button>
              </div>

              {ownFacilities.length === 0 ? (
                <div className="mt-4 rounded-xl border border-dashed border-black/[0.12] bg-[#FAF9F6] p-6 text-center caption-5 text-[#6B7280]">
                  No facilities listed under your provider account yet. Click <strong className="caption-3 text-[#111827]">Add Facility</strong> above to list your first parking bay.
                </div>
              ) : (
                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {ownFacilities.map((f) => {
                    const facSpaces = spaces.filter((s) => s.facilityId === f.id);
                    const primarySpace = facSpaces[0];
                    const isFocused = primarySpace && activeSpace?.id === primarySpace.id;
                    const assignedEmail = f.assignedDriverEmail || '';
                    const showCustomInput = customAssignFacilityId === f.id;

                    return (
                      <div
                        key={f.id}
                        className={`flex flex-col justify-between gap-3 rounded-xl border p-4 caption-5 transition-colors duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                          isFocused
                            ? 'border-[#047857] bg-emerald-50/25'
                            : 'border-black/[0.08] bg-[#FAF9F6]'
                        }`}
                      >
                        <div className="space-y-3">
                          <div className="space-y-1">
                            <div className="flex items-start justify-between gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  if (primarySpace) {
                                    setSelectedSpaceId(primarySpace.id);
                                    setEditPrice(primarySpace.hourlyPriceInr);
                                    setEditCutoffHour(Math.floor(primarySpace.hardDepartureMin / 60));
                                  }
                                }}
                                className="text-left title-4 text-[#111827] transition-colors duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:text-[#047857]"
                              >
                                {f.name}
                              </button>
                              <span className="shrink-0 font-mono caption-3 uppercase text-[#047857]">
                                {primarySpace?.publicationStatus.replace('_', ' ') || f.verificationStatus}
                              </span>
                            </div>

                            <div className="caption-5 text-[#4B5563]">
                              {f.address} · <span className="caption-4 text-[#111827]">{f.zone}</span>
                            </div>
                            <div className="flex items-center justify-between caption-5 text-[#6B7280]">
                              <span>Entrance: {f.entranceLabel}</span>
                              {primarySpace && (
                                <span className="font-mono caption-3 tabular-nums text-[#111827]">
                                  ₹{primarySpace.hourlyPriceInr}/hr
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Driver Assignment */}
                          <div className="rounded-lg border border-black/[0.06] bg-white p-3">
                            <label className="mb-1 flex items-center gap-1 caption-3 text-[#374151]">
                              <UserCheck className="h-3.5 w-3.5 text-[#4338CA]" weight="bold" />
                              <span>Assigned Driver</span>
                            </label>
                            <select
                              value={showCustomInput ? '__custom__' : assignedEmail}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val === '__custom__') {
                                  setCustomAssignFacilityId(f.id);
                                  setCustomDriverEmail(assignedEmail);
                                } else {
                                  setCustomAssignFacilityId(null);
                                  void onAssignFacilityDriver(f.id, val || undefined);
                                }
                              }}
                              className="w-full rounded-lg border border-black/[0.1] bg-[#FAF9F6] px-2 py-1 caption-5 text-[#111827]"
                            >
                              <option value="">Open Pool (Any Registered Driver)</option>
                              {driverOptions.map((opt) => (
                                <option key={opt.email} value={opt.email}>
                                  {opt.label}
                                </option>
                              ))}
                              <option value="__custom__">Assign by custom email...</option>
                            </select>

                            {showCustomInput && (
                              <div className="mt-2 flex items-center gap-2">
                                <input
                                  type="email"
                                  value={customDriverEmail}
                                  onChange={(e) => setCustomDriverEmail(e.target.value)}
                                  placeholder="driver@email.com"
                                  className="flex-1 rounded-lg border border-black/[0.1] bg-white px-2 py-1 caption-5"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    void onAssignFacilityDriver(
                                      f.id,
                                      customDriverEmail.trim() || undefined
                                    );
                                    setCustomAssignFacilityId(null);
                                  }}
                                  className="rounded-lg bg-[#047857] px-3 py-1 button-xsm text-white transition-colors duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.98]"
                                >
                                  Assign
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setCustomAssignFacilityId(null)}
                                  aria-label="Cancel driver assignment"
                                  className="rounded-lg border border-black/[0.1] bg-white px-2 py-1 text-[#374151]"
                                >
                                  <X className="h-3.5 w-3.5" weight="bold" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Edit & Inline Delete Controls */}
                        <div className="flex items-center justify-between gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingFacilityId(f.id);
                              setEditFacName(f.name);
                              setEditFacAddress(f.address);
                              setEditFacZone(f.zone);
                              setEditEntranceLabel(f.entranceLabel);
                              setEditAccessInstructions(f.accessInstructions);
                            }}
                            className="inline-flex items-center gap-1 rounded-lg border border-black/[0.1] bg-white px-3 py-1 button-xsm text-[#111827] transition-colors duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-black/[0.04] active:scale-[0.98]"
                          >
                            <PencilSimple className="h-3.5 w-3.5" weight="bold" />
                            <span>Edit</span>
                          </button>

                          {confirmDeleteId === f.id ? (
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  void onDeleteFacility(f.id);
                                  setConfirmDeleteId(null);
                                }}
                                className="rounded-lg bg-rose-600 px-3 py-1 button-xsm text-white transition-colors duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-rose-700 active:scale-[0.98]"
                              >
                                Confirm Delete
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                className="rounded-lg border border-black/[0.1] bg-white px-2 py-1 button-xsm text-[#374151]"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(f.id)}
                              className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1 button-xsm text-rose-700 transition-colors duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-rose-100 active:scale-[0.98]"
                            >
                              <Trash className="h-3.5 w-3.5" weight="bold" />
                              <span>Delete</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Interactive Dynamic Calendar (Clickable Dates + Hour Grid + Blocks/Withdrawals) */}
            <section className="rounded-2xl border border-black/[0.08] bg-white p-6">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-black/[0.06] bg-[#FAF9F6] p-3">
                <div className="flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4 text-[#047857]" weight="bold" />
                  <div>
                    <h2 className="title-3 text-[#111827]">
                      Dynamic Calendar &amp; Bay Availability
                    </h2>
                    <p className="caption-5 text-[#6B7280]">
                      Click any date on the calendar to view bookings and set owner blocks or withdrawals.
                    </p>
                  </div>
                </div>
                <select
                  value={activeSpace?.id || ''}
                  onChange={(e) => {
                    const next = ownSpaces.find((s) => s.id === e.target.value);
                    setSelectedSpaceId(e.target.value);
                    if (next) {
                      setEditPrice(next.hourlyPriceInr);
                      setEditCutoffHour(Math.floor(next.hardDepartureMin / 60));
                    }
                  }}
                  className="rounded-xl border border-black/[0.1] bg-white px-3 py-2 button-xsm text-[#111827]"
                >
                  {ownSpaces.map((sp) => {
                    const fac = ownFacilities.find((f) => f.id === sp.facilityId);
                    return (
                      <option key={sp.id} value={sp.id}>
                        {fac ? `${fac.name} · ` : ''}
                        {sp.spaceCode}
                      </option>
                    );
                  })}
                </select>
              </div>

              {!activeSpace ? (
                <div className="mt-4 rounded-xl border border-dashed border-black/[0.12] bg-[#FAF9F6] p-6 text-center caption-5 text-[#6B7280]">
                  Add a facility above to view its bay calendar, adjust hourly rates, and schedule owner blocks.
                </div>
              ) : (
                <div className="mt-4 grid grid-cols-1 gap-6 xl:grid-cols-12">
                  {/* Left: Interactive Clickable Month Grid */}
                  <div className="xl:col-span-5">
                    <div className="flex items-center justify-between mb-3">
                      <span className="title-4 text-[#111827]">
                        {MONTH_NAMES[calMonth.getMonth()]} {calMonth.getFullYear()}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            setCalMonth(
                              new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1)
                            )
                          }
                          aria-label="Previous month"
                          className="rounded-lg border border-black/[0.08] p-1 text-[#374151] transition-colors duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-black/[0.04]"
                        >
                          <CaretLeft className="h-4 w-4" weight="bold" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const now = new Date();
                            setCalMonth(new Date(now.getFullYear(), now.getMonth(), 1));
                            setSelectedDateStr(todayStr);
                          }}
                          className="rounded-lg border border-black/[0.08] px-2 py-1 button-xsm text-[#111827] transition-colors duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-black/[0.04]"
                        >
                          Today
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setCalMonth(
                              new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1)
                            )
                          }
                          aria-label="Next month"
                          className="rounded-lg border border-black/[0.08] p-1 text-[#374151] transition-colors duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-black/[0.04]"
                        >
                          <CaretRight className="h-4 w-4" weight="bold" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-7 gap-1 text-center caption-3 text-[#6B7280] mb-1">
                      {WEEKDAYS.map((w) => (
                        <div key={w} className="py-1">
                          {w}
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-7 gap-1">
                      {calendarDays.map((cell, idx) => {
                        if (!cell) {
                          return <div key={`empty-${idx}`} className="h-10" />;
                        }
                        const isSelected = selectedDateStr === cell.dateStr;
                        const isToday = todayStr === cell.dateStr;
                        const act = getDateActivity(cell.dateStr);

                        return (
                          <button
                            key={cell.dateStr}
                            type="button"
                            onClick={() => setSelectedDateStr(cell.dateStr)}
                            className={`flex h-11 flex-col items-center justify-center rounded-xl border font-mono caption-4 tabular-nums transition-colors duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.98] ${
                              isSelected
                                ? 'border-[#047857] bg-[#047857] caption-3 text-white'
                                : isToday
                                ? 'border-[#C83709] bg-[#FFF5F0] caption-3 text-[#111827]'
                                : 'border-black/[0.06] bg-[#FAF9F6] text-[#111827] hover:border-black/[0.2]'
                            }`}
                          >
                            <span>{cell.dayNum}</span>
                            <div className="mt-0.5 flex items-center gap-0.5">
                              {act.bookingCount > 0 && (
                                <span
                                  className={`h-1 w-1 rounded-full ${
                                    isSelected ? 'bg-white' : 'bg-[#4338CA]'
                                  }`}
                                />
                              )}
                              {act.blockCount > 0 && (
                                <span
                                  className={`h-1 w-1 rounded-full ${
                                    isSelected ? 'bg-amber-200' : 'bg-[#C83709]'
                                  }`}
                                />
                              )}
                              {act.withdrawalCount > 0 && (
                                <span
                                  className={`h-1 w-1 rounded-full ${
                                    isSelected ? 'bg-rose-200' : 'bg-rose-600'
                                  }`}
                                />
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-3 caption-5 text-[#6B7280]">
                      <span className="flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-[#4338CA]" />
                        Bookings
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-[#C83709]" />
                        Owner Block
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-rose-600" />
                        Withdrawn
                      </span>
                    </div>
                  </div>

                  {/* Right: Selected Date Hourly Schedule & Controls */}
                  <div className="xl:col-span-7 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="title-4 text-[#111827]">
                          Schedule for {selectedDateStr}
                          {selectedDateStr === todayStr ? ' (Today)' : ''}
                        </div>
                        <div className="caption-5 text-[#6B7280]">
                          Click any hour slot to prefill a schedule window for {activeSpace.spaceCode}.
                        </div>
                      </div>
                      <span className="font-mono caption-3 tabular-nums text-[#047857]">
                        ₹{activeSpace.hourlyPriceInr}/hr
                      </span>
                    </div>

                    {/* Hourly Interactive Grid */}
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                      {HOURS.map((hr) => {
                        const slotStart = hr * 60;
                        const slotEnd = (hr + 1) * 60;
                        const isBooked = selectedDateBookings.some(
                          (b) => slotStart < b.endMin && slotEnd > b.startMin
                        );
                        const isOwner = selectedDateBlocks.some(
                          (ob) => slotStart < ob.endMin && slotEnd > ob.startMin
                        );
                        const isWithdrawn = selectedDateWithdrawals.some(
                          (wd) => slotStart < wd.endMin && slotEnd > wd.startMin
                        );
                        const inSelection = hr >= blockStartHour && hr < blockEndHour;

                        const cellTone = isWithdrawn
                          ? 'border-rose-200 bg-rose-50 text-rose-700'
                          : isBooked
                          ? 'border-indigo-200 bg-indigo-50 text-[#4338CA]'
                          : isOwner
                          ? 'border-amber-200 bg-[#FFF5F0] text-[#C83709]'
                          : inSelection
                          ? 'border-[#047857] bg-[#047857] text-white'
                          : 'border-emerald-200 bg-emerald-50/70 text-[#047857] hover:border-[#047857]';

                        return (
                          <button
                            key={hr}
                            type="button"
                            onClick={() => {
                              setBlockStartHour(hr);
                              setBlockEndHour(Math.min(23, hr + 2));
                            }}
                            className={`rounded-lg border px-2 py-2 text-center font-mono caption-3 tabular-nums transition-colors duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.98] ${cellTone}`}
                          >
                            {String(hr).padStart(2, '0')}:00
                            <div className="mt-0.5 font-sans caption-4">
                              {isWithdrawn
                                ? 'Withdrawn'
                                : isBooked
                                ? 'Booked'
                                : isOwner
                                ? 'Owner'
                                : 'Open'}
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {/* Schedule Action Mode Bar */}
                    <div className="rounded-xl border border-black/[0.08] bg-[#FAF9F6] p-4 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="inline-flex rounded-lg border border-black/[0.08] bg-white p-0.5">
                          <button
                            type="button"
                            onClick={() => setCalendarActionMode('owner_block')}
                            className={`rounded-md px-3 py-1 button-xsm transition-colors duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                              calendarActionMode === 'owner_block'
                                ? 'bg-[#111827] text-white'
                                : 'text-[#4B5563]'
                            }`}
                          >
                            Owner Block
                          </button>
                          <button
                            type="button"
                            onClick={() => setCalendarActionMode('withdraw')}
                            className={`rounded-md px-3 py-1 button-xsm transition-colors duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                              calendarActionMode === 'withdraw'
                                ? 'bg-[#C83709] text-white'
                                : 'text-[#4B5563]'
                            }`}
                          >
                            Withdraw Slot
                          </button>
                        </div>

                        <div className="flex items-center gap-2 caption-5">
                          <input
                            type="number"
                            min={6}
                            max={22}
                            value={blockStartHour}
                            onChange={(e) => setBlockStartHour(Number(e.target.value))}
                            className="w-16 rounded-lg border border-black/[0.1] bg-white px-2 py-1 font-mono caption-5"
                          />
                          <span className="text-[#6B7280]">to</span>
                          <input
                            type="number"
                            min={7}
                            max={23}
                            value={blockEndHour}
                            onChange={(e) => setBlockEndHour(Number(e.target.value))}
                            className="w-16 rounded-lg border border-black/[0.1] bg-white px-2 py-1 font-mono caption-5"
                          />
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 sm:flex-row">
                        <input
                          type="text"
                          value={
                            calendarActionMode === 'owner_block' ? blockLabel : withdrawReason
                          }
                          onChange={(e) =>
                            calendarActionMode === 'owner_block'
                              ? setBlockLabel(e.target.value)
                              : setWithdrawReason(e.target.value)
                          }
                          placeholder={
                            calendarActionMode === 'owner_block'
                              ? 'Block reason (e.g. Owner Personal Vehicle)'
                              : 'Withdrawal reason (e.g. Maintenance)'
                          }
                          className="flex-1 rounded-xl border border-black/[0.1] bg-white px-3 py-2 caption-5 text-[#111827]"
                        />
                        <button
                          type="button"
                          disabled={calendarBusy}
                          onClick={async () => {
                            setCalendarBusy(true);
                            try {
                              if (calendarActionMode === 'owner_block') {
                                await onAddOwnerBlock(activeSpace.id, {
                                  startMin: blockStartHour * 60,
                                  endMin: blockEndHour * 60,
                                  label: blockLabel,
                                  date: selectedDateStr,
                                });
                              } else {
                                await onWithdrawAvailability(activeSpace.id, {
                                  startMin: blockStartHour * 60,
                                  endMin: blockEndHour * 60,
                                  reason: withdrawReason,
                                  date: selectedDateStr,
                                });
                              }
                            } finally {
                              setCalendarBusy(false);
                            }
                          }}
                          className={`whitespace-nowrap rounded-xl px-4 py-2 button-xsm text-white transition-colors duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.98] disabled:opacity-50 ${
                            calendarActionMode === 'owner_block'
                              ? 'bg-[#111827] hover:bg-black'
                              : 'bg-[#C83709] hover:brightness-110'
                          }`}
                        >
                          {calendarBusy
                            ? 'Applying...'
                            : calendarActionMode === 'owner_block'
                            ? `Block ${selectedDateStr}`
                            : `Withdraw ${selectedDateStr}`}
                        </button>
                      </div>

                      {/* Quick Pricing Adjustment */}
                      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-black/[0.06] bg-white p-3 caption-5">
                        <div className="flex items-center gap-2">
                          <span className="caption-3 text-[#374151]">Hourly Rate:</span>
                          <input
                            type="number"
                            min={15}
                            value={editPrice}
                            onChange={(e) => setEditPrice(Number(e.target.value))}
                            className="w-20 rounded-lg border border-black/[0.1] bg-[#FAF9F6] px-2 py-1 font-mono caption-5"
                          />
                          <span className="text-[#6B7280]">₹/hr</span>
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
                          className="rounded-lg border border-[#047857] px-3 py-1 button-xsm text-[#047857] transition-colors duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-emerald-50 active:scale-[0.98]"
                        >
                          Update Rate
                        </button>
                      </div>
                    </div>

                    {/* Active Blocks & Bookings on Selected Date */}
                    {(selectedDateBlocks.length > 0 ||
                      selectedDateWithdrawals.length > 0 ||
                      selectedDateBookings.length > 0) && (
                      <div className="space-y-2 caption-5">
                        {selectedDateBookings.map((b) => (
                          <div
                            key={b.id}
                            className="flex items-center justify-between rounded-lg border border-indigo-200/70 bg-indigo-50/50 px-3 py-2"
                          >
                            <span className="caption-4 text-[#111827]">
                              {b.driverName} · <span className="font-mono">{b.id}</span>
                            </span>
                            <span className="font-mono caption-3 tabular-nums text-[#4338CA]">
                              {fmt(b.startMin)} to {fmt(b.endMin)}
                            </span>
                          </div>
                        ))}
                        {selectedDateBlocks.map((ob) => (
                          <div
                            key={ob.id}
                            className="flex items-center justify-between rounded-lg border border-amber-200/70 bg-[#FFF5F0] px-3 py-2"
                          >
                            <span className="caption-4 text-[#9A3412]">{ob.label}</span>
                            <span className="font-mono caption-3 tabular-nums text-[#C83709]">
                              {fmt(ob.startMin)} to {fmt(ob.endMin)}
                            </span>
                          </div>
                        ))}
                        {selectedDateWithdrawals.map((wd) => (
                          <div
                            key={wd.id}
                            className="flex items-center justify-between rounded-lg border border-rose-200/70 bg-rose-50 px-3 py-2"
                          >
                            <span className="caption-4 text-rose-800">{wd.reason}</span>
                            <span className="font-mono caption-3 tabular-nums text-rose-700">
                              {fmt(wd.startMin)} to {fmt(wd.endMin)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </section>
          </div>
        )}

        {/* ================================================================ */}
        {/* TAB 3: BOOKINGS SEARCH, FILTER, CANCELLATION & ENTRY SCANNER     */}
        {/* ================================================================ */}
        {subTab === 'bookings' && (
          <div className="space-y-4">
            {/* Extension Approvals if any */}
            {pendingExtensions.length > 0 && (
              <section className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
                <div className="mb-3 title-4 text-[#111827]">
                  Pending Extension Requests ({pendingExtensions.length})
                </div>
                <div className="space-y-2">
                  {pendingExtensions.map(({ bk, req }) => (
                    <div
                      key={req.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-black/[0.08] bg-white p-3 caption-5"
                    >
                      <div>
                        <span className="caption-3 text-[#111827]">{bk.driverName}</span> · Spot{' '}
                        <strong className="caption-3">{bk.spaceCode}</strong> requests until{' '}
                        <strong className="font-mono caption-3">{fmt(req.requestedEndMin)}</strong> (+₹
                        {req.additionalTotalInr})
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => void onDecideExtension(bk.id, req.id, 'approve')}
                          className="rounded-lg bg-[#047857] px-3 py-1 button-xsm text-white transition-colors duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-[#065F46] active:scale-[0.98]"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => void onDecideExtension(bk.id, req.id, 'reject')}
                          className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1 button-xsm text-rose-700 transition-colors duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.98]"
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
              {/* Entry Scanner */}
              <section className="rounded-2xl border border-black/[0.08] bg-white p-6 xl:col-span-4">
                <div className="flex items-center gap-2 title-3 text-[#111827]">
                  <Scan className="h-4 w-4 text-[#047857]" weight="bold" />
                  <h2>Entry QR / PIN Check in</h2>
                </div>
                <p className="mt-1 caption-5 text-[#6B7280]">
                  Verify arriving drivers by QR token, Spot Access PIN, or Booking ID.
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
                        setScannerFeedback({
                          ok: true,
                          message: 'Checked in successfully and bay marked occupied.',
                        });
                        setScannerInput('');
                      } else {
                        setScannerFeedback({
                          ok: false,
                          message: res.error || 'Verification failed.',
                        });
                      }
                    } finally {
                      setScannerBusy(false);
                    }
                  }}
                  className="mt-4 space-y-3"
                >
                  <input
                    type="text"
                    value={scannerInput}
                    onChange={(e) => setScannerInput(e.target.value)}
                    placeholder="PKP PIN, QR token, or Booking ID"
                    className="w-full rounded-xl border border-black/[0.1] bg-[#F8F7F4] px-3 py-2 font-mono caption-5 text-[#111827]"
                  />
                  <button
                    type="submit"
                    disabled={scannerBusy || !scannerInput.trim()}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#047857] px-4 py-2 button-xsm text-white transition-colors duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-[#065F46] active:scale-[0.98] disabled:opacity-50"
                  >
                    <QrCode className="h-4 w-4" weight="bold" />
                    <span>{scannerBusy ? 'Verifying...' : 'Verify & Check In'}</span>
                  </button>
                </form>

                {scannerFeedback && (
                  <div
                    className={`mt-3 rounded-xl border px-3 py-2 caption-4 ${
                      scannerFeedback.ok
                        ? 'border-emerald-200 bg-emerald-50 text-[#047857]'
                        : 'border-rose-200 bg-rose-50 text-rose-700'
                    }`}
                  >
                    {scannerFeedback.message}
                  </div>
                )}
              </section>

              {/* Bookings Search, Filter, Cancel & CSV Export */}
              <section className="rounded-2xl border border-black/[0.08] bg-white p-6 xl:col-span-8">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="title-3 text-[#111827]">
                      Facility Bookings ({filteredOwnBookings.length})
                    </h2>
                    <p className="caption-5 text-[#6B7280]">
                      Search, filter, cancel bookings with refund, or download CSV reports.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={exportBookingsCsv}
                    className="inline-flex items-center gap-2 whitespace-nowrap rounded-xl border border-black/[0.1] bg-[#F8F7F4] px-3 py-2 button-xsm text-[#111827] transition-colors duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-black/[0.04] active:scale-[0.98]"
                  >
                    <DownloadSimple className="h-3.5 w-3.5 text-[#047857]" weight="bold" />
                    <span>Download CSV</span>
                  </button>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <div className="relative flex-1 min-w-[200px]">
                    <MagnifyingGlass className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[#9CA3AF]" weight="bold" />
                    <input
                      type="text"
                      value={bookingSearch}
                      onChange={(e) => setBookingSearch(e.target.value)}
                      placeholder="Search ID, driver, plate, facility, or space..."
                      className="w-full rounded-xl border border-black/[0.1] bg-[#F8F7F4] py-2 pl-8 pr-3 caption-5 text-[#111827]"
                    />
                  </div>
                  <select
                    value={bookingStatusFilter}
                    onChange={(e) => setBookingStatusFilter(e.target.value as any)}
                    className="rounded-xl border border-black/[0.1] bg-[#F8F7F4] px-3 py-2 button-xsm text-[#111827]"
                  >
                    <option value="all">All Statuses</option>
                    <option value="held">Held</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="checked-in">Checked in</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                  <select
                    value={bookingFacilityFilter}
                    onChange={(e) => setBookingFacilityFilter(e.target.value)}
                    className="rounded-xl border border-black/[0.1] bg-[#F8F7F4] px-3 py-2 button-xsm text-[#111827]"
                  >
                    <option value="all">All Facilities</option>
                    {ownFacilities.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mt-4 max-h-[460px] space-y-2 overflow-y-auto">
                  {filteredOwnBookings.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-black/[0.1] bg-[#FAF9F6] p-6 text-center caption-5 text-[#6B7280]">
                      No bookings match the current search or filters.
                    </div>
                  ) : (
                    filteredOwnBookings.map((bk) => {
                      const canCancel =
                        bk.status !== 'cancelled' &&
                        bk.status !== 'completed' &&
                        bk.status !== 'expired';
                      const isCancelling = cancellingBookingId === bk.id;
                      const linkedSpace = spaces.find((s) => s.id === bk.spaceId);

                      return (
                        <div
                          key={bk.id}
                          className="rounded-xl border border-black/[0.08] bg-[#FAF9F6] p-4 caption-5"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono caption-3 text-[#111827]">
                                {bk.id}
                              </span>
                              <span className="text-[#6B7280]">·</span>
                              <span className="caption-3 text-[#111827]">
                                {bk.facilityName} ({bk.spaceCode})
                              </span>
                            </div>
                            <span
                              className={`caption-3 capitalize ${
                                bk.status === 'cancelled'
                                  ? 'text-rose-700'
                                  : bk.status === 'completed'
                                  ? 'text-[#047857]'
                                  : 'text-[#4338CA]'
                              }`}
                            >
                              {bk.status === 'checked-in' ? 'Checked in' : bk.status} ·{' '}
                              <span className="font-mono tabular-nums">₹{bk.totalAmountInr}</span>
                            </span>
                          </div>

                          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[#4B5563]">
                            <span>
                              Driver: <strong className="caption-3 text-[#111827]">{bk.driverName}</strong>
                            </span>
                            <span>
                              {bk.vehicleLabel}
                              {bk.vehiclePlate ? ` (${bk.vehiclePlate})` : ''}
                            </span>
                            <span className="font-mono tabular-nums">
                              {bk.createdAt.slice(0, 10)} · {fmt(bk.startMin)} to {fmt(bk.endMin)}
                            </span>
                          </div>

                          <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
                            {(bk.status === 'checked-in' || bk.status === 'occupied') && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => void onConfirmDeparture(bk.id)}
                                  className="rounded-lg bg-[#047857] px-3 py-1 button-xsm text-white transition-colors duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-[#065F46] active:scale-[0.98]"
                                >
                                  Confirm Checkout
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void onReportOverstay(bk.id, 30)}
                                  className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1 button-xsm text-amber-900"
                                >
                                  Flag Overstay
                                </button>
                              </>
                            )}
                            {linkedSpace?.occupancyState === 'CLEARANCE' && (() => {
                              const remMs = linkedSpace.clearanceEndsAt
                                ? Math.max(0, Date.parse(linkedSpace.clearanceEndsAt) - Date.now())
                                : 0;
                              const minsLeft = Math.ceil(remMs / 60000);
                              return remMs > 0 ? (
                                <span className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1 caption-3 text-amber-900 tabular-nums">
                                  Buffer active ({minsLeft}m left)
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => void onCompleteClearance(linkedSpace.id)}
                                  className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1 button-xsm text-[#4338CA]"
                                >
                                  Complete Clearance
                                </button>
                              );
                            })()}
                            {canCancel && (
                              <button
                                type="button"
                                onClick={() => {
                                  setCancellingBookingId(isCancelling ? null : bk.id);
                                  setCancelReason('Host schedule adjustment');
                                }}
                                className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-white px-3 py-1 button-xsm text-rose-700 transition-colors duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-rose-50 active:scale-[0.98]"
                              >
                                <XCircle className="h-3.5 w-3.5" weight="bold" />
                                <span>Cancel Booking</span>
                              </button>
                            )}
                          </div>

                          {isCancelling && (
                            <div className="mt-3 rounded-lg border border-black/[0.06] bg-white p-3 space-y-2">
                              <div className="flex flex-wrap gap-2">
                                {[
                                  'Host schedule adjustment',
                                  'Bay maintenance required',
                                  'Owner emergency arrival',
                                ].map((preset) => (
                                  <button
                                    key={preset}
                                    type="button"
                                    onClick={() => setCancelReason(preset)}
                                    className={`rounded-md border px-2 py-1 caption-4 transition-colors duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                                      cancelReason === preset
                                        ? 'border-[#111827] bg-[#111827] text-white'
                                        : 'border-black/[0.1] bg-[#FAF9F6] text-[#4B5563]'
                                    }`}
                                  >
                                    {preset}
                                  </button>
                                ))}
                              </div>
                              <div className="flex flex-col gap-2 sm:flex-row">
                                <input
                                  type="text"
                                  value={cancelReason}
                                  onChange={(e) => setCancelReason(e.target.value)}
                                  placeholder="Enter cancellation reason..."
                                  className="flex-1 rounded-lg border border-black/[0.1] bg-[#FAF9F6] px-3 py-2 caption-5 text-[#111827]"
                                />
                                <button
                                  type="button"
                                  disabled={cancelBusy || !cancelReason.trim()}
                                  onClick={async () => {
                                    setCancelBusy(true);
                                    try {
                                      await onCancelBookingHost(bk.id, cancelReason.trim());
                                      setCancellingBookingId(null);
                                    } finally {
                                      setCancelBusy(false);
                                    }
                                  }}
                                  className="whitespace-nowrap rounded-lg bg-rose-600 px-3 py-2 button-xsm text-white transition-colors duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-rose-700 active:scale-[0.98] disabled:opacity-50"
                                >
                                  {cancelBusy ? 'Cancelling...' : 'Confirm Cancel & Refund'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setCancellingBookingId(null)}
                                  className="rounded-lg border border-black/[0.1] bg-white px-3 py-2 button-xsm text-[#374151]"
                                >
                                  Keep
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </section>
            </div>
          </div>
        )}

        {/* ================================================================ */}
        {/* TAB 4: SETTLEMENTS, DOCUMENT DOWNLOAD, CSV & INCIDENTS           */}
        {/* ================================================================ */}
        {subTab === 'settlements' && (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
            <section className="rounded-2xl border border-black/[0.08] bg-white p-6 xl:col-span-8">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="title-3 text-[#111827]">
                    Settlements &amp; Document Downloads
                  </h2>
                  <p className="caption-5 text-[#6B7280]">
                    Preview settlement statements, download payout receipts, or export CSV ledgers.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={exportSettlementsCsv}
                    className="inline-flex items-center gap-2 whitespace-nowrap rounded-xl border border-black/[0.1] bg-[#F8F7F4] px-3 py-2 button-xsm text-[#111827] transition-colors duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-black/[0.04] active:scale-[0.98]"
                  >
                    <DownloadSimple className="h-3.5 w-3.5 text-[#047857]" weight="bold" />
                    <span>Download CSV</span>
                  </button>
                  <div className="font-mono heading-6 tabular-nums text-[#047857]">
                    ₹{totalNetEarnings}
                  </div>
                </div>
              </div>

              <div className="mt-4 overflow-x-auto">
                <table className="w-full border-separate border-spacing-y-2 text-left caption-5">
                  <thead className="text-[#6B7280]">
                    <tr>
                      <th className="px-3 py-2 caption-3">Statement</th>
                      <th className="px-3 py-2 caption-3">Booking</th>
                      <th className="px-3 py-2 text-right caption-3">Gross</th>
                      <th className="px-3 py-2 text-right caption-3">Net Payout</th>
                      <th className="px-3 py-2 caption-3">Status</th>
                      <th className="px-3 py-2 text-right caption-3">Document</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ownSettlements.map((st) => (
                      <tr key={st.id} className="bg-[#FAF9F6] transition-colors duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-[#F3F2EE]">
                        <td className="rounded-l-xl px-3 py-3 font-mono caption-3 text-[#111827]">{st.id}</td>
                        <td className="px-3 py-3 font-mono caption-5 text-[#4B5563]">{st.bookingId}</td>
                        <td className="px-3 py-3 text-right font-mono tabular-nums text-[#374151]">
                          ₹{st.grossInr}
                        </td>
                        <td className="px-3 py-3 text-right font-mono caption-3 tabular-nums text-[#047857]">
                          ₹{st.netPayoutInr}
                        </td>
                        <td className="px-3 py-3 capitalize text-[#374151]">
                          {st.status.replace(/_/g, ' ')}
                        </td>
                        <td className="rounded-r-xl px-3 py-3 text-right">
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setPreviewSettlement(st)}
                              className="inline-flex items-center gap-1 rounded-lg border border-black/[0.1] bg-white px-2 py-1 button-xsm text-[#111827] transition-colors duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-black/[0.04]"
                            >
                              <Eye className="h-3.5 w-3.5 text-[#4338CA]" weight="bold" />
                              <span>View</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => downloadSettlementDocument(st, 'html')}
                              className="inline-flex items-center gap-1 rounded-lg bg-[#047857] px-2 py-1 button-xsm text-white transition-colors duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-[#065F46] active:scale-[0.98]"
                            >
                              <FileText className="h-3.5 w-3.5" weight="bold" />
                              <span>Download</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Incident Report Panel */}
            <section className="rounded-2xl border border-black/[0.08] bg-white p-6 xl:col-span-4 space-y-4">
              <div>
                <div className="flex items-center gap-2 title-3 text-[#111827]">
                  <Warning className="h-4 w-4 text-[#C83709]" weight="bold" />
                  <span>Report Facility Incident</span>
                </div>
                <p className="mt-1 caption-5 text-[#6B7280]">
                  Log overstays, blocked access, or operational safety issues.
                </p>
              </div>

              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!incDesc.trim()) return;
                  await onSubmitIncident({
                    facilityId: ownFacilities[0]?.id,
                    category: incCategory,
                    severity: incSeverity,
                    description: incDesc.trim(),
                  });
                  setIncDesc('');
                }}
                className="space-y-3"
              >
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={incCategory}
                    onChange={(e) => setIncCategory(e.target.value as IncidentRecord['category'])}
                    className="rounded-xl border border-black/[0.1] bg-[#F8F7F4] px-3 py-2 caption-5"
                  >
                    <option value="vehicle_overstay">Overstay</option>
                    <option value="access_blocked">Access Blocked</option>
                    <option value="safety_hazard">Safety Hazard</option>
                    <option value="other">Other</option>
                  </select>
                  <select
                    value={incSeverity}
                    onChange={(e) => setIncSeverity(e.target.value as IncidentRecord['severity'])}
                    className="rounded-xl border border-black/[0.1] bg-[#F8F7F4] px-3 py-2 caption-5"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
                <textarea
                  rows={3}
                  required
                  value={incDesc}
                  onChange={(e) => setIncDesc(e.target.value)}
                  placeholder="Describe incident..."
                  className="w-full rounded-xl border border-black/[0.1] bg-[#F8F7F4] px-3 py-2 caption-5"
                />
                <button
                  type="submit"
                  className="w-full rounded-xl bg-[#111827] px-4 py-2 button-xsm text-white transition-colors duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-black active:scale-[0.98]"
                >
                  Submit Incident
                </button>
              </form>

              {incidents.length > 0 && (
                <div className="rounded-xl border border-black/[0.06] bg-[#FAF9F6] p-3 space-y-2">
                  <div className="caption-4 text-[#6B7280]">Recent Reports</div>
                  {incidents.slice(0, 3).map((inc) => (
                    <div key={inc.id} className="rounded-lg border border-black/[0.05] bg-white px-3 py-2 caption-5">
                      <div className="flex items-center justify-between caption-3 text-[#111827]">
                        <span>{inc.category.replace(/_/g, ' ')}</span>
                        <span className="capitalize text-[#C83709]">{inc.status}</span>
                      </div>
                      <div className="truncate text-[#6B7280]">{inc.description}</div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </div>

      {/* ================================================================== */}
      {/* MODAL: ADD FACILITY                                                */}
      {/* ================================================================== */}
      {showAddFacilityModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-label="Add Facility"
        >
          <div className="w-full max-w-lg rounded-2xl border border-black/[0.1] bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between rounded-xl border border-black/[0.06] bg-[#FAF9F6] p-3">
              <div>
                <h3 className="title-3 text-[#111827]">
                  Add New Facility &amp; Parking Bay
                </h3>
                <p className="caption-5 text-[#6B7280]">
                  Submitted spaces start in pending_approval until reviewed.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddFacilityModal(false)}
                aria-label="Close modal"
                className="rounded-lg border border-black/[0.08] bg-white p-1 text-[#4B5563]"
              >
                <X className="h-4 w-4" weight="bold" />
              </button>
            </div>

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
                    walkingDistanceM: Number(walkingDistanceM) || 240,
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
                  setAddress('');
                  setShowAddFacilityModal(false);
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
                placeholder="Facility Name (e.g. Indiranagar 100ft Bay)"
                className="w-full rounded-xl border border-black/[0.1] bg-[#F8F7F4] px-3 py-2 caption-5 text-[#111827]"
              />
              <select
                value={selectedLocId}
                onChange={(e) => setSelectedLocId(e.target.value)}
                className="w-full rounded-xl border border-black/[0.1] bg-[#F8F7F4] px-3 py-2 caption-5 text-[#111827]"
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
                className="w-full rounded-xl border border-black/[0.1] bg-[#F8F7F4] px-3 py-2 caption-5 text-[#111827]"
              />
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="text"
                  value={entranceLabel}
                  onChange={(e) => setEntranceLabel(e.target.value)}
                  placeholder="Entrance"
                  className="rounded-xl border border-black/[0.1] bg-[#F8F7F4] px-3 py-2 caption-5"
                />
                <input
                  type="number"
                  min={50}
                  value={walkingDistanceM}
                  onChange={(e) => setWalkingDistanceM(Number(e.target.value))}
                  placeholder="Walk (m)"
                  className="rounded-xl border border-black/[0.1] bg-[#F8F7F4] px-3 py-2 font-mono caption-5"
                />
                <input
                  type="number"
                  min={20}
                  value={hourlyPriceInr}
                  onChange={(e) => setHourlyPriceInr(Number(e.target.value))}
                  placeholder="₹/hr"
                  className="rounded-xl border border-black/[0.1] bg-[#F8F7F4] px-3 py-2 font-mono caption-5"
                />
              </div>
              <input
                type="text"
                required
                value={accessInstructions}
                onChange={(e) => setAccessInstructions(e.target.value)}
                placeholder="Access instructions"
                className="w-full rounded-xl border border-black/[0.1] bg-[#F8F7F4] px-3 py-2 caption-5"
              />
              <input
                type="text"
                required
                value={restrictionsText}
                onChange={(e) => setRestrictionsText(e.target.value)}
                placeholder="Restrictions (comma separated)"
                className="w-full rounded-xl border border-black/[0.1] bg-[#F8F7F4] px-3 py-2 caption-5"
              />
              <div className="flex flex-wrap gap-2">
                {VEHICLE_CHOICES.map((vc) => (
                  <button
                    key={vc.id}
                    type="button"
                    onClick={() => toggleVehicle(vc.id)}
                    className={`rounded-lg px-3 py-1 button-xsm transition-colors duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                      allowedTypes.includes(vc.id)
                        ? 'bg-[#111827] text-white'
                        : 'bg-[#F3F2EE] text-[#374151]'
                    }`}
                  >
                    {vc.label}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-4 caption-5">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={covered}
                    onChange={(e) => setCovered(e.target.checked)}
                    className="accent-[#047857]"
                  />
                  Covered
                </label>
                <label className="flex items-center gap-2">
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
                  className="rounded-lg border border-black/[0.1] bg-[#F8F7F4] px-2 py-1 caption-5"
                >
                  <option value={18 * 60}>Close 18:00</option>
                  <option value={20 * 60}>Close 20:00</option>
                  <option value={21 * 60}>Close 21:00</option>
                  <option value={22 * 60 + 30}>Close 22:30</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddFacilityModal(false)}
                  className="rounded-xl border border-black/[0.1] px-4 py-2 button-xsm text-[#374151]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={facBusy}
                  className="rounded-xl bg-[#047857] px-4 py-2 button-xsm text-white transition-colors duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-[#065F46] active:scale-[0.98] disabled:opacity-60"
                >
                  {facBusy ? 'Submitting...' : 'Submit Facility'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* MODAL: EDIT FACILITY                                               */}
      {/* ================================================================== */}
      {editingFacility && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-label="Edit Facility"
        >
          <div className="w-full max-w-md rounded-2xl border border-black/[0.1] bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between rounded-xl border border-black/[0.06] bg-[#FAF9F6] p-3">
              <h3 className="title-3 text-[#111827]">
                Edit Facility Details
              </h3>
              <button
                type="button"
                onClick={() => setEditingFacilityId(null)}
                aria-label="Close modal"
                className="rounded-lg border border-black/[0.08] bg-white p-1 text-[#4B5563]"
              >
                <X className="h-4 w-4" weight="bold" />
              </button>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await onUpdateFacility(editingFacility.id, {
                  name: editFacName,
                  address: editFacAddress,
                  zone: editFacZone,
                  entranceLabel: editEntranceLabel,
                  accessInstructions: editAccessInstructions,
                });
                setEditingFacilityId(null);
              }}
              className="mt-4 space-y-3 caption-5"
            >
              <div>
                <label className="mb-1 block caption-3 text-[#374151]">Facility Name</label>
                <input
                  type="text"
                  required
                  value={editFacName}
                  onChange={(e) => setEditFacName(e.target.value)}
                  className="w-full rounded-xl border border-black/[0.1] bg-[#F8F7F4] px-3 py-2"
                />
              </div>
              <div>
                <label className="mb-1 block caption-3 text-[#374151]">Address</label>
                <input
                  type="text"
                  required
                  value={editFacAddress}
                  onChange={(e) => setEditFacAddress(e.target.value)}
                  className="w-full rounded-xl border border-black/[0.1] bg-[#F8F7F4] px-3 py-2"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block caption-3 text-[#374151]">Zone / Area</label>
                  <input
                    type="text"
                    required
                    value={editFacZone}
                    onChange={(e) => setEditFacZone(e.target.value)}
                    className="w-full rounded-xl border border-black/[0.1] bg-[#F8F7F4] px-3 py-2"
                  />
                </div>
                <div>
                  <label className="mb-1 block caption-3 text-[#374151]">Entrance Label</label>
                  <input
                    type="text"
                    required
                    value={editEntranceLabel}
                    onChange={(e) => setEditEntranceLabel(e.target.value)}
                    className="w-full rounded-xl border border-black/[0.1] bg-[#F8F7F4] px-3 py-2"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block caption-3 text-[#374151]">
                  Access Instructions
                </label>
                <textarea
                  rows={2}
                  required
                  value={editAccessInstructions}
                  onChange={(e) => setEditAccessInstructions(e.target.value)}
                  className="w-full rounded-xl border border-black/[0.1] bg-[#F8F7F4] px-3 py-2"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingFacilityId(null)}
                  className="rounded-xl border border-black/[0.1] px-4 py-2 button-xsm text-[#374151]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1 rounded-xl bg-[#047857] px-4 py-2 button-xsm text-white transition-colors duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-[#065F46] active:scale-[0.98]"
                >
                  <Check className="h-3.5 w-3.5" weight="bold" />
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* MODAL: SETTLEMENT STATEMENT PREVIEW & DOWNLOAD                     */}
      {/* ================================================================== */}
      {previewSettlement && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-label="Settlement Document Preview"
        >
          <div className="w-full max-w-md rounded-2xl border border-black/[0.1] bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between rounded-xl border border-black/[0.06] bg-[#FAF9F6] p-3">
              <div>
                <div className="font-mono caption-3 text-[#047857]">
                  {previewSettlement.id}
                </div>
                <h3 className="title-3 text-[#111827]">
                  Settlement Statement
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPreviewSettlement(null)}
                aria-label="Close modal"
                className="rounded-lg border border-black/[0.08] bg-white p-1 text-[#4B5563]"
              >
                <X className="h-4 w-4" weight="bold" />
              </button>
            </div>

            <div className="mt-4 space-y-3 caption-5">
              <div className="space-y-2 rounded-xl border border-black/[0.06] bg-[#FAF9F6] p-3">
                <div className="flex justify-between">
                  <span className="text-[#6B7280]">Provider</span>
                  <span className="caption-3 text-[#111827]">
                    {previewSettlement.providerName}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#6B7280]">Facility</span>
                  <span className="caption-3 text-[#111827]">
                    {previewSettlement.facilityName}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#6B7280]">Booking Ref</span>
                  <span className="font-mono text-[#111827]">{previewSettlement.bookingId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#6B7280]">UTR Reference</span>
                  <span className="font-mono text-[#111827]">
                    {previewSettlement.utrRef || 'PENDING'}
                  </span>
                </div>
              </div>

              <div className="rounded-xl border border-black/[0.06] bg-[#FAF9F6] p-3 space-y-2">
                <div className="flex justify-between">
                  <span className="text-[#6B7280]">Gross Parking Charge</span>
                  <span className="font-mono tabular-nums text-[#111827]">
                    ₹{previewSettlement.grossInr}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#6B7280]">Platform Fee</span>
                  <span className="font-mono tabular-nums text-[#4B5563]">
                    Less ₹{previewSettlement.platformCommissionInr}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#6B7280]">GST Withheld</span>
                  <span className="font-mono tabular-nums text-[#4B5563]">
                    Less ₹{previewSettlement.gstWithheldInr}
                  </span>
                </div>
              </div>

              <div className="flex justify-between rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 title-4 text-[#047857]">
                <span>Net Payout</span>
                <span className="font-mono tabular-nums">
                  ₹{previewSettlement.netPayoutInr}
                </span>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => downloadSettlementDocument(previewSettlement, 'txt')}
                className="inline-flex items-center gap-2 rounded-xl border border-black/[0.1] px-3 py-2 button-xsm text-[#111827] transition-colors duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-black/[0.04]"
              >
                <DownloadSimple className="h-3.5 w-3.5" weight="bold" />
                <span>Download TXT</span>
              </button>
              <button
                type="button"
                onClick={() => downloadSettlementDocument(previewSettlement, 'html')}
                className="inline-flex items-center gap-2 rounded-xl bg-[#047857] px-3 py-2 button-xsm text-white transition-colors duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-[#065F46] active:scale-[0.98]"
              >
                <FileText className="h-3.5 w-3.5" weight="bold" />
                <span>Download Statement</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
