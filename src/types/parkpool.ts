export type VehicleType = 'two_wheeler' | 'hatchback' | 'sedan' | 'suv';

export type WheelerCategory = 'two_wheeler' | 'four_wheeler';

export type ProviderType = 'commercial' | 'community' | 'individual';

export type DetailedProviderType =
  | 'commercial_operator'
  | 'mall_office'
  | 'property_owner'
  | 'property_manager'
  | 'apartment_residential';

export type ProviderVerificationStatus =
  | 'NOT_SUBMITTED'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'NEEDS_MORE_INFORMATION'
  | 'APPROVED'
  | 'REJECTED'
  | 'SUSPENDED'
  | 'EXPIRED';

export type SpacePublicationStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'suspended';

export type VerificationStatus = 'verified' | 'pending' | 'suspended';

export type UserRole = 'driver' | 'host' | 'admin';

export interface UserSession {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  organization: string;
  accentHex: string;
}

export type BookingStatus =
  | 'held'
  | 'confirmed'
  | 'checked-in'
  | 'occupied'
  | 'completed'
  | 'cancelled'
  | 'expired';

export interface EvidenceRequirement {
  docType: string;
  label: string;
  description: string;
  required: boolean;
}

export interface PrivateDocumentRecord {
  id: string;
  providerId: string;
  docType: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
  status: 'pending' | 'verified' | 'rejected';
  reviewerNote?: string;
  aiMissingFieldFlags?: string[];
}

export interface ProviderRecord {
  id: string;
  name: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  organizationName: string;
  registrationNumber?: string;
  providerType: DetailedProviderType;
  legacyType: ProviderType;
  verificationStatus: ProviderVerificationStatus;
  submittedAt?: string;
  reviewedAt?: string;
  reviewerId?: string;
  decisionReason?: string;
  expiresAt?: string;
  nextPeriodicReviewAt?: string;
  evidenceRefs: string[];
  documents: PrivateDocumentRecord[];
  aiPrecheckWarnings: string[];
  complaintsCount: number;
  operatorChangeFlagged: boolean;
  updatedAt: string;
}

export interface OperationalCheckRecord {
  entranceVerified: boolean;
  locationVerified: boolean;
  dimensionsVerified: boolean;
  operatingHoursVerified: boolean;
  restrictionsVerified: boolean;
  accessArrangementsVerified: boolean;
  inspectorId?: string;
  checkedAt?: string;
  notes?: string;
}

export interface VehicleProfile {
  id: string;
  label: string;
  plateNumber: string;
  vehicleType: VehicleType;
  wheelerCategory: WheelerCategory;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  isEv: boolean;
  ownerEmail?: string;
}

export interface DriverProfile {
  id: string;
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
  registeredVehicleId: string;
  verified: boolean;
  updatedAt: string;
}

export interface Facility {
  id: string;
  providerId: string;
  name: string;
  providerName: string;
  providerType: ProviderType;
  address: string;
  zone: string;
  verificationStatus: VerificationStatus;
  authorityDocRef: string;
  entranceLabel: string;
  walkingDistanceM: number;
  walkingMinutes: number;
  walkPathSafety: string;
  lat: number;
  lng: number;
  entranceLat: number;
  entranceLng: number;
  walkPathCoords: [number, number][];
  accessControl: string;
  accessInstructions: string;
  restrictions: string[];
  lateArrivalPolicy: {
    graceMinutes: number;
    forfeitAfterMinutes: number;
    summary: string;
  };
  operationalChecks: OperationalCheckRecord;
  operationalChecksPassed: boolean;
  propertyEligibleForUse: boolean;
  lastPeriodicReviewAt?: string;
  availabilitySource: 'provider_portal' | 'schedule_engine' | 'pending_audit';
  lastUpdatedIso: string;
  facilityGateQrToken?: string;
}

export interface TimeBlock {
  id: string;
  startMin: number;
  endMin: number;
  label: string;
  type: 'booking' | 'owner_block' | 'withdrawal';
}

export interface AvailabilityWithdrawal {
  id: string;
  spaceId: string;
  startMin: number;
  endMin: number;
  reason: string;
  createdAt: string;
  affectedBookingIds: string[];
}

export interface SpaceReview {
  id: string;
  bookingId: string;
  authorAlias: string;
  rating: number;
  comment: string;
  theme: string;
  createdAt: string;
}

export type SpaceOccupancyState =
  | 'AVAILABLE'
  | 'BOOKED'
  | 'OCCUPIED'
  | 'OVERSTAY'
  | 'DEPARTURE_PENDING'
  | 'CLEARANCE';

export interface ParkingSpace {
  id: string;
  facilityId: string;
  spaceCode: string;
  publicationStatus: SpacePublicationStatus;
  allowedTypes: VehicleType[];
  maxLengthCm: number;
  maxWidthCm: number;
  maxHeightCm: number;
  covered: boolean;
  evCharging: boolean;
  hourlyPriceInr: number;
  bufferMinutes: number;
  operatingStartMin: number;
  operatingEndMin: number;
  hardDepartureMin: number;
  restrictions: string[];
  ownerBlocks: TimeBlock[];
  withdrawals: AvailabilityWithdrawal[];
  reviews: SpaceReview[];
  occupancyState?: SpaceOccupancyState;
  activeOccupancyBookingId?: string;
  clearanceEndsAt?: string;
  bufferCompleted?: boolean;
  vacancyConfirmed?: boolean;
  lastOccupancyEvent?: string;
}

export interface ExtensionAlternative {
  spaceId: string;
  facilityName: string;
  spaceCode: string;
  hourlyPriceInr: number;
  walkingDistanceM: number;
}

export interface ExtensionRequest {
  id: string;
  bookingId: string;
  requestedEndMin: number;
  additionalBaseInr: number;
  additionalFeeInr: number;
  additionalGstInr: number;
  additionalTotalInr: number;
  status: 'pending_host_approval' | 'approved' | 'rejected';
  reason: string;
  createdAt: string;
  hostDecisionBy?: string;
  hostDecisionAt?: string;
  alternatives?: ExtensionAlternative[];
}

export interface ExtensionOffer {
  id: string;
  bookingId: string;
  additionalMinutes: number;
  requestedEndMin: number;
  additionalBaseInr: number;
  additionalFeeInr: number;
  additionalGstInr: number;
  additionalTotalInr: number;
  status: 'pending_driver_acceptance' | 'accepted' | 'declined' | 'expired';
  pricingReason: string;
  providerApprovalNote: string;
  createdAt: string;
  respondedAt?: string;
}

export interface DepartureSignal {
  type: 'im_leaving_button' | 'geofence_exit';
  detectedAt: string;
  distanceFromGateM?: number;
  gpsNote: string;
  confirmedByDriver: boolean;
  confirmedByHost: boolean;
}

export interface BookingRecord {
  id: string;
  spaceId: string;
  facilityId: string;
  facilityName: string;
  spaceCode: string;
  driverName: string;
  driverEmail?: string;
  driverLicense?: string;
  vehicleId: string;
  vehicleLabel: string;
  vehiclePlate?: string;
  startMin: number;
  endMin: number;
  bufferMinutes: number;
  status: BookingStatus;
  baseAmountInr: number;
  platformFeeInr: number;
  gstInr: number;
  totalAmountInr: number;
  accessCode: string;
  entranceLabel: string;
  createdAt: string;
  holdExpiresAt?: string;
  checkedInAt?: string;
  checkedOutAt?: string;
  arrivalStatus?: 'on_time' | 'late_grace' | 'late_flagged';
  lateArrivalPolicy: {
    graceMinutes: number;
    forfeitAfterMinutes: number;
    summary: string;
  };
  extensionRequests: ExtensionRequest[];
  paymentOrderId?: string;
  paymentStatus: 'unpaid' | 'pending' | 'paid' | 'failed' | 'refunded' | 'partially_refunded';
  refundStatus?: 'none' | 'requested' | 'processing' | 'refunded' | 'rejected';
  refundAmountInr?: number;
  invoiceNumber?: string;
  hostExceptionFlagged?: boolean;
  withdrawalResolution?: {
    status: 'affected' | 'rebooked' | 'refunded';
    options: string[];
    resolvedOption?: string;
  };
  qrPassToken?: string;
  qrVerifiedAt?: string;
  qrScanMethod?: 'camera' | 'upload' | 'gate_placard' | 'manual_token';
  overstayStatus?: 'none' | 'flagged_overstay' | 'resolved';
  overstayMinutes?: number;
  overstayPenaltyInr?: number;
  overstayImpactedByBookingId?: string;
  overstayResolution?: {
    status: 'auto_reassigned' | 'choice_required' | 'rescheduled' | 'refunded_with_credit';
    detail: string;
    previousSpaceCode?: string;
    compensationCreditInr?: number;
    options?: string[];
  };
  extensionOffers?: ExtensionOffer[];
  departureSignal?: DepartureSignal;
  actualDepartureAt?: string;
  walletSettledInr?: number;
  extraHoursChargedInr?: number;
  extraMinutesCharged?: number;
  remainingBalanceAfterCheckoutInr?: number;
  unpaidDueAfterCheckoutInr?: number;
  auditTrail: string[];
}

export interface PaymentOrder {
  id: string;
  bookingId: string;
  amountInr: number;
  baseAmountInr: number;
  platformFeeInr: number;
  gstInr: number;
  currency: 'INR';
  gatewayOrderRef: string;
  status: 'created' | 'authorized' | 'paid' | 'failed' | 'expired';
  reconciliationStatus: 'pending' | 'matched' | 'mismatch';
  createdAt: string;
  expiresAt: string;
  paidAt?: string;
}

export interface PaymentWebhookEvent {
  eventId: string;
  eventType: 'payment.succeeded' | 'payment.failed' | 'refund.processed';
  orderId: string;
  bookingId: string;
  amountInr: number;
  signatureVerified: boolean;
  receivedAt: string;
  processedCount: number;
  duplicateIgnoredCount: number;
}

export interface RefundRecord {
  id: string;
  bookingId: string;
  paymentOrderId?: string;
  amountInr: number;
  reason: string;
  status: 'requested' | 'approved' | 'processed' | 'rejected';
  requestedBy: string;
  processedBy?: string;
  createdAt: string;
  processedAt?: string;
}

export interface HostSettlementRecord {
  id: string;
  providerId: string;
  providerName: string;
  bookingId: string;
  facilityName: string;
  grossInr: number;
  platformCommissionInr: number;
  gstWithheldInr: number;
  netPayoutInr: number;
  status: 'pending_checkout' | 'scheduled' | 'settled' | 'reversed';
  settledAt?: string;
  utrRef?: string;
}

export interface TransactionHistoryItem {
  id: string;
  timestamp: string;
  bookingId: string;
  type: 'charge' | 'refund' | 'extension_charge' | 'host_payout';
  amountInr: number;
  actor: string;
  status: string;
  referenceId: string;
}

export interface IncidentRecord {
  id: string;
  reporterRole: UserRole;
  reporterName: string;
  facilityId?: string;
  bookingId?: string;
  category:
    | 'access_blocked'
    | 'vehicle_overstay'
    | 'safety_hazard'
    | 'unauthorized_towing'
    | 'payment_issue'
    | 'other';
  severity: 'low' | 'medium' | 'high';
  description: string;
  status: 'open' | 'investigating' | 'resolved';
  resolutionNote?: string;
  createdAt: string;
  resolvedAt?: string;
}

export interface DisputeRecord {
  id: string;
  bookingId: string;
  paymentOrderId?: string;
  raisedBy: string;
  reason: string;
  requestedRefundInr: number;
  status: 'open' | 'under_review' | 'refunded' | 'dismissed';
  adminNote?: string;
  createdAt: string;
  resolvedAt?: string;
}

export interface UserReportRecord {
  id: string;
  reportedEntity: string;
  reporterName: string;
  reason: string;
  status: 'open' | 'warned' | 'suspended' | 'dismissed';
  moderatorNote?: string;
  createdAt: string;
}

export interface DriverNotification {
  id: string;
  driverEmail?: string;
  driverName: string;
  bookingId: string;
  type:
    | 'slot_withdrawn'
    | 'host_block_exception'
    | 'extension_update'
    | 'extension_offer'
    | 'payment_update'
    | 'low_balance'
    | 'late_arrival'
    | 'overstay_alert'
    | 'overstay_impact';
  title: string;
  message: string;
  resolutionOptions?: string[];
  read: boolean;
  createdAt: string;
}

export interface WalletLedgerItem {
  id: string;
  timestamp: string;
  type:
    | 'top_up'
    | 'booking_charge'
    | 'extension_settlement'
    | 'overstay_settlement'
    | 'refund_credit'
    | 'unpaid_due';
  description: string;
  amountInr: number;
  balanceAfterInr: number;
  bookingId?: string;
}

export interface PrepaidWallet {
  driverEmail: string;
  driverName: string;
  balanceInr: number;
  unpaidDueInr: number;
  bookingRestricted: boolean;
  lowBalanceNotified: boolean;
  updatedAt: string;
  ledger: WalletLedgerItem[];
}

export interface AutonomousLifecycleStep {
  stepNumber: number;
  agentName: string;
  action: string;
  detail: string;
  status: 'done' | 'warning' | 'action_required';
}

export interface AutonomousLifecycleEvent {
  id: string;
  bookingId: string;
  spaceId: string;
  spaceCode: string;
  facilityName: string;
  trigger:
    | 'entry_scan'
    | 'time_expiry_monitor'
    | 'offer_response'
    | 'departure_signal'
    | 'departure_confirmed'
    | 'buffer_completed';
  createdAt: string;
  outcomeSummary: string;
  resultingOccupancyState: SpaceOccupancyState;
  executionMode: 'openrouter_llm' | 'deterministic_service';
  steps: AutonomousLifecycleStep[];
}

export interface AdminAnalytics {
  totalGmvInr: number;
  platformRevenueInr: number;
  totalRefundedInr: number;
  totalSettledHostInr: number;
  approvedProviders: number;
  pendingProviders: number;
  approvedSpaces: number;
  pendingSpaces: number;
  activeBookings: number;
  duplicateWebhooksBlocked: number;
  openIncidents: number;
  openDisputes: number;
  expiringProviders: number;
}

export interface ConstraintCheck {
  constraint: string;
  passed: boolean;
  detail: string;
  evidenceRef: string;
}

export interface CandidateEvaluation {
  spaceId: string;
  facilityId: string;
  facilityName: string;
  spaceCode: string;
  providerType: ProviderType;
  verificationStatus: VerificationStatus;
  eligible: boolean;
  rejectionReasons: string[];
  constraintChecks: ConstraintCheck[];
  walkingDistanceM: number;
  walkingMinutes: number;
  entranceLabel: string;
  hourlyPriceInr: number;
  durationHours?: number;
  baseAmountInr?: number;
  platformFeeInr?: number;
  gstInr?: number;
  totalQuoteInr: number;
  score: number;
  scoreBreakdown: {
    distanceFit: number;
    priceFit: number;
    safetyAmenityFit: number;
    reviewFit: number;
    availabilityFit: number;
  };
  covered: boolean;
  evCharging: boolean;
  avgRating: number;
  reviewCount: number;
  evidenceSummary: string;
  restrictions?: string[];
  lateArrivalSummary?: string;
}

export type SupervisorVerdict = 'VERIFIED' | 'FLAGGED_AND_CORRECTED' | 'REJECTED';

export interface SupervisorAudit {
  verdict: SupervisorVerdict;
  accuracyScore: number;
  invariantsChecked: string[];
  violationsCaught: string[];
  correctiveAction: string;
  verifierNotes: string;
  checkedAtIso: string;
}

export interface AgentStageResult {
  stageOrder: number;
  agentId: string;
  agentName: string;
  roleDescription: string;
  executionMode: 'openrouter_llm' | 'deterministic_service' | 'hybrid_optimizer';
  status: 'completed' | 'corrected' | 'blocked';
  latencyMs: number;
  outputSummary: string;
  structuredData: Record<string, unknown>;
  evidenceRefs: string[];
  supervisorAudit: SupervisorAudit;
}

export interface MultiAgentWorkflowRun {
  runId: string;
  prompt: string;
  requestedStartMin: number;
  requestedEndMin: number;
  vehicle: VehicleProfile;
  faultInjectionEnabled: boolean;
  overallStatus: 'verified_ready' | 'action_blocked' | 'corrected_and_verified';
  totalLatencyMs: number;
  parsedIntent: {
    destination: string;
    startTimeLabel: string;
    endTimeLabel: string;
    prioritize: 'balanced' | 'closest_walk' | 'lowest_price' | 'covered_ev';
    maxWalkMeters: number;
    needsEv: boolean;
    needsCovered: boolean;
    policyConcern?: string;
  };
  stages: AgentStageResult[];
  recommendedCandidates: CandidateEvaluation[];
  excludedCandidates: CandidateEvaluation[];
  supervisorFinalReport: string;
  humanApprovalRequired: boolean;
}

export type AgentStreamEvent =
  | {
      type: 'workflow_init';
      runId: string;
      vehicle: VehicleProfile;
      faultInjectionEnabled: boolean;
    }
  | {
      type: 'stage_start';
      stageOrder: number;
      agentId: string;
      agentName: string;
      message: string;
    }
  | {
      type: 'supervisor_check';
      stageOrder: number;
      agentId: string;
      verdict: SupervisorVerdict;
      message: string;
      violations: string[];
    }
  | {
      type: 'stage_complete';
      stage: AgentStageResult;
    }
  | {
      type: 'workflow_complete';
      run: MultiAgentWorkflowRun;
    }
  | {
      type: 'workflow_error';
      error: string;
    };

export interface PoolingStrategyMetrics {
  strategy: string;
  label: string;
  matchRatePct: number;
  utilizationPct: number;
  avgWalkMeters: number;
  conflictRatePer1k: number;
  hardViolations: number;
  computeMs: number;
  allocations: Array<{
    requestId: string;
    driverTag: string;
    spaceId: string;
    spaceCode: string;
    startMin: number;
    endMin: number;
    bufferEndMin: number;
    status: 'assigned' | 'unassigned';
  }>;
}

export interface BengaluruLocation {
  id: string;
  name: string;
  area: string;
  lat: number;
  lng: number;
  source?: 'hub' | 'nominatim' | 'geocoded';
}

export interface WorkspaceSnapshot {
  pilotZone: string;
  destinationName: string;
  destinationCoords: { lat: number; lng: number };
  locations: BengaluruLocation[];
  vehicles: VehicleProfile[];
  driverProfiles: DriverProfile[];
  providers: ProviderRecord[];
  evidenceChecklists: Record<DetailedProviderType, EvidenceRequirement[]>;
  facilities: Facility[];
  spaces: ParkingSpace[];
  bookings: BookingRecord[];
  paymentOrders: PaymentOrder[];
  webhookEvents: PaymentWebhookEvent[];
  refunds: RefundRecord[];
  settlements: HostSettlementRecord[];
  transactions: TransactionHistoryItem[];
  incidents: IncidentRecord[];
  disputes: DisputeRecord[];
  userReports: UserReportRecord[];
  notifications: DriverNotification[];
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
}
