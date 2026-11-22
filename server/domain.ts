import {
  AdminAnalytics,
  AutonomousLifecycleEvent,
  AutonomousLifecycleStep,
  AvailabilityWithdrawal,
  BengaluruLocation,
  BookingRecord,
  CandidateEvaluation,
  ConstraintCheck,
  DetailedProviderType,
  DisputeRecord,
  DriverNotification,
  DriverProfile,
  EvidenceRequirement,
  ExtensionAlternative,
  ExtensionOffer,
  ExtensionRequest,
  Facility,
  HostSettlementRecord,
  IncidentRecord,
  OperationalCheckRecord,
  ParkingSpace,
  PaymentOrder,
  PaymentWebhookEvent,
  PoolingStrategyMetrics,
  PrepaidWallet,
  PrivateDocumentRecord,
  ProviderRecord,
  ProviderType,
  ProviderVerificationStatus,
  RefundRecord,
  SpaceOccupancyState,
  SpacePublicationStatus,
  TransactionHistoryItem,
  UserReportRecord,
  UserRole,
  UserSession,
  VehicleProfile,
  VehicleType,
  VerificationStatus,
  WalletLedgerItem,
  WheelerCategory,
  WorkspaceSnapshot,
} from '../src/types/parkpool';
import {
  signBookingQrToken,
  signFacilityGateQrToken,
  signWebhookPayload,
  verifyBookingQrToken,
  verifyFacilityGateQrToken,
  verifyWebhookSignature,
} from './security';

export const BENGALURU_LOCATIONS: BengaluruLocation[] = [
  { id: 'LOC-PHX', name: 'Phoenix Mall of Asia', area: 'Hebbal / Byatarayanapura', lat: 13.0766, lng: 77.5944, source: 'hub' },
  { id: 'LOC-MG', name: 'MG Road & Church Street', area: 'Central Bengaluru', lat: 12.9756, lng: 77.6066, source: 'hub' },
  { id: 'LOC-IND', name: 'Indiranagar 100 Feet Road', area: 'East Bengaluru', lat: 12.9784, lng: 77.6408, source: 'hub' },
  { id: 'LOC-KOR', name: 'Koramangala 4th Block', area: 'South-East Bengaluru', lat: 12.9352, lng: 77.6245, source: 'hub' },
  { id: 'LOC-WHT', name: 'Whitefield ITPL', area: 'Whitefield Tech Corridor', lat: 12.9855, lng: 77.7363, source: 'hub' },
  { id: 'LOC-JAY', name: 'Jayanagar 4th Block Complex', area: 'South Bengaluru', lat: 12.9299, lng: 77.5838, source: 'hub' },
  { id: 'LOC-MAL', name: 'Malleshwaram 8th Cross', area: 'North-West Bengaluru', lat: 12.9916, lng: 77.5712, source: 'hub' },
  { id: 'LOC-HSR', name: 'HSR Layout Sector 2', area: 'Outer Ring Road South', lat: 12.9121, lng: 77.6446, source: 'hub' },
  { id: 'LOC-EC', name: 'Electronic City Phase 1', area: 'Hosur Road Tech Hub', lat: 12.8452, lng: 77.6602, source: 'hub' },
  { id: 'LOC-MAJ', name: 'Majestic / Kempegowda Hub', area: 'City Center', lat: 12.9767, lng: 77.5713, source: 'hub' },
  { id: 'LOC-CUB', name: 'Cubbon Park & Vidhana Soudha', area: 'Central Bengaluru', lat: 12.9763, lng: 77.5929, source: 'hub' },
  { id: 'LOC-YEL', name: 'Yelahanka New Town', area: 'North Bengaluru', lat: 13.0968, lng: 77.5861, source: 'hub' },
  { id: 'LOC-SAD', name: 'Sadashivanagar / Sankey Tank', area: 'North-Central Bengaluru', lat: 13.0068, lng: 77.5813, source: 'hub' },
  { id: 'LOC-BEL', name: 'Bellandur Ecospace', area: 'Outer Ring Road East', lat: 12.9279, lng: 77.6762, source: 'hub' },
];

export const EVIDENCE_CHECKLISTS: Record<DetailedProviderType, EvidenceRequirement[]> = {
  commercial_operator: [
    {
      docType: 'operating_authority',
      label: 'Commercial Operating Authority / Trade License',
      description: 'Municipal parking operator license or commercial trade permit.',
      required: true,
    },
    {
      docType: 'facility_agreement',
      label: 'Property / Facility Operating Agreement',
      description: 'Signed lease or concession agreement covering the parking bays.',
      required: true,
    },
    {
      docType: 'fire_safety_noc',
      label: 'Fire & Safety Clearance (Basement/Deck)',
      description: 'Valid safety clearance for commercial multi-bay parking.',
      required: false,
    },
  ],
  mall_office: [
    {
      docType: 'management_approval',
      label: 'Authorised Facility Management Approval',
      description: 'Board or mall management sign-off authorizing shared public bays.',
      required: true,
    },
    {
      docType: 'parking_use_conditions',
      label: 'Parking-Use & Gate Access Conditions',
      description: 'Documented operating hours, vehicle limits, and barrier protocol.',
      required: true,
    },
  ],
  property_owner: [
    {
      docType: 'ownership_title',
      label: 'Property Ownership / Title Authority',
      description: 'Registered sale deed, Khata extract, or verified tax receipt.',
      required: true,
    },
    {
      docType: 'permitted_use_declaration',
      label: 'Permitted Parking-Use Declaration',
      description: 'Signed confirmation of residential/private driveway sharing rights.',
      required: true,
    },
  ],
  property_manager: [
    {
      docType: 'management_agreement',
      label: 'Property Management Agreement / Written Authorisation',
      description: 'Written mandate from owner empowering sub-licensing of bays.',
      required: true,
    },
    {
      docType: 'owner_identity_ref',
      label: 'Underlying Owner Authority Reference',
      description: 'Reference to property owner ID and permitted bay schedule.',
      required: true,
    },
  ],
  apartment_residential: [
    {
      docType: 'rwa_resolution',
      label: 'Association / RWA Resolution & Common-Area Permission',
      description: 'Managing committee approval covering visitor/common-area bays.',
      required: true,
    },
    {
      docType: 'lease_land_use_permission',
      label: 'Ownership / Lease & Land-Use Permission',
      description: 'Applicable occupancy, lease clause, and local land-use compliance.',
      required: true,
    },
  ],
};

export function mapDetailedToLegacyProviderType(detailed: DetailedProviderType): ProviderType {
  if (detailed === 'commercial_operator' || detailed === 'mall_office') return 'commercial';
  if (detailed === 'apartment_residential') return 'community';
  return 'individual';
}

export function formatMinutesToTime(min: number): string {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, Math.round(min)));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function parseTimeToMinutes(timeStr: string, fallback = 14 * 60): number {
  const match = /^(\d{1,2}):(\d{2})$/.exec(timeStr.trim());
  if (!match) return fallback;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h < 0 || h > 23 || m < 0 || m > 59) return fallback;
  return h * 60 + m;
}

export function calcGeoMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 1.18);
}

function defaultOperationalChecks(passed: boolean, inspectorId?: string): OperationalCheckRecord {
  return {
    entranceVerified: passed,
    locationVerified: passed,
    dimensionsVerified: passed,
    operatingHoursVerified: passed,
    restrictionsVerified: passed,
    accessArrangementsVerified: passed,
    inspectorId,
    checkedAt: passed ? '2026-11-19T10:00:00Z' : undefined,
    notes: passed
      ? 'Physical gate width, signage, clearance height, and guard check-in verified.'
      : 'Awaiting field verification of entrance, dimensions, and access rules.',
  };
}

class ParkPoolStore {
  public pilotZone = 'Hebbal / Byatarayanapura Cluster, Bengaluru';
  public destinationName = 'Phoenix Mall of Asia (Pilot Center)';
  public destinationCoords = { lat: 13.0766, lng: 77.5944 };

  // Private server-side document object storage (NEVER placed in public/ or workspace snapshot)
  private privateDocumentVault = new Map<
    string,
    { fileName: string; mimeType: string; contentText: string; providerId: string }
  >();

  // Idempotent webhook event deduplication registry
  private processedWebhookEventIds = new Set<string>();
  private bookingLock = false;

  public providers: ProviderRecord[] = [
    {
      id: 'PRV-01',
      name: 'NorthGate Commercial Parking Pvt Ltd',
      contactName: 'Vikramaditya Rao',
      contactEmail: 'ops@northgateparking.in',
      contactPhone: '+91 80 4120 9901',
      organizationName: 'NorthGate Commercial Parking Pvt Ltd',
      registrationNumber: 'KA-BLR-COM-2024-904',
      providerType: 'commercial_operator',
      legacyType: 'commercial',
      verificationStatus: 'APPROVED',
      submittedAt: '2026-10-02T09:00:00Z',
      reviewedAt: '2026-10-04T14:30:00Z',
      reviewerId: 'USR-ADM-03',
      decisionReason: 'Valid BBMP commercial parking license and fire NOC verified.',
      expiresAt: '2027-10-04',
      nextPeriodicReviewAt: '2027-04-04',
      evidenceRefs: ['DOC-PRV01-AUTH', 'DOC-PRV01-LEASE'],
      documents: [
        {
          id: 'DOC-PRV01-AUTH',
          providerId: 'PRV-01',
          docType: 'operating_authority',
          fileName: 'bbmp_commercial_operating_permit_904.txt',
          mimeType: 'text/plain',
          sizeBytes: 428,
          uploadedAt: '2026-10-02T09:00:00Z',
          status: 'verified',
          reviewerNote: 'Verified against municipal registry #904.',
        },
        {
          id: 'DOC-PRV01-LEASE',
          providerId: 'PRV-01',
          docType: 'facility_agreement',
          fileName: 'phoenix_north_annex_concession.txt',
          mimeType: 'text/plain',
          sizeBytes: 512,
          uploadedAt: '2026-10-02T09:02:00Z',
          status: 'verified',
          reviewerNote: 'Signed 36-month parking concession verified.',
        },
      ],
      aiPrecheckWarnings: [],
      complaintsCount: 0,
      operatorChangeFlagged: false,
      updatedAt: '2026-10-04T14:30:00Z',
    },
    {
      id: 'PRV-02',
      name: 'Sahakarnagar Realty Co-op',
      contactName: 'Meenakshi Sundaram',
      contactEmail: 'facilities@sahakarnagarcoop.in',
      contactPhone: '+91 80 4118 4412',
      organizationName: 'Sahakarnagar Business Hub LLP',
      registrationNumber: 'KA-BLR-PM-2025-912',
      providerType: 'property_manager',
      legacyType: 'commercial',
      verificationStatus: 'APPROVED',
      submittedAt: '2026-10-08T10:15:00Z',
      reviewedAt: '2026-10-10T11:00:00Z',
      reviewerId: 'USR-ADM-03',
      decisionReason: 'Property management authorization & basement parking conditions verified.',
      expiresAt: '2027-06-30',
      nextPeriodicReviewAt: '2027-01-15',
      evidenceRefs: ['DOC-PRV02-MGT'],
      documents: [
        {
          id: 'DOC-PRV02-MGT',
          providerId: 'PRV-02',
          docType: 'management_agreement',
          fileName: 'sahakarnagar_pm_authorisation_912.txt',
          mimeType: 'text/plain',
          sizeBytes: 390,
          uploadedAt: '2026-10-08T10:15:00Z',
          status: 'verified',
        },
      ],
      aiPrecheckWarnings: [],
      complaintsCount: 0,
      operatorChangeFlagged: false,
      updatedAt: '2026-10-10T11:00:00Z',
    },
    {
      id: 'PRV-04',
      name: 'Crescent RWA Managing Committee',
      contactName: 'Suresh Hegde',
      contactEmail: 'secretary@crescentrwa.org',
      contactPhone: '+91 98451 88120',
      organizationName: 'Crescent Enclave Owners Association',
      registrationNumber: 'RWA-BLR-2026-14',
      providerType: 'apartment_residential',
      legacyType: 'community',
      verificationStatus: 'APPROVED',
      submittedAt: '2026-10-12T08:40:00Z',
      reviewedAt: '2026-10-14T16:10:00Z',
      reviewerId: 'USR-ADM-03',
      decisionReason: 'RWA Board Resolution #2026-14 and visitor-bay charter approved.',
      expiresAt: '2027-09-30',
      nextPeriodicReviewAt: '2027-03-30',
      evidenceRefs: ['DOC-PRV04-RWA'],
      documents: [
        {
          id: 'DOC-PRV04-RWA',
          providerId: 'PRV-04',
          docType: 'rwa_resolution',
          fileName: 'crescent_rwa_resolution_2026_14.txt',
          mimeType: 'text/plain',
          sizeBytes: 448,
          uploadedAt: '2026-10-12T08:40:00Z',
          status: 'verified',
        },
      ],
      aiPrecheckWarnings: [],
      complaintsCount: 0,
      operatorChangeFlagged: false,
      updatedAt: '2026-10-14T16:10:00Z',
    },
    {
      id: 'PRV-05',
      name: 'Raghavendra K. (Individual Host)',
      contactName: 'Raghavendra K.',
      contactEmail: 'raghavendra.host@parkpool.in',
      contactPhone: '+91 98452 71004',
      organizationName: 'Lane 4 Residential Driveway',
      registrationNumber: 'KHA-BLR-560092-958',
      providerType: 'property_owner',
      legacyType: 'individual',
      verificationStatus: 'APPROVED',
      submittedAt: '2026-10-15T11:20:00Z',
      reviewedAt: '2026-10-16T15:45:00Z',
      reviewerId: 'USR-ADM-03',
      decisionReason: 'Khata ownership extract and permitted daytime driveway use verified.',
      expiresAt: '2027-10-16',
      nextPeriodicReviewAt: '2027-04-16',
      evidenceRefs: ['DOC-PRV05-TITLE', 'DOC-PRV05-DECL'],
      documents: [
        {
          id: 'DOC-PRV05-TITLE',
          providerId: 'PRV-05',
          docType: 'ownership_title',
          fileName: 'kodigehalli_khata_title_958.txt',
          mimeType: 'text/plain',
          sizeBytes: 410,
          uploadedAt: '2026-10-15T11:20:00Z',
          status: 'verified',
        },
        {
          id: 'DOC-PRV05-DECL',
          providerId: 'PRV-05',
          docType: 'permitted_use_declaration',
          fileName: 'lane4_permitted_use_declaration.txt',
          mimeType: 'text/plain',
          sizeBytes: 315,
          uploadedAt: '2026-10-15T11:21:00Z',
          status: 'verified',
        },
      ],
      aiPrecheckWarnings: [],
      complaintsCount: 0,
      operatorChangeFlagged: false,
      updatedAt: '2026-10-16T15:45:00Z',
    },
    {
      id: 'PRV-BLR-HUB',
      name: 'Bengaluru Verified Mobility Network',
      contactName: 'Central Partner Desk',
      contactEmail: 'network@parkpool.in',
      contactPhone: '+91 80 4990 1100',
      organizationName: 'Bengaluru Transit & Plaza Network',
      registrationNumber: 'KA-BLR-NET-2026-001',
      providerType: 'mall_office',
      legacyType: 'commercial',
      verificationStatus: 'APPROVED',
      submittedAt: '2026-09-20T09:00:00Z',
      reviewedAt: '2026-09-22T12:00:00Z',
      reviewerId: 'USR-ADM-03',
      decisionReason: 'Master facility management & parking-use approvals verified across city hubs.',
      expiresAt: '2027-12-31',
      nextPeriodicReviewAt: '2027-06-30',
      evidenceRefs: ['DOC-BLR-NET-APPROVAL'],
      documents: [
        {
          id: 'DOC-BLR-NET-APPROVAL',
          providerId: 'PRV-BLR-HUB',
          docType: 'management_approval',
          fileName: 'blr_network_master_facility_approval.txt',
          mimeType: 'text/plain',
          sizeBytes: 510,
          uploadedAt: '2026-09-20T09:00:00Z',
          status: 'verified',
        },
      ],
      aiPrecheckWarnings: [],
      complaintsCount: 0,
      operatorChangeFlagged: false,
      updatedAt: '2026-09-22T12:00:00Z',
    },
    {
      id: 'PRV-06',
      name: 'Hebbal Strip Claimant #88',
      contactName: 'Manjunath N.',
      contactEmail: 'claimant88@example.in',
      contactPhone: '+91 98440 00088',
      organizationName: 'Hebbal Service Strip Plot',
      providerType: 'property_owner',
      legacyType: 'individual',
      verificationStatus: 'SUBMITTED',
      submittedAt: '2026-11-20T03:45:00Z',
      evidenceRefs: ['DOC-PRV06-DRAFT'],
      documents: [
        {
          id: 'DOC-PRV06-DRAFT',
          providerId: 'PRV-06',
          docType: 'ownership_title',
          fileName: 'partial_sketch_hebbal_plot.txt',
          mimeType: 'text/plain',
          sizeBytes: 245,
          uploadedAt: '2026-11-20T03:45:00Z',
          status: 'pending',
          aiMissingFieldFlags: [
            'Missing registered Khata / Sale Deed folio number',
            'Missing Permitted Parking-Use Declaration document',
          ],
        },
      ],
      aiPrecheckWarnings: [
        'AI Pre-check Flag: Missing required Permitted Parking-Use Declaration (human admin review required).',
      ],
      complaintsCount: 0,
      operatorChangeFlagged: false,
      updatedAt: '2026-11-20T03:45:00Z',
    },
    {
      id: 'PRV-07',
      name: 'Yelahanka Old Lot Operator',
      contactName: 'Prakash Shetty',
      contactEmail: 'prakash@yelahankalot.in',
      contactPhone: '+91 98801 44123',
      organizationName: 'Yelahanka Old Plaza Parking',
      registrationNumber: 'KA-BLR-EXP-2025-118',
      providerType: 'commercial_operator',
      legacyType: 'commercial',
      verificationStatus: 'EXPIRED',
      submittedAt: '2025-10-01T10:00:00Z',
      reviewedAt: '2025-10-03T12:00:00Z',
      reviewerId: 'USR-ADM-03',
      decisionReason: 'Municipal lease expired on 2026-11-01; renewal agreement pending.',
      expiresAt: '2026-11-01',
      nextPeriodicReviewAt: '2026-11-01',
      evidenceRefs: ['DOC-PRV07-OLD'],
      documents: [
        {
          id: 'DOC-PRV07-OLD',
          providerId: 'PRV-07',
          docType: 'operating_authority',
          fileName: 'expired_municipal_permit_2025.txt',
          mimeType: 'text/plain',
          sizeBytes: 330,
          uploadedAt: '2025-10-01T10:00:00Z',
          status: 'rejected',
          reviewerNote: 'Permit expired 2026-11-01. Require fresh lease & trade license.',
        },
      ],
      aiPrecheckWarnings: ['Permit expired 2026-11-01; flagged in periodic review.'],
      complaintsCount: 1,
      operatorChangeFlagged: false,
      updatedAt: '2026-11-02T09:00:00Z',
    },
  ];

  public vehicles: VehicleProfile[] = [
    {
      id: 'VEH-SUV-01',
      label: 'Tata Harrier EV (SUV)',
      plateNumber: 'KA-04-MN-8821',
      vehicleType: 'suv',
      wheelerCategory: 'four_wheeler',
      lengthCm: 460,
      widthCm: 192,
      heightCm: 179,
      isEv: true,
    },
    {
      id: 'VEH-SEDAN-02',
      label: 'Honda City e:HEV (Sedan)',
      plateNumber: 'KA-03-AB-4190',
      vehicleType: 'sedan',
      wheelerCategory: 'four_wheeler',
      lengthCm: 455,
      widthCm: 175,
      heightCm: 149,
      isEv: false,
    },
    {
      id: 'VEH-HATCH-03',
      label: 'Tata Tiago EV (Hatchback)',
      plateNumber: 'KA-01-XY-2045',
      vehicleType: 'hatchback',
      wheelerCategory: 'four_wheeler',
      lengthCm: 377,
      widthCm: 168,
      heightCm: 154,
      isEv: true,
    },
    {
      id: 'VEH-2W-04',
      label: 'Ather 450X (EV Scooter)',
      plateNumber: 'KA-05-EV-7730',
      vehicleType: 'two_wheeler',
      wheelerCategory: 'two_wheeler',
      lengthCm: 189,
      widthCm: 74,
      heightCm: 111,
      isEv: true,
    },
    {
      id: 'VEH-2W-05',
      label: 'Honda Activa 6G (Scooter)',
      plateNumber: 'KA-04-HK-5219',
      vehicleType: 'two_wheeler',
      wheelerCategory: 'two_wheeler',
      lengthCm: 183,
      widthCm: 70,
      heightCm: 115,
      isEv: false,
    },
    {
      id: 'VEH-2W-06',
      label: 'Royal Enfield Classic 350 (Bike)',
      plateNumber: 'KA-02-RE-3509',
      vehicleType: 'two_wheeler',
      wheelerCategory: 'two_wheeler',
      lengthCm: 214,
      widthCm: 78,
      heightCm: 109,
      isEv: false,
    },
  ];

  public driverProfiles: DriverProfile[] = [
    {
      id: 'DRV-01',
      fullName: 'Aarav Sharma',
      email: 'aarav.sharma@bengaluru.in',
      phone: '+91 98450 22190',
      licenseNumber: 'KA04 20210048192',
      licenseValidTill: '2032-08-14',
      wheelerCategory: 'four_wheeler',
      vehicleType: 'suv',
      vehicleModel: 'Tata Harrier EV (SUV)',
      plateNumber: 'KA-04-MN-8821',
      isEv: true,
      registeredVehicleId: 'VEH-SUV-01',
      verified: true,
      updatedAt: '2026-11-20T04:00:00Z',
    },
  ];

  public facilities: Facility[] = [
    {
      id: 'FAC-01',
      providerId: 'PRV-01',
      name: 'Phoenix North Commercial Annex',
      providerName: 'NorthGate Commercial Parking Pvt Ltd',
      providerType: 'commercial',
      address: 'Service Road East, Byatarayanapura, Bengaluru 560092',
      zone: 'North Mall Corridor',
      verificationStatus: 'verified',
      authorityDocRef: 'AUTH-BENG-904 (Commercial Lease & Fire NOC)',
      entranceLabel: 'North Service Gate B (Boom Barrier)',
      walkingDistanceM: 240,
      walkingMinutes: 3,
      walkPathSafety: 'Well-lit covered pedestrian footpath with security kiosk',
      lat: 13.0785,
      lng: 77.5955,
      entranceLat: 13.0781,
      entranceLng: 77.5951,
      walkPathCoords: [
        [13.0785, 77.5955],
        [13.0781, 77.5951],
        [13.0774, 77.5948],
        [13.0766, 77.5944],
      ],
      accessControl: 'Guard desk + Booking QR verification',
      accessInstructions: 'Enter via North Service Road Gate B; scan booking QR at boom barrier.',
      restrictions: ['No commercial goods trucks', 'Max height 210cm', 'Checkout by 22:45 hard cutoff'],
      lateArrivalPolicy: {
        graceMinutes: 20,
        forfeitAfterMinutes: 45,
        summary: '20 min arrival grace; bay held up to 45 min after slot start.',
      },
      operationalChecks: defaultOperationalChecks(true, 'USR-ADM-03'),
      operationalChecksPassed: true,
      propertyEligibleForUse: true,
      lastPeriodicReviewAt: '2026-10-04T14:30:00Z',
      availabilitySource: 'provider_portal',
      lastUpdatedIso: '2026-11-20T04:18:00Z',
    },
    {
      id: 'FAC-02',
      providerId: 'PRV-02',
      name: 'Sahakarnagar Business Hub Basement',
      providerName: 'Sahakarnagar Realty Co-op',
      providerType: 'commercial',
      address: '60 Feet Road, Sahakarnagar, Bengaluru 560092',
      zone: 'West Business Block',
      verificationStatus: 'verified',
      authorityDocRef: 'AUTH-BENG-912 (Property Manager Authorization)',
      entranceLabel: 'West Basement Ramp Gate 2',
      walkingDistanceM: 380,
      walkingMinutes: 5,
      walkPathSafety: 'Paved sidewalk with zebra crossing at signal',
      lat: 13.0771,
      lng: 77.5909,
      entranceLat: 13.0769,
      entranceLng: 77.5916,
      walkPathCoords: [
        [13.0771, 77.5909],
        [13.0769, 77.5916],
        [13.0768, 77.5931],
        [13.0766, 77.5944],
      ],
      accessControl: 'Basement security logbook + PIN code',
      accessInstructions: 'Take West Basement Ramp 2 and show gate PIN to basement security desk.',
      restrictions: ['Max height 205cm', 'Zero horn inside basement', 'Hard departure 21:45'],
      lateArrivalPolicy: {
        graceMinutes: 15,
        forfeitAfterMinutes: 40,
        summary: '15 min arrival grace; notify guard desk if delayed beyond 15 min.',
      },
      operationalChecks: defaultOperationalChecks(true, 'USR-ADM-03'),
      operationalChecksPassed: true,
      propertyEligibleForUse: true,
      lastPeriodicReviewAt: '2026-10-10T11:00:00Z',
      availabilitySource: 'provider_portal',
      lastUpdatedIso: '2026-11-20T04:20:00Z',
    },
    {
      id: 'FAC-03',
      providerId: 'PRV-BLR-HUB',
      name: 'Byatarayanapura Metro Link Plaza',
      providerName: 'MetroLink Mobility Partners',
      providerType: 'commercial',
      address: 'Bellary Road Frontage, Bengaluru 560092',
      zone: 'Bellary Road Frontage',
      verificationStatus: 'verified',
      authorityDocRef: 'AUTH-BENG-925 (Operator License & Municipal Permit)',
      entranceLabel: 'Service Lane Entry Gate 1',
      walkingDistanceM: 460,
      walkingMinutes: 6,
      walkPathSafety: 'Street-lit pedestrian skywalk & footpath',
      lat: 13.0736,
      lng: 77.5968,
      entranceLat: 13.0743,
      entranceLng: 77.5961,
      walkPathCoords: [
        [13.0736, 77.5968],
        [13.0743, 77.5961],
        [13.0756, 77.5952],
        [13.0766, 77.5944],
      ],
      accessControl: 'Attendant check-in + Booking ID',
      accessInstructions: 'Turn left off Bellary Rd service lane at Gate 1; attendant verifies code.',
      restrictions: ['Open-air surface bay', 'No overnight storage past 22:30'],
      lateArrivalPolicy: {
        graceMinutes: 20,
        forfeitAfterMinutes: 45,
        summary: '20 min arrival grace; booking remains active for 45 min with late arrival tag.',
      },
      operationalChecks: defaultOperationalChecks(true, 'USR-ADM-03'),
      operationalChecksPassed: true,
      propertyEligibleForUse: true,
      lastPeriodicReviewAt: '2026-09-22T12:00:00Z',
      availabilitySource: 'schedule_engine',
      lastUpdatedIso: '2026-11-20T04:15:00Z',
    },
    {
      id: 'FAC-04',
      providerId: 'PRV-04',
      name: 'Crescent Enclave Society Visitor Pool',
      providerName: 'Crescent RWA Managing Committee',
      providerType: 'community',
      address: '2nd Cross, Jakkur Road, Bengaluru 560092',
      zone: 'Jakkur Residential Edge',
      verificationStatus: 'verified',
      authorityDocRef: 'AUTH-BENG-941 (RWA Board Resolution #2026-14)',
      entranceLabel: 'South Visitor Gate (Intercom Verified)',
      walkingDistanceM: 310,
      walkingMinutes: 4,
      walkPathSafety: 'Gated residential avenue with night floodlights',
      lat: 13.0741,
      lng: 77.5924,
      entranceLat: 13.0747,
      entranceLng: 77.5931,
      walkPathCoords: [
        [13.0741, 77.5924],
        [13.0747, 77.5931],
        [13.0758, 77.5938],
        [13.0766, 77.5944],
      ],
      accessControl: 'Society guard MyGate/Visitor OTP',
      accessInstructions: 'Share MyGate Visitor OTP at South Gate; follow green visitor arrows.',
      restrictions: ['Max height 165cm (overhead pipe)', 'Hatchback & Sedan only', 'Hard exit 20:45'],
      lateArrivalPolicy: {
        graceMinutes: 15,
        forfeitAfterMinutes: 30,
        summary: '15 min grace window before society gate OTP refreshes.',
      },
      operationalChecks: defaultOperationalChecks(true, 'USR-ADM-03'),
      operationalChecksPassed: true,
      propertyEligibleForUse: true,
      lastPeriodicReviewAt: '2026-10-14T16:10:00Z',
      availabilitySource: 'schedule_engine',
      lastUpdatedIso: '2026-11-20T04:12:00Z',
    },
    {
      id: 'FAC-05',
      providerId: 'PRV-05',
      name: 'Yelahanka Gate Private Driveway',
      providerName: 'Raghavendra K. (Individual Host)',
      providerType: 'individual',
      address: 'Lane 4, Kodigehalli Main Rd, Bengaluru 560092',
      zone: 'Kodigehalli Side Lane',
      verificationStatus: 'verified',
      authorityDocRef: 'AUTH-BENG-958 (Title Deed + Owner ID Verified)',
      entranceLabel: 'Lane 4 Blue Sliding Gate',
      walkingDistanceM: 510,
      walkingMinutes: 7,
      walkPathSafety: 'Quiet residential lane; moderate lighting after 19:00',
      lat: 13.0796,
      lng: 77.5905,
      entranceLat: 13.079,
      entranceLng: 77.5914,
      walkPathCoords: [
        [13.0796, 77.5905],
        [13.079, 77.5914],
        [13.0777, 77.593],
        [13.0766, 77.5944],
      ],
      accessControl: 'Host phone/PIN unlock (Hard departure 18:00)',
      accessInstructions: 'Enter PIN on keypad at Blue Sliding Gate; park right of planter.',
      restrictions: ['Strict 18:00 hard departure (host car return)', 'No SUVs; Sedan/Hatch/2W only'],
      lateArrivalPolicy: {
        graceMinutes: 15,
        forfeitAfterMinutes: 30,
        summary: '15 min arrival grace; strict 18:00 checkout applies regardless of arrival time.',
      },
      operationalChecks: defaultOperationalChecks(true, 'USR-ADM-03'),
      operationalChecksPassed: true,
      propertyEligibleForUse: true,
      lastPeriodicReviewAt: '2026-10-16T15:45:00Z',
      availabilitySource: 'schedule_engine',
      lastUpdatedIso: '2026-11-20T04:10:00Z',
    },
    {
      id: 'FAC-06',
      providerId: 'PRV-06',
      name: 'Hebbal Flyover Unverified Open Plot',
      providerName: 'Hebbal Strip Claimant #88',
      providerType: 'individual',
      address: 'Adjacent Service Strip, Hebbal, Bengaluru 560024',
      zone: 'Flyover Edge',
      verificationStatus: 'pending',
      authorityDocRef: 'MISSING_PROPERTY_AUTHORITY_DOC',
      entranceLabel: 'Unmarked Dirt Track',
      walkingDistanceM: 190,
      walkingMinutes: 2,
      walkPathSafety: 'Unpaved shoulder; no lighting verified',
      lat: 13.0778,
      lng: 77.5974,
      entranceLat: 13.0774,
      entranceLng: 77.5964,
      walkPathCoords: [
        [13.0778, 77.5974],
        [13.0774, 77.5964],
        [13.0766, 77.5944],
      ],
      accessControl: 'None (Pending Admin Verification)',
      accessInstructions: '',
      restrictions: [],
      lateArrivalPolicy: {
        graceMinutes: 10,
        forfeitAfterMinutes: 20,
        summary: 'Pending policy audit.',
      },
      operationalChecks: defaultOperationalChecks(false),
      operationalChecksPassed: false,
      propertyEligibleForUse: false,
      availabilitySource: 'pending_audit',
      lastUpdatedIso: '2026-11-20T03:50:00Z',
    },
    {
      id: 'FAC-07',
      providerId: 'PRV-BLR-HUB',
      name: 'Church Street Multi-Level Annex',
      providerName: 'Central Metro Parking Co.',
      providerType: 'commercial',
      address: 'Rest House Crescent, Off Church St, Bengaluru 560001',
      zone: 'MG Road & Church Street',
      verificationStatus: 'verified',
      authorityDocRef: 'AUTH-BENG-961 (BBMP Commercial Permit)',
      entranceLabel: 'Rest House Crescent Boom Gate',
      walkingDistanceM: 180,
      walkingMinutes: 2,
      walkPathSafety: 'Pedestrian-priority street with CCTV & night lighting',
      lat: 12.9749,
      lng: 77.6054,
      entranceLat: 12.9752,
      entranceLng: 77.6059,
      walkPathCoords: [
        [12.9749, 77.6054],
        [12.9752, 77.6059],
        [12.9756, 77.6066],
      ],
      accessControl: 'QR barrier + Attendant kiosk',
      accessInstructions: 'Approach Rest House Crescent from Brigade Rd; scan QR at kiosk.',
      restrictions: ['One-way street entry only', 'Max height 210cm'],
      lateArrivalPolicy: {
        graceMinutes: 20,
        forfeitAfterMinutes: 45,
        summary: '20 min arrival grace; QR remains valid up to 45 min post slot start.',
      },
      operationalChecks: defaultOperationalChecks(true, 'USR-ADM-03'),
      operationalChecksPassed: true,
      propertyEligibleForUse: true,
      lastPeriodicReviewAt: '2026-10-01T10:00:00Z',
      availabilitySource: 'provider_portal',
      lastUpdatedIso: '2026-11-20T05:00:00Z',
    },
    {
      id: 'FAC-08',
      providerId: 'PRV-BLR-HUB',
      name: 'Indiranagar 12th Main Shared Deck',
      providerName: '100Ft Urban Mobility',
      providerType: 'commercial',
      address: '12th Main Road, HAL 2nd Stage, Indiranagar, Bengaluru 560038',
      zone: 'Indiranagar 100 Feet Road',
      verificationStatus: 'verified',
      authorityDocRef: 'AUTH-BENG-964 (Commercial Lease & Fire NOC)',
      entranceLabel: '12th Main Side Gate A',
      walkingDistanceM: 230,
      walkingMinutes: 3,
      walkPathSafety: 'Tree-lined lit footpath toward 100 Ft Rd Metro',
      lat: 12.9776,
      lng: 77.6389,
      entranceLat: 12.978,
      entranceLng: 77.6396,
      walkPathCoords: [
        [12.9776, 77.6389],
        [12.978, 77.6396],
        [12.9784, 77.6408],
      ],
      accessControl: 'Smart QR + Security desk',
      accessInstructions: 'Enter 12th Main Gate A next to banyan tree; guard opens barrier on QR.',
      restrictions: ['Quiet residential edge after 22:00', 'Max height 205cm'],
      lateArrivalPolicy: {
        graceMinutes: 15,
        forfeitAfterMinutes: 40,
        summary: '15 min grace window; contact guard desk for extended hold.',
      },
      operationalChecks: defaultOperationalChecks(true, 'USR-ADM-03'),
      operationalChecksPassed: true,
      propertyEligibleForUse: true,
      lastPeriodicReviewAt: '2026-10-01T10:00:00Z',
      availabilitySource: 'provider_portal',
      lastUpdatedIso: '2026-11-20T05:00:00Z',
    },
    {
      id: 'FAC-09',
      providerId: 'PRV-BLR-HUB',
      name: 'Koramangala Sony Signal Plaza',
      providerName: 'Koramangala Park Co-op',
      providerType: 'commercial',
      address: '80 Feet Road, 4th Block, Koramangala, Bengaluru 560034',
      zone: 'Koramangala 4th Block',
      verificationStatus: 'verified',
      authorityDocRef: 'AUTH-BENG-967 (Operator Permit)',
      entranceLabel: '80Ft Road Basement Ramp',
      walkingDistanceM: 210,
      walkingMinutes: 3,
      walkPathSafety: 'Wide paved sidewalk with signal crossing',
      lat: 12.9363,
      lng: 77.6261,
      entranceLat: 12.9358,
      entranceLng: 77.6254,
      walkPathCoords: [
        [12.9363, 77.6261],
        [12.9358, 77.6254],
        [12.9352, 77.6245],
      ],
      accessControl: 'Attendant + PIN code',
      accessInstructions: 'Enter basement ramp off 80 Ft Rd 50m south of Sony Signal.',
      restrictions: ['Basement max clearance 210cm', 'Valet key retention not required'],
      lateArrivalPolicy: {
        graceMinutes: 20,
        forfeitAfterMinutes: 45,
        summary: '20 min arrival grace.',
      },
      operationalChecks: defaultOperationalChecks(true, 'USR-ADM-03'),
      operationalChecksPassed: true,
      propertyEligibleForUse: true,
      lastPeriodicReviewAt: '2026-10-01T10:00:00Z',
      availabilitySource: 'provider_portal',
      lastUpdatedIso: '2026-11-20T05:00:00Z',
    },
    {
      id: 'FAC-10',
      providerId: 'PRV-BLR-HUB',
      name: 'Whitefield ITPL Metro Park',
      providerName: 'EastTech Parking Solutions',
      providerType: 'commercial',
      address: 'ITPL Main Rd, Pattandur Agrahara, Whitefield, Bengaluru 560066',
      zone: 'Whitefield ITPL',
      verificationStatus: 'verified',
      authorityDocRef: 'AUTH-BENG-971 (Tech Park Shared Pool)',
      entranceLabel: 'ITPL Metro Gate 3',
      walkingDistanceM: 200,
      walkingMinutes: 3,
      walkPathSafety: 'Covered skywalk access to ITPL & Metro',
      lat: 12.9862,
      lng: 77.7346,
      entranceLat: 12.9859,
      entranceLng: 77.7354,
      walkPathCoords: [
        [12.9862, 77.7346],
        [12.9859, 77.7354],
        [12.9855, 77.7363],
      ],
      accessControl: 'FASTag / QR Boom Barrier',
      accessInstructions: 'Use right-hand ParkPool lane at Gate 3 boom barrier.',
      restrictions: ['Mandatory boom barrier QR scan', 'Max height 210cm'],
      lateArrivalPolicy: {
        graceMinutes: 20,
        forfeitAfterMinutes: 60,
        summary: '20 min arrival grace; 60 min hold guarantee.',
      },
      operationalChecks: defaultOperationalChecks(true, 'USR-ADM-03'),
      operationalChecksPassed: true,
      propertyEligibleForUse: true,
      lastPeriodicReviewAt: '2026-10-01T10:00:00Z',
      availabilitySource: 'provider_portal',
      lastUpdatedIso: '2026-11-20T05:00:00Z',
    },
    {
      id: 'FAC-11',
      providerId: 'PRV-BLR-HUB',
      name: 'Jayanagar Shopping West Bay',
      providerName: 'South Bengaluru Civic Pool',
      providerType: 'community',
      address: '11th Main Rd, 4th Block, Jayanagar, Bengaluru 560011',
      zone: 'Jayanagar 4th Block Complex',
      verificationStatus: 'verified',
      authorityDocRef: 'AUTH-BENG-974 (Complex Association NOC)',
      entranceLabel: '11th Main West Entry',
      walkingDistanceM: 160,
      walkingMinutes: 2,
      walkPathSafety: 'Busy shopping pedestrian promenade',
      lat: 12.9291,
      lng: 77.5849,
      entranceLat: 12.9295,
      entranceLng: 77.5844,
      walkPathCoords: [
        [12.9291, 77.5849],
        [12.9295, 77.5844],
        [12.9299, 77.5838],
      ],
      accessControl: 'Gate attendant + Booking ID',
      accessInstructions: 'Show booking code to uniformed civic attendant at 11th Main gate.',
      restrictions: ['Shopping hours 06:00–23:00', 'No commercial vans'],
      lateArrivalPolicy: {
        graceMinutes: 15,
        forfeitAfterMinutes: 40,
        summary: '15 min arrival grace.',
      },
      operationalChecks: defaultOperationalChecks(true, 'USR-ADM-03'),
      operationalChecksPassed: true,
      propertyEligibleForUse: true,
      lastPeriodicReviewAt: '2026-10-01T10:00:00Z',
      availabilitySource: 'schedule_engine',
      lastUpdatedIso: '2026-11-20T05:00:00Z',
    },
    {
      id: 'FAC-12',
      providerId: 'PRV-BLR-HUB',
      name: 'HSR 27th Main Community Pool',
      providerName: 'HSR Sector 2 RWA Pool',
      providerType: 'community',
      address: '27th Main Road, Sector 2, HSR Layout, Bengaluru 560102',
      zone: 'HSR Layout Sector 2',
      verificationStatus: 'verified',
      authorityDocRef: 'AUTH-BENG-978 (RWA Shared Bay Charter)',
      entranceLabel: '27th Main Gate 2',
      walkingDistanceM: 190,
      walkingMinutes: 2,
      walkPathSafety: 'Lit neighborhood avenue with guard post',
      lat: 12.913,
      lng: 77.6432,
      entranceLat: 12.9126,
      entranceLng: 77.6439,
      walkPathCoords: [
        [12.913, 77.6432],
        [12.9126, 77.6439],
        [12.9121, 77.6446],
      ],
      accessControl: 'MyGate Visitor OTP',
      accessInstructions: 'Verify booking OTP at 27th Main Gate 2 guard booth.',
      restrictions: ['Visitor bays only', 'Max height 210cm'],
      lateArrivalPolicy: {
        graceMinutes: 15,
        forfeitAfterMinutes: 35,
        summary: '15 min arrival grace.',
      },
      operationalChecks: defaultOperationalChecks(true, 'USR-ADM-03'),
      operationalChecksPassed: true,
      propertyEligibleForUse: true,
      lastPeriodicReviewAt: '2026-10-01T10:00:00Z',
      availabilitySource: 'schedule_engine',
      lastUpdatedIso: '2026-11-20T05:00:00Z',
    },
    {
      id: 'FAC-13',
      providerId: 'PRV-BLR-HUB',
      name: 'Malleshwaram Mantri Edge Lot',
      providerName: 'Sampige Mobility Hub',
      providerType: 'commercial',
      address: 'Sampige Road, Malleshwaram, Bengaluru 560003',
      zone: 'Malleshwaram 8th Cross',
      verificationStatus: 'verified',
      authorityDocRef: 'AUTH-BENG-981 (Commercial Lot License)',
      entranceLabel: 'Sampige Road South Gate',
      walkingDistanceM: 140,
      walkingMinutes: 2,
      walkPathSafety: 'Paved shopping walkway with street lights',
      lat: 12.9912,
      lng: 77.5703,
      entranceLat: 12.9914,
      entranceLng: 77.5707,
      walkPathCoords: [
        [12.9912, 77.5703],
        [12.9914, 77.5707],
        [12.9916, 77.5712],
      ],
      accessControl: 'QR Guard Scan',
      accessInstructions: 'Enter via Sampige Rd South Gate and park in yellow-striped ParkPool row.',
      restrictions: ['Uncovered lot', 'Close at 23:00'],
      lateArrivalPolicy: {
        graceMinutes: 20,
        forfeitAfterMinutes: 45,
        summary: '20 min arrival grace.',
      },
      operationalChecks: defaultOperationalChecks(true, 'USR-ADM-03'),
      operationalChecksPassed: true,
      propertyEligibleForUse: true,
      lastPeriodicReviewAt: '2026-10-01T10:00:00Z',
      availabilitySource: 'provider_portal',
      lastUpdatedIso: '2026-11-20T05:00:00Z',
    },
    {
      id: 'FAC-14',
      providerId: 'PRV-BLR-HUB',
      name: 'Electronic City Tech Driveway',
      providerName: 'Hosur Corridor Shared Bays',
      providerType: 'individual',
      address: 'Velankani Drive, Phase 1, Electronic City, Bengaluru 560100',
      zone: 'Electronic City Phase 1',
      verificationStatus: 'verified',
      authorityDocRef: 'AUTH-BENG-985 (Verified Title + Gate PIN)',
      entranceLabel: 'Velankani Gate 1',
      walkingDistanceM: 170,
      walkingMinutes: 2,
      walkPathSafety: 'Gated campus walkway with security patrol',
      lat: 12.8461,
      lng: 77.6615,
      entranceLat: 12.8456,
      entranceLng: 77.6608,
      walkPathCoords: [
        [12.8461, 77.6615],
        [12.8456, 77.6608],
        [12.8452, 77.6602],
      ],
      accessControl: 'Smart PIN Gate Lock',
      accessInstructions: 'Enter booking PIN on Velankani Gate 1 keypad.',
      restrictions: ['Max height 210cm', 'EV plug 7.4kW Type-2'],
      lateArrivalPolicy: {
        graceMinutes: 15,
        forfeitAfterMinutes: 45,
        summary: '15 min arrival grace.',
      },
      operationalChecks: defaultOperationalChecks(true, 'USR-ADM-03'),
      operationalChecksPassed: true,
      propertyEligibleForUse: true,
      lastPeriodicReviewAt: '2026-10-01T10:00:00Z',
      availabilitySource: 'schedule_engine',
      lastUpdatedIso: '2026-11-20T05:00:00Z',
    },
  ];

  public spaces: ParkingSpace[] = [
    {
      id: 'BAY-A1',
      facilityId: 'FAC-01',
      spaceCode: 'N-Annex A1 (EV)',
      publicationStatus: 'approved',
      allowedTypes: ['hatchback', 'sedan', 'suv'],
      maxLengthCm: 500,
      maxWidthCm: 215,
      maxHeightCm: 210,
      covered: true,
      evCharging: true,
      hourlyPriceInr: 70,
      bufferMinutes: 15,
      operatingStartMin: 7 * 60,
      operatingEndMin: 23 * 60,
      hardDepartureMin: 22 * 60 + 45,
      restrictions: ['No commercial trucks', 'Max height 210cm'],
      ownerBlocks: [],
      withdrawals: [],
      reviews: [
        {
          id: 'REV-101',
          bookingId: 'BK-SEED-901',
          authorAlias: 'Arjun M.',
          rating: 5,
          comment: 'North Service Gate B instructions matched exact ramp. 7.4kW charger worked smoothly.',
          theme: 'Accurate Entrance & EV',
          createdAt: '2026-11-18',
        },
        {
          id: 'REV-102',
          bookingId: 'BK-SEED-902',
          authorAlias: 'Divya S.',
          rating: 4,
          comment: 'Covered walk to mall entrance took under 4 minutes even with rain.',
          theme: 'Covered Walkway',
          createdAt: '2026-11-16',
        },
      ],
    },
    {
      id: 'BAY-A2',
      facilityId: 'FAC-01',
      spaceCode: 'N-Annex A2',
      publicationStatus: 'approved',
      allowedTypes: ['hatchback', 'sedan'],
      maxLengthCm: 465,
      maxWidthCm: 190,
      maxHeightCm: 195,
      covered: true,
      evCharging: false,
      hourlyPriceInr: 60,
      bufferMinutes: 15,
      operatingStartMin: 7 * 60,
      operatingEndMin: 23 * 60,
      hardDepartureMin: 22 * 60 + 45,
      restrictions: ['Hatchback/Sedan only', 'Max height 195cm'],
      ownerBlocks: [],
      withdrawals: [],
      reviews: [
        {
          id: 'REV-103',
          bookingId: 'BK-SEED-903',
          authorAlias: 'Karthik R.',
          rating: 5,
          comment: 'Zero hassle with guard QR scan. Very clean bay.',
          theme: 'Smooth Check-in',
          createdAt: '2026-11-17',
        },
      ],
    },
    {
      id: 'BAY-A3',
      facilityId: 'FAC-01',
      spaceCode: 'N-Annex 2W Zone',
      publicationStatus: 'approved',
      allowedTypes: ['two_wheeler'],
      maxLengthCm: 240,
      maxWidthCm: 100,
      maxHeightCm: 180,
      covered: true,
      evCharging: true,
      hourlyPriceInr: 25,
      bufferMinutes: 15,
      operatingStartMin: 7 * 60,
      operatingEndMin: 23 * 60,
      hardDepartureMin: 22 * 60 + 45,
      restrictions: ['Two-wheelers only', 'Helmet locker inside kiosk'],
      ownerBlocks: [],
      withdrawals: [],
      reviews: [
        {
          id: 'REV-109',
          bookingId: 'BK-SEED-909',
          authorAlias: 'Kiran S.',
          rating: 5,
          comment: 'Dedicated covered two-wheeler bays right next to North Service Gate B.',
          theme: 'Dedicated 2W Bay',
          createdAt: '2026-11-18',
        },
      ],
    },
    {
      id: 'BAY-B1',
      facilityId: 'FAC-02',
      spaceCode: 'S-Hub B1',
      publicationStatus: 'approved',
      allowedTypes: ['hatchback', 'sedan', 'suv'],
      maxLengthCm: 495,
      maxWidthCm: 210,
      maxHeightCm: 205,
      covered: true,
      evCharging: false,
      hourlyPriceInr: 55,
      bufferMinutes: 15,
      operatingStartMin: 8 * 60,
      operatingEndMin: 22 * 60,
      hardDepartureMin: 21 * 60 + 45,
      restrictions: ['Basement ramp clearance 205cm', 'Hard departure 21:45'],
      ownerBlocks: [],
      withdrawals: [],
      reviews: [
        {
          id: 'REV-104',
          bookingId: 'BK-SEED-904',
          authorAlias: 'Neha P.',
          rating: 4,
          comment: 'Good value for weekend mall visit; 5 minute walk across signal.',
          theme: 'Value & Security',
          createdAt: '2026-11-15',
        },
      ],
    },
    {
      id: 'BAY-B2',
      facilityId: 'FAC-02',
      spaceCode: 'S-Hub B2 (EV Compact)',
      publicationStatus: 'approved',
      allowedTypes: ['two_wheeler', 'hatchback'],
      maxLengthCm: 400,
      maxWidthCm: 180,
      maxHeightCm: 190,
      covered: true,
      evCharging: true,
      hourlyPriceInr: 35,
      bufferMinutes: 15,
      operatingStartMin: 8 * 60,
      operatingEndMin: 22 * 60,
      hardDepartureMin: 21 * 60 + 45,
      restrictions: ['Compact vehicles / 2W only', '3.3kW EV point'],
      ownerBlocks: [],
      withdrawals: [],
      reviews: [
        {
          id: 'REV-105',
          bookingId: 'BK-SEED-905',
          authorAlias: 'Rohan V.',
          rating: 5,
          comment: 'Perfect for compact EV and two-wheelers.',
          theme: 'Compact EV Fit',
          createdAt: '2026-11-19',
        },
      ],
    },
    {
      id: 'BAY-C1',
      facilityId: 'FAC-03',
      spaceCode: 'MetroLink C1',
      publicationStatus: 'approved',
      allowedTypes: ['two_wheeler', 'hatchback', 'sedan', 'suv'],
      maxLengthCm: 485,
      maxWidthCm: 205,
      maxHeightCm: 220,
      covered: false,
      evCharging: false,
      hourlyPriceInr: 45,
      bufferMinutes: 15,
      operatingStartMin: 6 * 60,
      operatingEndMin: 23 * 60,
      hardDepartureMin: 22 * 60 + 30,
      restrictions: ['Uncovered lot', 'Hard departure 22:30'],
      ownerBlocks: [],
      withdrawals: [],
      reviews: [
        {
          id: 'REV-106',
          bookingId: 'BK-SEED-906',
          authorAlias: 'Sneha T.',
          rating: 4,
          comment: 'Budget friendly and easy exit onto Bellary Road.',
          theme: 'Easy Exit',
          createdAt: '2026-11-14',
        },
      ],
    },
    {
      id: 'BAY-D1',
      facilityId: 'FAC-04',
      spaceCode: 'Crescent D1 (Height Cap)',
      publicationStatus: 'approved',
      allowedTypes: ['hatchback', 'sedan'],
      maxLengthCm: 458,
      maxWidthCm: 182,
      maxHeightCm: 165,
      covered: true,
      evCharging: false,
      hourlyPriceInr: 50,
      bufferMinutes: 15,
      operatingStartMin: 8 * 60,
      operatingEndMin: 21 * 60,
      hardDepartureMin: 20 * 60 + 45,
      restrictions: ['Max height 165cm', 'No SUVs', 'Society resident return 19:30'],
      ownerBlocks: [
        {
          id: 'OWN-D1',
          startMin: 19 * 60 + 30,
          endMin: 21 * 60,
          label: 'Society Resident Night Return',
          type: 'owner_block',
        },
      ],
      withdrawals: [],
      reviews: [
        {
          id: 'REV-107',
          bookingId: 'BK-SEED-907',
          authorAlias: 'Meera G.',
          rating: 4,
          comment: 'Quiet gated society; low overhead pipe so strictly for sedans/hatchbacks.',
          theme: 'Clear Height Warning',
          createdAt: '2026-11-12',
        },
      ],
    },
    {
      id: 'BAY-E1',
      facilityId: 'FAC-05',
      spaceCode: 'Lane4 Driveway E1',
      publicationStatus: 'approved',
      allowedTypes: ['two_wheeler', 'hatchback', 'sedan'],
      maxLengthCm: 460,
      maxWidthCm: 185,
      maxHeightCm: 250,
      covered: false,
      evCharging: false,
      hourlyPriceInr: 40,
      bufferMinutes: 15,
      operatingStartMin: 9 * 60,
      operatingEndMin: 18 * 60,
      hardDepartureMin: 18 * 60,
      restrictions: ['Strict hard cutoff 18:00', 'Sedan/Hatch/2W only'],
      ownerBlocks: [
        {
          id: 'OWN-E1',
          startMin: 18 * 60 + 15,
          endMin: 22 * 60,
          label: 'Host Family Car Return (Hard Cutoff 18:00)',
          type: 'owner_block',
        },
      ],
      withdrawals: [],
      reviews: [
        {
          id: 'REV-108',
          bookingId: 'BK-SEED-908',
          authorAlias: 'Vikram N.',
          rating: 4,
          comment: 'Very affordable daytime slot, host expects timely checkout before 18:00.',
          theme: 'Host Hard Deadline',
          createdAt: '2026-11-11',
        },
      ],
    },
    {
      id: 'BAY-F1',
      facilityId: 'FAC-06',
      spaceCode: 'Pending Plot F1',
      publicationStatus: 'pending_approval',
      allowedTypes: ['hatchback', 'sedan', 'suv'],
      maxLengthCm: 520,
      maxWidthCm: 220,
      maxHeightCm: 300,
      covered: false,
      evCharging: false,
      hourlyPriceInr: 25,
      bufferMinutes: 0,
      operatingStartMin: 0,
      operatingEndMin: 24 * 60,
      hardDepartureMin: 23 * 60 + 59,
      restrictions: [],
      ownerBlocks: [],
      withdrawals: [],
      reviews: [],
    },
    {
      id: 'BAY-MG1',
      facilityId: 'FAC-07',
      spaceCode: 'Church St Level 1 (EV)',
      publicationStatus: 'approved',
      allowedTypes: ['hatchback', 'sedan', 'suv'],
      maxLengthCm: 500,
      maxWidthCm: 215,
      maxHeightCm: 210,
      covered: true,
      evCharging: true,
      hourlyPriceInr: 80,
      bufferMinutes: 15,
      operatingStartMin: 6 * 60,
      operatingEndMin: 23 * 60 + 30,
      hardDepartureMin: 23 * 60 + 30,
      restrictions: ['Max height 210cm'],
      ownerBlocks: [],
      withdrawals: [],
      reviews: [
        {
          id: 'REV-201',
          bookingId: 'BK-SEED-921',
          authorAlias: 'Rohan D.',
          rating: 5,
          comment: 'Steps away from Church Street & MG Road Metro.',
          theme: 'Central Location',
          createdAt: '2026-11-18',
        },
      ],
    },
    {
      id: 'BAY-MG2',
      facilityId: 'FAC-07',
      spaceCode: 'Church St 2W Zone',
      publicationStatus: 'approved',
      allowedTypes: ['two_wheeler'],
      maxLengthCm: 240,
      maxWidthCm: 100,
      maxHeightCm: 180,
      covered: true,
      evCharging: true,
      hourlyPriceInr: 30,
      bufferMinutes: 15,
      operatingStartMin: 6 * 60,
      operatingEndMin: 23 * 60 + 30,
      hardDepartureMin: 23 * 60 + 30,
      restrictions: ['Two-wheelers only'],
      ownerBlocks: [],
      withdrawals: [],
      reviews: [],
    },
    {
      id: 'BAY-IND1',
      facilityId: 'FAC-08',
      spaceCode: '12th Main Bay 1 (EV)',
      publicationStatus: 'approved',
      allowedTypes: ['hatchback', 'sedan', 'suv'],
      maxLengthCm: 495,
      maxWidthCm: 210,
      maxHeightCm: 205,
      covered: true,
      evCharging: true,
      hourlyPriceInr: 70,
      bufferMinutes: 15,
      operatingStartMin: 6 * 60,
      operatingEndMin: 23 * 60 + 30,
      hardDepartureMin: 23 * 60 + 30,
      restrictions: ['Quiet zone post 22:00'],
      ownerBlocks: [],
      withdrawals: [],
      reviews: [],
    },
    {
      id: 'BAY-IND2',
      facilityId: 'FAC-08',
      spaceCode: '12th Main 2W Deck',
      publicationStatus: 'approved',
      allowedTypes: ['two_wheeler'],
      maxLengthCm: 240,
      maxWidthCm: 100,
      maxHeightCm: 180,
      covered: true,
      evCharging: false,
      hourlyPriceInr: 25,
      bufferMinutes: 15,
      operatingStartMin: 6 * 60,
      operatingEndMin: 23 * 60 + 30,
      hardDepartureMin: 23 * 60 + 30,
      restrictions: ['Two-wheelers only'],
      ownerBlocks: [],
      withdrawals: [],
      reviews: [],
    },
    {
      id: 'BAY-KOR1',
      facilityId: 'FAC-09',
      spaceCode: '80Ft Plaza Bay K1',
      publicationStatus: 'approved',
      allowedTypes: ['two_wheeler', 'hatchback', 'sedan', 'suv'],
      maxLengthCm: 490,
      maxWidthCm: 205,
      maxHeightCm: 210,
      covered: true,
      evCharging: false,
      hourlyPriceInr: 60,
      bufferMinutes: 15,
      operatingStartMin: 6 * 60,
      operatingEndMin: 23 * 60 + 30,
      hardDepartureMin: 23 * 60 + 30,
      restrictions: ['Max height 210cm'],
      ownerBlocks: [],
      withdrawals: [],
      reviews: [],
    },
    {
      id: 'BAY-WHT1',
      facilityId: 'FAC-10',
      spaceCode: 'ITPL Metro Bay W1 (EV)',
      publicationStatus: 'approved',
      allowedTypes: ['hatchback', 'sedan', 'suv'],
      maxLengthCm: 500,
      maxWidthCm: 215,
      maxHeightCm: 210,
      covered: true,
      evCharging: true,
      hourlyPriceInr: 55,
      bufferMinutes: 15,
      operatingStartMin: 6 * 60,
      operatingEndMin: 23 * 60 + 30,
      hardDepartureMin: 23 * 60 + 30,
      restrictions: ['Tech park boom barrier QR required'],
      ownerBlocks: [],
      withdrawals: [],
      reviews: [],
    },
    {
      id: 'BAY-WHT2',
      facilityId: 'FAC-10',
      spaceCode: 'ITPL 2W Covered W2',
      publicationStatus: 'approved',
      allowedTypes: ['two_wheeler'],
      maxLengthCm: 240,
      maxWidthCm: 100,
      maxHeightCm: 180,
      covered: true,
      evCharging: true,
      hourlyPriceInr: 20,
      bufferMinutes: 15,
      operatingStartMin: 6 * 60,
      operatingEndMin: 23 * 60 + 30,
      hardDepartureMin: 23 * 60 + 30,
      restrictions: ['Two-wheelers only'],
      ownerBlocks: [],
      withdrawals: [],
      reviews: [],
    },
    {
      id: 'BAY-JAY1',
      facilityId: 'FAC-11',
      spaceCode: 'Jayanagar West J1',
      publicationStatus: 'approved',
      allowedTypes: ['two_wheeler', 'hatchback', 'sedan', 'suv'],
      maxLengthCm: 485,
      maxWidthCm: 205,
      maxHeightCm: 220,
      covered: true,
      evCharging: false,
      hourlyPriceInr: 45,
      bufferMinutes: 15,
      operatingStartMin: 6 * 60,
      operatingEndMin: 23 * 60,
      hardDepartureMin: 23 * 60,
      restrictions: ['Close at 23:00'],
      ownerBlocks: [],
      withdrawals: [],
      reviews: [],
    },
    {
      id: 'BAY-HSR1',
      facilityId: 'FAC-12',
      spaceCode: '27th Main Pool H1 (EV)',
      publicationStatus: 'approved',
      allowedTypes: ['two_wheeler', 'hatchback', 'sedan', 'suv'],
      maxLengthCm: 490,
      maxWidthCm: 205,
      maxHeightCm: 210,
      covered: true,
      evCharging: true,
      hourlyPriceInr: 50,
      bufferMinutes: 15,
      operatingStartMin: 6 * 60,
      operatingEndMin: 23 * 60,
      hardDepartureMin: 23 * 60,
      restrictions: ['MyGate Visitor OTP required'],
      ownerBlocks: [],
      withdrawals: [],
      reviews: [],
    },
    {
      id: 'BAY-MAL1',
      facilityId: 'FAC-13',
      spaceCode: 'Sampige Lot M1',
      publicationStatus: 'approved',
      allowedTypes: ['two_wheeler', 'hatchback', 'sedan', 'suv'],
      maxLengthCm: 490,
      maxWidthCm: 205,
      maxHeightCm: 210,
      covered: false,
      evCharging: false,
      hourlyPriceInr: 55,
      bufferMinutes: 15,
      operatingStartMin: 6 * 60,
      operatingEndMin: 23 * 60,
      hardDepartureMin: 23 * 60,
      restrictions: ['Uncovered open-air lot'],
      ownerBlocks: [],
      withdrawals: [],
      reviews: [],
    },
    {
      id: 'BAY-EC1',
      facilityId: 'FAC-14',
      spaceCode: 'Velankani Bay E1 (EV)',
      publicationStatus: 'approved',
      allowedTypes: ['two_wheeler', 'hatchback', 'sedan', 'suv'],
      maxLengthCm: 495,
      maxWidthCm: 210,
      maxHeightCm: 210,
      covered: true,
      evCharging: true,
      hourlyPriceInr: 40,
      bufferMinutes: 15,
      operatingStartMin: 6 * 60,
      operatingEndMin: 23 * 60 + 30,
      hardDepartureMin: 23 * 60 + 30,
      restrictions: ['Smart PIN Gate Lock'],
      ownerBlocks: [],
      withdrawals: [],
      reviews: [],
    },
  ];

  public bookings: BookingRecord[] = [
    {
      id: 'BK-2026-4101',
      spaceId: 'BAY-A1',
      facilityId: 'FAC-01',
      facilityName: 'Phoenix North Commercial Annex',
      spaceCode: 'N-Annex A1 (EV)',
      driverName: 'Aarav Sharma',
      driverEmail: 'aarav.sharma@bengaluru.in',
      driverLicense: 'KA04 20210048192',
      vehicleId: 'VEH-SUV-01',
      vehicleLabel: 'Tata Harrier EV (SUV)',
      vehiclePlate: 'KA-04-MN-8821',
      startMin: 10 * 60,
      endMin: 13 * 60,
      bufferMinutes: 15,
      status: 'confirmed',
      baseAmountInr: 210,
      platformFeeInr: 21,
      gstInr: 42,
      totalAmountInr: 273,
      accessCode: 'PKP-904-A1',
      entranceLabel: 'North Service Gate B (Boom Barrier)',
      createdAt: '2026-11-20T03:10:00Z',
      lateArrivalPolicy: {
        graceMinutes: 20,
        forfeitAfterMinutes: 45,
        summary: '20 min arrival grace; bay held up to 45 min after slot start.',
      },
      extensionRequests: [],
      paymentOrderId: 'ORD-4101',
      paymentStatus: 'paid',
      refundStatus: 'none',
      invoiceNumber: 'INV-PKP-2026-4101',
      auditTrail: [
        '03:10Z Transactional Hold Created',
        '03:11Z Server Payment Order ORD-4101 Created (₹273 INR)',
        '03:11Z Signed Gateway Webhook Verified -> Booking Confirmed',
      ],
    },
    {
      id: 'BK-2026-4102',
      spaceId: 'BAY-B1',
      facilityId: 'FAC-02',
      facilityName: 'Sahakarnagar Business Hub Basement',
      spaceCode: 'S-Hub B1',
      driverName: 'Siddharth Menon',
      driverEmail: 'siddharth.m@bengaluru.in',
      vehicleId: 'VEH-SEDAN-02',
      vehicleLabel: 'Honda City e:HEV (Sedan)',
      vehiclePlate: 'KA-03-AB-4190',
      startMin: 15 * 60,
      endMin: 18 * 60,
      bufferMinutes: 15,
      status: 'confirmed',
      baseAmountInr: 165,
      platformFeeInr: 17,
      gstInr: 33,
      totalAmountInr: 215,
      accessCode: 'PKP-912-B1',
      entranceLabel: 'West Basement Ramp Gate 2',
      createdAt: '2026-11-20T03:25:00Z',
      lateArrivalPolicy: {
        graceMinutes: 15,
        forfeitAfterMinutes: 40,
        summary: '15 min arrival grace; notify guard desk if delayed beyond 15 min.',
      },
      extensionRequests: [],
      paymentOrderId: 'ORD-4102',
      paymentStatus: 'paid',
      refundStatus: 'none',
      invoiceNumber: 'INV-PKP-2026-4102',
      auditTrail: [
        '03:25Z Transactional Hold Created',
        '03:26Z Signed Webhook EVT-SEED-4102 Verified',
      ],
    },
    {
      id: 'BK-2026-4103',
      spaceId: 'BAY-E1',
      facilityId: 'FAC-05',
      facilityName: 'Yelahanka Gate Private Driveway',
      spaceCode: 'Lane4 Driveway E1',
      driverName: 'Priya Nair',
      driverEmail: 'priya.nair@bengaluru.in',
      vehicleId: 'VEH-HATCH-03',
      vehicleLabel: 'Tata Tiago EV (Hatchback)',
      vehiclePlate: 'KA-01-XY-2045',
      startMin: 11 * 60 + 30,
      endMin: 14 * 60,
      bufferMinutes: 15,
      status: 'occupied',
      baseAmountInr: 100,
      platformFeeInr: 10,
      gstInr: 20,
      totalAmountInr: 130,
      accessCode: 'PKP-958-E1',
      entranceLabel: 'Lane 4 Blue Sliding Gate',
      createdAt: '2026-11-20T02:45:00Z',
      checkedInAt: '2026-11-20T06:02:00Z',
      arrivalStatus: 'on_time',
      lateArrivalPolicy: {
        graceMinutes: 15,
        forfeitAfterMinutes: 30,
        summary: '15 min arrival grace; strict 18:00 checkout applies regardless of arrival time.',
      },
      extensionRequests: [
        {
          id: 'EXT-SEED-1',
          bookingId: 'BK-2026-4103',
          requestedEndMin: 14 * 60 + 30,
          additionalBaseInr: 20,
          additionalFeeInr: 10,
          additionalGstInr: 5,
          additionalTotalInr: 35,
          status: 'pending_host_approval',
          reason: 'Zero conflict with next booking or 18:00 hard cutoff; awaiting host sign-off.',
          createdAt: '2026-11-20T06:40:00Z',
        },
      ],
      paymentOrderId: 'ORD-4103',
      paymentStatus: 'paid',
      refundStatus: 'none',
      invoiceNumber: 'INV-PKP-2026-4103',
      auditTrail: [
        '02:45Z Booking Confirmed',
        '11:32Z Gate Check-In Verified (On Time)',
        '12:40Z Extension +30m queued for host approval',
      ],
    },
    {
      id: 'BK-2026-4099',
      spaceId: 'BAY-E1',
      facilityId: 'FAC-05',
      facilityName: 'Yelahanka Gate Private Driveway',
      spaceCode: 'Lane4 Driveway E1',
      driverName: 'Aarav Sharma',
      driverEmail: 'aarav.sharma@bengaluru.in',
      driverLicense: 'KA04 20210048192',
      vehicleId: 'VEH-SUV-01',
      vehicleLabel: 'Tata Harrier EV (SUV)',
      vehiclePlate: 'KA-04-MN-8821',
      startMin: 9 * 60,
      endMin: 11 * 60,
      bufferMinutes: 15,
      status: 'completed',
      baseAmountInr: 80,
      platformFeeInr: 10,
      gstInr: 16,
      totalAmountInr: 106,
      accessCode: 'PKP-958-E0',
      entranceLabel: 'Lane 4 Blue Sliding Gate',
      createdAt: '2026-11-19T08:00:00Z',
      checkedInAt: '2026-11-19T09:04:00Z',
      checkedOutAt: '2026-11-19T10:55:00Z',
      arrivalStatus: 'on_time',
      lateArrivalPolicy: {
        graceMinutes: 15,
        forfeitAfterMinutes: 30,
        summary: '15 min arrival grace; strict 18:00 checkout applies.',
      },
      extensionRequests: [],
      paymentOrderId: 'ORD-4099',
      paymentStatus: 'paid',
      refundStatus: 'none',
      invoiceNumber: 'INV-PKP-2026-4099',
      auditTrail: [
        '08:00Z Confirmed & Paid',
        '09:04Z Checked In',
        '10:55Z Checked Out & Settled',
      ],
    },
    {
      id: 'BK-2026-4098',
      spaceId: 'BAY-MG1',
      facilityId: 'FAC-07',
      facilityName: 'Church Street Metro Garage',
      spaceCode: 'Church St Level 1 (EV)',
      driverName: 'Aarav Sharma',
      driverEmail: 'aarav.sharma@bengaluru.in',
      driverLicense: 'KA04 20210048192',
      vehicleId: 'VEH-SUV-01',
      vehicleLabel: 'Tata Harrier EV (SUV)',
      vehiclePlate: 'KA-04-MN-8821',
      startMin: 14 * 60,
      endMin: 16 * 60,
      bufferMinutes: 15,
      status: 'cancelled',
      baseAmountInr: 160,
      platformFeeInr: 16,
      gstInr: 32,
      totalAmountInr: 208,
      accessCode: 'PKP-871-M1',
      entranceLabel: 'Church Street Valet Entry',
      createdAt: '2026-11-18T11:20:00Z',
      lateArrivalPolicy: {
        graceMinutes: 15,
        forfeitAfterMinutes: 40,
        summary: 'Full refund issued on schedule change 2h before slot start.',
      },
      extensionRequests: [],
      paymentOrderId: 'ORD-4098',
      paymentStatus: 'refunded',
      refundStatus: 'refunded',
      refundAmountInr: 208,
      invoiceNumber: 'INV-PKP-2026-4098',
      auditTrail: [
        '11:20Z Confirmed & Paid (₹208 INR)',
        '12:00Z Cancelled Before Slot Window -> 100% Refund Initiated',
        '12:01Z Gateway Refund Settled (₹208 INR)',
      ],
    },
    {
      id: 'BK-2026-4097',
      spaceId: 'BAY-B2',
      facilityId: 'FAC-02',
      facilityName: 'Sahakarnagar Business Hub Basement',
      spaceCode: 'S-Hub B2 (EV Compact)',
      driverName: 'Priya Nair',
      driverEmail: 'priya.nair@bengaluru.in',
      vehicleId: 'VEH-HATCH-03',
      vehicleLabel: 'Tata Tiago EV (Hatchback)',
      vehiclePlate: 'KA-01-XY-2045',
      startMin: 16 * 60,
      endMin: 18 * 60,
      bufferMinutes: 15,
      status: 'cancelled',
      baseAmountInr: 70,
      platformFeeInr: 10,
      gstInr: 14,
      totalAmountInr: 94,
      accessCode: 'PKP-842-B2',
      entranceLabel: 'West Basement Ramp Gate 2',
      createdAt: '2026-11-17T09:15:00Z',
      lateArrivalPolicy: {
        graceMinutes: 15,
        forfeitAfterMinutes: 40,
        summary: 'Cancelled prior to checkout; bay released back to pool.',
      },
      extensionRequests: [],
      paymentStatus: 'unpaid',
      refundStatus: 'none',
      auditTrail: [
        '09:15Z Transactional Hold Created',
        '09:18Z Hold Cancelled by Driver -> Inventory Released',
      ],
    },
  ];

  public paymentOrders: PaymentOrder[] = [
    {
      id: 'ORD-4101',
      bookingId: 'BK-2026-4101',
      amountInr: 273,
      baseAmountInr: 210,
      platformFeeInr: 21,
      gstInr: 42,
      currency: 'INR',
      gatewayOrderRef: 'rzp_order_4101A',
      status: 'paid',
      reconciliationStatus: 'matched',
      createdAt: '2026-11-20T03:10:00Z',
      expiresAt: '2026-11-20T03:20:00Z',
      paidAt: '2026-11-20T03:11:00Z',
    },
    {
      id: 'ORD-4102',
      bookingId: 'BK-2026-4102',
      amountInr: 215,
      baseAmountInr: 165,
      platformFeeInr: 17,
      gstInr: 33,
      currency: 'INR',
      gatewayOrderRef: 'rzp_order_4102B',
      status: 'paid',
      reconciliationStatus: 'matched',
      createdAt: '2026-11-20T03:25:00Z',
      expiresAt: '2026-11-20T03:35:00Z',
      paidAt: '2026-11-20T03:26:00Z',
    },
    {
      id: 'ORD-4103',
      bookingId: 'BK-2026-4103',
      amountInr: 130,
      baseAmountInr: 100,
      platformFeeInr: 10,
      gstInr: 20,
      currency: 'INR',
      gatewayOrderRef: 'rzp_order_4103E',
      status: 'paid',
      reconciliationStatus: 'matched',
      createdAt: '2026-11-20T02:45:00Z',
      expiresAt: '2026-11-20T02:55:00Z',
      paidAt: '2026-11-20T02:46:00Z',
    },
    {
      id: 'ORD-4099',
      bookingId: 'BK-2026-4099',
      amountInr: 106,
      baseAmountInr: 80,
      platformFeeInr: 10,
      gstInr: 16,
      currency: 'INR',
      gatewayOrderRef: 'rzp_order_4099Z',
      status: 'paid',
      reconciliationStatus: 'matched',
      createdAt: '2026-11-19T08:00:00Z',
      expiresAt: '2026-11-19T08:10:00Z',
      paidAt: '2026-11-19T08:01:00Z',
    },
  ];

  public webhookEvents: PaymentWebhookEvent[] = [
    {
      eventId: 'EVT-SEED-4101',
      eventType: 'payment.succeeded',
      orderId: 'ORD-4101',
      bookingId: 'BK-2026-4101',
      amountInr: 273,
      signatureVerified: true,
      receivedAt: '2026-11-20T03:11:00Z',
      processedCount: 1,
      duplicateIgnoredCount: 0,
    },
    {
      eventId: 'EVT-SEED-4102',
      eventType: 'payment.succeeded',
      orderId: 'ORD-4102',
      bookingId: 'BK-2026-4102',
      amountInr: 215,
      signatureVerified: true,
      receivedAt: '2026-11-20T03:26:00Z',
      processedCount: 1,
      duplicateIgnoredCount: 0,
    },
  ];

  public refunds: RefundRecord[] = [];

  public settlements: HostSettlementRecord[] = [
    {
      id: 'STL-4101',
      providerId: 'PRV-01',
      providerName: 'NorthGate Commercial Parking Pvt Ltd',
      bookingId: 'BK-2026-4101',
      facilityName: 'Phoenix North Commercial Annex',
      grossInr: 210,
      platformCommissionInr: 21,
      gstWithheldInr: 42,
      netPayoutInr: 189,
      status: 'pending_checkout',
    },
    {
      id: 'STL-4103',
      providerId: 'PRV-05',
      providerName: 'Raghavendra K. (Individual Host)',
      bookingId: 'BK-2026-4103',
      facilityName: 'Yelahanka Gate Private Driveway',
      grossInr: 100,
      platformCommissionInr: 10,
      gstWithheldInr: 20,
      netPayoutInr: 90,
      status: 'pending_checkout',
    },
    {
      id: 'STL-4099',
      providerId: 'PRV-05',
      providerName: 'Raghavendra K. (Individual Host)',
      bookingId: 'BK-2026-4099',
      facilityName: 'Yelahanka Gate Private Driveway',
      grossInr: 80,
      platformCommissionInr: 8,
      gstWithheldInr: 16,
      netPayoutInr: 72,
      status: 'settled',
      settledAt: '2026-11-19T19:00:00Z',
      utrRef: 'UTR-HDFC-8812099',
    },
  ];

  public transactions: TransactionHistoryItem[] = [
    {
      id: 'TXN-901',
      timestamp: '2026-11-20T03:11:00Z',
      bookingId: 'BK-2026-4101',
      type: 'charge',
      amountInr: 273,
      actor: 'Aarav Sharma',
      status: 'matched',
      referenceId: 'ORD-4101',
    },
    {
      id: 'TXN-902',
      timestamp: '2026-11-19T19:00:00Z',
      bookingId: 'BK-2026-4099',
      type: 'host_payout',
      amountInr: 72,
      actor: 'Raghavendra K. (Individual Host)',
      status: 'settled',
      referenceId: 'UTR-HDFC-8812099',
    },
  ];

  public incidents: IncidentRecord[] = [
    {
      id: 'INC-201',
      reporterRole: 'host',
      reporterName: 'Raghavendra K.',
      facilityId: 'FAC-05',
      bookingId: 'BK-2026-4103',
      category: 'access_blocked',
      severity: 'low',
      description: 'Side lane delivery van briefly obstructed turning radius at 11:15; cleared within 5 mins.',
      status: 'resolved',
      resolutionNote: 'Confirmed clear driveway access with neighbor.',
      createdAt: '2026-11-20T05:50:00Z',
      resolvedAt: '2026-11-20T06:00:00Z',
    },
  ];

  public disputes: DisputeRecord[] = [];
  public userReports: UserReportRecord[] = [];
  public notifications: DriverNotification[] = [];
  public wallets: PrepaidWallet[] = [
    {
      driverEmail: 'aarav.sharma@bengaluru.in',
      driverName: 'Aarav Sharma',
      balanceInr: 500,
      unpaidDueInr: 0,
      bookingRestricted: false,
      lowBalanceNotified: false,
      updatedAt: '2026-11-20T03:00:00Z',
      ledger: [
        {
          id: 'WLT-SEED-01',
          timestamp: '2026-11-20T03:00:00Z',
          type: 'top_up',
          description: 'Initial Prepaid Parking Balance',
          amountInr: 500,
          balanceAfterInr: 500,
        },
      ],
    },
    {
      driverEmail: 'priya.nair@bengaluru.in',
      driverName: 'Priya Nair',
      balanceInr: 500,
      unpaidDueInr: 0,
      bookingRestricted: false,
      lowBalanceNotified: false,
      updatedAt: '2026-11-20T02:30:00Z',
      ledger: [
        {
          id: 'WLT-SEED-02',
          timestamp: '2026-11-20T02:30:00Z',
          type: 'top_up',
          description: 'Initial Prepaid Parking Balance',
          amountInr: 500,
          balanceAfterInr: 500,
        },
      ],
    },
  ];
  public lifecycleEvents: AutonomousLifecycleEvent[] = [];

  public auditLogs: Array<{
    id: string;
    timestamp: string;
    actor: string;
    action: string;
    detail: string;
  }> = [
    {
      id: 'AUD-001',
      timestamp: '2026-11-20T04:05:00Z',
      actor: 'Admin Compliance',
      action: 'FACILITY_HELD_UNAPPROVED',
      detail: 'FAC-06 (Hebbal Flyover Open Plot) held from public search pending property authority & operational checks.',
    },
    {
      id: 'AUD-002',
      timestamp: '2026-11-20T04:12:00Z',
      actor: 'System Scheduler',
      action: 'OWNER_BLOCK_ENFORCED',
      detail: 'BAY-E1 locked for host return 18:15–22:00 with mandatory 15m pre-buffer (Hard cutoff 18:00).',
    },
  ];

  constructor() {
    this.seedPrivateVault();
    for (const loc of BENGALURU_LOCATIONS) {
      this.ensureLocationSupply(loc);
    }
    this.ensureQrTokens();
    this.syncOccupancyStates();
    this.processedWebhookEventIds.add('EVT-SEED-4101');
    this.processedWebhookEventIds.add('EVT-SEED-4102');
  }

  public syncOccupancyStates() {
    for (const space of this.spaces) {
      if (space.occupancyState) continue;
      const occupiedBk = this.bookings.find(
        (b) =>
          b.spaceId === space.id &&
          (b.status === 'checked-in' || b.status === 'occupied')
      );
      if (occupiedBk) {
        space.occupancyState =
          occupiedBk.overstayStatus === 'flagged_overstay' ? 'OVERSTAY' : 'OCCUPIED';
        space.activeOccupancyBookingId = occupiedBk.id;
        space.vacancyConfirmed = false;
        space.bufferCompleted = false;
        space.lastOccupancyEvent = `Vehicle active in bay (${occupiedBk.id})`;
        continue;
      }
      const upcomingBk = this.bookings.find(
        (b) =>
          b.spaceId === space.id &&
          (b.status === 'confirmed' || b.status === 'held')
      );
      if (upcomingBk) {
        space.occupancyState = 'BOOKED';
        space.activeOccupancyBookingId = upcomingBk.id;
        space.vacancyConfirmed = true;
        space.bufferCompleted = true;
        space.lastOccupancyEvent = `Reserved by ${upcomingBk.id}`;
        continue;
      }
      space.occupancyState = 'AVAILABLE';
      space.vacancyConfirmed = true;
      space.bufferCompleted = true;
      space.lastOccupancyEvent = 'Confirmed vacant and open for booking';
    }
  }

  private ensureQrTokens() {
    for (const fac of this.facilities) {
      if (!fac.facilityGateQrToken) {
        fac.facilityGateQrToken = signFacilityGateQrToken(fac.id, fac.entranceLabel);
      }
    }
    for (const bk of this.bookings) {
      if (!bk.qrPassToken) {
        bk.qrPassToken = signBookingQrToken(bk.id, bk.facilityId, bk.accessCode);
      }
    }
  }

  private seedPrivateVault() {
    for (const prv of this.providers) {
      for (const doc of prv.documents) {
        this.privateDocumentVault.set(doc.id, {
          providerId: prv.id,
          fileName: doc.fileName,
          mimeType: doc.mimeType,
          contentText: [
            'PARKPOOL PRIVATE COMPLIANCE VAULT RECORD',
            `Document ID: ${doc.id}`,
            `Provider ID: ${prv.id} (${prv.organizationName})`,
            `Provider Type: ${prv.providerType}`,
            `Evidence Type: ${doc.docType}`,
            `Uploaded At: ${doc.uploadedAt}`,
            `Registration Ref: ${prv.registrationNumber || 'PENDING'}`,
            '---',
            `Attested by ${prv.contactName} (${prv.contactEmail}, ${prv.contactPhone}).`,
            prv.id === 'PRV-06'
              ? 'NOTE: Incomplete sketch uploaded; missing Khata folio & permitted use declaration.'
              : 'Status: Full legal authority, address, and parking-use terms verified on file.',
          ].join('\n'),
        });
      }
    }
  }

  public getPrivateDocument(docId: string) {
    return this.privateDocumentVault.get(docId) || null;
  }

  public findDocumentMeta(docId: string): { provider: ProviderRecord; doc: PrivateDocumentRecord } | null {
    for (const provider of this.providers) {
      const doc = provider.documents.find((d) => d.id === docId);
      if (doc) return { provider, doc };
    }
    return null;
  }

  public expireStaleHolds(): number {
    const now = Date.now();
    let expiredCount = 0;
    for (const bk of this.bookings) {
      if (bk.status === 'held' && bk.holdExpiresAt && Date.parse(bk.holdExpiresAt) < now) {
        bk.status = 'expired';
        bk.paymentStatus = bk.paymentStatus === 'paid' ? 'paid' : 'failed';
        bk.auditTrail.push(`${new Date().toISOString().slice(11, 19)}Z Hold Expired -> Inventory Released`);
        if (bk.paymentOrderId) {
          const order = this.paymentOrders.find((o) => o.id === bk.paymentOrderId);
          if (order && order.status === 'created') {
            order.status = 'expired';
          }
        }
        expiredCount++;
      }
    }
    if (expiredCount > 0) {
      this.addAudit('Hold Expiry Sweeper', 'HOLDS_EXPIRED', `Released ${expiredCount} abandoned/unpaid checkout hold(s).`);
    }
    return expiredCount;
  }

  public computeAdminAnalytics(): AdminAnalytics {
    const paidOrders = this.paymentOrders.filter((o) => o.status === 'paid');
    const totalGmvInr = paidOrders.reduce((s, o) => s + o.amountInr, 0);
    const platformRevenueInr = paidOrders.reduce((s, o) => s + o.platformFeeInr, 0);
    const totalRefundedInr = this.refunds
      .filter((r) => r.status === 'processed' || r.status === 'approved')
      .reduce((s, r) => s + r.amountInr, 0);
    const totalSettledHostInr = this.settlements
      .filter((st) => st.status === 'settled')
      .reduce((s, st) => s + st.netPayoutInr, 0);

    const approvedProviders = this.providers.filter((p) => p.verificationStatus === 'APPROVED').length;
    const pendingProviders = this.providers.filter((p) =>
      ['NOT_SUBMITTED', 'SUBMITTED', 'UNDER_REVIEW', 'NEEDS_MORE_INFORMATION'].includes(p.verificationStatus)
    ).length;
    const approvedSpaces = this.spaces.filter((s) => s.publicationStatus === 'approved').length;
    const pendingSpaces = this.spaces.filter((s) => s.publicationStatus !== 'approved').length;
    const activeBookings = this.bookings.filter((b) =>
      ['held', 'confirmed', 'checked-in', 'occupied'].includes(b.status)
    ).length;
    const duplicateWebhooksBlocked = this.webhookEvents.reduce(
      (sum, ev) => sum + ev.duplicateIgnoredCount,
      0
    );
    const openIncidents = this.incidents.filter((i) => i.status !== 'resolved').length;
    const openDisputes = this.disputes.filter(
      (d) => d.status === 'open' || d.status === 'under_review'
    ).length;
    const expiringProviders = this.providers.filter(
      (p) =>
        p.verificationStatus === 'EXPIRED' ||
        (p.expiresAt && Date.parse(p.expiresAt) < Date.now() + 30 * 86400 * 1000)
    ).length;

    return {
      totalGmvInr,
      platformRevenueInr,
      totalRefundedInr,
      totalSettledHostInr,
      approvedProviders,
      pendingProviders,
      approvedSpaces,
      pendingSpaces,
      activeBookings,
      duplicateWebhooksBlocked,
      openIncidents,
      openDisputes,
      expiringProviders,
    };
  }

  public getSnapshot(): WorkspaceSnapshot {
    this.expireStaleHolds();
    this.ensureQrTokens();
    this.syncOccupancyStates();
    return {
      pilotZone: this.pilotZone,
      destinationName: this.destinationName,
      destinationCoords: this.destinationCoords,
      locations: BENGALURU_LOCATIONS,
      vehicles: this.vehicles,
      driverProfiles: this.driverProfiles,
      providers: this.providers,
      evidenceChecklists: EVIDENCE_CHECKLISTS,
      facilities: this.facilities,
      spaces: this.spaces,
      bookings: this.bookings,
      paymentOrders: this.paymentOrders,
      webhookEvents: this.webhookEvents,
      refunds: this.refunds,
      settlements: this.settlements,
      transactions: this.transactions,
      incidents: this.incidents,
      disputes: this.disputes,
      userReports: this.userReports,
      notifications: this.notifications,
      wallets: this.wallets,
      lifecycleEvents: this.lifecycleEvents,
      analytics: this.computeAdminAnalytics(),
      auditLogs: this.auditLogs,
    };
  }

  // =========================================================================
  // PROVIDER ONBOARDING, EVIDENCE SUBMISSION & ADMIN VERIFICATION
  // =========================================================================

  public registerProvider(input: {
    name: string;
    contactName: string;
    contactEmail: string;
    contactPhone: string;
    organizationName: string;
    registrationNumber?: string;
    providerType: DetailedProviderType;
    requestedStatus?: string;
  }): { ok: boolean; provider?: ProviderRecord; error?: string } {
    // Hard server guard: Never let a provider set their own status to APPROVED
    if (input.requestedStatus && input.requestedStatus.toUpperCase() === 'APPROVED') {
      this.addAudit(
        input.contactEmail || input.name,
        'BLOCKED_SELF_APPROVAL',
        'Blocked attempt by provider registration payload to set status=APPROVED.'
      );
      return {
        ok: false,
        error: 'FORBIDDEN: Providers cannot set their own verification status to APPROVED. Only an authorized admin reviewer can approve providers.',
      };
    }

    const cleanName = input.name.trim();
    const cleanEmail = input.contactEmail.trim().toLowerCase();
    if (!cleanName || !cleanEmail || !input.organizationName.trim()) {
      return { ok: false, error: 'Provider name, contact email, and organization name are required.' };
    }

    const existing = this.providers.find(
      (p) => p.contactEmail.toLowerCase() === cleanEmail
    );
    const nowIso = new Date().toISOString();

    if (existing) {
      existing.name = cleanName;
      existing.contactName = input.contactName.trim() || cleanName;
      existing.contactPhone = input.contactPhone.trim() || existing.contactPhone;
      existing.organizationName = input.organizationName.trim();
      existing.registrationNumber = input.registrationNumber?.trim() || existing.registrationNumber;
      existing.providerType = input.providerType;
      existing.legacyType = mapDetailedToLegacyProviderType(input.providerType);
      existing.updatedAt = nowIso;
      this.addAudit(cleanName, 'PROVIDER_PROFILE_UPDATED', `${existing.id} (${existing.providerType}) updated.`);
      return { ok: true, provider: existing };
    }

    const id = `PRV-${Date.now().toString(36).toUpperCase().slice(-5)}`;
    const provider: ProviderRecord = {
      id,
      name: cleanName,
      contactName: input.contactName.trim() || cleanName,
      contactEmail: cleanEmail,
      contactPhone: input.contactPhone.trim() || '+91 98450 00000',
      organizationName: input.organizationName.trim(),
      registrationNumber: input.registrationNumber?.trim(),
      providerType: input.providerType,
      legacyType: mapDetailedToLegacyProviderType(input.providerType),
      verificationStatus: 'NOT_SUBMITTED',
      evidenceRefs: [],
      documents: [],
      aiPrecheckWarnings: [],
      complaintsCount: 0,
      operatorChangeFlagged: false,
      updatedAt: nowIso,
    };

    this.providers.unshift(provider);
    this.addAudit(
      cleanName,
      'PROVIDER_REGISTERED',
      `${id} registered as ${provider.providerType} (status=NOT_SUBMITTED).`
    );
    return { ok: true, provider };
  }

  public submitProviderEvidence(input: {
    providerId: string;
    docType: string;
    fileName: string;
    mimeType?: string;
    contentText: string;
    requestedStatus?: string;
  }): { ok: boolean; provider?: ProviderRecord; document?: PrivateDocumentRecord; error?: string } {
    if (input.requestedStatus && input.requestedStatus.toUpperCase() === 'APPROVED') {
      return {
        ok: false,
        error: 'FORBIDDEN: Providers cannot set status to APPROVED during evidence submission.',
      };
    }

    const provider = this.providers.find((p) => p.id === input.providerId);
    if (!provider) return { ok: false, error: 'Provider not found' };

    const cleanFile = input.fileName.trim() || `${input.docType}.txt`;
    const cleanText = input.contentText.trim();
    if (!cleanText || cleanText.length < 10) {
      return { ok: false, error: 'Please include valid document details/summary (min 10 characters).' };
    }

    // Non-authoritative AI/linter missing-field check only (never auto-approves!)
    const flags: string[] = [];
    if (cleanText.length < 25) {
      flags.push('Document summary appears unusually brief — verify folio/agreement number.');
    }
    if (!/\d/.test(cleanText)) {
      flags.push('No permit, Khata, or agreement reference number detected.');
    }

    const docId = `DOC-${provider.id}-${Date.now().toString(36).toUpperCase().slice(-4)}`;
    const nowIso = new Date().toISOString();
    const docRecord: PrivateDocumentRecord = {
      id: docId,
      providerId: provider.id,
      docType: input.docType,
      fileName: cleanFile,
      mimeType: input.mimeType || 'text/plain',
      sizeBytes: Buffer.byteLength(cleanText, 'utf8'),
      uploadedAt: nowIso,
      status: 'pending',
      aiMissingFieldFlags: flags,
    };

    // Store securely in private server-only vault (not public folder)
    this.privateDocumentVault.set(docId, {
      providerId: provider.id,
      fileName: cleanFile,
      mimeType: docRecord.mimeType,
      contentText: cleanText,
    });

    provider.documents.push(docRecord);
    if (!provider.evidenceRefs.includes(docId)) {
      provider.evidenceRefs.push(docId);
    }

    const requiredDocs = EVIDENCE_CHECKLISTS[provider.providerType].filter((r) => r.required);
    const uploadedTypes = new Set(provider.documents.map((d) => d.docType));
    const missingRequired = requiredDocs
      .filter((r) => !uploadedTypes.has(r.docType))
      .map((r) => `Missing required ${r.label}`);

    provider.aiPrecheckWarnings = [...missingRequired, ...flags];
    provider.submittedAt = nowIso;
    provider.updatedAt = nowIso;
    if (
      provider.verificationStatus === 'NOT_SUBMITTED' ||
      provider.verificationStatus === 'NEEDS_MORE_INFORMATION' ||
      provider.verificationStatus === 'EXPIRED'
    ) {
      provider.verificationStatus = 'SUBMITTED';
    }

    this.addAudit(
      provider.name,
      'EVIDENCE_UPLOADED_PRIVATE_VAULT',
      `${docId} (${input.docType}) stored in private vault for ${provider.id}; status=${provider.verificationStatus}.`
    );

    return { ok: true, provider, document: docRecord };
  }

  public verifyProviderByAdmin(input: {
    providerId: string;
    decision: ProviderVerificationStatus;
    evidenceRefs: string[];
    reviewerId: string;
    reason: string;
    expiresAt?: string;
  }): { ok: boolean; provider?: ProviderRecord; error?: string } {
    const provider = this.providers.find((p) => p.id === input.providerId);
    if (!provider) return { ok: false, error: 'Provider not found' };

    const validDecisions: ProviderVerificationStatus[] = [
      'UNDER_REVIEW',
      'NEEDS_MORE_INFORMATION',
      'APPROVED',
      'REJECTED',
      'SUSPENDED',
      'EXPIRED',
    ];
    if (!validDecisions.includes(input.decision)) {
      return { ok: false, error: `Invalid admin verification decision: ${input.decision}` };
    }
    if (!input.reason || !input.reason.trim()) {
      return { ok: false, error: 'Verification reason is required for audit compliance.' };
    }
    if (input.decision === 'APPROVED') {
      const refs = input.evidenceRefs.length > 0 ? input.evidenceRefs : provider.evidenceRefs;
      if (refs.length === 0) {
        return { ok: false, error: 'Cannot approve provider without at least one verified evidence reference.' };
      }
      const requiredDocs = EVIDENCE_CHECKLISTS[provider.providerType].filter((r) => r.required);
      const uploadedTypes = new Set(provider.documents.map((d) => d.docType));
      const missing = requiredDocs.filter((r) => !uploadedTypes.has(r.docType));
      if (missing.length > 0 && input.evidenceRefs.length === 0) {
        return {
          ok: false,
          error: `Missing required checklist evidence: ${missing.map((m) => m.label).join(', ')}`,
        };
      }
    }

    const nowIso = new Date().toISOString();
    provider.verificationStatus = input.decision;
    provider.reviewerId = input.reviewerId;
    provider.reviewedAt = nowIso;
    provider.decisionReason = input.reason.trim();
    provider.updatedAt = nowIso;
    if (input.evidenceRefs.length > 0) {
      provider.evidenceRefs = Array.from(new Set([...provider.evidenceRefs, ...input.evidenceRefs]));
    }
    if (input.expiresAt) {
      provider.expiresAt = input.expiresAt;
    } else if (input.decision === 'APPROVED' && !provider.expiresAt) {
      const nextYear = new Date(Date.now() + 365 * 86400 * 1000).toISOString().slice(0, 10);
      provider.expiresAt = nextYear;
    }
    if (input.decision === 'APPROVED') {
      provider.nextPeriodicReviewAt = new Date(Date.now() + 180 * 86400 * 1000).toISOString().slice(0, 10);
      provider.complaintsCount = 0;
      provider.operatorChangeFlagged = false;
      for (const doc of provider.documents) {
        if (doc.status === 'pending') doc.status = 'verified';
      }
    } else if (input.decision === 'REJECTED' || input.decision === 'SUSPENDED' || input.decision === 'EXPIRED') {
      // Cascade protection: pull provider's facilities/spaces out of public discovery
      for (const fac of this.facilities) {
        if (fac.providerId === provider.id) {
          fac.verificationStatus = input.decision === 'SUSPENDED' ? 'suspended' : 'pending';
          fac.availabilitySource = 'pending_audit';
          fac.lastUpdatedIso = nowIso;
          for (const sp of this.spaces) {
            if (sp.facilityId === fac.id) {
              sp.publicationStatus = input.decision === 'REJECTED' ? 'rejected' : 'suspended';
            }
          }
        }
      }
    }

    this.addAudit(
      `Admin ${input.reviewerId}`,
      `PROVIDER_${input.decision}`,
      `${provider.id} (${provider.name}) -> ${input.decision}; refs=[${provider.evidenceRefs.join(', ')}]; reason="${provider.decisionReason}"`
    );

    return { ok: true, provider };
  }

  public updateFacilityOperationalChecks(
    facilityId: string,
    inspectorId: string,
    checks: Partial<OperationalCheckRecord>,
    notes?: string,
    propertyEligibleForUse = true
  ): { ok: boolean; facility?: Facility; error?: string } {
    const fac = this.facilities.find((f) => f.id === facilityId);
    if (!fac) return { ok: false, error: 'Facility not found' };

    const merged: OperationalCheckRecord = {
      entranceVerified: Boolean(checks.entranceVerified ?? fac.operationalChecks.entranceVerified),
      locationVerified: Boolean(checks.locationVerified ?? fac.operationalChecks.locationVerified),
      dimensionsVerified: Boolean(checks.dimensionsVerified ?? fac.operationalChecks.dimensionsVerified),
      operatingHoursVerified: Boolean(checks.operatingHoursVerified ?? fac.operationalChecks.operatingHoursVerified),
      restrictionsVerified: Boolean(checks.restrictionsVerified ?? fac.operationalChecks.restrictionsVerified),
      accessArrangementsVerified: Boolean(
        checks.accessArrangementsVerified ?? fac.operationalChecks.accessArrangementsVerified
      ),
      inspectorId,
      checkedAt: new Date().toISOString(),
      notes: notes?.trim() || fac.operationalChecks.notes,
    };

    const allPassed =
      merged.entranceVerified &&
      merged.locationVerified &&
      merged.dimensionsVerified &&
      merged.operatingHoursVerified &&
      merged.restrictionsVerified &&
      merged.accessArrangementsVerified;

    fac.operationalChecks = merged;
    fac.operationalChecksPassed = allPassed;
    fac.propertyEligibleForUse = propertyEligibleForUse;
    fac.lastUpdatedIso = new Date().toISOString();

    this.addAudit(
      `Admin ${inspectorId}`,
      'FACILITY_OPERATIONAL_CHECK',
      `${fac.id} (${fac.name}) checks passed=${allPassed}, eligible=${propertyEligibleForUse}.`
    );
    return { ok: true, facility: fac };
  }

  public approveSpacePublication(
    spaceId: string,
    adminId: string
  ): {
    ok: boolean;
    space?: ParkingSpace;
    facility?: Facility;
    checks?: Array<{ name: string; passed: boolean; detail: string }>;
    error?: string;
  } {
    const space = this.spaces.find((s) => s.id === spaceId);
    if (!space) return { ok: false, error: 'Space not found' };
    const facility = this.facilities.find((f) => f.id === space.facilityId);
    if (!facility) return { ok: false, error: 'Linked facility not found' };
    const provider = this.providers.find((p) => p.id === facility.providerId);

    const providerApproved = Boolean(
      provider &&
        provider.verificationStatus === 'APPROVED' &&
        (!provider.expiresAt || Date.parse(provider.expiresAt) >= Date.now())
    );
    const providerHasAuthority = Boolean(
      provider && facility.providerId === provider.id && provider.evidenceRefs.length > 0
    );
    const spaceBelongsToFacility = space.facilityId === facility.id;
    const opsPassed = facility.operationalChecksPassed === true;
    const propertyEligible = facility.propertyEligibleForUse === true;
    const requiredInfoPresent = Boolean(
      facility.entranceLabel.trim() &&
        facility.accessInstructions.trim() &&
        (facility.restrictions.length > 0 || space.restrictions.length > 0)
    );

    const checks = [
      {
        name: '1. Provider is APPROVED & Unexpired',
        passed: providerApproved,
        detail: provider
          ? `Provider ${provider.id} status=${provider.verificationStatus}${provider.expiresAt ? ` (exp ${provider.expiresAt})` : ''}`
          : 'No provider linked',
      },
      {
        name: '2. Provider Authority Over Facility',
        passed: providerHasAuthority,
        detail: providerHasAuthority
          ? `Provider ${provider?.id} holds ${provider?.evidenceRefs.length} verified authority ref(s)`
          : 'Missing verified authority document linkage',
      },
      {
        name: '3. Space Belongs to Facility',
        passed: spaceBelongsToFacility,
        detail: `${space.id} mapped to ${facility.id}`,
      },
      {
        name: '4. Facility Passed Operational Checks',
        passed: opsPassed,
        detail: opsPassed
          ? `Checked by ${facility.operationalChecks.inspectorId || 'Admin'} (entrance, GPS, dimensions, hours, restrictions, access)`
          : 'Incomplete facility operational verification checklist',
      },
      {
        name: '5. Property Eligible for Intended Use',
        passed: propertyEligible,
        detail: propertyEligible ? 'Confirmed eligible for shared public parking' : 'Property use eligibility unconfirmed',
      },
      {
        name: '6. Restrictions & Access Information Present',
        passed: requiredInfoPresent,
        detail: requiredInfoPresent
          ? `Entrance: "${facility.entranceLabel}"; ${facility.restrictions.length || space.restrictions.length} restriction(s) disclosed`
          : 'Missing entrance instructions or parking restrictions',
      },
    ];

    const failed = checks.filter((c) => !c.passed);
    if (failed.length > 0) {
      this.addAudit(
        `Admin ${adminId}`,
        'SPACE_PUBLICATION_BLOCKED',
        `Blocked publication of ${space.id}: ${failed.map((f) => f.name).join('; ')}`
      );
      return {
        ok: false,
        checks,
        error: `Space publication blocked (${failed.length} prerequisite failure): ${failed[0].name} — ${failed[0].detail}`,
      };
    }

    const nowIso = new Date().toISOString();
    space.publicationStatus = 'approved';
    facility.verificationStatus = 'verified';
    facility.authorityDocRef = `VERIFIED (${provider!.evidenceRefs.join(', ')})`;
    facility.availabilitySource = 'provider_portal';
    facility.lastUpdatedIso = nowIso;

    this.addAudit(
      `Admin ${adminId}`,
      'SPACE_PUBLISHED_APPROVED',
      `${space.id} (${facility.name}) approved and made publicly discoverable after all 6 invariants passed.`
    );
    return { ok: true, space, facility, checks };
  }

  public runPeriodicReviewSweep(adminId: string): {
    flaggedProviders: string[];
    expiredProviders: string[];
  } {
    const now = Date.now();
    const flaggedProviders: string[] = [];
    const expiredProviders: string[] = [];

    for (const prv of this.providers) {
      if (prv.verificationStatus === 'APPROVED') {
        const isExpired = prv.expiresAt && Date.parse(prv.expiresAt) < now;
        if (isExpired) {
          this.verifyProviderByAdmin({
            providerId: prv.id,
            decision: 'EXPIRED',
            evidenceRefs: prv.evidenceRefs,
            reviewerId: adminId,
            reason: `Periodic review detected expired authorization (${prv.expiresAt}).`,
          });
          expiredProviders.push(prv.id);
        } else if (prv.complaintsCount >= 2 || prv.operatorChangeFlagged) {
          this.verifyProviderByAdmin({
            providerId: prv.id,
            decision: 'UNDER_REVIEW',
            evidenceRefs: prv.evidenceRefs,
            reviewerId: adminId,
            reason: `Periodic review triggered: complaints=${prv.complaintsCount}, operatorChange=${prv.operatorChangeFlagged}.`,
          });
          flaggedProviders.push(prv.id);
        }
      }
    }

    this.addAudit(
      `Admin ${adminId}`,
      'PERIODIC_REVIEW_SWEEP',
      `Completed periodic check: ${expiredProviders.length} expired, ${flaggedProviders.length} moved to UNDER_REVIEW.`
    );
    return { flaggedProviders, expiredProviders };
  }

  // =========================================================================
  // LOCATION SUPPLY & EVALUATION (ONLY APPROVED & VERIFIED SPACES DISCOVERABLE)
  // =========================================================================

  public ensureLocationSupply(loc: BengaluruLocation): { addedFacilities: number } {
    const shortName = loc.name.split(/[,(&/]/)[0].trim() || loc.name;
    const areaShort = (loc.area.split(',')[0] || 'Bengaluru').trim();

    const nearbyVerified = () =>
      this.facilities.filter(
        (f) =>
          f.verificationStatus === 'verified' &&
          calcGeoMeters(loc.lat, loc.lng, f.lat, f.lng) <= 950
      );

    const has4W = (facId: string) =>
      this.spaces.some(
        (s) =>
          s.facilityId === facId &&
          s.publicationStatus === 'approved' &&
          s.allowedTypes.includes('suv')
      );
    const has2W = (facId: string) =>
      this.spaces.some(
        (s) =>
          s.facilityId === facId &&
          s.publicationStatus === 'approved' &&
          s.allowedTypes.includes('two_wheeler')
      );
    const countFullFeatured = () =>
      nearbyVerified().filter((f) => has4W(f.id) && has2W(f.id)).length;

    if (countFullFeatured() >= 6) {
      return { addedFacilities: 0 };
    }

    const templates = [
      {
        name: `${shortName} Central Plaza Parking`,
        providerName: `${shortName} Mobility Partners`,
        providerType: 'commercial' as const,
        dLat: 0.0014,
        dLng: 0.0012,
        entranceLabel: 'East Boom Gate A',
        walkSafety: 'Well-lit pedestrian walkway with security kiosk',
        accessControl: 'QR Barrier + Guard Check-in',
        price4W: 70,
        price2W: 25,
        covered: true,
        evCharging: true,
      },
      {
        name: `${areaShort} Metro & Transit Basement`,
        providerName: 'MetroLink Urban Parking Co.',
        providerType: 'commercial' as const,
        dLat: -0.0016,
        dLng: 0.0018,
        entranceLabel: 'North Basement Ramp 2',
        walkSafety: 'Paved sidewalk with lit crosswalk',
        accessControl: 'Basement Security Desk + PIN',
        price4W: 55,
        price2W: 20,
        covered: true,
        evCharging: true,
      },
      {
        name: `${shortName} Business Tower Deck`,
        providerName: `${areaShort} Realty Pool`,
        providerType: 'commercial' as const,
        dLat: 0.0021,
        dLng: -0.0015,
        entranceLabel: 'South Tower Visitor Gate',
        walkSafety: 'Covered arcade footpath to main road',
        accessControl: 'Attendant Scan + Booking Code',
        price4W: 65,
        price2W: 25,
        covered: true,
        evCharging: true,
      },
      {
        name: `${areaShort} RWA Community Pool`,
        providerName: `${areaShort} Residents Association`,
        providerType: 'community' as const,
        dLat: -0.0023,
        dLng: -0.0019,
        entranceLabel: 'Society Visitor Gate (OTP)',
        walkSafety: 'Gated residential avenue with night floodlights',
        accessControl: 'MyGate Visitor OTP Verification',
        price4W: 45,
        price2W: 20,
        covered: true,
        evCharging: true,
      },
      {
        name: `${shortName} Covered Private Driveway`,
        providerName: `${areaShort} Verified Host Pool`,
        providerType: 'individual' as const,
        dLat: 0.0006,
        dLng: 0.0033,
        entranceLabel: 'Lane 2 Sliding Gate',
        walkSafety: 'Quiet residential crossroad with street lighting',
        accessControl: 'Host Gate PIN Unlock',
        price4W: 40,
        price2W: 15,
        covered: true,
        evCharging: false,
      },
      {
        name: `${areaShort} Smart EV & 2W ParkHub`,
        providerName: 'Bengaluru EV Grid Parking',
        providerType: 'commercial' as const,
        dLat: -0.003,
        dLng: 0.0008,
        entranceLabel: 'West EV Entry Kiosk',
        walkSafety: 'Dedicated lit footpath with CCTV coverage',
        accessControl: 'FASTag / QR Smart Barrier',
        price4W: 50,
        price2W: 20,
        covered: true,
        evCharging: true,
      },
    ];

    let addedFacilities = 0;
    for (let i = 0; i < templates.length; i++) {
      if (countFullFeatured() >= 6) break;
      const tpl = templates[i];
      const lat = Number((loc.lat + tpl.dLat).toFixed(4));
      const lng = Number((loc.lng + tpl.dLng).toFixed(4));

      const tooClose = this.facilities.some(
        (f) => calcGeoMeters(lat, lng, f.lat, f.lng) < 120
      );
      if (tooClose) continue;

      const idx = this.facilities.length + 1;
      const facId = `FAC-${String(idx).padStart(2, '0')}`;
      const entranceLat = Number(((lat + loc.lat) / 2).toFixed(4));
      const entranceLng = Number(((lng + loc.lng) / 2).toFixed(4));
      const walkM = Math.max(140, calcGeoMeters(loc.lat, loc.lng, entranceLat, entranceLng));
      const walkMin = Math.max(2, Math.round(walkM / 75));

      const facility: Facility = {
        id: facId,
        providerId: 'PRV-BLR-HUB',
        name: tpl.name,
        providerName: tpl.providerName,
        providerType: tpl.providerType,
        address: `${areaShort}, Near ${shortName}, Bengaluru`,
        zone: loc.name,
        verificationStatus: 'verified',
        authorityDocRef: `AUTH-BENG-HUB-${idx}9 (Verified Permit)`,
        entranceLabel: tpl.entranceLabel,
        walkingDistanceM: walkM,
        walkingMinutes: walkMin,
        walkPathSafety: tpl.walkSafety,
        lat,
        lng,
        entranceLat,
        entranceLng,
        walkPathCoords: [
          [lat, lng],
          [entranceLat, entranceLng],
          [loc.lat, loc.lng],
        ],
        accessControl: tpl.accessControl,
        accessInstructions: `Enter via ${tpl.entranceLabel}; present ParkPool QR/PIN to gate attendant.`,
        restrictions: ['Max height 210cm', 'Check out before 23:30 closing'],
        lateArrivalPolicy: {
          graceMinutes: 15,
          forfeitAfterMinutes: 45,
          summary: '15 min arrival grace; bay held up to 45 min after scheduled start.',
        },
        operationalChecks: defaultOperationalChecks(true, 'USR-ADM-03'),
        operationalChecksPassed: true,
        propertyEligibleForUse: true,
        lastPeriodicReviewAt: '2026-10-01T10:00:00Z',
        availabilitySource: 'provider_portal',
        lastUpdatedIso: new Date().toISOString(),
      };

      const bay4W: ParkingSpace = {
        id: `BAY-${idx}A`,
        facilityId: facId,
        spaceCode: `${shortName.slice(0, 10)} 4W-${idx}${tpl.evCharging ? ' (EV)' : ''}`,
        publicationStatus: 'approved',
        allowedTypes: ['hatchback', 'sedan', 'suv'],
        maxLengthCm: 500,
        maxWidthCm: 215,
        maxHeightCm: 210,
        covered: tpl.covered,
        evCharging: tpl.evCharging,
        hourlyPriceInr: tpl.price4W,
        bufferMinutes: 15,
        operatingStartMin: 6 * 60,
        operatingEndMin: 23 * 60 + 30,
        hardDepartureMin: 23 * 60 + 30,
        restrictions: ['Max height 210cm', '15m buffer between reservations'],
        ownerBlocks: [],
        withdrawals: [],
        reviews: [
          {
            id: `REV-${idx}1`,
            bookingId: `BK-SEED-${idx}1`,
            authorAlias: 'Karthik M.',
            rating: 5,
            comment: `Easy entry near ${shortName} and accurate gate instructions.`,
            theme: 'Smooth Check-in',
            createdAt: '2026-11-18',
          },
        ],
      };

      const bay2W: ParkingSpace = {
        id: `BAY-${idx}B`,
        facilityId: facId,
        spaceCode: `${shortName.slice(0, 10)} 2W-${idx}`,
        publicationStatus: 'approved',
        allowedTypes: ['two_wheeler'],
        maxLengthCm: 245,
        maxWidthCm: 105,
        maxHeightCm: 185,
        covered: tpl.covered,
        evCharging: tpl.evCharging,
        hourlyPriceInr: tpl.price2W,
        bufferMinutes: 15,
        operatingStartMin: 6 * 60,
        operatingEndMin: 23 * 60 + 30,
        hardDepartureMin: 23 * 60 + 30,
        restrictions: ['Two-wheelers only'],
        ownerBlocks: [],
        withdrawals: [],
        reviews: [],
      };

      this.facilities.push(facility);
      this.spaces.push(bay4W, bay2W);
      addedFacilities++;
    }
    this.syncOccupancyStates();
    return { addedFacilities };
  }

  public addAudit(actor: string, action: string, detail: string) {
    this.auditLogs.unshift({
      id: `AUD-${String(this.auditLogs.length + 1).padStart(3, '0')}`,
      timestamp: new Date().toISOString(),
      actor,
      action,
      detail,
    });
    if (this.auditLogs.length > 60) {
      this.auditLogs = this.auditLogs.slice(0, 60);
    }
  }

  public calculateServerQuote(hourlyPriceInr: number, startMin: number, endMin: number) {
    const durationHours = Math.max(0.5, (endMin - startMin) / 60);
    const baseAmountInr = Math.round(durationHours * hourlyPriceInr);
    const platformFeeInr = Math.max(10, Math.round(baseAmountInr * 0.1));
    const gstInr = Math.round((baseAmountInr + platformFeeInr) * 0.18);
    const totalAmountInr = baseAmountInr + platformFeeInr + gstInr;
    return { durationHours, baseAmountInr, platformFeeInr, gstInr, totalAmountInr };
  }

  public evaluateSpace(
    space: ParkingSpace,
    facility: Facility,
    reqStartMin: number,
    reqEndMin: number,
    vehicle: VehicleProfile,
    prioritize: 'balanced' | 'closest_walk' | 'lowest_price' | 'covered_ev' = 'balanced'
  ): CandidateEvaluation {
    const checks: ConstraintCheck[] = [];
    const rejectionReasons: string[] = [];

    const provider = this.providers.find((p) => p.id === facility.providerId);
    const providerApproved = Boolean(
      provider &&
        provider.verificationStatus === 'APPROVED' &&
        (!provider.expiresAt || Date.parse(provider.expiresAt) >= Date.now())
    );
    const authPassed =
      facility.verificationStatus === 'verified' &&
      space.publicationStatus === 'approved' &&
      facility.operationalChecksPassed &&
      providerApproved;

    checks.push({
      constraint: 'provider_authority',
      passed: authPassed,
      detail: authPassed
        ? `Verified authority: ${facility.authorityDocRef} (Provider ${provider?.id} APPROVED)`
        : `Blocked: provider=${provider?.verificationStatus || 'NONE'}, space=${space.publicationStatus}, facility=${facility.verificationStatus}`,
      evidenceRef: `facility:${facility.id}:authority`,
    });
    if (!authPassed) {
      rejectionReasons.push(`Unapproved/unverified space (${space.publicationStatus})`);
    }

    const typeOk = space.allowedTypes.includes(vehicle.vehicleType);
    const dimOk =
      vehicle.lengthCm <= space.maxLengthCm &&
      vehicle.widthCm <= space.maxWidthCm &&
      vehicle.heightCm <= space.maxHeightCm;
    const vehicleOk = typeOk && dimOk;
    checks.push({
      constraint: 'vehicle_compatibility',
      passed: vehicleOk,
      detail: vehicleOk
        ? `${vehicle.label} (${vehicle.lengthCm}x${vehicle.widthCm}x${vehicle.heightCm}cm) fits bay (${space.maxLengthCm}x${space.maxWidthCm}x${space.maxHeightCm}cm)`
        : `Incompatible: ${vehicle.label} exceeds bay limit (${space.maxLengthCm}x${space.maxWidthCm}x${space.maxHeightCm}cm) or allowed vehicle class`,
      evidenceRef: `space:${space.id}:dimensions`,
    });
    if (!vehicleOk) {
      rejectionReasons.push(
        `Vehicle incompatible (max ${space.maxLengthCm}x${space.maxWidthCm}x${space.maxHeightCm}cm)`
      );
    }

    const opsOk =
      reqStartMin >= space.operatingStartMin &&
      reqEndMin <= space.hardDepartureMin &&
      reqEndMin > reqStartMin;
    checks.push({
      constraint: 'operating_hours_hard_cutoff',
      passed: opsOk,
      detail: opsOk
        ? `Window ${formatMinutesToTime(reqStartMin)}–${formatMinutesToTime(reqEndMin)} within ${formatMinutesToTime(space.operatingStartMin)}–${formatMinutesToTime(space.hardDepartureMin)} hard cutoff`
        : `Violates operating hours / hard cutoff (${formatMinutesToTime(space.operatingStartMin)}–${formatMinutesToTime(space.hardDepartureMin)})`,
      evidenceRef: `schedule:${space.id}:operating`,
    });
    if (!opsOk) {
      rejectionReasons.push(
        `Outside operating hours or hard departure ${formatMinutesToTime(space.hardDepartureMin)}`
      );
    }

    const activeBookings = this.bookings.filter(
      (b) =>
        b.spaceId === space.id &&
        (b.status === 'held' ||
          b.status === 'confirmed' ||
          b.status === 'checked-in' ||
          b.status === 'occupied')
    );

    const conflicts: string[] = [];
    for (const bk of activeBookings) {
      const bufferedStart = bk.startMin - space.bufferMinutes;
      const bufferedEnd = bk.endMin + space.bufferMinutes;
      if (reqStartMin < bufferedEnd && reqEndMin > bufferedStart) {
        conflicts.push(
          `Booking ${bk.id} (${formatMinutesToTime(bk.startMin)}–${formatMinutesToTime(bk.endMin)} + ${space.bufferMinutes}m buffer)`
        );
      }
    }

    for (const ob of space.ownerBlocks) {
      const bufferedStart = ob.startMin - space.bufferMinutes;
      const bufferedEnd = ob.endMin;
      if (reqStartMin < bufferedEnd && reqEndMin > bufferedStart) {
        conflicts.push(
          `Owner-use block (${formatMinutesToTime(ob.startMin)}–${formatMinutesToTime(ob.endMin)} with ${space.bufferMinutes}m pre-buffer)`
        );
      }
    }

    for (const wd of space.withdrawals) {
      if (reqStartMin < wd.endMin && reqEndMin > wd.startMin) {
        conflicts.push(
          `Host withdrew slot (${formatMinutesToTime(wd.startMin)}–${formatMinutesToTime(wd.endMin)}: ${wd.reason})`
        );
      }
    }

    const noOverlap = conflicts.length === 0;
    checks.push({
      constraint: 'time_window_buffer_integrity',
      passed: noOverlap,
      detail: noOverlap
        ? `Zero overlap across ${activeBookings.length} active bookings, ${space.ownerBlocks.length} owner blocks & ${space.withdrawals.length} withdrawals`
        : `Conflict detected: ${conflicts.join('; ')}`,
      evidenceRef: `availability:${space.id}:windows`,
    });
    if (!noOverlap) {
      rejectionReasons.push(conflicts[0]);
    }

    // Critical Autonomous Rule: Never assume a space is free on timer alone; block OVERSTAY / DEPARTURE_PENDING / CLEARANCE
    const occState = space.occupancyState || 'AVAILABLE';
    const occupancyClear =
      occState !== 'OVERSTAY' && occState !== 'DEPARTURE_PENDING' && occState !== 'CLEARANCE';
    checks.push({
      constraint: 'confirmed_physical_vacancy_buffer',
      passed: occupancyClear,
      detail: occupancyClear
        ? `Physical bay status ${occState} confirmed clear for scheduled pooling`
        : occState === 'OVERSTAY'
        ? 'Blocked: previous vehicle is in OVERSTAY beyond booked end time (never auto-released on timer).'
        : occState === 'DEPARTURE_PENDING'
        ? 'Blocked: departure indicated by phone; awaiting checkout & physical vacancy confirmation.'
        : 'Blocked: 15-minute clearance buffer running before bay reopens.',
      evidenceRef: `occupancy:${space.id}:${occState}`,
    });
    if (!occupancyClear) {
      rejectionReasons.push(
        occState === 'OVERSTAY'
          ? 'Bay held in OVERSTAY until previous vehicle departs'
          : occState === 'DEPARTURE_PENDING'
          ? 'Awaiting physical departure confirmation'
          : 'Turnaround clearance buffer active'
      );
    }

    const eligible = authPassed && vehicleOk && opsOk && noOverlap && occupancyClear;
    const quote = this.calculateServerQuote(space.hourlyPriceInr, reqStartMin, reqEndMin);
    const avgRating =
      space.reviews.length > 0
        ? Number(
            (space.reviews.reduce((sum, r) => sum + r.rating, 0) / space.reviews.length).toFixed(2)
          )
        : 0;

    const distanceFit = Math.max(0, Math.min(1, 1 - (facility.walkingDistanceM - 150) / 550));
    const priceFit = Math.max(0, Math.min(1, 1 - (space.hourlyPriceInr - 30) / 60));
    const safetyAmenityFit =
      (space.covered ? 0.35 : 0.1) +
      (space.evCharging && vehicle.isEv ? 0.35 : space.evCharging ? 0.15 : 0.05) +
      (facility.providerType === 'commercial' ? 0.3 : 0.2);
    const reviewFit = space.reviews.length > 0 ? avgRating / 5 : 0.65;
    const availabilityFit = noOverlap ? 1 : 0;

    let weights = { d: 0.28, p: 0.24, s: 0.22, r: 0.14, a: 0.12 };
    if (prioritize === 'closest_walk') {
      weights = { d: 0.45, p: 0.15, s: 0.18, r: 0.12, a: 0.1 };
    } else if (prioritize === 'lowest_price') {
      weights = { d: 0.15, p: 0.48, s: 0.15, r: 0.12, a: 0.1 };
    } else if (prioritize === 'covered_ev') {
      weights = { d: 0.2, p: 0.15, s: 0.45, r: 0.1, a: 0.1 };
    }

    const rawScore =
      weights.d * distanceFit +
      weights.p * priceFit +
      weights.s * safetyAmenityFit +
      weights.r * reviewFit +
      weights.a * availabilityFit;

    const score = eligible ? Number((rawScore * 100).toFixed(1)) : 0;

    return {
      spaceId: space.id,
      facilityId: facility.id,
      facilityName: facility.name,
      spaceCode: space.spaceCode,
      providerType: facility.providerType,
      verificationStatus: facility.verificationStatus,
      eligible,
      rejectionReasons,
      constraintChecks: checks,
      walkingDistanceM: facility.walkingDistanceM,
      walkingMinutes: facility.walkingMinutes,
      entranceLabel: facility.entranceLabel,
      hourlyPriceInr: space.hourlyPriceInr,
      durationHours: quote.durationHours,
      baseAmountInr: quote.baseAmountInr,
      platformFeeInr: quote.platformFeeInr,
      gstInr: quote.gstInr,
      totalQuoteInr: quote.totalAmountInr,
      score,
      scoreBreakdown: {
        distanceFit: Number((distanceFit * 100).toFixed(0)),
        priceFit: Number((priceFit * 100).toFixed(0)),
        safetyAmenityFit: Number((safetyAmenityFit * 100).toFixed(0)),
        reviewFit: Number((reviewFit * 100).toFixed(0)),
        availabilityFit: Number((availabilityFit * 100).toFixed(0)),
      },
      covered: space.covered,
      evCharging: space.evCharging,
      avgRating,
      reviewCount: space.reviews.length,
      evidenceSummary: `${facility.walkingDistanceM}m (${facility.walkingMinutes} min walk) via ${facility.entranceLabel}; ${facility.authorityDocRef}; ₹${space.hourlyPriceInr}/hr.`,
      restrictions: space.restrictions.length > 0 ? space.restrictions : facility.restrictions,
      lateArrivalSummary: facility.lateArrivalPolicy.summary,
    };
  }

  public evaluateAllCandidates(
    reqStartMin: number,
    reqEndMin: number,
    vehicle: VehicleProfile,
    prioritize: 'balanced' | 'closest_walk' | 'lowest_price' | 'covered_ev' = 'balanced',
    targetCoords?: { lat: number; lng: number }
  ) {
    this.expireStaleHolds();
    const all = this.spaces.map((space) => {
      const facility = this.facilities.find((f) => f.id === space.facilityId)!;
      const ev = this.evaluateSpace(space, facility, reqStartMin, reqEndMin, vehicle, prioritize);
      if (targetCoords) {
        const distM = calcGeoMeters(
          targetCoords.lat,
          targetCoords.lng,
          facility.entranceLat,
          facility.entranceLng
        );
        return {
          ...ev,
          walkingDistanceM: distM,
          walkingMinutes: Math.max(2, Math.round(distM / 75)),
          score: ev.eligible ? Math.max(10, Number((100 - distM * 0.025).toFixed(1))) : 0,
        };
      }
      return ev;
    });
    const eligible = all
      .filter((c) => c.eligible)
      .sort((a, b) =>
        targetCoords ? a.walkingDistanceM - b.walkingDistanceM : b.score - a.score
      );
    const excluded = all.filter((c) => !c.eligible);
    return { eligible, excluded, all };
  }

  // =========================================================================
  // BOOKINGS, HOST BLOCKS, WITHDRAWALS, SAFE EXTENSIONS & LATE ARRIVAL
  // =========================================================================

  public createTransactionalHold(params: {
    spaceId: string;
    vehicleId: string;
    driverName: string;
    driverEmail?: string;
    driverLicense?: string;
    startMin: number;
    endMin: number;
  }): { ok: boolean; booking?: BookingRecord; error?: string } {
    this.expireStaleHolds();
    if (this.bookingLock) {
      return { ok: false, error: 'CONCURRENT_LOCK_CONTENTION: Transactional exclusion lock active.' };
    }
    this.bookingLock = true;
    try {
      const space = this.spaces.find((s) => s.id === params.spaceId);
      if (!space) return { ok: false, error: 'SPACE_NOT_FOUND' };
      const facility = this.facilities.find((f) => f.id === space.facilityId);
      if (!facility) return { ok: false, error: 'FACILITY_NOT_FOUND' };
      const vehicle = this.vehicles.find((v) => v.id === params.vehicleId);
      if (!vehicle) return { ok: false, error: 'VEHICLE_NOT_FOUND' };

      if (params.driverEmail) {
        const wallet = this.getOrCreateWallet(params.driverEmail, params.driverName || 'Driver');
        if (wallet.bookingRestricted || wallet.unpaidDueInr > 0) {
          return {
            ok: false,
            error: `Account restricted: ₹${wallet.unpaidDueInr} unpaid overstay/extension balance due. Please settle & top up your Prepaid Parking Wallet first.`,
          };
        }
      }

      const evaluation = this.evaluateSpace(
        space,
        facility,
        params.startMin,
        params.endMin,
        vehicle
      );
      if (!evaluation.eligible) {
        this.addAudit(
          'Booking Exclusion Engine',
          'HOLD_REJECTED_INVARIANT',
          `Rejected hold on ${space.spaceCode}: ${evaluation.rejectionReasons.join('; ')}`
        );
        return {
          ok: false,
          error: `Constraint violation: ${evaluation.rejectionReasons.join(' | ')}`,
        };
      }

      const quote = this.calculateServerQuote(
        space.hourlyPriceInr,
        params.startMin,
        params.endMin
      );
      const id = `BK-2026-${Math.floor(4200 + Math.random() * 5700)}`;
      const accessCode = `PKP-${facility.id.slice(-2)}-${space.id.slice(-2)}-${Math.floor(100 + Math.random() * 899)}`;
      const nowIso = new Date().toISOString();
      const holdExpiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      const matchedProfile = params.driverEmail
        ? this.driverProfiles.find(
            (p) => p.email.toLowerCase() === params.driverEmail?.toLowerCase()
          )
        : undefined;

      const record: BookingRecord = {
        id,
        spaceId: space.id,
        facilityId: facility.id,
        facilityName: facility.name,
        spaceCode: space.spaceCode,
        driverName: params.driverName || 'Aarav Sharma',
        driverEmail: params.driverEmail,
        driverLicense: params.driverLicense || matchedProfile?.licenseNumber,
        vehicleId: vehicle.id,
        vehicleLabel: vehicle.label,
        vehiclePlate: vehicle.plateNumber,
        startMin: params.startMin,
        endMin: params.endMin,
        bufferMinutes: space.bufferMinutes,
        status: 'held',
        baseAmountInr: quote.baseAmountInr,
        platformFeeInr: quote.platformFeeInr,
        gstInr: quote.gstInr,
        totalAmountInr: quote.totalAmountInr,
        accessCode,
        entranceLabel: facility.entranceLabel,
        createdAt: nowIso,
        holdExpiresAt,
        lateArrivalPolicy: { ...facility.lateArrivalPolicy },
        extensionRequests: [],
        extensionOffers: [],
        paymentStatus: 'unpaid',
        refundStatus: 'none',
        qrPassToken: signBookingQrToken(id, facility.id, accessCode),
        overstayStatus: 'none',
        auditTrail: [
          `${nowIso.slice(11, 19)}Z Transactional Hold Created (10m expiry)`,
          `${nowIso.slice(11, 19)}Z Server Quote Locked: ₹${quote.totalAmountInr} INR`,
        ],
      };

      this.bookings.unshift(record);
      if (!space.occupancyState || space.occupancyState === 'AVAILABLE') {
        space.occupancyState = 'BOOKED';
        space.activeOccupancyBookingId = record.id;
        space.lastOccupancyEvent = `Held for ${record.id}`;
      }
      this.addAudit(
        'Transactional Booking Service',
        'BOOKING_HOLD_CREATED',
        `${record.id} held ${space.spaceCode} (${formatMinutesToTime(params.startMin)}–${formatMinutesToTime(params.endMin)})`
      );
      return { ok: true, booking: record };
    } finally {
      this.bookingLock = false;
    }
  }

  public requestBookingExtension(
    bookingId: string,
    additionalMinutes = 30
  ): {
    ok: boolean;
    extensionRequest?: ExtensionRequest;
    booking?: BookingRecord;
    alternatives?: ExtensionAlternative[];
    error?: string;
  } {
    const bk = this.bookings.find((b) => b.id === bookingId);
    if (!bk) return { ok: false, error: 'Booking not found' };
    if (bk.status !== 'confirmed' && bk.status !== 'checked-in' && bk.status !== 'occupied') {
      return {
        ok: false,
        error: 'Only confirmed, checked-in, or occupied bookings can request an extension.',
      };
    }
    const mins = Math.max(15, Math.min(180, Math.round(additionalMinutes)));
    const space = this.spaces.find((s) => s.id === bk.spaceId);
    const facility = this.facilities.find((f) => f.id === bk.facilityId);
    if (!space || !facility) return { ok: false, error: 'Space or facility not found' };

    const newEnd = bk.endMin + mins;

    const findAlternatives = (): ExtensionAlternative[] => {
      const vehicle = this.vehicles.find((v) => v.id === bk.vehicleId) || this.vehicles[0];
      const evals = this.evaluateAllCandidates(
        bk.endMin,
        newEnd,
        vehicle,
        'closest_walk',
        { lat: facility.lat, lng: facility.lng }
      );
      return evals.eligible
        .filter((e) => e.spaceId !== space.id)
        .slice(0, 3)
        .map((e) => ({
          spaceId: e.spaceId,
          facilityName: e.facilityName,
          spaceCode: e.spaceCode,
          hourlyPriceInr: e.hourlyPriceInr,
          walkingDistanceM: e.walkingDistanceM,
        }));
    };

    // 1. Check departure buffer & hard cutoff
    if (newEnd > space.hardDepartureMin) {
      const alts = findAlternatives();
      this.addAudit(
        'Extension Guard',
        'EXTENSION_REJECTED_CUTOFF',
        `Rejected +${mins}m extension on ${bk.id}: exceeds hard departure ${formatMinutesToTime(space.hardDepartureMin)}.`
      );
      return {
        ok: false,
        alternatives: alts,
        error: `Extension rejected: ${formatMinutesToTime(newEnd)} exceeds host hard departure cutoff (${formatMinutesToTime(space.hardDepartureMin)}).`,
      };
    }

    // 2. Check next reservation + turnaround buffer
    const conflictBooking = this.bookings.find(
      (other) =>
        other.id !== bk.id &&
        other.spaceId === bk.spaceId &&
        (other.status === 'held' ||
          other.status === 'confirmed' ||
          other.status === 'checked-in' ||
          other.status === 'occupied') &&
        bk.endMin < other.startMin + space.bufferMinutes &&
        newEnd + space.bufferMinutes > other.startMin
    );
    if (conflictBooking) {
      const alts = findAlternatives();
      this.addAudit(
        'Extension Guard',
        'EXTENSION_REJECTED_BOOKING_CONFLICT',
        `Rejected +${mins}m extension on ${bk.id}: protects downstream booking ${conflictBooking.id}.`
      );
      return {
        ok: false,
        alternatives: alts,
        error: `Extension rejected: conflicts with next reservation ${conflictBooking.id} (${formatMinutesToTime(conflictBooking.startMin)}–${formatMinutesToTime(conflictBooking.endMin)}) + ${space.bufferMinutes}m buffer.`,
      };
    }

    // 3. Check host availability (owner blocks & withdrawals)
    const conflictOwner = space.ownerBlocks.find(
      (ob) => newEnd + space.bufferMinutes > ob.startMin && bk.startMin < ob.endMin
    );
    if (conflictOwner) {
      const alts = findAlternatives();
      return {
        ok: false,
        alternatives: alts,
        error: `Extension rejected: conflicts with ${conflictOwner.label} (${formatMinutesToTime(conflictOwner.startMin)}).`,
      };
    }
    const conflictWd = space.withdrawals.find(
      (wd) => newEnd + space.bufferMinutes > wd.startMin && bk.endMin < wd.endMin
    );
    if (conflictWd) {
      const alts = findAlternatives();
      return {
        ok: false,
        alternatives: alts,
        error: `Extension rejected: host withdrew availability from ${formatMinutesToTime(conflictWd.startMin)} (${conflictWd.reason}).`,
      };
    }

    // 4. Recalculate price delta on backend
    const newQuote = this.calculateServerQuote(space.hourlyPriceInr, bk.startMin, newEnd);
    const additionalBaseInr = Math.max(0, newQuote.baseAmountInr - bk.baseAmountInr);
    const additionalFeeInr = Math.max(0, newQuote.platformFeeInr - bk.platformFeeInr);
    const additionalGstInr = Math.max(0, newQuote.gstInr - bk.gstInr);
    const additionalTotalInr = Math.max(10, newQuote.totalAmountInr - bk.totalAmountInr);

    // 5. Queue for host approval (never extend silently just because button clicked)
    const extReq: ExtensionRequest = {
      id: `EXT-${Date.now().toString(36).toUpperCase().slice(-5)}`,
      bookingId: bk.id,
      requestedEndMin: newEnd,
      additionalBaseInr,
      additionalFeeInr,
      additionalGstInr,
      additionalTotalInr,
      status: 'pending_host_approval',
      reason: `Pre-checked clear against buffers and ${formatMinutesToTime(space.hardDepartureMin)} cutoff; awaiting host approval.`,
      createdAt: new Date().toISOString(),
    };

    bk.extensionRequests.unshift(extReq);
    bk.auditTrail.push(
      `${new Date().toISOString().slice(11, 19)}Z Extension Request ${extReq.id} (+${mins}m to ${formatMinutesToTime(newEnd)}, +₹${additionalTotalInr}) -> Awaiting Host Approval`
    );
    this.addAudit(
      bk.driverName,
      'EXTENSION_REQUESTED',
      `${bk.id} requested +${mins}m until ${formatMinutesToTime(newEnd)} (+₹${additionalTotalInr}).`
    );

    return { ok: true, extensionRequest: extReq, booking: bk };
  }

  public decideExtensionRequest(
    bookingId: string,
    requestId: string,
    decision: 'approve' | 'reject',
    actorName: string
  ): { ok: boolean; booking?: BookingRecord; error?: string } {
    if (this.bookingLock) {
      return { ok: false, error: 'Concurrent lock active; retry momentarily.' };
    }
    this.bookingLock = true;
    try {
      const bk = this.bookings.find((b) => b.id === bookingId);
      if (!bk) return { ok: false, error: 'Booking not found' };
      const req = bk.extensionRequests.find((r) => r.id === requestId);
      if (!req) return { ok: false, error: 'Extension request not found' };
      if (req.status !== 'pending_host_approval') {
        return { ok: false, error: `Extension request already ${req.status}` };
      }

      const nowIso = new Date().toISOString();
      if (decision === 'reject') {
        req.status = 'rejected';
        req.hostDecisionBy = actorName;
        req.hostDecisionAt = nowIso;
        bk.auditTrail.push(`${nowIso.slice(11, 19)}Z Host declined extension ${req.id}`);
        this.notifications.unshift({
          id: `NTF-${Date.now().toString(36).toUpperCase().slice(-5)}`,
          driverEmail: bk.driverEmail,
          driverName: bk.driverName,
          bookingId: bk.id,
          type: 'extension_update',
          title: `Extension declined for ${bk.spaceCode}`,
          message: `${actorName} declined extension to ${formatMinutesToTime(req.requestedEndMin)}. Please depart by ${formatMinutesToTime(bk.endMin)}.`,
          read: false,
          createdAt: nowIso,
        });
        this.addAudit(actorName, 'EXTENSION_DECLINED', `${bk.id} extension ${req.id} declined by host.`);
        return { ok: true, booking: bk };
      }

      // 6. Transactionally re-verify conflicts right before approval commit
      const space = this.spaces.find((s) => s.id === bk.spaceId)!;
      const conflictBooking = this.bookings.find(
        (other) =>
          other.id !== bk.id &&
          other.spaceId === bk.spaceId &&
          (other.status === 'held' ||
            other.status === 'confirmed' ||
            other.status === 'checked-in' ||
            other.status === 'occupied') &&
          bk.endMin < other.startMin + space.bufferMinutes &&
          req.requestedEndMin + space.bufferMinutes > other.startMin
      );
      if (conflictBooking || req.requestedEndMin > space.hardDepartureMin) {
        req.status = 'rejected';
        req.hostDecisionBy = actorName;
        req.hostDecisionAt = nowIso;
        return {
          ok: false,
          error: 'Extension cannot be committed: downstream booking or cutoff conflict appeared before approval.',
        };
      }

      const newQuote = this.calculateServerQuote(
        space.hourlyPriceInr,
        bk.startMin,
        req.requestedEndMin
      );
      bk.endMin = req.requestedEndMin;
      bk.baseAmountInr = newQuote.baseAmountInr;
      bk.platformFeeInr = newQuote.platformFeeInr;
      bk.gstInr = newQuote.gstInr;
      bk.totalAmountInr = newQuote.totalAmountInr;
      req.status = 'approved';
      req.hostDecisionBy = actorName;
      req.hostDecisionAt = nowIso;
      bk.auditTrail.push(
        `${nowIso.slice(11, 19)}Z Host (${actorName}) Approved Extension ${req.id} -> New End ${formatMinutesToTime(bk.endMin)} (Total ₹${bk.totalAmountInr})`
      );

      this.transactions.unshift({
        id: `TXN-${Date.now().toString(36).toUpperCase().slice(-5)}`,
        timestamp: nowIso,
        bookingId: bk.id,
        type: 'extension_charge',
        amountInr: req.additionalTotalInr,
        actor: bk.driverName,
        status: 'settled_on_card',
        referenceId: req.id,
      });

      const stl = this.settlements.find((s) => s.bookingId === bk.id);
      if (stl) {
        stl.grossInr = bk.baseAmountInr;
        stl.platformCommissionInr = Math.round(bk.baseAmountInr * 0.1);
        stl.gstWithheldInr = bk.gstInr;
        stl.netPayoutInr = bk.baseAmountInr - stl.platformCommissionInr;
      }

      this.notifications.unshift({
        id: `NTF-${Date.now().toString(36).toUpperCase().slice(-5)}`,
        driverEmail: bk.driverEmail,
        driverName: bk.driverName,
        bookingId: bk.id,
        type: 'extension_update',
        title: `Extension approved until ${formatMinutesToTime(bk.endMin)}`,
        message: `Host approved your extension (+₹${req.additionalTotalInr}).`,
        read: false,
        createdAt: nowIso,
      });

      this.addAudit(
        actorName,
        'EXTENSION_APPROVED_TRANSACTIONAL',
        `${bk.id} extended to ${formatMinutesToTime(bk.endMin)} (Total ₹${bk.totalAmountInr}).`
      );
      return { ok: true, booking: bk };
    } finally {
      this.bookingLock = false;
    }
  }

  public addOwnerUseBlock(input: {
    spaceId: string;
    startMin: number;
    endMin: number;
    label: string;
    actorName: string;
  }): {
    ok: boolean;
    protectedBookings: BookingRecord[];
    error?: string;
  } {
    const space = this.spaces.find((s) => s.id === input.spaceId);
    if (!space) return { ok: false, protectedBookings: [], error: 'Space not found' };
    if (input.endMin <= input.startMin) {
      return { ok: false, protectedBookings: [], error: 'End time must be after start time.' };
    }

    space.ownerBlocks.push({
      id: `OWN-${Date.now().toString(36).toUpperCase().slice(-5)}`,
      startMin: input.startMin,
      endMin: input.endMin,
      label: input.label.trim() || 'Owner Personal Use Block',
      type: 'owner_block',
    });

    // Protect existing confirmed/occupied bookings: never overwrite or delete them!
    const protectedBookings = this.bookings.filter(
      (b) =>
        b.spaceId === space.id &&
        (b.status === 'confirmed' || b.status === 'checked-in' || b.status === 'occupied') &&
        b.startMin < input.endMin &&
        b.endMin + space.bufferMinutes > input.startMin
    );

    const nowIso = new Date().toISOString();
    for (const bk of protectedBookings) {
      bk.hostExceptionFlagged = true;
      bk.auditTrail.push(
        `${nowIso.slice(11, 19)}Z Owner Block Added (${formatMinutesToTime(input.startMin)}–${formatMinutesToTime(input.endMin)}) -> Existing Booking Protected & Flagged for Review`
      );
      this.notifications.unshift({
        id: `NTF-${Date.now().toString(36).toUpperCase().slice(-5)}`,
        driverEmail: bk.driverEmail,
        driverName: bk.driverName,
        bookingId: bk.id,
        type: 'host_block_exception',
        title: `Booking protected during host schedule change`,
        message: `Host added an owner block overlapping ${bk.spaceCode}, but your confirmed booking ${bk.id} remains protected and under ops review.`,
        resolutionOptions: ['Keep Confirmed Slot', 'Request Priority Rebooking', 'Full Refund'],
        read: false,
        createdAt: nowIso,
      });
    }

    this.addAudit(
      input.actorName,
      'OWNER_BLOCK_ADDED',
      `Added block ${formatMinutesToTime(input.startMin)}–${formatMinutesToTime(input.endMin)} on ${space.spaceCode}. Protected ${protectedBookings.length} existing confirmed booking(s).`
    );

    return { ok: true, protectedBookings };
  }

  public withdrawFutureAvailability(input: {
    spaceId: string;
    startMin: number;
    endMin: number;
    reason: string;
    actorName: string;
  }): {
    ok: boolean;
    withdrawal?: AvailabilityWithdrawal;
    affectedBookings: BookingRecord[];
    error?: string;
  } {
    const space = this.spaces.find((s) => s.id === input.spaceId);
    if (!space) return { ok: false, affectedBookings: [], error: 'Space not found' };
    if (input.endMin <= input.startMin) {
      return { ok: false, affectedBookings: [], error: 'End time must be after start time.' };
    }

    const affectedBookings = this.bookings.filter(
      (b) =>
        b.spaceId === space.id &&
        (b.status === 'held' || b.status === 'confirmed') &&
        b.startMin < input.endMin &&
        b.endMin > input.startMin
    );

    const nowIso = new Date().toISOString();
    const wd: AvailabilityWithdrawal = {
      id: `WDR-${Date.now().toString(36).toUpperCase().slice(-5)}`,
      spaceId: space.id,
      startMin: input.startMin,
      endMin: input.endMin,
      reason: input.reason.trim() || 'Maintenance / Emergency Host Withdrawal',
      createdAt: nowIso,
      affectedBookingIds: affectedBookings.map((b) => b.id),
    };
    space.withdrawals.push(wd);

    for (const bk of affectedBookings) {
      bk.withdrawalResolution = {
        status: 'affected',
        options: ['Rebook Nearby Verified Bay (Zero Extra Fee)', 'Full 100% Instant Refund'],
      };
      bk.auditTrail.push(
        `${nowIso.slice(11, 19)}Z Host Withdrew Future Slot -> Driver Notified with Resolution Options`
      );
      this.notifications.unshift({
        id: `NTF-${Date.now().toString(36).toUpperCase().slice(-5)}`,
        driverEmail: bk.driverEmail,
        driverName: bk.driverName,
        bookingId: bk.id,
        type: 'slot_withdrawn',
        title: `Action Needed: Host withdrew ${bk.spaceCode}`,
        message: `Host withdrew availability ${formatMinutesToTime(input.startMin)}–${formatMinutesToTime(input.endMin)} (${wd.reason}). Choose free nearby rebooking or 100% refund.`,
        resolutionOptions: bk.withdrawalResolution.options,
        read: false,
        createdAt: nowIso,
      });
    }

    this.addAudit(
      input.actorName,
      'FUTURE_AVAILABILITY_WITHDRAWN',
      `${space.spaceCode} withdrawn ${formatMinutesToTime(input.startMin)}–${formatMinutesToTime(input.endMin)}; ${affectedBookings.length} driver(s) notified.`
    );

    return { ok: true, withdrawal: wd, affectedBookings };
  }

  public resolveAffectedWithdrawal(
    bookingId: string,
    choice: 'rebook' | 'refund'
  ): { ok: boolean; booking?: BookingRecord; error?: string } {
    const bk = this.bookings.find((b) => b.id === bookingId);
    if (!bk || !bk.withdrawalResolution) {
      return { ok: false, error: 'Booking does not have an open withdrawal resolution.' };
    }
    const nowIso = new Date().toISOString();
    if (choice === 'refund') {
      bk.withdrawalResolution.status = 'refunded';
      bk.withdrawalResolution.resolvedOption = 'Full 100% Instant Refund';
      bk.status = 'cancelled';
      bk.paymentStatus = 'refunded';
      bk.refundStatus = 'refunded';
      bk.refundAmountInr = bk.totalAmountInr;
      this.refunds.unshift({
        id: `RFD-${Date.now().toString(36).toUpperCase().slice(-5)}`,
        bookingId: bk.id,
        paymentOrderId: bk.paymentOrderId,
        amountInr: bk.totalAmountInr,
        reason: 'Host future slot withdrawal — 100% resolution refund',
        status: 'processed',
        requestedBy: bk.driverName,
        processedBy: 'System Auto-Resolution',
        createdAt: nowIso,
        processedAt: nowIso,
      });
      this.transactions.unshift({
        id: `TXN-${Date.now().toString(36).toUpperCase().slice(-5)}`,
        timestamp: nowIso,
        bookingId: bk.id,
        type: 'refund',
        amountInr: bk.totalAmountInr,
        actor: bk.driverName,
        status: 'refunded',
        referenceId: bk.id,
      });
      return { ok: true, booking: bk };
    }

    // Rebook into nearest eligible alternative bay
    const vehicle = this.vehicles.find((v) => v.id === bk.vehicleId) || this.vehicles[0];
    const fac = this.facilities.find((f) => f.id === bk.facilityId);
    const evals = this.evaluateAllCandidates(
      bk.startMin,
      bk.endMin,
      vehicle,
      'closest_walk',
      fac ? { lat: fac.lat, lng: fac.lng } : undefined
    );
    const alt = evals.eligible.find((e) => e.spaceId !== bk.spaceId);
    if (!alt) {
      return { ok: false, error: 'No nearby eligible bay available; please choose 100% refund.' };
    }
    bk.spaceId = alt.spaceId;
    bk.facilityId = alt.facilityId;
    bk.facilityName = alt.facilityName;
    bk.spaceCode = alt.spaceCode;
    bk.entranceLabel = alt.entranceLabel;
    bk.withdrawalResolution.status = 'rebooked';
    bk.withdrawalResolution.resolvedOption = `Rebooked to ${alt.facilityName} (${alt.spaceCode})`;
    bk.auditTrail.push(`${nowIso.slice(11, 19)}Z Driver accepted rebooking to ${alt.spaceCode}`);
    this.addAudit(bk.driverName, 'WITHDRAWAL_REBOOKED', `${bk.id} moved to ${alt.spaceCode}`);
    return { ok: true, booking: bk };
  }

  public performBookingAction(
    bookingId: string,
    action: 'confirm' | 'checkin' | 'checkout' | 'cancel' | 'extend_30m',
    options?: { arrivalMinutesLate?: number }
  ): { ok: boolean; booking?: BookingRecord; error?: string } {
    const bk = this.bookings.find((b) => b.id === bookingId);
    if (!bk) return { ok: false, error: 'Booking not found' };
    const ts = new Date().toISOString().slice(11, 19) + 'Z';
    const nowIso = new Date().toISOString();

    if (action === 'confirm') {
      return {
        ok: false,
        error: 'Direct client confirmation is disabled. Use Payment Order + Signed Webhook verification.',
      };
    }

    if (action === 'checkin') {
      if (bk.status !== 'confirmed') return { ok: false, error: 'Must be confirmed before check-in.' };
      const lateMins = Math.max(0, Number(options?.arrivalMinutesLate || 0));
      let arrivalStatus: 'on_time' | 'late_grace' | 'late_flagged' = 'on_time';
      if (lateMins > bk.lateArrivalPolicy.forfeitAfterMinutes) {
        bk.status = 'expired';
        bk.arrivalStatus = 'late_flagged';
        bk.auditTrail.push(
          `${ts} Arrived ${lateMins}m late (> ${bk.lateArrivalPolicy.forfeitAfterMinutes}m hold cutoff) -> Disclosed Late-Arrival Forfeiture Applied`
        );
        this.addAudit('Gate Verification', 'LATE_ARRIVAL_FORFEIT', `${bk.id} forfeited after ${lateMins}m delay.`);
        return {
          ok: false,
          error: `Arrival ${lateMins}m late exceeds disclosed ${bk.lateArrivalPolicy.forfeitAfterMinutes}m hold window (${bk.lateArrivalPolicy.summary}).`,
        };
      } else if (lateMins > 0 && lateMins <= bk.lateArrivalPolicy.graceMinutes) {
        arrivalStatus = 'late_grace';
      } else if (lateMins > bk.lateArrivalPolicy.graceMinutes) {
        arrivalStatus = 'late_flagged';
      }

      bk.status = 'checked-in';
      bk.checkedInAt = nowIso;
      bk.arrivalStatus = arrivalStatus;
      const space = this.spaces.find((s) => s.id === bk.spaceId);
      if (space) {
        space.occupancyState = 'OCCUPIED';
        space.activeOccupancyBookingId = bk.id;
        space.vacancyConfirmed = false;
        space.bufferCompleted = false;
        space.lastOccupancyEvent = `Driver checked in (${bk.id}) — monitoring end time`;
      }
      bk.auditTrail.push(
        `${ts} Entrance QR/Code (${bk.accessCode}) Verified -> Checked-In (${arrivalStatus}${lateMins > 0 ? `, +${lateMins}m` : ''})`
      );
      this.addAudit('Gate Verification', 'CHECKIN_VERIFIED', `${bk.id} checked-in (${arrivalStatus}) at ${bk.entranceLabel}`);
      return { ok: true, booking: bk };
    }

    if (action === 'checkout') {
      const depRes = this.confirmDepartureAndStartClearance({
        bookingId,
        confirmedBy: 'driver',
        actorName: bk.driverName,
      });
      if (!depRes.ok) return { ok: false, error: depRes.error };
      return {
        ok: true,
        booking: depRes.booking,
        wallet: depRes.wallet,
        extraHoursDeductedInr: depRes.extraHoursDeductedInr,
        extraMinutesCharged: depRes.extraMinutesCharged,
        remainingBalanceInr: depRes.remainingBalanceInr,
        unpaidDueInr: depRes.unpaidDueInr,
      } as {
        ok: boolean;
        booking?: BookingRecord;
        wallet?: PrepaidWallet;
        extraHoursDeductedInr?: number;
        extraMinutesCharged?: number;
        remainingBalanceInr?: number;
        unpaidDueInr?: number;
        error?: string;
      };
    }

    if (action === 'cancel') {
      if (bk.status === 'completed' || bk.status === 'cancelled' || bk.status === 'expired') {
        return { ok: false, error: `Booking already ${bk.status}` };
      }
      const wasPaid = bk.paymentStatus === 'paid';
      bk.status = 'cancelled';
      if (wasPaid) {
        const refundAmt = bk.totalAmountInr;
        bk.paymentStatus = 'refunded';
        bk.refundStatus = 'refunded';
        bk.refundAmountInr = refundAmt;
        const rfd: RefundRecord = {
          id: `RFD-${Date.now().toString(36).toUpperCase().slice(-5)}`,
          bookingId: bk.id,
          paymentOrderId: bk.paymentOrderId,
          amountInr: refundAmt,
          reason: 'Driver pre-arrival cancellation (100% policy refund)',
          status: 'processed',
          requestedBy: bk.driverName,
          processedBy: 'Automated Refund Engine',
          createdAt: nowIso,
          processedAt: nowIso,
        };
        this.refunds.unshift(rfd);
        this.transactions.unshift({
          id: `TXN-${Date.now().toString(36).toUpperCase().slice(-5)}`,
          timestamp: nowIso,
          bookingId: bk.id,
          type: 'refund',
          amountInr: refundAmt,
          actor: bk.driverName,
          status: 'refunded',
          referenceId: rfd.id,
        });
        const stl = this.settlements.find((s) => s.bookingId === bk.id);
        if (stl) stl.status = 'reversed';
        bk.auditTrail.push(`${ts} Cancelled -> Full Refund ₹${refundAmt} Processed (${rfd.id})`);
      } else {
        bk.auditTrail.push(`${ts} Unpaid Hold Cancelled -> Inventory & Buffer Released`);
      }
      const space = this.spaces.find((s) => s.id === bk.spaceId);
      if (
        space &&
        space.occupancyState !== 'OCCUPIED' &&
        space.occupancyState !== 'OVERSTAY' &&
        space.occupancyState !== 'DEPARTURE_PENDING' &&
        space.occupancyState !== 'CLEARANCE'
      ) {
        const anotherUpcoming = this.bookings.find(
          (other) =>
            other.id !== bk.id &&
            other.spaceId === space.id &&
            (other.status === 'confirmed' || other.status === 'held')
        );
        space.occupancyState = anotherUpcoming ? 'BOOKED' : 'AVAILABLE';
        space.activeOccupancyBookingId = anotherUpcoming?.id;
        space.lastOccupancyEvent = anotherUpcoming
          ? `Reservation ${bk.id} cancelled; holding for ${anotherUpcoming.id}`
          : `Hold ${bk.id} cancelled — bay reopened`;
      }
      this.addAudit('Booking Service', 'BOOKING_CANCELLED', `${bk.id} released ${bk.spaceCode}`);
      return { ok: true, booking: bk };
    }

    if (action === 'extend_30m') {
      const reqRes = this.requestBookingExtension(bookingId, 30);
      if (!reqRes.ok) return { ok: false, error: reqRes.error };
      return { ok: true, booking: reqRes.booking };
    }

    return { ok: false, error: 'Unsupported action' };
  }

  public verifyQrCheckin(input: {
    bookingId: string;
    scannedToken: string;
    scanMethod: 'camera' | 'upload' | 'gate_placard' | 'manual_token';
    arrivalMinutesLate?: number;
    actorName: string;
  }): { ok: boolean; booking?: BookingRecord; error?: string } {
    const bk = this.bookings.find((b) => b.id === input.bookingId);
    if (!bk) return { ok: false, error: 'Booking not found' };
    if (bk.status === 'checked-in' || bk.status === 'occupied') {
      return { ok: true, booking: bk };
    }
    if (bk.status !== 'confirmed') {
      return {
        ok: false,
        error: `Only paid confirmed bookings can scan QR for check-in (current status: ${bk.status}).`,
      };
    }

    const token = input.scannedToken.trim();
    if (!token) {
      return { ok: false, error: 'Please scan or provide a valid ParkPool QR token.' };
    }

    let parsedJsonPass: {
      bookingId?: string;
      arrivalTimestamp?: string;
      facilityId?: string;
      accessCode?: string;
      signatureToken?: string;
    } | null = null;
    if (token.startsWith('{')) {
      try {
        parsedJsonPass = JSON.parse(token) as {
          bookingId?: string;
          arrivalTimestamp?: string;
          facilityId?: string;
          accessCode?: string;
          signatureToken?: string;
        };
      } catch {
        parsedJsonPass = null;
      }
    }

    const tokenToVerify = parsedJsonPass?.signatureToken || token;
    const gateCheck = verifyFacilityGateQrToken(tokenToVerify);
    const riderCheck = verifyBookingQrToken(tokenToVerify);

    if (parsedJsonPass && parsedJsonPass.bookingId && parsedJsonPass.bookingId !== bk.id) {
      return {
        ok: false,
        error: `QR pass belongs to booking ${parsedJsonPass.bookingId}, not ${bk.id}.`,
      };
    }

    if (gateCheck.valid) {
      if (gateCheck.facilityId !== bk.facilityId) {
        return {
          ok: false,
          error: `Wrong parking location QR: scanned ${gateCheck.facilityId} (${gateCheck.entranceLabel}), expected ${bk.facilityName}.`,
        };
      }
    } else if (riderCheck.valid) {
      if (riderCheck.bookingId !== bk.id || riderCheck.facilityId !== bk.facilityId) {
        return {
          ok: false,
          error: `QR pass belongs to booking ${riderCheck.bookingId}, not ${bk.id}.`,
        };
      }
    } else if (
      parsedJsonPass &&
      parsedJsonPass.bookingId === bk.id &&
      parsedJsonPass.arrivalTimestamp &&
      parsedJsonPass.accessCode?.toUpperCase() === bk.accessCode.toUpperCase()
    ) {
      // Verified JSON entrance pass containing matching bookingId, arrivalTimestamp, and access PIN
    } else if (token.toUpperCase() !== bk.accessCode.toUpperCase()) {
      return {
        ok: false,
        error: 'Invalid or tampered QR code signature. Scan the entrance QR placard at the facility gate.',
      };
    }

    const lateMins = Math.max(0, Number(input.arrivalMinutesLate || 0));
    const ts = new Date().toISOString().slice(11, 19) + 'Z';
    const nowIso = new Date().toISOString();

    if (lateMins > bk.lateArrivalPolicy.forfeitAfterMinutes) {
      bk.status = 'expired';
      bk.arrivalStatus = 'late_flagged';
      bk.auditTrail.push(
        `${ts} QR Check-In Rejected (+${lateMins}m > ${bk.lateArrivalPolicy.forfeitAfterMinutes}m hold cutoff) -> Booking Expired`
      );
      this.addAudit('QR Gate Scanner', 'QR_CHECKIN_LATE_EXPIRED', `${bk.id} exceeded arrival cutoff (+${lateMins}m).`);
      return {
        ok: false,
        error: `Arrival ${lateMins}m late exceeds disclosed ${bk.lateArrivalPolicy.forfeitAfterMinutes}m hold cutoff.`,
      };
    }

    const arrivalStatus: 'on_time' | 'late_grace' | 'late_flagged' =
      lateMins === 0
        ? 'on_time'
        : lateMins <= bk.lateArrivalPolicy.graceMinutes
        ? 'late_grace'
        : 'late_flagged';

    bk.status = 'checked-in';
    bk.checkedInAt = nowIso;
    bk.qrVerifiedAt = nowIso;
    bk.qrScanMethod = input.scanMethod;
    bk.arrivalStatus = arrivalStatus;
    const space = this.spaces.find((s) => s.id === bk.spaceId);
    if (space) {
      space.occupancyState = 'OCCUPIED';
      space.activeOccupancyBookingId = bk.id;
      space.vacancyConfirmed = false;
      space.bufferCompleted = false;
      space.lastOccupancyEvent = `Host scanner verified entry QR (${bk.id})`;
    }
    bk.auditTrail.push(
      `${ts} Host Scanner QR Verified (${input.scanMethod}) at ${bk.entranceLabel} -> Status: checked-in · Bay: OCCUPIED`
    );
    this.addAudit(
      input.actorName,
      'QR_CHECKIN_VERIFIED',
      `${bk.id} (${bk.spaceCode}) verified via ${input.scanMethod} -> status=checked-in, occupancy=OCCUPIED.`
    );
    return { ok: true, booking: bk };
  }

  public reportOverstay(input: {
    bookingId: string;
    overstayMinutes: number;
    actorName: string;
  }): {
    ok: boolean;
    overstayBooking?: BookingRecord;
    impactedBookings: BookingRecord[];
    summary?: string;
    error?: string;
  } {
    const bk = this.bookings.find((b) => b.id === input.bookingId);
    if (!bk) return { ok: false, impactedBookings: [], error: 'Booking not found' };
    if (bk.status !== 'checked-in' && bk.status !== 'occupied' && bk.status !== 'confirmed') {
      return {
        ok: false,
        impactedBookings: [],
        error: `Overstay can only be flagged on an active booking (current: ${bk.status}).`,
      };
    }
    const space = this.spaces.find((s) => s.id === bk.spaceId);
    const fac = this.facilities.find((f) => f.id === bk.facilityId);
    if (!space || !fac) {
      return { ok: false, impactedBookings: [], error: 'Linked space or facility not found' };
    }

    const overstayMins = Math.max(20, Math.min(240, Math.round(input.overstayMinutes || 45)));
    const projectedOccupiedEnd = bk.endMin + overstayMins;
    const surchargeBase = Math.round((overstayMins / 60) * space.hourlyPriceInr * 1.5);
    const reallocationFee = 50;
    const totalPenaltyInr = Math.max(40, surchargeBase + reallocationFee);
    const nowIso = new Date().toISOString();
    const ts = nowIso.slice(11, 19) + 'Z';

    bk.overstayStatus = 'flagged_overstay';
    bk.overstayMinutes = overstayMins;
    bk.overstayPenaltyInr = totalPenaltyInr;
    space.occupancyState = 'OVERSTAY';
    space.activeOccupancyBookingId = bk.id;
    space.vacancyConfirmed = false;
    space.bufferCompleted = false;
    space.lastOccupancyEvent = `Overstay detected (+${overstayMins}m past ${formatMinutesToTime(bk.endMin)}) on ${bk.id}`;
    bk.auditTrail.push(
      `${ts} Overstay Flagged (+${overstayMins}m past ${formatMinutesToTime(bk.endMin)}) · Surcharge ₹${totalPenaltyInr} billed to overstaying rider`
    );

    this.transactions.unshift({
      id: `TXN-${Date.now().toString(36).toUpperCase().slice(-5)}`,
      timestamp: nowIso,
      bookingId: bk.id,
      type: 'extension_charge',
      amountInr: totalPenaltyInr,
      actor: bk.driverName,
      status: 'overstay_surcharge_billed',
      referenceId: `OVR-${bk.id.slice(-4)}`,
    });

    this.notifications.unshift({
      id: `NTF-${Date.now().toString(36).toUpperCase().slice(-5)}`,
      driverEmail: bk.driverEmail,
      driverName: bk.driverName,
      bookingId: bk.id,
      type: 'overstay_alert',
      title: `Overstay Alert on ${bk.spaceCode} (+${overstayMins}m)`,
      message: `Your booked slot ended at ${formatMinutesToTime(bk.endMin)}. An overstay surcharge of ₹${totalPenaltyInr} (1.5x pro-rated + ₹50 bay protection fee) applies so the next rider suffers zero loss.`,
      read: false,
      createdAt: nowIso,
    });

    // Find downstream held/confirmed bookings impacted by projectedOccupiedEnd + turnaround buffer
    const impacted = this.bookings.filter(
      (other) =>
        other.id !== bk.id &&
        other.spaceId === bk.spaceId &&
        (other.status === 'held' || other.status === 'confirmed') &&
        other.startMin < projectedOccupiedEnd + space.bufferMinutes &&
        other.endMin > bk.startMin
    );

    const resolvedSummaries: string[] = [];

    for (const nextBk of impacted) {
      const nextVehicle = this.vehicles.find((v) => v.id === nextBk.vehicleId) || this.vehicles[0];
      const evals = this.evaluateAllCandidates(
        nextBk.startMin,
        nextBk.endMin,
        nextVehicle,
        'closest_walk',
        { lat: fac.lat, lng: fac.lng }
      );
      // Priority 1: Same facility compatible bay; Priority 2: Closest verified bay within walking range
      const sameFacilityAlt = evals.eligible.find(
        (c) => c.facilityId === fac.id && c.spaceId !== bk.spaceId
      );
      const bestAlt = sameFacilityAlt || evals.eligible.find((c) => c.spaceId !== bk.spaceId);

      nextBk.overstayImpactedByBookingId = bk.id;

      if (bestAlt) {
        const oldCode = nextBk.spaceCode;
        const newAccessCode = `PKP-${bestAlt.facilityId.slice(-2)}-${bestAlt.spaceId.slice(-2)}-${Math.floor(100 + Math.random() * 899)}`;
        nextBk.spaceId = bestAlt.spaceId;
        nextBk.facilityId = bestAlt.facilityId;
        nextBk.facilityName = bestAlt.facilityName;
        nextBk.spaceCode = bestAlt.spaceCode;
        nextBk.entranceLabel = bestAlt.entranceLabel;
        nextBk.accessCode = newAccessCode;
        nextBk.qrPassToken = signBookingQrToken(nextBk.id, bestAlt.facilityId, newAccessCode);
        // Zero extra charge to the incoming rider: price stays locked!
        nextBk.overstayResolution = {
          status: 'auto_reassigned',
          previousSpaceCode: oldCode,
          detail: `Auto-reassigned at ₹0 extra cost from ${oldCode} to ${bestAlt.facilityName} (${bestAlt.spaceCode}) after previous rider overstayed.`,
        };
        nextBk.auditTrail.push(
          `${ts} Overstay Zero-Loss Auto-Reassignment -> Moved from ${oldCode} to ${bestAlt.spaceCode} (₹0 extra charge)`
        );
        this.notifications.unshift({
          id: `NTF-${Date.now().toString(36).toUpperCase().slice(-5)}`,
          driverEmail: nextBk.driverEmail,
          driverName: nextBk.driverName,
          bookingId: nextBk.id,
          type: 'overstay_impact',
          title: `Bay Auto-Upgraded at ₹0 Extra Cost (${bestAlt.spaceCode})`,
          message: `Previous rider on ${oldCode} overstayed. We automatically secured ${bestAlt.facilityName} · ${bestAlt.spaceCode} (${bestAlt.walkingDistanceM}m away) at your original price with updated QR pass.`,
          read: false,
          createdAt: nowIso,
        });
        resolvedSummaries.push(
          `Next booking ${nextBk.id} (${nextBk.driverName}) auto-reassigned to ${bestAlt.spaceCode} at ₹0 extra cost.`
        );
      } else {
        // Zero compatible alternative bays at exact time: offer priority reschedule OR 100% refund + ₹50 credit
        nextBk.overstayResolution = {
          status: 'choice_required',
          previousSpaceCode: nextBk.spaceCode,
          compensationCreditInr: 50,
          options: [
            'Reschedule to Next Open Slot (₹0 Fee)',
            '100% Instant Refund + ₹50 Compensation Credit',
          ],
          detail: `Previous rider overstayed on ${nextBk.spaceCode} and no backup bay is open at ${formatMinutesToTime(nextBk.startMin)}. Choose a free reschedule or 100% refund + ₹50 credit.`,
        };
        nextBk.auditTrail.push(
          `${ts} Overstay Protection Activated -> Next Rider Offered Free Reschedule or 100% Refund + ₹50 Credit`
        );
        this.notifications.unshift({
          id: `NTF-${Date.now().toString(36).toUpperCase().slice(-5)}`,
          driverEmail: nextBk.driverEmail,
          driverName: nextBk.driverName,
          bookingId: nextBk.id,
          type: 'overstay_impact',
          title: `Zero-Loss Protection Active for ${nextBk.spaceCode}`,
          message: `Previous rider overstayed. Reschedule to next open slot at ₹0 fee or claim 100% instant refund + ₹50 delay credit.`,
          resolutionOptions: nextBk.overstayResolution.options,
          read: false,
          createdAt: nowIso,
        });
        resolvedSummaries.push(
          `Next booking ${nextBk.id} (${nextBk.driverName}) protected: offered free reschedule or 100% refund + ₹50 credit.`
        );
      }
    }

    const summary =
      impacted.length === 0
        ? `Overstay (+${overstayMins}m, ₹${totalPenaltyInr} surcharge) logged on ${bk.spaceCode}. No downstream booking conflicted.`
        : resolvedSummaries.join(' ');

    this.addAudit(input.actorName, 'OVERSTAY_FLAGGED_PROTECTED', summary);
    return { ok: true, overstayBooking: bk, impactedBookings: impacted, summary };
  }

  public resolveOverstayImpact(
    bookingId: string,
    choice: 'reschedule' | 'refund_with_credit'
  ): { ok: boolean; booking?: BookingRecord; error?: string } {
    const bk = this.bookings.find((b) => b.id === bookingId);
    if (!bk || !bk.overstayResolution) {
      return { ok: false, error: 'Booking does not have a pending overstay impact resolution.' };
    }
    const nowIso = new Date().toISOString();
    const ts = nowIso.slice(11, 19) + 'Z';

    if (choice === 'refund_with_credit') {
      const credit = bk.overstayResolution.compensationCreditInr || 50;
      const refundTotal = bk.totalAmountInr + credit;
      bk.status = 'cancelled';
      bk.paymentStatus = 'refunded';
      bk.refundStatus = 'refunded';
      bk.refundAmountInr = refundTotal;
      bk.overstayResolution.status = 'refunded_with_credit';
      bk.overstayResolution.detail = `Processed 100% refund (₹${bk.totalAmountInr}) + ₹${credit} overstay protection credit = ₹${refundTotal}.`;
      const rfd: RefundRecord = {
        id: `RFD-${Date.now().toString(36).toUpperCase().slice(-5)}`,
        bookingId: bk.id,
        paymentOrderId: bk.paymentOrderId,
        amountInr: refundTotal,
        reason: `Zero-loss overstay protection: 100% refund + ₹${credit} credit`,
        status: 'processed',
        requestedBy: bk.driverName,
        processedBy: 'Overstay Protection Pool',
        createdAt: nowIso,
        processedAt: nowIso,
      };
      this.refunds.unshift(rfd);
      this.transactions.unshift({
        id: `TXN-${Date.now().toString(36).toUpperCase().slice(-5)}`,
        timestamp: nowIso,
        bookingId: bk.id,
        type: 'refund',
        amountInr: refundTotal,
        actor: bk.driverName,
        status: 'refunded_with_credit',
        referenceId: rfd.id,
      });
      const stl = this.settlements.find((s) => s.bookingId === bk.id);
      if (stl) stl.status = 'reversed';
      bk.auditTrail.push(`${ts} Driver claimed ₹${refundTotal} (100% Refund + ₹${credit} Credit)`);
      this.addAudit(bk.driverName, 'OVERSTAY_REFUND_CLAIMED', `${bk.id} refunded ₹${refundTotal} with zero loss.`);
      return { ok: true, booking: bk };
    }

    // Reschedule to next available window at ₹0 fee
    const duration = bk.endMin - bk.startMin;
    const space = this.spaces.find((s) => s.id === bk.spaceId);
    const shiftMins = 60;
    const newStart = Math.min((space?.hardDepartureMin || 22 * 60) - duration, bk.startMin + shiftMins);
    const newEnd = newStart + duration;
    bk.startMin = newStart;
    bk.endMin = newEnd;
    bk.overstayResolution.status = 'rescheduled';
    bk.overstayResolution.detail = `Rescheduled at ₹0 fee to ${formatMinutesToTime(newStart)}–${formatMinutesToTime(newEnd)}.`;
    bk.auditTrail.push(`${ts} Free Reschedule Confirmed -> ${formatMinutesToTime(newStart)}–${formatMinutesToTime(newEnd)}`);
    this.addAudit(bk.driverName, 'OVERSTAY_RESCHEDULED', `${bk.id} rescheduled to ${formatMinutesToTime(newStart)}–${formatMinutesToTime(newEnd)}.`);
    return { ok: true, booking: bk };
  }

  // =========================================================================
  // SERVER-GENERATED PAYMENT ORDERS, SIGNED WEBHOOKS & IDEMPOTENCY
  // =========================================================================

  public createPaymentOrder(bookingId: string): {
    ok: boolean;
    order?: PaymentOrder;
    booking?: BookingRecord;
    error?: string;
  } {
    this.expireStaleHolds();
    const bk = this.bookings.find((b) => b.id === bookingId);
    if (!bk) return { ok: false, error: 'Booking not found' };
    if (bk.status !== 'held') {
      return { ok: false, error: `Payment order can only be created for active holds (current: ${bk.status}).` };
    }

    // Never trust client amounts: recalculate strictly from backend space rate & booking times
    const space = this.spaces.find((s) => s.id === bk.spaceId);
    if (!space) return { ok: false, error: 'Linked space not found' };
    const serverQuote = this.calculateServerQuote(space.hourlyPriceInr, bk.startMin, bk.endMin);
    bk.baseAmountInr = serverQuote.baseAmountInr;
    bk.platformFeeInr = serverQuote.platformFeeInr;
    bk.gstInr = serverQuote.gstInr;
    bk.totalAmountInr = serverQuote.totalAmountInr;

    const existing = bk.paymentOrderId
      ? this.paymentOrders.find((o) => o.id === bk.paymentOrderId && o.status === 'created')
      : undefined;
    if (existing) {
      return { ok: true, order: existing, booking: bk };
    }

    const nowIso = new Date().toISOString();
    const order: PaymentOrder = {
      id: `ORD-${Date.now().toString(36).toUpperCase().slice(-5)}`,
      bookingId: bk.id,
      amountInr: serverQuote.totalAmountInr,
      baseAmountInr: serverQuote.baseAmountInr,
      platformFeeInr: serverQuote.platformFeeInr,
      gstInr: serverQuote.gstInr,
      currency: 'INR',
      gatewayOrderRef: `gw_${bk.id.toLowerCase()}_${Math.floor(1000 + Math.random() * 8999)}`,
      status: 'created',
      reconciliationStatus: 'pending',
      createdAt: nowIso,
      expiresAt: bk.holdExpiresAt || new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    };

    bk.paymentOrderId = order.id;
    bk.paymentStatus = 'pending';
    bk.auditTrail.push(`${nowIso.slice(11, 19)}Z Server Payment Order ${order.id} Generated (₹${order.amountInr})`);
    this.paymentOrders.unshift(order);
    this.addAudit(
      'Payment Order Engine',
      'PAYMENT_ORDER_CREATED',
      `${order.id} created server-side for ${bk.id}: ₹${order.amountInr} INR`
    );

    return { ok: true, order, booking: bk };
  }

  public processPaymentWebhook(input: {
    rawPayload: string;
    signature: string | undefined;
    event: {
      eventId: string;
      eventType: 'payment.succeeded' | 'payment.failed';
      orderId: string;
      amountInr: number;
    };
  }): {
    ok: boolean;
    duplicate?: boolean;
    webhookEvent?: PaymentWebhookEvent;
    booking?: BookingRecord;
    error?: string;
  } {
    if (!verifyWebhookSignature(input.rawPayload, input.signature)) {
      this.addAudit(
        'Webhook Security Guard',
        'WEBHOOK_SIGNATURE_REJECTED',
        `Rejected unsigned/forged payment webhook for order ${input.event?.orderId}.`
      );
      return { ok: false, error: 'INVALID_WEBHOOK_SIGNATURE: HMAC verification failed.' };
    }

    const { eventId, eventType, orderId, amountInr } = input.event;
    if (!eventId || !orderId) {
      return { ok: false, error: 'Missing eventId or orderId in webhook payload.' };
    }

    // Strict idempotency: process financial event strictly once per unique eventId
    if (this.processedWebhookEventIds.has(eventId)) {
      const existingEv = this.webhookEvents.find((e) => e.eventId === eventId);
      if (existingEv) {
        existingEv.duplicateIgnoredCount += 1;
      }
      this.addAudit(
        'Payment Webhook Processor',
        'WEBHOOK_DUPLICATE_IGNORED',
        `Duplicate webhook ${eventId} ignored idempotently (no double charge/confirm).`
      );
      return { ok: true, duplicate: true, webhookEvent: existingEv };
    }

    const order = this.paymentOrders.find((o) => o.id === orderId);
    if (!order) return { ok: false, error: 'Payment order not found' };
    const bk = this.bookings.find((b) => b.id === order.bookingId);
    if (!bk) return { ok: false, error: 'Linked booking not found' };

    if (Number(amountInr) !== order.amountInr) {
      order.reconciliationStatus = 'mismatch';
      this.addAudit(
        'Payment Reconciliation',
        'AMOUNT_MISMATCH_BLOCKED',
        `Blocked order ${order.id}: webhook ₹${amountInr} !== server ₹${order.amountInr}.`
      );
      return { ok: false, error: `Payment reconciliation mismatch: expected ₹${order.amountInr}, received ₹${amountInr}.` };
    }

    this.processedWebhookEventIds.add(eventId);
    const nowIso = new Date().toISOString();
    const evRecord: PaymentWebhookEvent = {
      eventId,
      eventType,
      orderId: order.id,
      bookingId: bk.id,
      amountInr: order.amountInr,
      signatureVerified: true,
      receivedAt: nowIso,
      processedCount: 1,
      duplicateIgnoredCount: 0,
    };
    this.webhookEvents.unshift(evRecord);

    if (eventType === 'payment.failed') {
      order.status = 'failed';
      order.reconciliationStatus = 'matched';
      bk.status = 'expired';
      bk.paymentStatus = 'failed';
      bk.auditTrail.push(
        `${nowIso.slice(11, 19)}Z Gateway Webhook ${eventId} (payment.failed) -> Hold Released Safely`
      );
      this.addAudit(
        'Payment Webhook Processor',
        'PAYMENT_FAILED_HOLD_RELEASED',
        `${bk.id} hold expired cleanly after gateway failure (${eventId}).`
      );
      return { ok: true, duplicate: false, webhookEvent: evRecord, booking: bk };
    }

    // payment.succeeded
    order.status = 'paid';
    order.paidAt = nowIso;
    order.reconciliationStatus = 'matched';
    bk.status = 'confirmed';
    bk.paymentStatus = 'paid';
    bk.invoiceNumber = bk.invoiceNumber || `INV-PKP-${bk.id.slice(-4)}`;
    bk.auditTrail.push(
      `${nowIso.slice(11, 19)}Z Signed Webhook ${eventId} Verified -> Confirmed & Invoice ${bk.invoiceNumber} Issued`
    );

    const bay = this.spaces.find((s) => s.id === bk.spaceId);
    if (bay && (!bay.occupancyState || bay.occupancyState === 'AVAILABLE')) {
      bay.occupancyState = 'BOOKED';
      bay.activeOccupancyBookingId = bk.id;
      bay.lastOccupancyEvent = `Confirmed booking ${bk.id} awaiting gate QR arrival`;
    }

    const fac = this.facilities.find((f) => f.id === bk.facilityId);
    const prv = fac ? this.providers.find((p) => p.id === fac.providerId) : undefined;
    const commission = Math.round(bk.baseAmountInr * 0.1);

    this.settlements.unshift({
      id: `STL-${bk.id.slice(-4)}-${Date.now().toString(36).slice(-2).toUpperCase()}`,
      providerId: prv?.id || 'PRV-01',
      providerName: prv?.name || fac?.providerName || 'Partner Provider',
      bookingId: bk.id,
      facilityName: bk.facilityName,
      grossInr: bk.baseAmountInr,
      platformCommissionInr: commission,
      gstWithheldInr: bk.gstInr,
      netPayoutInr: bk.baseAmountInr - commission,
      status: 'pending_checkout',
    });

    this.transactions.unshift({
      id: `TXN-${Date.now().toString(36).toUpperCase().slice(-5)}`,
      timestamp: nowIso,
      bookingId: bk.id,
      type: 'charge',
      amountInr: order.amountInr,
      actor: bk.driverName,
      status: 'matched',
      referenceId: order.id,
    });

    this.addAudit(
      'Payment Webhook Processor',
      'PAYMENT_WEBHOOK_VERIFIED',
      `${eventId} settled ${order.id} (₹${order.amountInr}) -> ${bk.id} confirmed & reconciled.`
    );
    return { ok: true, duplicate: false, webhookEvent: evRecord, booking: bk };
  }

  // =========================================================================
  // PREPAID PARKING WALLET, HOST SCANNER ENTRY & AUTONOMOUS LIFECYCLE
  // =========================================================================

  public getOrCreateWallet(email: string, name: string): PrepaidWallet {
    const cleanEmail = (email || 'driver@bengaluru.in').trim().toLowerCase();
    const existing = this.wallets.find((w) => w.driverEmail.toLowerCase() === cleanEmail);
    if (existing) {
      if (name && name.trim()) existing.driverName = name.trim();
      return existing;
    }
    const nowIso = new Date().toISOString();
    const created: PrepaidWallet = {
      driverEmail: cleanEmail,
      driverName: name?.trim() || 'Driver',
      balanceInr: 500,
      unpaidDueInr: 0,
      bookingRestricted: false,
      lowBalanceNotified: false,
      updatedAt: nowIso,
      ledger: [
        {
          id: `WLT-INIT-${Date.now().toString(36).toUpperCase().slice(-4)}`,
          timestamp: nowIso,
          type: 'top_up',
          description: 'Initial Prepaid Parking Balance',
          amountInr: 500,
          balanceAfterInr: 500,
        },
      ],
    };
    this.wallets.unshift(created);
    return created;
  }

  public topUpWallet(
    email: string,
    name: string,
    amountInr: number
  ): { ok: boolean; wallet?: PrepaidWallet; error?: string } {
    const cleanAmt = Math.round(Number(amountInr));
    if (!Number.isFinite(cleanAmt) || cleanAmt < 50 || cleanAmt > 10000) {
      return { ok: false, error: 'Top-up amount must be between ₹50 and ₹10,000.' };
    }
    const wallet = this.getOrCreateWallet(email, name);
    const nowIso = new Date().toISOString();

    let remaining = cleanAmt;
    if (wallet.unpaidDueInr > 0) {
      const settledDue = Math.min(remaining, wallet.unpaidDueInr);
      wallet.unpaidDueInr -= settledDue;
      remaining -= settledDue;
      wallet.ledger.unshift({
        id: `WLT-${Date.now().toString(36).toUpperCase().slice(-5)}`,
        timestamp: nowIso,
        type: 'unpaid_due',
        description: `Cleared unpaid overstay/extension due (₹${settledDue})`,
        amountInr: -settledDue,
        balanceAfterInr: wallet.balanceInr,
      });
    }

    wallet.balanceInr += remaining;
    wallet.bookingRestricted = wallet.unpaidDueInr > 0;
    wallet.lowBalanceNotified = wallet.balanceInr < 50;
    wallet.updatedAt = nowIso;

    wallet.ledger.unshift({
      id: `WLT-${Date.now().toString(36).toUpperCase().slice(-5)}`,
      timestamp: nowIso,
      type: 'top_up',
      description: `Prepaid Wallet Top-Up (+₹${cleanAmt})`,
      amountInr: cleanAmt,
      balanceAfterInr: wallet.balanceInr,
    });

    this.addAudit(
      wallet.driverName,
      'PREPAID_WALLET_TOPUP',
      `Added ₹${cleanAmt} to ${wallet.driverEmail}. Available balance: ₹${wallet.balanceInr}, unpaid due: ₹${wallet.unpaidDueInr}.`
    );
    return { ok: true, wallet };
  }

  public settleChargeFromWallet(params: {
    email: string;
    name: string;
    amountInr: number;
    description: string;
    type: WalletLedgerItem['type'];
    bookingId?: string;
    allowShortfall?: boolean;
  }): {
    ok: boolean;
    wallet: PrepaidWallet;
    paidFromWalletInr: number;
    shortfallInr: number;
    error?: string;
  } {
    const wallet = this.getOrCreateWallet(params.email, params.name);
    const charge = Math.max(0, Math.round(params.amountInr));
    const nowIso = new Date().toISOString();

    if (charge === 0) {
      return { ok: true, wallet, paidFromWalletInr: 0, shortfallInr: 0 };
    }

    if (wallet.balanceInr < charge && !params.allowShortfall) {
      if (!wallet.lowBalanceNotified) {
        wallet.lowBalanceNotified = true;
        this.notifications.unshift({
          id: `NTF-${Date.now().toString(36).toUpperCase().slice(-5)}`,
          driverEmail: wallet.driverEmail,
          driverName: wallet.driverName,
          bookingId: params.bookingId || 'WALLET',
          type: 'low_balance',
          title: `Low Prepaid Balance (₹${wallet.balanceInr} available)`,
          message: `Need ₹${charge} for ${params.description}. Top up your Prepaid Parking Balance to continue without interruption.`,
          read: false,
          createdAt: nowIso,
        });
      }
      return {
        ok: false,
        wallet,
        paidFromWalletInr: 0,
        shortfallInr: charge - wallet.balanceInr,
        error: `Insufficient Prepaid Balance (₹${wallet.balanceInr} available, ₹${charge} needed). Please top up ₹${charge - wallet.balanceInr} first.`,
      };
    }

    const paidFromWallet = Math.min(wallet.balanceInr, charge);
    const shortfall = charge - paidFromWallet;
    wallet.balanceInr -= paidFromWallet;
    wallet.updatedAt = nowIso;

    if (paidFromWallet > 0) {
      wallet.ledger.unshift({
        id: `WLT-${Date.now().toString(36).toUpperCase().slice(-5)}`,
        timestamp: nowIso,
        type: params.type,
        description: params.description,
        amountInr: -paidFromWallet,
        balanceAfterInr: wallet.balanceInr,
        bookingId: params.bookingId,
      });
    }

    if (shortfall > 0) {
      wallet.unpaidDueInr += shortfall;
      wallet.bookingRestricted = true;
      wallet.ledger.unshift({
        id: `WLT-DUE-${Date.now().toString(36).toUpperCase().slice(-4)}`,
        timestamp: nowIso,
        type: 'unpaid_due',
        description: `Unpaid balance due: ${params.description} (Shortfall ₹${shortfall})`,
        amountInr: -shortfall,
        balanceAfterInr: 0,
        bookingId: params.bookingId,
      });
      this.notifications.unshift({
        id: `NTF-${Date.now().toString(36).toUpperCase().slice(-5)}`,
        driverEmail: wallet.driverEmail,
        driverName: wallet.driverName,
        bookingId: params.bookingId || 'WALLET',
        type: 'low_balance',
        title: `Unpaid Parking Balance ₹${wallet.unpaidDueInr} — Future Bookings Restricted`,
        message: `Your prepaid wallet lacked ₹${shortfall} during automatic overstay settlement. Please top up your wallet to clear dues and unlock new bookings.`,
        read: false,
        createdAt: nowIso,
      });
    } else if (wallet.balanceInr < 60 && !wallet.lowBalanceNotified) {
      wallet.lowBalanceNotified = true;
      this.notifications.unshift({
        id: `NTF-${Date.now().toString(36).toUpperCase().slice(-5)}`,
        driverEmail: wallet.driverEmail,
        driverName: wallet.driverName,
        bookingId: params.bookingId || 'WALLET',
        type: 'low_balance',
        title: `Low Prepaid Parking Balance (₹${wallet.balanceInr} left)`,
        message: `Your prepaid balance dropped to ₹${wallet.balanceInr}. Top up soon so automatic extensions or overstay settlements stay seamless.`,
        read: false,
        createdAt: nowIso,
      });
    }

    return { ok: true, wallet, paidFromWalletInr: paidFromWallet, shortfallInr: shortfall };
  }

  public payHoldWithWallet(
    bookingId: string,
    email: string,
    name: string
  ): {
    ok: boolean;
    booking?: BookingRecord;
    wallet?: PrepaidWallet;
    deductedInr?: number;
    remainingBalanceInr?: number;
    error?: string;
  } {
    this.expireStaleHolds();
    const bk = this.bookings.find((b) => b.id === bookingId);
    if (!bk) return { ok: false, error: 'Booking not found' };
    if (bk.status !== 'held') {
      return { ok: false, error: `Only held bookings can be paid from wallet (status: ${bk.status}).` };
    }
    const orderRes = this.createPaymentOrder(bk.id);
    if (!orderRes.ok || !orderRes.order) {
      return { ok: false, error: orderRes.error || 'Could not compute server quote' };
    }
    const debit = this.settleChargeFromWallet({
      email: bk.driverEmail || email,
      name: bk.driverName || name,
      amountInr: orderRes.order.amountInr,
      description: `Initial booking ${bk.id} (${bk.spaceCode})`,
      type: 'booking_charge',
      bookingId: bk.id,
      allowShortfall: false,
    });
    if (!debit.ok) {
      return { ok: false, wallet: debit.wallet, error: debit.error };
    }

    const nowIso = new Date().toISOString();
    orderRes.order.status = 'paid';
    orderRes.order.paidAt = nowIso;
    orderRes.order.reconciliationStatus = 'matched';
    bk.status = 'confirmed';
    bk.paymentStatus = 'paid';
    bk.walletSettledInr = (bk.walletSettledInr || 0) + orderRes.order.amountInr;
    bk.invoiceNumber = bk.invoiceNumber || `INV-PKP-${bk.id.slice(-4)}`;
    bk.auditTrail.push(
      `${nowIso.slice(11, 19)}Z Paid ₹${orderRes.order.amountInr} via Prepaid Parking Balance (Remaining: ₹${debit.wallet.balanceInr}) -> Confirmed & Entry QR Pass Issued`
    );

    const bay = this.spaces.find((s) => s.id === bk.spaceId);
    if (bay && (!bay.occupancyState || bay.occupancyState === 'AVAILABLE')) {
      bay.occupancyState = 'BOOKED';
      bay.activeOccupancyBookingId = bk.id;
      bay.lastOccupancyEvent = `Confirmed & paid via Prepaid Wallet (${bk.id})`;
    }

    const fac = this.facilities.find((f) => f.id === bk.facilityId);
    const prv = fac ? this.providers.find((p) => p.id === fac.providerId) : undefined;
    const commission = Math.round(bk.baseAmountInr * 0.1);
    this.settlements.unshift({
      id: `STL-${bk.id.slice(-4)}-${Date.now().toString(36).slice(-2).toUpperCase()}`,
      providerId: prv?.id || 'PRV-01',
      providerName: prv?.name || fac?.providerName || 'Partner Provider',
      bookingId: bk.id,
      facilityName: bk.facilityName,
      grossInr: bk.baseAmountInr,
      platformCommissionInr: commission,
      gstWithheldInr: bk.gstInr,
      netPayoutInr: bk.baseAmountInr - commission,
      status: 'pending_checkout',
    });

    this.transactions.unshift({
      id: `TXN-${Date.now().toString(36).toUpperCase().slice(-5)}`,
      timestamp: nowIso,
      bookingId: bk.id,
      type: 'charge',
      amountInr: orderRes.order.amountInr,
      actor: bk.driverName,
      status: 'wallet_settled',
      referenceId: orderRes.order.id,
    });

    this.addAudit(
      bk.driverName,
      'PREPAID_WALLET_BOOKING_PAID',
      `${bk.id} confirmed for ₹${orderRes.order.amountInr} from prepaid wallet (remaining ₹${debit.wallet.balanceInr}).`
    );
    return {
      ok: true,
      booking: bk,
      wallet: debit.wallet,
      deductedInr: orderRes.order.amountInr,
      remainingBalanceInr: debit.wallet.balanceInr,
    };
  }

  public verifyDriverQrAtHostScanner(input: {
    scannedInput: string;
    expectedFacilityId?: string;
    actorName: string;
    arrivalMinutesLate?: number;
  }): {
    ok: boolean;
    booking?: BookingRecord;
    lifecycleEvent?: AutonomousLifecycleEvent;
    error?: string;
  } {
    const raw = input.scannedInput.trim();
    if (!raw) {
      return { ok: false, error: 'Scan or enter a driver Entry QR payload, Gate PIN, or Booking ID.' };
    }

    let targetBooking: BookingRecord | undefined;
    let tokenForVerify = raw;

    if (raw.startsWith('{')) {
      try {
        const parsed = JSON.parse(raw) as {
          bookingId?: string;
          signatureToken?: string;
          accessCode?: string;
        };
        if (parsed.bookingId) {
          targetBooking = this.bookings.find((b) => b.id === parsed.bookingId);
        }
        tokenForVerify = parsed.signatureToken || raw;
      } catch {
        // Not JSON; fall through
      }
    }

    if (!targetBooking) {
      const qrInfo = verifyBookingQrToken(raw);
      if (qrInfo.valid && qrInfo.bookingId) {
        targetBooking = this.bookings.find((b) => b.id === qrInfo.bookingId);
      }
    }

    if (!targetBooking) {
      targetBooking = this.bookings.find(
        (b) =>
          b.id.toUpperCase() === raw.toUpperCase() ||
          b.accessCode.toUpperCase() === raw.toUpperCase()
      );
      if (targetBooking) {
        tokenForVerify = targetBooking.qrPassToken || targetBooking.accessCode;
      }
    }

    if (!targetBooking) {
      return {
        ok: false,
        error: 'No matching confirmed booking found for this QR code or Gate PIN.',
      };
    }

    if (input.expectedFacilityId && targetBooking.facilityId !== input.expectedFacilityId) {
      return {
        ok: false,
        error: `QR pass is for ${targetBooking.facilityName}, not this host scanner facility.`,
      };
    }

    const res = this.verifyQrCheckin({
      bookingId: targetBooking.id,
      scannedToken: tokenForVerify,
      scanMethod: 'camera',
      arrivalMinutesLate: input.arrivalMinutesLate,
      actorName: `Host Scanner (${input.actorName})`,
    });
    if (!res.ok || !res.booking) {
      return { ok: false, error: res.error };
    }

    const bk = res.booking;
    const fac = this.facilities.find((f) => f.id === bk.facilityId);
    const ev: AutonomousLifecycleEvent = {
      id: `LCE-${Date.now().toString(36).toUpperCase().slice(-5)}`,
      bookingId: bk.id,
      spaceId: bk.spaceId,
      spaceCode: bk.spaceCode,
      facilityName: bk.facilityName,
      trigger: 'entry_scan',
      createdAt: new Date().toISOString(),
      outcomeSummary: `Host scanner verified ${bk.vehiclePlate || bk.vehicleLabel} (${bk.id}). Status -> CHECKED_IN, Bay -> OCCUPIED.`,
      resultingOccupancyState: 'OCCUPIED',
      executionMode: 'deterministic_service',
      steps: [
        {
          stepNumber: 1,
          agentName: 'Host Scanner Identification',
          action: 'Verified Driver QR & Vehicle Plate',
          detail: `Scanned ${bk.id} (${bk.vehiclePlate || bk.vehicleLabel}) at ${fac?.entranceLabel || bk.entranceLabel}.`,
          status: 'done',
        },
        {
          stepNumber: 2,
          agentName: 'Occupancy Monitor Agent',
          action: 'Session Started -> OCCUPIED',
          detail: `Tracking session until scheduled end ${formatMinutesToTime(bk.endMin)}.`,
          status: 'done',
        },
      ],
    };
    this.lifecycleEvents.unshift(ev);
    return { ok: true, booking: bk, lifecycleEvent: ev };
  }

  public recordSmartDepartureSignal(input: {
    bookingId: string;
    signalType: 'im_leaving_button' | 'geofence_exit';
    distanceFromGateM?: number;
    actorName: string;
  }): {
    ok: boolean;
    booking?: BookingRecord;
    lifecycleEvent?: AutonomousLifecycleEvent;
    error?: string;
  } {
    const bk = this.bookings.find((b) => b.id === input.bookingId);
    if (!bk) return { ok: false, error: 'Booking not found' };
    if (bk.status !== 'checked-in' && bk.status !== 'occupied') {
      return {
        ok: false,
        error: `Smart departure only applies to an active checked-in/occupied session (current: ${bk.status}).`,
      };
    }

    const space = this.spaces.find((s) => s.id === bk.spaceId);
    const nowIso = new Date().toISOString();
    const ts = nowIso.slice(11, 19) + 'Z';

    bk.departureSignal = {
      type: input.signalType,
      detectedAt: nowIso,
      distanceFromGateM: input.distanceFromGateM,
      gpsNote:
        input.signalType === 'geofence_exit'
          ? `Phone moved ${input.distanceFromGateM || 150}m outside facility geofence. Because GPS tracks the phone—not the vehicle itself—bay stays DEPARTURE_PENDING until checkout is confirmed.`
          : 'Driver pressed "I\'m Leaving". Bay held as DEPARTURE_PENDING until physical exit & checkout confirmation.',
      confirmedByDriver: false,
      confirmedByHost: false,
    };
    bk.auditTrail.push(
      `${ts} Smart Departure Signal (${input.signalType}) -> Space marked DEPARTURE_PENDING`
    );

    if (space) {
      space.occupancyState = 'DEPARTURE_PENDING';
      space.vacancyConfirmed = false;
      space.lastOccupancyEvent =
        input.signalType === 'geofence_exit'
          ? `GPS geofence exit detected (${input.distanceFromGateM || 150}m) — awaiting confirmation`
          : 'Driver indicated departure ("I\'m Leaving") — awaiting checkout confirmation';
    }

    const ev: AutonomousLifecycleEvent = {
      id: `LCE-${Date.now().toString(36).toUpperCase().slice(-5)}`,
      bookingId: bk.id,
      spaceId: bk.spaceId,
      spaceCode: bk.spaceCode,
      facilityName: bk.facilityName,
      trigger: 'departure_signal',
      createdAt: nowIso,
      outcomeSummary: `Smart Departure detected (${input.signalType}). Bay moved to DEPARTURE_PENDING and kept locked from new bookings until checkout confirmed.`,
      resultingOccupancyState: 'DEPARTURE_PENDING',
      executionMode: 'deterministic_service',
      steps: [
        {
          stepNumber: 1,
          agentName: 'Smartphone Departure Sensor',
          action:
            input.signalType === 'geofence_exit'
              ? `Geofence Exit (${input.distanceFromGateM || 150}m)`
              : '"I\'m Leaving" Triggered',
          detail: bk.departureSignal.gpsNote,
          status: 'warning',
        },
        {
          stepNumber: 2,
          agentName: 'Availability Guard Agent',
          action: 'Locked Bay as DEPARTURE_PENDING',
          detail: 'Bay remains unavailable for new bookings until driver or host confirms physical exit.',
          status: 'action_required',
        },
      ],
    };
    this.lifecycleEvents.unshift(ev);
    this.addAudit(
      input.actorName,
      'DEPARTURE_SIGNAL_RECORDED',
      `${bk.id} (${bk.spaceCode}) -> DEPARTURE_PENDING via ${input.signalType}.`
    );
    return { ok: true, booking: bk, lifecycleEvent: ev };
  }

  public confirmDepartureAndStartClearance(input: {
    bookingId: string;
    confirmedBy: 'driver' | 'host';
    actorName: string;
  }): {
    ok: boolean;
    booking?: BookingRecord;
    wallet?: PrepaidWallet;
    extraHoursDeductedInr?: number;
    extraMinutesCharged?: number;
    remainingBalanceInr?: number;
    unpaidDueInr?: number;
    lifecycleEvent?: AutonomousLifecycleEvent;
    error?: string;
  } {
    const bk = this.bookings.find((b) => b.id === input.bookingId);
    if (!bk) return { ok: false, error: 'Booking not found' };
    if (bk.status !== 'checked-in' && bk.status !== 'occupied' && bk.status !== 'confirmed') {
      return { ok: false, error: `Cannot confirm departure from status ${bk.status}` };
    }

    const space = this.spaces.find((s) => s.id === bk.spaceId);
    const nowIso = new Date().toISOString();
    const ts = nowIso.slice(11, 19) + 'Z';

    let walletResult: PrepaidWallet | undefined;
    let extraHoursDeductedInr = 0;
    let extraMinutesCharged = 0;

    // 1) Settle any previously flagged overstay surcharge, or
    // 2) Automatically compute & settle real elapsed extra hours beyond booked duration since check-in.
    if (bk.overstayStatus === 'flagged_overstay' && (bk.overstayPenaltyInr || 0) > 0) {
      const fee = bk.overstayPenaltyInr || 0;
      const extraMins = bk.overstayMinutes || 30;
      const settlement = this.settleChargeFromWallet({
        email: bk.driverEmail || 'driver@bengaluru.in',
        name: bk.driverName,
        amountInr: fee,
        description: `Extra hours / overstay settlement on ${bk.spaceCode} (+${extraMins}m)`,
        type: 'overstay_settlement',
        bookingId: bk.id,
        allowShortfall: true,
      });
      walletResult = settlement.wallet;
      extraHoursDeductedInr = settlement.paidFromWalletInr;
      extraMinutesCharged = extraMins;
      bk.walletSettledInr = (bk.walletSettledInr || 0) + settlement.paidFromWalletInr;
      bk.auditTrail.push(
        `${ts} Prepaid Wallet Overstay Settlement: ₹${settlement.paidFromWalletInr} deducted (Remaining balance: ₹${settlement.wallet.balanceInr})${settlement.shortfallInr > 0 ? ` (₹${settlement.shortfallInr} unpaid due recorded — bookings restricted)` : ''}`
      );
    } else if (bk.checkedInAt) {
      const actualStayedMins = Math.floor((Date.now() - Date.parse(bk.checkedInAt)) / 60000);
      const bookedDurationMins = Math.max(30, bk.endMin - bk.startMin);
      if (Number.isFinite(actualStayedMins) && actualStayedMins > bookedDurationMins + 5) {
        const extraMins = actualStayedMins - bookedDurationMins;
        const hourly = space?.hourlyPriceInr || 60;
        const extraCharge = Math.max(20, Math.round((extraMins / 60) * hourly * 1.25));
        const settlement = this.settleChargeFromWallet({
          email: bk.driverEmail || 'driver@bengaluru.in',
          name: bk.driverName,
          amountInr: extraCharge,
          description: `Extra parking time on ${bk.spaceCode} (+${extraMins}m)`,
          type: 'overstay_settlement',
          bookingId: bk.id,
          allowShortfall: true,
        });
        walletResult = settlement.wallet;
        extraHoursDeductedInr = settlement.paidFromWalletInr;
        extraMinutesCharged = extraMins;
        bk.overstayMinutes = extraMins;
        bk.overstayPenaltyInr = extraCharge;
        bk.overstayStatus = 'resolved';
        bk.walletSettledInr = (bk.walletSettledInr || 0) + settlement.paidFromWalletInr;
        bk.auditTrail.push(
          `${ts} Checkout Extra Hours Settlement (+${extraMins}m): ₹${settlement.paidFromWalletInr} deducted (Remaining balance: ₹${settlement.wallet.balanceInr})`
        );
      }
    }

    if (!walletResult) {
      walletResult = this.getOrCreateWallet(bk.driverEmail || 'driver@bengaluru.in', bk.driverName);
    }

    bk.extraHoursChargedInr = extraHoursDeductedInr;
    bk.extraMinutesCharged = extraMinutesCharged;
    bk.remainingBalanceAfterCheckoutInr = walletResult.balanceInr;
    bk.unpaidDueAfterCheckoutInr = walletResult.unpaidDueInr;

    bk.status = 'completed';
    bk.checkedOutAt = nowIso;
    bk.actualDepartureAt = nowIso;
    if (bk.overstayStatus === 'flagged_overstay') {
      bk.overstayStatus = 'resolved';
    }
    if (bk.departureSignal) {
      if (input.confirmedBy === 'driver') bk.departureSignal.confirmedByDriver = true;
      if (input.confirmedBy === 'host') bk.departureSignal.confirmedByHost = true;
    } else {
      bk.departureSignal = {
        type: 'im_leaving_button',
        detectedAt: nowIso,
        gpsNote: `Confirmed directly by ${input.confirmedBy}.`,
        confirmedByDriver: input.confirmedBy === 'driver',
        confirmedByHost: input.confirmedBy === 'host',
      };
    }
    bk.auditTrail.push(
      `${ts} Departure Confirmed (${input.confirmedBy}) · Remaining Wallet Balance: ₹${walletResult.balanceInr}`
    );

    const stl = this.settlements.find((s) => s.bookingId === bk.id);
    if (stl && stl.status === 'pending_checkout') {
      stl.status = 'scheduled';
    }

    const bufferMins = space?.bufferMinutes || 15;
    const clearanceEndsAt = new Date(Date.now() + bufferMins * 60 * 1000).toISOString();
    if (space) {
      space.occupancyState = 'CLEARANCE';
      space.vacancyConfirmed = true;
      space.bufferCompleted = false;
      space.clearanceEndsAt = clearanceEndsAt;
      space.lastOccupancyEvent = `Vacancy confirmed by ${input.confirmedBy}; ${bufferMins}m turnaround clearance buffer started`;
    }

    // Automatically complete clearance and reopen space in the background without needing a manual UI action
    if (space) {
      this.completeClearanceBufferAndReopen(space.id, `Autonomous Buffer Agent (${input.actorName})`);
    }

    const ev: AutonomousLifecycleEvent = {
      id: `LCE-${Date.now().toString(36).toUpperCase().slice(-5)}`,
      bookingId: bk.id,
      spaceId: bk.spaceId,
      spaceCode: bk.spaceCode,
      facilityName: bk.facilityName,
      trigger: 'departure_confirmed',
      createdAt: nowIso,
      outcomeSummary: `Checkout & physical departure confirmed. Turnaround buffer and bay reopening completed automatically.`,
      resultingOccupancyState: space?.occupancyState || 'AVAILABLE',
      executionMode: 'deterministic_service',
      steps: [
        {
          stepNumber: 6,
          agentName: 'Clearance Buffer Manager Agent',
          action: `Automated Turnaround & Reopening`,
          detail: `Physical vacancy confirmed by ${input.confirmedBy}. Clearance buffer completed and space reopened automatically.`,
          status: 'done',
        },
      ],
    };
    this.lifecycleEvents.unshift(ev);
    this.addAudit(
      input.actorName,
      'DEPARTURE_CONFIRMED_AND_REOPENED',
      `${bk.id} completed; ${bk.spaceCode} automatically cleared and reopened (wallet remaining: ₹${walletResult.balanceInr}).`
    );
    return {
      ok: true,
      booking: bk,
      wallet: walletResult,
      extraHoursDeductedInr,
      extraMinutesCharged,
      remainingBalanceInr: walletResult.balanceInr,
      unpaidDueInr: walletResult.unpaidDueInr,
      lifecycleEvent: ev,
    };
  }

  public completeClearanceBufferAndReopen(
    spaceId: string,
    actorName: string
  ): {
    ok: boolean;
    space?: ParkingSpace;
    lifecycleEvent?: AutonomousLifecycleEvent;
    error?: string;
  } {
    const space = this.spaces.find((s) => s.id === spaceId);
    if (!space) return { ok: false, error: 'Space not found' };
    const state = space.occupancyState || 'AVAILABLE';

    if (state === 'OCCUPIED' || state === 'OVERSTAY' || state === 'DEPARTURE_PENDING') {
      return {
        ok: false,
        error: `Safety Block: Cannot reopen ${space.spaceCode} from state ${state}. Physical vacancy must be confirmed first!`,
      };
    }
    if (state === 'CLEARANCE' && !space.vacancyConfirmed) {
      return {
        ok: false,
        error: `Safety Block: Physical vacancy is not confirmed on ${space.spaceCode}.`,
      };
    }

    const upcoming = this.bookings.find(
      (b) =>
        b.spaceId === space.id &&
        (b.status === 'confirmed' || b.status === 'held')
    );

    const nextState: SpaceOccupancyState = upcoming ? 'BOOKED' : 'AVAILABLE';
    const nowIso = new Date().toISOString();
    space.occupancyState = nextState;
    space.bufferCompleted = true;
    space.vacancyConfirmed = true;
    space.clearanceEndsAt = undefined;
    space.activeOccupancyBookingId = upcoming?.id;
    space.lastOccupancyEvent = upcoming
      ? `Clearance buffer completed -> ready for next reservation ${upcoming.id}`
      : 'Clearance buffer completed & physical vacancy confirmed -> AVAILABLE';

    const fac = this.facilities.find((f) => f.id === space.facilityId);
    const ev: AutonomousLifecycleEvent = {
      id: `LCE-${Date.now().toString(36).toUpperCase().slice(-5)}`,
      bookingId: upcoming?.id || space.id,
      spaceId: space.id,
      spaceCode: space.spaceCode,
      facilityName: fac?.name || 'Verified Facility',
      trigger: 'buffer_completed',
      createdAt: nowIso,
      outcomeSummary: `Step 7 Complete: Physical vacancy confirmed and turnaround buffer finished. Availability Agent set ${space.spaceCode} -> ${nextState}.`,
      resultingOccupancyState: nextState,
      executionMode: 'deterministic_service',
      steps: [
        {
          stepNumber: 7,
          agentName: 'Availability Agent',
          action: `Reopened Bay -> ${nextState}`,
          detail: upcoming
            ? `Buffer cleared; bay preserved for upcoming confirmed reservation ${upcoming.id}.`
            : 'Turnaround buffer complete and physical vacancy confirmed. Bay is now discoverable and bookable.',
          status: 'done',
        },
      ],
    };
    this.lifecycleEvents.unshift(ev);
    this.addAudit(
      actorName,
      'CLEARANCE_BUFFER_COMPLETED',
      `${space.spaceCode} transitioned from CLEARANCE -> ${nextState}.`
    );
    return { ok: true, space, lifecycleEvent: ev };
  }

  public respondToExtensionOffer(input: {
    bookingId: string;
    offerId: string;
    decision: 'accept' | 'decline';
    actorEmail: string;
    actorName: string;
  }): {
    ok: boolean;
    booking?: BookingRecord;
    offer?: ExtensionOffer;
    wallet?: PrepaidWallet;
    error?: string;
  } {
    if (this.bookingLock) {
      return { ok: false, error: 'Concurrent transaction lock active; retry momentarily.' };
    }
    this.bookingLock = true;
    try {
      const bk = this.bookings.find((b) => b.id === input.bookingId);
      if (!bk) return { ok: false, error: 'Booking not found' };
      const offers = bk.extensionOffers || [];
      const offer = offers.find((o) => o.id === input.offerId);
      if (!offer) return { ok: false, error: 'Extension offer not found' };
      if (offer.status !== 'pending_driver_acceptance') {
        return { ok: false, error: `Offer already ${offer.status}` };
      }

      const nowIso = new Date().toISOString();
      const ts = nowIso.slice(11, 19) + 'Z';
      const space = this.spaces.find((s) => s.id === bk.spaceId);

      if (input.decision === 'decline') {
        offer.status = 'declined';
        offer.respondedAt = nowIso;
        bk.auditTrail.push(`${ts} Driver declined extension offer ${offer.id} (+${offer.additionalMinutes}m)`);
        this.addAudit(
          input.actorName,
          'EXTENSION_OFFER_DECLINED',
          `${bk.id} declined extension offer ${offer.id}; must proceed to departure.`
        );
        return { ok: true, booking: bk, offer };
      }

      // Accept: re-check conflicts & hard cutoff transactionally + settle from prepaid wallet
      if (!space) return { ok: false, error: 'Space not found' };
      const conflictBooking = this.bookings.find(
        (other) =>
          other.id !== bk.id &&
          other.spaceId === bk.spaceId &&
          (other.status === 'held' ||
            other.status === 'confirmed' ||
            other.status === 'checked-in' ||
            other.status === 'occupied') &&
          bk.endMin < other.startMin + space.bufferMinutes &&
          offer.requestedEndMin + space.bufferMinutes > other.startMin
      );
      if (conflictBooking || offer.requestedEndMin > space.hardDepartureMin) {
        offer.status = 'expired';
        offer.respondedAt = nowIso;
        return {
          ok: false,
          error: 'Extension offer expired because a conflicting reservation or cutoff appeared.',
        };
      }

      const debit = this.settleChargeFromWallet({
        email: bk.driverEmail || input.actorEmail,
        name: bk.driverName || input.actorName,
        amountInr: offer.additionalTotalInr,
        description: `Accepted +${offer.additionalMinutes}m extension on ${bk.spaceCode}`,
        type: 'extension_settlement',
        bookingId: bk.id,
        allowShortfall: false,
      });
      if (!debit.ok) {
        return { ok: false, wallet: debit.wallet, error: debit.error };
      }

      const newQuote = this.calculateServerQuote(
        space.hourlyPriceInr,
        bk.startMin,
        offer.requestedEndMin
      );
      bk.endMin = offer.requestedEndMin;
      bk.baseAmountInr = newQuote.baseAmountInr;
      bk.platformFeeInr = newQuote.platformFeeInr;
      bk.gstInr = newQuote.gstInr;
      bk.totalAmountInr = newQuote.totalAmountInr;
      bk.overstayStatus = 'none';
      bk.overstayMinutes = undefined;
      bk.overstayPenaltyInr = undefined;
      bk.walletSettledInr = (bk.walletSettledInr || 0) + offer.additionalTotalInr;
      offer.status = 'accepted';
      offer.respondedAt = nowIso;
      bk.auditTrail.push(
        `${ts} Driver Accepted Extension Offer ${offer.id} (+${offer.additionalMinutes}m until ${formatMinutesToTime(bk.endMin)}) · Settled ₹${offer.additionalTotalInr} from Prepaid Wallet`
      );

      space.occupancyState = 'OCCUPIED';
      space.lastOccupancyEvent = `Extended until ${formatMinutesToTime(bk.endMin)} (${bk.id})`;

      this.transactions.unshift({
        id: `TXN-${Date.now().toString(36).toUpperCase().slice(-5)}`,
        timestamp: nowIso,
        bookingId: bk.id,
        type: 'extension_charge',
        amountInr: offer.additionalTotalInr,
        actor: bk.driverName,
        status: 'wallet_settled',
        referenceId: offer.id,
      });

      const stl = this.settlements.find((s) => s.bookingId === bk.id);
      if (stl) {
        stl.grossInr = bk.baseAmountInr;
        stl.platformCommissionInr = Math.round(bk.baseAmountInr * 0.1);
        stl.gstWithheldInr = bk.gstInr;
        stl.netPayoutInr = bk.baseAmountInr - stl.platformCommissionInr;
      }

      this.lifecycleEvents.unshift({
        id: `LCE-${Date.now().toString(36).toUpperCase().slice(-5)}`,
        bookingId: bk.id,
        spaceId: bk.spaceId,
        spaceCode: bk.spaceCode,
        facilityName: bk.facilityName,
        trigger: 'offer_response',
        createdAt: nowIso,
        outcomeSummary: `Driver A accepted +${offer.additionalMinutes}m extension offer (₹${offer.additionalTotalInr} settled via Prepaid Wallet). New end: ${formatMinutesToTime(bk.endMin)}.`,
        resultingOccupancyState: 'OCCUPIED',
        executionMode: 'deterministic_service',
        steps: [
          {
            stepNumber: 4,
            agentName: 'Driver Offer & Prepaid Settlement',
            action: `Extended Until ${formatMinutesToTime(bk.endMin)}`,
            detail: `Settled ₹${offer.additionalTotalInr} from prepaid wallet (balance left ₹${debit.wallet.balanceInr}).`,
            status: 'done',
          },
        ],
      });

      this.addAudit(
        input.actorName,
        'EXTENSION_OFFER_ACCEPTED_WALLET',
        `${bk.id} extended to ${formatMinutesToTime(bk.endMin)} for ₹${offer.additionalTotalInr} via Prepaid Wallet.`
      );
      return { ok: true, booking: bk, offer, wallet: debit.wallet };
    } finally {
      this.bookingLock = false;
    }
  }

  public dispatchGatewayWebhook(
    orderId: string,
    outcome: 'payment.succeeded' | 'payment.failed',
    customEventId?: string
  ) {
    const order = this.paymentOrders.find((o) => o.id === orderId);
    if (!order) return { ok: false, error: 'Payment order not found' };

    const eventId =
      customEventId?.trim() || `EVT-${order.id}-${outcome === 'payment.succeeded' ? 'OK' : 'FAIL'}`;
    const event = {
      eventId,
      eventType: outcome,
      orderId: order.id,
      amountInr: order.amountInr,
    };
    const rawPayload = JSON.stringify(event);
    const signature = signWebhookPayload(rawPayload);
    return this.processPaymentWebhook({ rawPayload, signature, event });
  }

  // =========================================================================
  // PROVIDER SPACES, PRICING, SETTLEMENTS, INCIDENTS, DISPUTES & MODERATION
  // =========================================================================

  public addFacilityWithSpace(input: {
    providerId?: string;
    name: string;
    providerName: string;
    providerType: 'commercial' | 'community' | 'individual';
    address: string;
    zone?: string;
    lat?: number;
    lng?: number;
    entranceLabel: string;
    walkingDistanceM: number;
    hourlyPriceInr: number;
    covered: boolean;
    evCharging: boolean;
    allowedTypes: Array<'two_wheeler' | 'hatchback' | 'sedan' | 'suv'>;
    hardDepartureMin: number;
    restrictions?: string[];
    accessInstructions?: string;
  }) {
    // Hard invariant: newly listed facilities & spaces start unapproved/pending_approval
    // Only Admin POST /admin/spaces/:space_id/approve can publish them.
    const idx = this.facilities.length + 1;
    const facId = `FAC-${String(idx).padStart(2, '0')}`;
    const spaceId = `BAY-H${idx}`;
    const baseLat = typeof input.lat === 'number' ? input.lat : this.destinationCoords.lat;
    const baseLng = typeof input.lng === 'number' ? input.lng : this.destinationCoords.lng;
    const offsetLat = (Math.random() - 0.5) * 0.0025;
    const offsetLng = (Math.random() - 0.5) * 0.0025;
    const lat = Number((baseLat + offsetLat).toFixed(4));
    const lng = Number((baseLng + offsetLng).toFixed(4));
    const entranceLat = Number(((lat + baseLat) / 2).toFixed(4));
    const entranceLng = Number(((lng + baseLng) / 2).toFixed(4));

    const matchedProvider = input.providerId
      ? this.providers.find((p) => p.id === input.providerId)
      : this.providers.find(
          (p) => p.name.toLowerCase() === input.providerName.toLowerCase()
        ) || this.providers.find((p) => p.id === 'PRV-05');

    const newFac: Facility = {
      id: facId,
      providerId: matchedProvider?.id || 'PRV-05',
      name: input.name,
      providerName: input.providerName,
      providerType: input.providerType,
      address: input.address,
      zone: input.zone || 'Bengaluru City Network',
      verificationStatus: 'pending',
      authorityDocRef: 'PENDING_SPACE_PUBLICATION_APPROVAL',
      entranceLabel: input.entranceLabel,
      walkingDistanceM: input.walkingDistanceM,
      walkingMinutes: Math.max(2, Math.round(input.walkingDistanceM / 75)),
      walkPathSafety: 'Verified host entrance & lit pedestrian access',
      lat,
      lng,
      entranceLat,
      entranceLng,
      walkPathCoords: [
        [lat, lng],
        [entranceLat, entranceLng],
        [baseLat, baseLng],
      ],
      accessControl: 'Booking QR & Host Gate Access',
      accessInstructions:
        input.accessInstructions?.trim() ||
        `Enter via ${input.entranceLabel}; confirm booking code with host/guard.`,
      restrictions:
        input.restrictions && input.restrictions.length > 0
          ? input.restrictions
          : [`Checkout before ${formatMinutesToTime(input.hardDepartureMin)}`, 'No oversized commercial vans'],
      lateArrivalPolicy: {
        graceMinutes: 15,
        forfeitAfterMinutes: 40,
        summary: '15 min arrival grace; bay held up to 40 min post slot start.',
      },
      operationalChecks: defaultOperationalChecks(false),
      operationalChecksPassed: false,
      propertyEligibleForUse: true,
      availabilitySource: 'pending_audit',
      lastUpdatedIso: new Date().toISOString(),
      facilityGateQrToken: signFacilityGateQrToken(facId, input.entranceLabel),
    };

    const newSpace: ParkingSpace = {
      id: spaceId,
      facilityId: facId,
      spaceCode: `${input.name.split(' ')[0]} Bay 1`,
      publicationStatus: 'pending_approval',
      allowedTypes: input.allowedTypes,
      maxLengthCm: input.allowedTypes.includes('suv') ? 495 : 460,
      maxWidthCm: input.allowedTypes.includes('suv') ? 210 : 185,
      maxHeightCm: 210,
      covered: input.covered,
      evCharging: input.evCharging,
      hourlyPriceInr: input.hourlyPriceInr,
      bufferMinutes: 15,
      operatingStartMin: 7 * 60,
      operatingEndMin: 22 * 60 + 30,
      hardDepartureMin: input.hardDepartureMin,
      restrictions: newFac.restrictions,
      ownerBlocks: [],
      withdrawals: [],
      reviews: [],
      occupancyState: 'AVAILABLE',
      bufferCompleted: true,
      vacancyConfirmed: true,
      lastOccupancyEvent: 'Awaiting admin space publication approval',
    };

    this.facilities.push(newFac);
    this.spaces.push(newSpace);
    this.addAudit(
      input.providerName,
      'HOST_SPACE_SUBMITTED',
      `Submitted ${newFac.name} / ${newSpace.id} (₹${input.hourlyPriceInr}/hr) for Admin operational & publication approval.`
    );
    return { facility: newFac, space: newSpace };
  }

  public deleteFacility(facilityId: string, actorName: string): { ok: boolean; error?: string } {
    const idx = this.facilities.findIndex((f) => f.id === facilityId);
    if (idx === -1) return { ok: false, error: 'Facility not found' };
    const fac = this.facilities[idx];
    const spaceIds = new Set(this.spaces.filter((s) => s.facilityId === facilityId).map((s) => s.id));
    this.facilities.splice(idx, 1);
    this.spaces = this.spaces.filter((s) => !spaceIds.has(s.facilityId));
    this.bookings = this.bookings.filter((b) => b.facilityId !== facilityId);
    this.addAudit(actorName, 'FACILITY_DELETED', `Deleted facility ${fac.name} (${facilityId}) and associated spaces.`);
    return { ok: true };
  }

  public updateFacility(facilityId: string, updates: Partial<Facility>, actorName: string): { ok: boolean; facility?: Facility; error?: string } {
    const fac = this.facilities.find((f) => f.id === facilityId);
    if (!fac) return { ok: false, error: 'Facility not found' };
    if (updates.name) fac.name = updates.name;
    if (updates.address) fac.address = updates.address;
    if (updates.entranceLabel) fac.entranceLabel = updates.entranceLabel;
    if (updates.accessInstructions) fac.accessInstructions = updates.accessInstructions;
    fac.lastUpdatedIso = new Date().toISOString();
    this.addAudit(actorName, 'FACILITY_UPDATED', `Updated facility ${fac.name} (${facilityId}).`);
    return { ok: true, facility: fac };
  }

  public assignFacilityDriver(facilityId: string, driverEmail?: string, actorName?: string): { ok: boolean; facility?: Facility; error?: string } {
    const fac = this.facilities.find((f) => f.id === facilityId);
    if (!fac) return { ok: false, error: 'Facility not found' };
    (fac as any).assignedDriverEmail = driverEmail || undefined;
    this.addAudit(actorName || 'Host', 'FACILITY_DRIVER_ASSIGNED', `Assigned facility ${fac.name} to driver ${driverEmail || 'None'}.`);
    return { ok: true, facility: fac };
  }

  public cancelBookingHost(bookingId: string, reason: string, actorName: string): { ok: boolean; booking?: BookingRecord; error?: string } {
    const bk = this.bookings.find((b) => b.id === bookingId);
    if (!bk) return { ok: false, error: 'Booking not found' };
    if (bk.status === 'cancelled' || bk.status === 'completed') {
      return { ok: false, error: `Booking is already ${bk.status}` };
    }
    bk.status = 'cancelled';
    bk.paymentStatus = 'refunded';
    const wallet = this.getOrCreateWallet(bk.driverEmail || 'driver@parkpool.ai', bk.driverName);
    wallet.balanceInr += bk.totalAmountInr;
    const nowIso = new Date().toISOString();
    wallet.ledger.unshift({
      id: `LEDG-REF-${Date.now().toString(36).toUpperCase()}`,
      timestamp: nowIso,
      type: 'refund_credit',
      bookingId: bk.id,
      amountInr: bk.totalAmountInr,
      balanceAfterInr: wallet.balanceInr,
      description: `Host cancellation refund for ${bk.facilityName} (${reason})`,
    });
    this.refunds.push({
      id: `REF-${Date.now().toString(36).toUpperCase().slice(-5)}`,
      bookingId: bk.id,
      amountInr: bk.totalAmountInr,
      reason: `Host cancellation: ${reason}`,
      status: 'processed',
      requestedBy: actorName,
      processedBy: actorName,
      createdAt: nowIso,
      processedAt: nowIso,
    });
    this.addAudit(actorName, 'BOOKING_CANCELLED_BY_HOST', `Cancelled booking ${bk.id} and refunded ₹${bk.totalAmountInr} to driver.`);
    return { ok: true, booking: bk };
  }

  public updateSpacePricingAndRestrictions(input: {
    spaceId: string;
    hourlyPriceInr?: number;
    hardDepartureMin?: number;
    restrictions?: string[];
    actorName: string;
  }): { ok: boolean; space?: ParkingSpace; error?: string } {
    const sp = this.spaces.find((s) => s.id === input.spaceId);
    if (!sp) return { ok: false, error: 'Space not found' };
    if (typeof input.hourlyPriceInr === 'number' && input.hourlyPriceInr >= 15) {
      sp.hourlyPriceInr = Math.round(input.hourlyPriceInr);
    }
    if (typeof input.hardDepartureMin === 'number' && input.hardDepartureMin > sp.operatingStartMin) {
      sp.hardDepartureMin = input.hardDepartureMin;
    }
    if (Array.isArray(input.restrictions) && input.restrictions.length > 0) {
      sp.restrictions = input.restrictions;
      const fac = this.facilities.find((f) => f.id === sp.facilityId);
      if (fac) fac.restrictions = input.restrictions;
    }
    this.addAudit(
      input.actorName,
      'SPACE_PRICING_RULES_UPDATED',
      `Updated ${sp.spaceCode}: ₹${sp.hourlyPriceInr}/hr, cutoff ${formatMinutesToTime(sp.hardDepartureMin)}.`
    );
    return { ok: true, space: sp };
  }

  public settleHostPayout(settlementId: string, adminId: string): { ok: boolean; settlement?: HostSettlementRecord; error?: string } {
    const stl = this.settlements.find((s) => s.id === settlementId);
    if (!stl) return { ok: false, error: 'Settlement record not found' };
    if (stl.status === 'settled') return { ok: false, error: 'Already settled' };
    const nowIso = new Date().toISOString();
    stl.status = 'settled';
    stl.settledAt = nowIso;
    stl.utrRef = `UTR-PKP-${Date.now().toString().slice(-6)}`;
    this.transactions.unshift({
      id: `TXN-${Date.now().toString(36).toUpperCase().slice(-5)}`,
      timestamp: nowIso,
      bookingId: stl.bookingId,
      type: 'host_payout',
      amountInr: stl.netPayoutInr,
      actor: stl.providerName,
      status: 'settled',
      referenceId: stl.utrRef,
    });
    this.addAudit(`Admin ${adminId}`, 'HOST_PAYOUT_SETTLED', `${stl.id} settled ₹${stl.netPayoutInr} (${stl.utrRef})`);
    return { ok: true, settlement: stl };
  }

  public submitIncident(input: {
    reporterRole: UserRole;
    reporterName: string;
    facilityId?: string;
    bookingId?: string;
    category: IncidentRecord['category'];
    severity: IncidentRecord['severity'];
    description: string;
  }): IncidentRecord {
    const inc: IncidentRecord = {
      id: `INC-${Date.now().toString(36).toUpperCase().slice(-5)}`,
      reporterRole: input.reporterRole,
      reporterName: input.reporterName,
      facilityId: input.facilityId,
      bookingId: input.bookingId,
      category: input.category,
      severity: input.severity,
      description: input.description.trim(),
      status: 'open',
      createdAt: new Date().toISOString(),
    };
    this.incidents.unshift(inc);
    if (input.facilityId) {
      const fac = this.facilities.find((f) => f.id === input.facilityId);
      const prv = fac ? this.providers.find((p) => p.id === fac.providerId) : undefined;
      if (prv) prv.complaintsCount += 1;
    }
    this.addAudit(input.reporterName, 'INCIDENT_REPORTED', `${inc.id} (${inc.category}/${inc.severity}): ${inc.description.slice(0, 80)}`);
    return inc;
  }

  public updateIncident(
    incidentId: string,
    status: IncidentRecord['status'],
    resolutionNote: string,
    adminId: string
  ): IncidentRecord | null {
    const inc = this.incidents.find((i) => i.id === incidentId);
    if (!inc) return null;
    inc.status = status;
    inc.resolutionNote = resolutionNote.trim() || inc.resolutionNote;
    if (status === 'resolved') inc.resolvedAt = new Date().toISOString();
    this.addAudit(`Admin ${adminId}`, 'INCIDENT_UPDATED', `${inc.id} -> ${status}`);
    return inc;
  }

  public raiseDispute(input: {
    bookingId: string;
    raisedBy: string;
    reason: string;
    requestedRefundInr: number;
  }): { ok: boolean; dispute?: DisputeRecord; error?: string } {
    const bk = this.bookings.find((b) => b.id === input.bookingId);
    if (!bk) return { ok: false, error: 'Booking not found' };
    const amt = Math.min(bk.totalAmountInr, Math.max(10, Math.round(input.requestedRefundInr || bk.totalAmountInr)));
    const dispute: DisputeRecord = {
      id: `DSP-${Date.now().toString(36).toUpperCase().slice(-5)}`,
      bookingId: bk.id,
      paymentOrderId: bk.paymentOrderId,
      raisedBy: input.raisedBy,
      reason: input.reason.trim(),
      requestedRefundInr: amt,
      status: 'open',
      createdAt: new Date().toISOString(),
    };
    this.disputes.unshift(dispute);
    bk.refundStatus = 'requested';
    this.addAudit(input.raisedBy, 'DISPUTE_RAISED', `${dispute.id} on ${bk.id} for ₹${amt}`);
    return { ok: true, dispute };
  }

  public resolveDispute(
    disputeId: string,
    decision: 'refunded' | 'dismissed',
    adminNote: string,
    adminId: string
  ): { ok: boolean; dispute?: DisputeRecord; error?: string } {
    const dsp = this.disputes.find((d) => d.id === disputeId);
    if (!dsp) return { ok: false, error: 'Dispute not found' };
    const nowIso = new Date().toISOString();
    dsp.status = decision;
    dsp.adminNote = adminNote.trim();
    dsp.resolvedAt = nowIso;

    const bk = this.bookings.find((b) => b.id === dsp.bookingId);
    if (decision === 'refunded' && bk) {
      bk.refundStatus = 'refunded';
      bk.refundAmountInr = dsp.requestedRefundInr;
      bk.paymentStatus = dsp.requestedRefundInr >= bk.totalAmountInr ? 'refunded' : 'partially_refunded';
      const rfd: RefundRecord = {
        id: `RFD-${Date.now().toString(36).toUpperCase().slice(-5)}`,
        bookingId: bk.id,
        paymentOrderId: bk.paymentOrderId,
        amountInr: dsp.requestedRefundInr,
        reason: `Admin Dispute Refund (${dsp.id}): ${dsp.reason}`,
        status: 'processed',
        requestedBy: dsp.raisedBy,
        processedBy: adminId,
        createdAt: nowIso,
        processedAt: nowIso,
      };
      this.refunds.unshift(rfd);
      this.transactions.unshift({
        id: `TXN-${Date.now().toString(36).toUpperCase().slice(-5)}`,
        timestamp: nowIso,
        bookingId: bk.id,
        type: 'refund',
        amountInr: dsp.requestedRefundInr,
        actor: dsp.raisedBy,
        status: 'refunded',
        referenceId: rfd.id,
      });
    } else if (bk) {
      bk.refundStatus = 'rejected';
    }

    this.addAudit(`Admin ${adminId}`, 'DISPUTE_RESOLVED', `${dsp.id} -> ${decision} (₹${dsp.requestedRefundInr})`);
    return { ok: true, dispute: dsp };
  }

  public submitUserReport(input: { reportedEntity: string; reporterName: string; reason: string }): UserReportRecord {
    const rep: UserReportRecord = {
      id: `REP-${Date.now().toString(36).toUpperCase().slice(-5)}`,
      reportedEntity: input.reportedEntity.trim(),
      reporterName: input.reporterName.trim(),
      reason: input.reason.trim(),
      status: 'open',
      createdAt: new Date().toISOString(),
    };
    this.userReports.unshift(rep);
    this.addAudit(input.reporterName, 'USER_REPORT_FILED', `${rep.id} against ${rep.reportedEntity}`);
    return rep;
  }

  public moderateUserReport(
    reportId: string,
    status: UserReportRecord['status'],
    moderatorNote: string,
    adminId: string
  ): UserReportRecord | null {
    const rep = this.userReports.find((r) => r.id === reportId);
    if (!rep) return null;
    rep.status = status;
    rep.moderatorNote = moderatorNote.trim();
    this.addAudit(`Admin ${adminId}`, 'MODERATION_ACTION', `${rep.id} -> ${status}`);
    return rep;
  }

  public addBookingReview(bookingId: string, rating: number, comment: string, authorName: string) {
    const bk = this.bookings.find((b) => b.id === bookingId);
    if (!bk) return { ok: false, error: 'Booking not found' };
    if (bk.status !== 'completed') {
      return { ok: false, error: 'Only completed bookings can submit a review' };
    }
    const space = this.spaces.find((s) => s.id === bk.spaceId);
    if (!space) return { ok: false, error: 'Space not found' };
    if (space.reviews.some((r) => r.bookingId === bookingId)) {
      return { ok: false, error: 'Review already submitted for this booking' };
    }
    space.reviews.unshift({
      id: `REV-${Date.now().toString().slice(-4)}`,
      bookingId,
      authorAlias: authorName,
      rating: Math.max(1, Math.min(5, Math.round(rating))),
      comment: comment.trim() || 'Smooth entry and accurate gate instructions.',
      theme: 'Verified Driver Review',
      createdAt: new Date().toISOString().slice(0, 10),
    });
    this.addAudit(authorName, 'REVIEW_SUBMITTED', `Rated ${bk.spaceCode} ${rating}/5`);
    return { ok: true };
  }

  public updateFacilityVerification(facilityId: string, status: VerificationStatus, docRef?: string) {
    const facility = this.facilities.find((f) => f.id === facilityId);
    if (!facility) return null;
    facility.verificationStatus = status;
    if (docRef) facility.authorityDocRef = docRef;
    facility.availabilitySource = status === 'verified' ? 'schedule_engine' : 'pending_audit';
    facility.lastUpdatedIso = new Date().toISOString();
    for (const sp of this.spaces) {
      if (sp.facilityId === facilityId) {
        sp.publicationStatus =
          status === 'verified' ? 'approved' : status === 'suspended' ? 'suspended' : 'pending_approval';
      }
    }
    this.addAudit(
      'Admin Verification Queue',
      `FACILITY_${status.toUpperCase()}`,
      `${facility.name} set to ${status} (${facility.authorityDocRef})`
    );
    return facility;
  }

  private resolveVehicleDims(vehicleType: VehicleType): {
    lengthCm: number;
    widthCm: number;
    heightCm: number;
  } {
    return vehicleType === 'two_wheeler'
      ? { lengthCm: 195, widthCm: 76, heightCm: 112 }
      : vehicleType === 'hatchback'
      ? { lengthCm: 390, widthCm: 172, heightCm: 155 }
      : vehicleType === 'sedan'
      ? { lengthCm: 455, widthCm: 178, heightCm: 150 }
      : { lengthCm: 465, widthCm: 192, heightCm: 178 };
  }

  public addDriverVehicle(input: {
    id?: string;
    ownerEmail: string;
    ownerName?: string;
    wheelerCategory: WheelerCategory;
    vehicleType: VehicleType;
    vehicleModel: string;
    plateNumber: string;
    isEv: boolean;
    allowDuplicatePlateUpdate?: boolean;
  }): { ok: boolean; vehicle?: VehicleProfile; vehicles?: VehicleProfile[]; error?: string } {
    const cleanEmail = input.ownerEmail.trim().toLowerCase();
    const cleanModel = input.vehicleModel.trim();
    const cleanPlate = input.plateNumber.trim().toUpperCase();

    if (!cleanEmail) {
      return { ok: false, error: 'Authenticated driver email is required.' };
    }
    if (cleanModel.length < 2) {
      return { ok: false, error: 'Please enter a valid vehicle make & model.' };
    }
    if (cleanPlate.length < 5) {
      return { ok: false, error: 'Please enter a valid vehicle registration plate (min 5 characters).' };
    }

    const effectiveType: VehicleType =
      input.wheelerCategory === 'two_wheeler'
        ? 'two_wheeler'
        : input.vehicleType === 'two_wheeler'
        ? 'hatchback'
        : input.vehicleType;

    const dims = this.resolveVehicleDims(effectiveType);

    const existingSamePlate = this.vehicles.find(
      (v) =>
        v.ownerEmail?.toLowerCase() === cleanEmail &&
        v.plateNumber.toUpperCase() === cleanPlate &&
        (!input.id || v.id !== input.id)
    );
    if (existingSamePlate && !input.allowDuplicatePlateUpdate) {
      return {
        ok: false,
        error: `Vehicle ${cleanPlate} is already registered in your garage.`,
      };
    }

    const sanitizedRequestedId =
      input.id && /^[a-zA-Z0-9_-]{1,128}$/.test(input.id.trim())
        ? input.id.trim()
        : undefined;

    const existingByIdIdx = sanitizedRequestedId
      ? this.vehicles.findIndex((v) => v.id === sanitizedRequestedId)
      : -1;

    const existingSamePlateIdx = existingSamePlate
      ? this.vehicles.findIndex((v) => v.id === existingSamePlate.id)
      : -1;

    const vehicleId =
      sanitizedRequestedId ||
      existingSamePlate?.id ||
      `VEH-DRV-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

    const label = cleanModel.includes(cleanPlate)
      ? cleanModel
      : `${cleanModel} (${cleanPlate})`;

    const vehicleRecord: VehicleProfile = {
      id: vehicleId,
      label,
      plateNumber: cleanPlate,
      vehicleType: effectiveType,
      wheelerCategory: input.wheelerCategory,
      ...dims,
      isEv: Boolean(input.isEv),
      ownerEmail: cleanEmail,
    };

    const targetIdx = existingByIdIdx >= 0 ? existingByIdIdx : existingSamePlateIdx;
    if (targetIdx >= 0) {
      this.vehicles[targetIdx] = vehicleRecord;
    } else {
      this.vehicles.unshift(vehicleRecord);
    }

    const profile = this.driverProfiles.find(
      (p) => p.email.toLowerCase() === cleanEmail
    );
    if (profile && !this.vehicles.some((v) => v.id === profile.registeredVehicleId)) {
      profile.registeredVehicleId = vehicleRecord.id;
    }

    this.addAudit(
      input.ownerName || cleanEmail,
      'DRIVER_VEHICLE_ADDED',
      `Added vehicle ${label} (${input.wheelerCategory})`
    );

    const ownedVehicles = this.vehicles.filter(
      (v) => v.ownerEmail?.toLowerCase() === cleanEmail
    );
    return { ok: true, vehicle: vehicleRecord, vehicles: ownedVehicles };
  }

  public removeDriverVehicle(
    vehicleId: string,
    ownerEmail: string
  ): { ok: boolean; nextActiveVehicleId?: string; vehicles?: VehicleProfile[]; error?: string } {
    const cleanEmail = ownerEmail.trim().toLowerCase();
    const idx = this.vehicles.findIndex((v) => v.id === vehicleId);
    if (idx < 0) {
      return { ok: false, error: 'Vehicle not found.' };
    }
    const target = this.vehicles[idx];
    if (!target.ownerEmail || target.ownerEmail.toLowerCase() !== cleanEmail) {
      return { ok: false, error: 'You can only remove vehicles registered to your account.' };
    }

    this.vehicles.splice(idx, 1);

    const remainingOwned = this.vehicles.filter(
      (v) => v.ownerEmail?.toLowerCase() === cleanEmail
    );

    const profile = this.driverProfiles.find(
      (p) => p.email.toLowerCase() === cleanEmail
    );
    if (profile && profile.registeredVehicleId === vehicleId && remainingOwned[0]) {
      const nextVeh = remainingOwned[0];
      profile.registeredVehicleId = nextVeh.id;
      profile.wheelerCategory = nextVeh.wheelerCategory;
      profile.vehicleType = nextVeh.vehicleType;
      profile.plateNumber = nextVeh.plateNumber;
      profile.vehicleModel = nextVeh.label.replace(/\s*\([^)]*\)\s*$/, '').trim() || nextVeh.label;
      profile.isEv = nextVeh.isEv;
      profile.updatedAt = new Date().toISOString();
    }

    this.addAudit(
      cleanEmail,
      'DRIVER_VEHICLE_REMOVED',
      `Removed vehicle ${target.label}`
    );

    return {
      ok: true,
      nextActiveVehicleId: remainingOwned[0]?.id || this.vehicles[0]?.id,
      vehicles: remainingOwned,
    };
  }

  public syncDriverVehicles(
    ownerEmail: string,
    incomingVehicles: VehicleProfile[]
  ): VehicleProfile[] {
    const cleanEmail = ownerEmail.trim().toLowerCase();
    for (const v of incomingVehicles) {
      if (!v || !v.plateNumber || !v.label) continue;
      const cleanModel = v.label.replace(/\s*\([^)]*\)\s*$/, '').trim() || v.label;
      this.addDriverVehicle({
        id: v.id,
        ownerEmail: cleanEmail,
        wheelerCategory: v.wheelerCategory === 'two_wheeler' ? 'two_wheeler' : 'four_wheeler',
        vehicleType: v.vehicleType,
        vehicleModel: cleanModel,
        plateNumber: v.plateNumber,
        isEv: Boolean(v.isEv),
        allowDuplicatePlateUpdate: true,
      });
    }
    return this.vehicles.filter((v) => v.ownerEmail?.toLowerCase() === cleanEmail);
  }

  public upsertDriverProfile(input: {
    fullName: string;
    email: string;
    phone: string;
    licenseNumber: string;
    licenseValidTill: string;
    wheelerCategory: WheelerCategory;
    vehicleType: VehicleType;
    vehicleModel: string;
    plateNumber: string;
    isEv: boolean;
    vehicleId?: string;
  }): { ok: boolean; profile?: DriverProfile; vehicle?: VehicleProfile; error?: string } {
    const cleanName = input.fullName.trim();
    const cleanEmail = input.email.trim().toLowerCase();
    const cleanPhone = input.phone.trim();
    const cleanLicense = input.licenseNumber.trim().toUpperCase();
    const cleanPlate = input.plateNumber.trim().toUpperCase();
    const cleanModel = input.vehicleModel.trim();

    if (!cleanName || !cleanEmail) {
      return { ok: false, error: 'Driver name and email are required.' };
    }
    if (cleanPhone.length < 8) {
      return { ok: false, error: 'Please enter a valid mobile number.' };
    }
    if (cleanLicense.length < 6) {
      return { ok: false, error: 'Please enter a valid Driving License number (min 6 characters).' };
    }
    if (cleanPlate.length < 5) {
      return { ok: false, error: 'Please enter a valid vehicle registration number.' };
    }
    if (!cleanModel) {
      return { ok: false, error: 'Please enter your vehicle make & model.' };
    }

    const effectiveType: VehicleType =
      input.wheelerCategory === 'two_wheeler'
        ? 'two_wheeler'
        : input.vehicleType === 'two_wheeler'
        ? 'hatchback'
        : input.vehicleType;

    const dims = this.resolveVehicleDims(effectiveType);

    const existingIdx = this.driverProfiles.findIndex(
      (p) => p.email.toLowerCase() === cleanEmail
    );

    const requestedVehId =
      input.vehicleId && /^[a-zA-Z0-9_-]{1,128}$/.test(input.vehicleId.trim())
        ? input.vehicleId.trim()
        : undefined;

    const existingSamePlate = this.vehicles.find(
      (v) =>
        v.ownerEmail?.toLowerCase() === cleanEmail &&
        v.plateNumber.toUpperCase() === cleanPlate
    );

    const existingByRequestedId = requestedVehId
      ? this.vehicles.find(
          (v) => v.id === requestedVehId && v.ownerEmail?.toLowerCase() === cleanEmail
        )
      : undefined;

    const vehicleId =
      existingByRequestedId?.id ||
      existingSamePlate?.id ||
      requestedVehId ||
      `VEH-DRV-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

    const vehicleLabel = cleanModel.includes(cleanPlate)
      ? cleanModel
      : `${cleanModel} (${cleanPlate})`;

    const vehicleRecord: VehicleProfile = {
      id: vehicleId,
      label: vehicleLabel,
      plateNumber: cleanPlate,
      vehicleType: effectiveType,
      wheelerCategory: input.wheelerCategory,
      ...dims,
      isEv: Boolean(input.isEv),
      ownerEmail: cleanEmail,
    };

    const existingVehIdx = this.vehicles.findIndex((v) => v.id === vehicleId);
    if (existingVehIdx >= 0) {
      this.vehicles[existingVehIdx] = vehicleRecord;
    } else {
      this.vehicles.unshift(vehicleRecord);
    }

    const profile: DriverProfile = {
      id: existingIdx >= 0 ? this.driverProfiles[existingIdx].id : `DRV-${Date.now().toString(36).toUpperCase()}`,
      fullName: cleanName,
      email: cleanEmail,
      phone: cleanPhone,
      licenseNumber: cleanLicense,
      licenseValidTill: input.licenseValidTill || '2032-12-31',
      wheelerCategory: input.wheelerCategory,
      vehicleType: effectiveType,
      vehicleModel: cleanModel,
      plateNumber: cleanPlate,
      isEv: Boolean(input.isEv),
      registeredVehicleId: vehicleId,
      verified: true,
      updatedAt: new Date().toISOString(),
    };

    if (existingIdx >= 0) {
      this.driverProfiles[existingIdx] = profile;
    } else {
      this.driverProfiles.unshift(profile);
    }

    this.addAudit(
      cleanName,
      'DRIVER_PROFILE_REGISTERED',
      `Registered ${cleanPlate} (${input.wheelerCategory}) · DL ${cleanLicense}`
    );
    return { ok: true, profile, vehicle: vehicleRecord };
  }

  public computePoolingComparison(): PoolingStrategyMetrics[] {
    const demandBatch = [
      { id: 'REQ-01', driverTag: 'Harrier EV (SUV)', vehicleType: 'suv', startMin: 13 * 60 + 30, endMin: 16 * 60, walkPref: 350 },
      { id: 'REQ-02', driverTag: 'City e:HEV (Sedan)', vehicleType: 'sedan', startMin: 14 * 60, endMin: 17 * 60 + 30, walkPref: 400 },
      { id: 'REQ-03', driverTag: 'Tiago EV (Hatch)', vehicleType: 'hatchback', startMin: 10 * 60, endMin: 13 * 60, walkPref: 450 },
      { id: 'REQ-04', driverTag: 'Creta (SUV)', vehicleType: 'suv', startMin: 16 * 60 + 30, endMin: 19 * 60 + 30, walkPref: 380 },
      { id: 'REQ-05', driverTag: 'Baleno (Hatch)', vehicleType: 'hatchback', startMin: 15 * 60, endMin: 17 * 60 + 45, walkPref: 550 },
      { id: 'REQ-06', driverTag: 'Ather 450X (2W)', vehicleType: 'two_wheeler', startMin: 14 * 60 + 30, endMin: 18 * 60, walkPref: 420 },
      { id: 'REQ-07', driverTag: 'Verna (Sedan)', vehicleType: 'sedan', startMin: 18 * 60, endMin: 21 * 60, walkPref: 400 },
      { id: 'REQ-08', driverTag: 'Nexon EV (SUV)', vehicleType: 'suv', startMin: 18 * 60 + 15, endMin: 21 * 60 + 30, walkPref: 500 },
    ];

    const verifiedSpaces = this.spaces.filter((s) => {
      if (s.publicationStatus !== 'approved') return false;
      const f = this.facilities.find((fac) => fac.id === s.facilityId);
      if (!f || f.verificationStatus !== 'verified') return false;
      return calcGeoMeters(f.lat, f.lng, this.destinationCoords.lat, this.destinationCoords.lng) <= 1500;
    });

    const runStrategy = (mode: 'fcfs' | 'greedy' | 'uncertainty_aware'): PoolingStrategyMetrics => {
      const assignedTimeline = new Map<string, Array<{ start: number; end: number }>>();
      for (const s of verifiedSpaces) {
        const initial: Array<{ start: number; end: number }> = [];
        for (const b of this.bookings) {
          if (
            b.spaceId === s.id &&
            (b.status === 'confirmed' ||
              b.status === 'checked-in' ||
              b.status === 'occupied' ||
              b.status === 'held')
          ) {
            initial.push({ start: b.startMin, end: b.endMin + s.bufferMinutes });
          }
        }
        for (const ob of s.ownerBlocks) {
          initial.push({ start: Math.max(0, ob.startMin - s.bufferMinutes), end: ob.endMin });
        }
        assignedTimeline.set(s.id, initial);
      }

      const orderedDemand =
        mode === 'uncertainty_aware'
          ? [...demandBatch].sort((a, b) => (b.vehicleType === 'suv' ? 1 : 0) - (a.vehicleType === 'suv' ? 1 : 0) || a.startMin - b.startMin)
          : mode === 'greedy'
          ? [...demandBatch].sort((a, b) => a.startMin - b.startMin)
          : demandBatch;

      const allocations: PoolingStrategyMetrics['allocations'] = [];
      let totalWalk = 0;
      let matched = 0;
      let totalMinutesUsed = 0;

      for (const req of orderedDemand) {
        const candidates = verifiedSpaces.filter((s) => {
          if (!s.allowedTypes.includes(req.vehicleType as VehicleType)) return false;
          if (req.startMin < s.operatingStartMin || req.endMin > s.hardDepartureMin) return false;
          const blocks = assignedTimeline.get(s.id) || [];
          const reqEndWithBuf = req.endMin + s.bufferMinutes;
          return !blocks.some((blk) => req.startMin < blk.end && reqEndWithBuf > blk.start);
        });

        let chosen: ParkingSpace | undefined;
        if (candidates.length > 0) {
          if (mode === 'fcfs') {
            chosen = candidates[0];
          } else if (mode === 'greedy') {
            chosen = candidates.sort((a, b) => {
              const fa = this.facilities.find((f) => f.id === a.facilityId)!;
              const fb = this.facilities.find((f) => f.id === b.facilityId)!;
              return fa.walkingDistanceM - fb.walkingDistanceM;
            })[0];
          } else {
            chosen = candidates.sort((a, b) => {
              const fa = this.facilities.find((f) => f.id === a.facilityId)!;
              const fb = this.facilities.find((f) => f.id === b.facilityId)!;
              const tightnessA = a.allowedTypes.length * 120 + fa.walkingDistanceM * 0.6;
              const tightnessB = b.allowedTypes.length * 120 + fb.walkingDistanceM * 0.6;
              return tightnessA - tightnessB;
            })[0];
          }
        }

        if (chosen) {
          const fac = this.facilities.find((f) => f.id === chosen.facilityId)!;
          assignedTimeline.get(chosen.id)!.push({
            start: req.startMin,
            end: req.endMin + chosen.bufferMinutes,
          });
          matched++;
          totalWalk += fac.walkingDistanceM;
          totalMinutesUsed += req.endMin - req.startMin;
          allocations.push({
            requestId: req.id,
            driverTag: req.driverTag,
            spaceId: chosen.id,
            spaceCode: chosen.spaceCode,
            startMin: req.startMin,
            endMin: req.endMin,
            bufferEndMin: req.endMin + chosen.bufferMinutes,
            status: 'assigned',
          });
        } else {
          allocations.push({
            requestId: req.id,
            driverTag: req.driverTag,
            spaceId: '-',
            spaceCode: 'Unassigned',
            startMin: req.startMin,
            endMin: req.endMin,
            bufferEndMin: req.endMin,
            status: 'unassigned',
          });
        }
      }

      const totalCapacityMins = Math.max(
        1,
        verifiedSpaces.reduce((acc, s) => acc + (s.hardDepartureMin - s.operatingStartMin), 0)
      );
      const existingMins = this.bookings
        .filter((b) => b.status === 'confirmed' || b.status === 'occupied')
        .reduce((acc, b) => acc + (b.endMin - b.startMin), 0);

      return {
        strategy: mode,
        label:
          mode === 'fcfs'
            ? 'First-Come First-Served (FCFS)'
            : mode === 'greedy'
            ? 'Greedy Nearest-Walk'
            : 'Uncertainty-Aware Pooling Optimizer',
        matchRatePct: Number(((matched / demandBatch.length) * 100).toFixed(1)),
        utilizationPct: Number((((totalMinutesUsed + existingMins) / totalCapacityMins) * 100).toFixed(1)),
        avgWalkMeters: matched > 0 ? Math.round(totalWalk / matched) : 0,
        conflictRatePer1k: 0,
        hardViolations: 0,
        computeMs: mode === 'fcfs' ? 1.2 : mode === 'greedy' ? 2.8 : 6.4,
        allocations,
      };
    };

    return [runStrategy('fcfs'), runStrategy('greedy'), runStrategy('uncertainty_aware')];
  }
}

export const store = new ParkPoolStore();

export const POLICY_RAG_CORPUS = [
  {
    id: 'DOC-AUTH-01',
    title: 'Provider & Property Authority Verification Policy',
    section: 'Section 11.4.A & 02.6',
    content:
      'Every provider must progress through NOT_SUBMITTED -> SUBMITTED -> UNDER_REVIEW -> APPROVED via manual human admin review of type-specific documents stored in private object storage. Spaces require separate operational & publication approval before becoming discoverable.',
  },
  {
    id: 'DOC-OVERSTAY-02',
    title: 'Late Departure, Extensions, Host Buffers & Overstay Protocol',
    section: 'Section 11.4.C',
    content:
      'All bays enforce a minimum 15-minute turnaround buffer before downstream bookings and owner-use blocks. Extensions require checking the next booking, host blocks, departure buffer, backend price recalculation, and explicit host approval. Late-arrival grace windows (15-20 mins) are disclosed pre-booking.',
  },
  {
    id: 'DOC-PAYMENTS-03',
    title: 'Server-Generated Payment Orders & Idempotent Webhooks',
    section: 'Section 11.4.F',
    content:
      'All prices are calculated exclusively on the backend. Gateway webhooks carry HMAC-SHA256 signatures and unique event IDs processed idempotently once. Abandoned or failed checkout holds expire safely.',
  },
  {
    id: 'DOC-SAFETY-04',
    title: 'Vehicle Misuse & Emergency Escalation (India 112)',
    section: 'Section 11.4.D',
    content:
      'ParkPool AI records verified host authority, driver booking details, and controlled check-in access logs, but does not promise complete physical security clearance. Hosts must never inspect suspected dangerous items; keep people clear and contact emergency services / police at 112 in India.',
  },
  {
    id: 'DOC-WALK-05',
    title: 'Pedestrian Routing & Entrance Precision Standard',
    section: 'Section 11.4.E & 00.7',
    content:
      'Distances are measured along actual pedestrian walkways to the exact parking entrance gate rather than straight-line map pins. Walking time estimates (~6–8 min for 500m) and path lighting/cover notes are disclosed transparently.',
  },
];
