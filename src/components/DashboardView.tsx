import React, { useState } from 'react';
import {
  ArrowCounterClockwise,
  Bell,
  Calendar,
  CheckCircle,
  Clock,
  ClockCounterClockwise,
  CurrencyInr,
  FileText,
  MapPin,
  NavigationArrow,
  QrCode,
  Robot,
  Scan,
  ShieldCheck,
  ShieldWarning,
  Star,
  Wallet,
  X,
  XCircle,
} from '@phosphor-icons/react';
import {
  AutonomousLifecycleEvent,
  BengaluruLocation,
  BookingRecord,
  DisputeRecord,
  DriverNotification,
  DriverProfile,
  ExtensionAlternative,
  Facility,
  ParkingSpace,
  PaymentOrder,
  PrepaidWallet,
  RefundRecord,
  UserSession,
} from '../types/parkpool';
import { GoogleParkingMap } from './GoogleParkingMap';
import { QrCheckinScannerModal } from './QrCheckinScannerModal';
import { WallQrScannerModal } from './WallQrScannerModal';

interface DashboardViewProps {
  user: UserSession;
  bookings: BookingRecord[];
  facilities: Facility[];
  spaces: ParkingSpace[];
  locations: BengaluruLocation[];
  paymentOrders: PaymentOrder[];
  refunds: RefundRecord[];
  disputes: DisputeRecord[];
  notifications: DriverNotification[];
  driverProfile?: DriverProfile;
  wallet?: PrepaidWallet;
  lifecycleEvents: AutonomousLifecycleEvent[];
  onBookingAction: (
    bookingId: string,
    action: 'checkin' | 'checkout' | 'cancel',
    arrivalMinutesLate?: number
  ) => Promise<void>;
  onResolveOverstayImpact: (
    bookingId: string,
    choice: 'reschedule' | 'refund_with_credit'
  ) => Promise<void>;
  onRequestExtension: (
    bookingId: string,
    additionalMinutes: number
  ) => Promise<{ ok: boolean; alternatives?: ExtensionAlternative[] }>;
  onResolveWithdrawal: (bookingId: string, choice: 'rebook' | 'refund') => Promise<void>;
  onSubmitReview: (bookingId: string, rating: number, comment: string) => Promise<void>;
  onRaiseDispute: (payload: {
    bookingId: string;
    reason: string;
    requestedRefundInr: number;
  }) => Promise<void>;
  onMarkNotificationRead: (id: string) => Promise<void>;
  onTopUpWallet: (amountInr: number) => Promise<void>;
  onPayWithWallet: (bookingId: string) => Promise<BookingRecord | null>;
  onRespondExtensionOffer: (
    bookingId: string,
    offerId: string,
    decision: 'accept' | 'decline'
  ) => Promise<void>;
  onSendDepartureSignal: (
    bookingId: string,
    signalType: 'im_leaving_button' | 'geofence_exit',
    distanceFromGateM?: number
  ) => Promise<void>;
  onConfirmDeparture: (bookingId: string) => Promise<void>;
  onCompleteClearance: (spaceId: string) => Promise<void>;
  onVerifyQrCheckin: (
    bookingId: string,
    payload: {
      scannedToken: string;
      scanMethod: 'camera' | 'upload' | 'gate_placard' | 'manual_token';
      arrivalMinutesLate: number;
    }
  ) => Promise<{ ok: boolean; error?: string }>;
  onFindParking: () => void;
  onOpenProfile: () => void;
}

function fmt12(min: number): string {
  const h24 = Math.floor(min / 60);
  const m = min % 60;
  const period = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

function friendlyStatusLabel(bk: BookingRecord): { label: string; colorClass: string } {
  if (bk.status === 'held') {
    return { label: 'Reserved, waiting for payment', colorClass: 'text-[#C83709]' };
  }
  if (bk.status === 'confirmed') {
    return {
      label: bk.paymentStatus === 'paid' ? 'Confirmed and paid' : 'Confirmed',
      colorClass: 'text-[#047857]',
    };
  }
  if (bk.status === 'checked-in' || bk.status === 'occupied') {
    return { label: 'Parked', colorClass: 'text-[#4338CA]' };
  }
  if (bk.status === 'completed') {
    return { label: 'Completed', colorClass: 'text-[#047857]' };
  }
  if (bk.status === 'expired') {
    return { label: 'Expired', colorClass: 'text-rose-700' };
  }
  return { label: 'Cancelled', colorClass: 'text-rose-700' };
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  user,
  bookings,
  facilities,
  spaces,
  locations,
  paymentOrders,
  refunds,
  disputes,
  notifications,
  driverProfile,
  wallet,
  lifecycleEvents,
  onBookingAction,
  onResolveOverstayImpact,
  onRequestExtension,
  onResolveWithdrawal,
  onSubmitReview,
  onRaiseDispute,
  onMarkNotificationRead,
  onTopUpWallet,
  onPayWithWallet,
  onRespondExtensionOffer,
  onSendDepartureSignal,
  onConfirmDeparture,
  onCompleteClearance,
  onVerifyQrCheckin,
  onFindParking,
  onOpenProfile,
}) => {
  const [navBookingId, setNavBookingId] = useState<string | null>(null);
  const [invoiceBookingId, setInvoiceBookingId] = useState<string | null>(null);
  const [fullQrBookingId, setFullQrBookingId] = useState<string | null>(null);
  const [wallScannerBookingId, setWallScannerBookingId] = useState<string | null>(null);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [extAlternatives, setExtAlternatives] = useState<
    Record<string, ExtensionAlternative[]>
  >({});
  const [disputeBookingId, setDisputeBookingId] = useState<string | null>(null);
  const [disputeReason, setDisputeReason] = useState('');
  const [disputeAmount, setDisputeAmount] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [walletBusy, setWalletBusy] = useState(false);
  const [showLedger, setShowLedger] = useState(false);
  const [pastFilter, setPastFilter] = useState<
    'all' | 'completed' | 'refunded' | 'cancelled'
  >('all');

  const isBookingRefunded = (b: BookingRecord) =>
    b.refundStatus === 'refunded' ||
    b.paymentStatus === 'refunded' ||
    b.paymentStatus === 'partially_refunded';

  const isPastBooking = (b: BookingRecord) =>
    b.status === 'completed' ||
    b.status === 'cancelled' ||
    b.status === 'expired' ||
    isBookingRefunded(b);

  const activeBookings = bookings.filter((b) => !isPastBooking(b));
  const pastBookings = bookings.filter(isPastBooking);

  const completedPastCount = pastBookings.filter(
    (b) => b.status === 'completed' && !isBookingRefunded(b)
  ).length;
  const refundedPastCount = pastBookings.filter(isBookingRefunded).length;
  const cancelledPastCount = pastBookings.filter(
    (b) => (b.status === 'cancelled' || b.status === 'expired') && !isBookingRefunded(b)
  ).length;

  const filteredPastBookings = pastBookings.filter((b) => {
    if (pastFilter === 'completed') {
      return b.status === 'completed' && !isBookingRefunded(b);
    }
    if (pastFilter === 'refunded') {
      return isBookingRefunded(b);
    }
    if (pastFilter === 'cancelled') {
      return (b.status === 'cancelled' || b.status === 'expired') && !isBookingRefunded(b);
    }
    return true;
  });

  const unreadNotifications = notifications.filter((n) => !n.read);
  const firstName = user.name.split(' ')[0];

  const handleExtensionClick = async (bkId: string, mins: number) => {
    setBusyId(bkId);
    try {
      const res = await onRequestExtension(bkId, mins);
      if (!res.ok && res.alternatives && res.alternatives.length > 0) {
        setExtAlternatives((prev) => ({ ...prev, [bkId]: res.alternatives! }));
      } else {
        setExtAlternatives((prev) => {
          const next = { ...prev };
          delete next[bkId];
          return next;
        });
      }
    } finally {
      setBusyId(null);
    }
  };

  const navBooking = bookings.find((b) => b.id === navBookingId);
  const navFacility = navBooking
    ? facilities.find((f) => f.id === navBooking.facilityId)
    : undefined;
  const invoiceBooking = bookings.find((b) => b.id === invoiceBookingId);
  const invoiceOrder = invoiceBooking?.paymentOrderId
    ? paymentOrders.find((o) => o.id === invoiceBooking.paymentOrderId)
    : undefined;
  const fullQrBooking = bookings.find((b) => b.id === fullQrBookingId);
  const fullQrFacility = fullQrBooking
    ? facilities.find((f) => f.id === fullQrBooking.facilityId)
    : undefined;
  const wallScannerBooking = bookings.find((b) => b.id === wallScannerBookingId);
  const wallScannerFacility = wallScannerBooking
    ? facilities.find((f) => f.id === wallScannerBooking.facilityId)
    : undefined;

  return (
    <div className="space-y-6">
      {/* Compact Header & Slim Summary Row */}
      <section className="rounded-2xl border border-black/[0.08] bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="heading-5 text-[#111827]">
              {firstName}&apos;s Booking History
            </h1>
            <p className="body-6 mt-1 text-[#4B5563]">
              Your active parking passes, entry QR codes, payments, and past trips in one place.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onOpenProfile}
              className="button-xsm flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-xl border border-black/[0.08] bg-[#F8F7F4] px-3 py-2 text-[#111827] transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:border-[#D93F0B] active:scale-[0.98]"
            >
              <ShieldCheck className="h-4 w-4 text-[#047857]" weight="fill" />
              <span>
                {driverProfile
                  ? `${driverProfile.plateNumber} · License ${driverProfile.licenseNumber}`
                  : 'Add license and vehicle'}
              </span>
            </button>
            <button
              type="button"
              onClick={onFindParking}
              className="button-xsm whitespace-nowrap shrink-0 rounded-xl bg-[#C83709] px-3 py-2 text-white shadow-sm transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-[#A62B05] active:scale-[0.98]"
            >
              Book a spot
            </button>
          </div>
        </div>

        {/* Reduced Compact Summary Strip */}
        <div className="mt-4 grid grid-cols-3 gap-3">
          <div className="flex items-center justify-between rounded-xl border border-[#FED7AA] bg-[#FFF5F0] px-3 py-2">
            <span className="caption-3 flex items-center gap-1.5 text-[#9A3412]">
              <Calendar className="h-3.5 w-3.5 shrink-0 text-[#C83709]" weight="bold" />
              <span className="truncate">Active</span>
            </span>
            <span className="title-3 font-mono font-semibold tabular-nums text-[#C83709]">
              {activeBookings.length}
            </span>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2">
            <span className="caption-3 flex items-center gap-1.5 text-[#3730A3]">
              <Clock className="h-3.5 w-3.5 shrink-0 text-[#4338CA]" weight="bold" />
              <span className="truncate">Completed</span>
            </span>
            <span className="title-3 font-mono font-semibold tabular-nums text-[#4338CA]">
              {completedPastCount}
            </span>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
            <span className="caption-3 flex items-center gap-1.5 text-[#065F46]">
              <CurrencyInr className="h-3.5 w-3.5 shrink-0 text-[#047857]" weight="bold" />
              <span className="truncate">Refunds</span>
            </span>
            <span className="title-3 font-mono font-semibold tabular-nums text-[#047857]">
              {refunds.length + disputes.length}
            </span>
          </div>
        </div>
      </section>

      {/* Prepaid Parking Balance Wallet */}
      {wallet && (
        <section className="rounded-2xl border border-black/[0.08] bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-[#047857]">
                <Wallet className="h-5 w-5" weight="bold" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="title-3 text-[#111827]">
                    Prepaid Parking Balance
                  </h2>
                  {wallet.bookingRestricted && (
                    <span className="caption-3 text-rose-700">
                      · Bookings paused (₹{wallet.unpaidDueInr} unpaid due)
                    </span>
                  )}
                </div>
                <p className="caption-5 text-[#4B5563]">
                  Used for instant bookings, accepted extension offers, and automatic overstay settlement.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="mr-2 text-right">
                <div className="caption-4 text-[#4B5563]">Available balance</div>
                <div className="heading-5 font-mono tabular-nums text-[#047857]">
                  ₹{wallet.balanceInr}
                </div>
              </div>
              {[200, 500, 1000].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  disabled={walletBusy}
                  onClick={async () => {
                    setWalletBusy(true);
                    try {
                      await onTopUpWallet(amt);
                    } finally {
                      setWalletBusy(false);
                    }
                  }}
                  className="button-xsm whitespace-nowrap shrink-0 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 font-mono text-[#047857] transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-emerald-100 active:scale-[0.98] disabled:opacity-50"
                >
                  +₹{amt}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setShowLedger((s) => !s)}
                className="button-xsm whitespace-nowrap shrink-0 rounded-xl border border-black/[0.08] bg-[#F8F7F4] px-3 py-2 text-[#111827] transition-colors duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-black/[0.04]"
              >
                {showLedger ? 'Hide ledger' : `Ledger (${wallet.ledger.length})`}
              </button>
            </div>
          </div>

          {wallet.bookingRestricted && (
            <div className="caption-4 mt-3 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-rose-900">
              <ShieldWarning className="h-4 w-4 shrink-0 text-rose-600" weight="fill" />
              <span>
                Your wallet has ₹{wallet.unpaidDueInr} in unpaid overstay charges. Add funds above to clear your balance and unlock new bookings.
              </span>
            </div>
          )}

          {showLedger && (
            <div className="mt-3 max-h-48 space-y-2 overflow-y-auto rounded-xl border border-black/[0.06] bg-[#F8F7F4] p-3">
              {wallet.ledger.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-black/[0.06] bg-white px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="caption-3 truncate text-[#111827]">{item.description}</div>
                    <div className="caption-5 text-[#4B5563]">
                      {new Date(item.timestamp).toLocaleString()} · Balance after: ₹{item.balanceAfterInr}
                    </div>
                  </div>
                  <span
                    className={`caption-3 shrink-0 font-mono tabular-nums ${
                      item.amountInr >= 0 ? 'text-[#047857]' : 'text-[#C83709]'
                    }`}
                  >
                    {item.amountInr >= 0 ? `+₹${item.amountInr}` : `Debit ₹${Math.abs(item.amountInr)}`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Important Schedule Updates */}
      {unreadNotifications.length > 0 && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
          <div className="title-4 mb-3 flex items-center gap-2 text-amber-950">
            <Bell className="h-4 w-4 text-amber-700" weight="fill" />
            <span>Important updates ({unreadNotifications.length})</span>
          </div>
          <div className="space-y-2">
            {unreadNotifications.map((ntf) => (
              <div
                key={ntf.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-white p-3"
              >
                <div className="space-y-0.5">
                  <div className="caption-3 text-[#111827]">{ntf.title}</div>
                  <div className="caption-5 text-[#4B5563]">{ntf.message}</div>
                </div>
                <button
                  type="button"
                  onClick={() => void onMarkNotificationRead(ntf.id)}
                  className="button-xsm whitespace-nowrap shrink-0 rounded-lg border border-black/[0.08] px-3 py-2 text-[#111827] transition-colors duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-black/[0.04]"
                >
                  Got it
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Active Reservations — Entry QR Revealed Only Upon Pressing Show QR Code */}
      <section className="rounded-2xl border border-black/[0.08] bg-white p-5 sm:p-6 shadow-sm">
        <h2 className="title-2 mb-4 text-[#111827]">
          Upcoming and Active Bookings
        </h2>

        {activeBookings.length === 0 ? (
          <div className="caption-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-black/[0.12] bg-[#F8F7F4] p-5 text-[#4B5563]">
            <span>You have no upcoming or ongoing parking bookings right now.</span>
            <button
              type="button"
              onClick={onFindParking}
              className="button-xsm whitespace-nowrap shrink-0 rounded-lg bg-[#111827] px-3 py-2 text-white transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-black active:scale-[0.98]"
            >
              Find parking
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {activeBookings.map((bk) => {
              const alts = extAlternatives[bk.id] || [];
              const isBusy = busyId === bk.id;
              const statusInfo = friendlyStatusLabel(bk);

              return (
                <div
                  key={bk.id}
                  className="rounded-xl border border-black/[0.08] bg-[#F8F7F4] p-4"
                >
                  <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                    {/* Left: Plain English Booking Summary */}
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="caption-4 flex flex-wrap items-center gap-2">
                        <span className={`caption-3 ${statusInfo.colorClass}`}>
                          {statusInfo.label}
                        </span>
                        <span aria-hidden="true" className="text-black/20">
                          ·
                        </span>
                        <span className="caption-3 text-[#111827]">
                          {fmt12(bk.startMin)} to {fmt12(bk.endMin)}
                        </span>
                        <span aria-hidden="true" className="text-black/20">
                          ·
                        </span>
                        <span className="caption-3 font-mono text-[#111827]">
                          ₹{bk.totalAmountInr}
                        </span>
                        {bk.refundStatus && bk.refundStatus !== 'none' && (
                          <>
                            <span aria-hidden="true" className="text-black/20">
                              ·
                            </span>
                            <span className="caption-3 text-[#047857]">
                              Refund {bk.refundStatus}
                              {bk.refundAmountInr ? ` (₹${bk.refundAmountInr})` : ''}
                            </span>
                          </>
                        )}
                      </div>

                      <div className="title-3 text-[#111827]">
                        {bk.facilityName} · Spot {bk.spaceCode}
                      </div>

                      <div className="caption-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-[#374151]">
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5 text-[#C83709]" weight="fill" />
                          {bk.entranceLabel}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>
                          {bk.vehicleLabel}
                          {bk.vehiclePlate ? ` (${bk.vehiclePlate})` : ''}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>
                          Spot access PIN:{' '}
                          <strong className="font-mono text-[#4338CA]">{bk.accessCode}</strong>
                        </span>
                      </div>

                      <div className="caption-5 rounded-lg border border-black/[0.06] bg-white px-3 py-2 text-[#374151]">
                        <span className="caption-3 text-[#111827]">Price breakdown: </span>
                        <span className="font-mono">
                          Parking ₹{bk.baseAmountInr} + Service fee ₹{bk.platformFeeInr} + GST ₹
                          {bk.gstInr} = <strong className="text-[#111827]">₹{bk.totalAmountInr}</strong>
                        </span>
                      </div>

                      <p className="caption-5 text-[#4B5563]">
                        {bk.status === 'held'
                          ? 'Complete payment within 10 minutes to lock this spot.'
                          : 'Tap Show QR Code when arriving at your spot, or tap Scan Spot Wall QR if no attendant is present.'}
                      </p>

                      {bk.overstayStatus === 'flagged_overstay' && (
                        <div className="caption-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-900">
                          <strong>Overstay fee applied:</strong> You stayed past your booked time
                          (+₹{bk.overstayPenaltyInr}). Please exit the spot as soon as possible.
                        </div>
                      )}

                      {bk.overstayResolution && (
                        <div className="caption-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-emerald-950">
                          <span>
                            <strong>Spot protection active:</strong> {bk.overstayResolution.detail}
                          </span>
                          {bk.overstayResolution.status === 'choice_required' && (
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => void onResolveOverstayImpact(bk.id, 'reschedule')}
                                className="button-xsm rounded-md bg-[#047857] px-3 py-2 text-white"
                              >
                                Move time (free)
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  void onResolveOverstayImpact(bk.id, 'refund_with_credit')
                                }
                                className="button-xsm rounded-md border border-emerald-400 bg-white px-3 py-2 text-[#047857]"
                              >
                                Full refund + ₹50 credit
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {bk.hostExceptionFlagged && (
                        <div className="caption-4 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-indigo-900">
                          Your confirmed booking remains protected while we check a host schedule update.
                        </div>
                      )}

                      {bk.withdrawalResolution && (
                        <div className="caption-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-950">
                          <span>
                            <strong>Parking host cancelled this slot:</strong>{' '}
                            {bk.withdrawalResolution.status === 'affected'
                              ? 'Choose how you would like to proceed:'
                              : bk.withdrawalResolution.resolvedOption}
                          </span>
                          {bk.withdrawalResolution.status === 'affected' && (
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => void onResolveWithdrawal(bk.id, 'rebook')}
                                className="button-xsm rounded-md bg-[#047857] px-3 py-2 text-white"
                              >
                                Move nearby (free)
                              </button>
                              <button
                                type="button"
                                onClick={() => void onResolveWithdrawal(bk.id, 'refund')}
                                className="button-xsm rounded-md border border-rose-300 bg-white px-3 py-2 text-rose-700"
                              >
                                Full refund
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {bk.extensionRequests.length > 0 && (
                        <div className="space-y-1 pt-1">
                          {bk.extensionRequests.map((ext) => (
                            <div
                              key={ext.id}
                              className="caption-4 rounded-lg border border-black/[0.06] bg-white px-3 py-2 text-[#374151]"
                            >
                              Extra time until <strong>{fmt12(ext.requestedEndMin)}</strong> (+₹
                              {ext.additionalTotalInr}):{' '}
                              <strong
                                className={
                                  ext.status === 'approved'
                                    ? 'text-[#047857]'
                                    : ext.status === 'rejected'
                                    ? 'text-rose-700'
                                    : 'text-[#C83709]'
                                }
                              >
                                {ext.status === 'pending_host_approval'
                                  ? 'Waiting for host approval'
                                  : ext.status === 'approved'
                                  ? 'Approved'
                                  : 'Declined'}
                              </strong>
                            </div>
                          ))}
                        </div>
                      )}

                      {alts.length > 0 && (
                        <div className="caption-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-950">
                          <div className="caption-3">Nearby open spots available instead:</div>
                          <div className="mt-1 flex flex-wrap gap-2">
                            {alts.map((a) => (
                              <span key={a.spaceId}>
                                {a.facilityName} (Spot {a.spaceCode}) · ₹{a.hourlyPriceInr}/hr ·{' '}
                                {a.walkingDistanceM}m
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {(() => {
                        const pendingOffers = (bk.extensionOffers || []).filter(
                          (o) => o.status === 'pending_driver_acceptance'
                        );
                        return (
                          <>
                            {pendingOffers.map((offer) => (
                              <div
                                key={offer.id}
                                className="rounded-xl border-2 border-indigo-200 bg-indigo-50 p-3 text-indigo-950"
                              >
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <span className="caption-3 flex items-center gap-1.5">
                                    <Robot className="h-4 w-4 text-[#4338CA]" weight="bold" />
                                    Extension offer (+{offer.additionalMinutes}m until{' '}
                                    {fmt12(offer.requestedEndMin)}), ₹{offer.additionalTotalInr}
                                  </span>
                                  <span className="caption-4 font-mono text-[#4338CA]">
                                    Awaiting your acceptance
                                  </span>
                                </div>
                                <p className="caption-5 mt-1 text-[#374151]">
                                  {offer.pricingReason} {offer.providerApprovalNote}
                                </p>
                                <div className="mt-3 flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={async () => {
                                      setBusyId(bk.id);
                                      try {
                                        await onRespondExtensionOffer(bk.id, offer.id, 'accept');
                                      } finally {
                                        setBusyId(null);
                                      }
                                    }}
                                    className="button-xsm rounded-lg bg-[#047857] px-3 py-2 text-white hover:bg-[#065F46] disabled:opacity-50"
                                  >
                                    Accept and pay ₹{offer.additionalTotalInr} from Wallet
                                  </button>
                                  <button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={async () => {
                                      setBusyId(bk.id);
                                      try {
                                        await onRespondExtensionOffer(bk.id, offer.id, 'decline');
                                      } finally {
                                        setBusyId(null);
                                      }
                                    }}
                                    className="button-xsm rounded-lg border border-black/[0.1] bg-white px-3 py-2 text-[#374151] hover:bg-black/[0.04]"
                                  >
                                    Decline and leave now
                                  </button>
                                </div>
                              </div>
                            ))}
                          </>
                        );
                      })()}

                      {/* Action Buttons */}
                      <div className="flex flex-wrap items-center gap-2 pt-2">
                        {bk.status === 'held' && (
                          <>
                            <button
                              type="button"
                              disabled={
                                isBusy ||
                                Boolean(wallet?.bookingRestricted) ||
                                (wallet ? wallet.balanceInr < bk.totalAmountInr : false)
                              }
                              onClick={async () => {
                                setBusyId(bk.id);
                                try {
                                  await onPayWithWallet(bk.id);
                                } finally {
                                  setBusyId(null);
                                }
                              }}
                              className="button-xsm flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg bg-[#047857] px-3 py-2 text-white transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-[#065F46] active:scale-[0.98] disabled:opacity-50"
                            >
                              <Wallet className="h-3.5 w-3.5" weight="bold" />
                              <span>Pay ₹{bk.totalAmountInr} via Wallet</span>
                            </button>
                            {wallet &&
                              (wallet.bookingRestricted || wallet.balanceInr < bk.totalAmountInr) && (
                                <button
                                  type="button"
                                  disabled={walletBusy}
                                  onClick={async () => {
                                    setWalletBusy(true);
                                    try {
                                      await onTopUpWallet(500);
                                    } finally {
                                      setWalletBusy(false);
                                    }
                                  }}
                                  className="button-xsm whitespace-nowrap shrink-0 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-[#047857] hover:bg-emerald-100 disabled:opacity-50"
                                >
                                  + Add ₹500 to Wallet
                                </button>
                              )}
                          </>
                        )}

                        {(bk.status === 'confirmed' ||
                          bk.status === 'checked-in' ||
                          bk.status === 'occupied') && (
                          <>
                            {bk.status === 'confirmed' && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => void onBookingAction(bk.id, 'checkin')}
                                  className="button-xsm flex items-center gap-1 whitespace-nowrap shrink-0 rounded-lg bg-[#111827] px-3 py-2 text-white transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-black active:scale-[0.98]"
                                >
                                  <CheckCircle className="h-3.5 w-3.5 text-emerald-400" weight="fill" />
                                  <span>Arrived and check in</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setWallScannerBookingId(bk.id)}
                                  className="button-xsm flex items-center gap-1 whitespace-nowrap shrink-0 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-[#4338CA] transition-colors duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-indigo-100"
                                >
                                  <Scan className="h-3.5 w-3.5" weight="bold" />
                                  <span>Scan Spot Wall QR</span>
                                </button>
                              </>
                            )}
                            <button
                              type="button"
                              onClick={() => setFullQrBookingId(bk.id)}
                              className="button-xsm flex items-center gap-1 whitespace-nowrap shrink-0 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-[#047857] hover:bg-emerald-50"
                            >
                              <QrCode className="h-3.5 w-3.5" weight="bold" />
                              <span>Show QR code</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setNavBookingId(bk.id)}
                              className="button-xsm flex items-center gap-1 whitespace-nowrap shrink-0 rounded-lg border border-indigo-200 bg-white px-3 py-2 text-[#4338CA] hover:bg-indigo-50"
                            >
                              <NavigationArrow className="h-3.5 w-3.5" weight="fill" />
                              <span>Parking spot directions</span>
                            </button>
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => void handleExtensionClick(bk.id, 30)}
                              className="button-xsm whitespace-nowrap shrink-0 rounded-lg border border-black/[0.1] bg-white px-3 py-2 text-[#111827] hover:bg-black/[0.03]"
                            >
                              Add 30 mins
                            </button>
                            <button
                              type="button"
                              onClick={() => void onConfirmDeparture(bk.id)}
                              className="button-xsm whitespace-nowrap shrink-0 rounded-lg bg-[#047857] px-3 py-2 text-white hover:bg-[#065F46]"
                            >
                              Finish and exit
                            </button>
                          </>
                        )}

                        <button
                          type="button"
                          onClick={() => setInvoiceBookingId(bk.id)}
                          className="button-xsm flex items-center gap-1 whitespace-nowrap shrink-0 rounded-lg border border-black/[0.08] bg-white px-3 py-2 text-[#111827] hover:bg-black/[0.03]"
                        >
                          <FileText className="h-3.5 w-3.5 text-[#047857]" weight="bold" />
                          <span>Receipt</span>
                        </button>

                        {bk.paymentStatus === 'paid' && bk.refundStatus !== 'refunded' && (
                          <button
                            type="button"
                            onClick={() => {
                              setDisputeBookingId(disputeBookingId === bk.id ? null : bk.id);
                              setDisputeAmount(bk.totalAmountInr);
                            }}
                            className="button-xsm whitespace-nowrap shrink-0 rounded-lg border border-black/[0.08] bg-white px-3 py-2 text-[#4B5563] hover:text-[#111827]"
                          >
                            Request refund
                          </button>
                        )}

                        {bk.status !== 'completed' &&
                          bk.status !== 'cancelled' &&
                          bk.status !== 'expired' && (
                            <button
                              type="button"
                              onClick={() => void onBookingAction(bk.id, 'cancel')}
                              className="button-xsm whitespace-nowrap shrink-0 rounded-lg border border-rose-200 bg-white px-3 py-2 text-rose-600 hover:bg-rose-50"
                            >
                              Cancel
                            </button>
                          )}
                      </div>
                    </div>
                  </div>

                  {/* Inline Refund Dispute Box */}
                  {disputeBookingId === bk.id && (
                    <div className="mt-3 flex flex-col gap-2.5 rounded-lg border border-black/[0.08] bg-white p-3 sm:flex-row sm:items-center sm:gap-3">
                      <input
                        type="number"
                        min={10}
                        max={bk.totalAmountInr}
                        value={disputeAmount}
                        onChange={(e) => setDisputeAmount(Number(e.target.value))}
                        className="caption-4 w-28 rounded-lg border border-black/[0.1] bg-[#F8F7F4] px-2.5 py-2 font-mono text-[#111827]"
                      />
                      <input
                        type="text"
                        value={disputeReason}
                        onChange={(e) => setDisputeReason(e.target.value)}
                        placeholder="Briefly tell us why you need a refund..."
                        className="caption-4 w-full flex-1 rounded-lg border border-black/[0.1] bg-[#F8F7F4] px-3 py-2 text-[#111827]"
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          if (!disputeReason.trim()) return;
                          await onRaiseDispute({
                            bookingId: bk.id,
                            reason: disputeReason,
                            requestedRefundInr: disputeAmount,
                          });
                          setDisputeBookingId(null);
                          setDisputeReason('');
                        }}
                        className="button-xsm whitespace-nowrap shrink-0 rounded-lg bg-[#4338CA] px-3 py-2 text-white"
                      >
                        Send request
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Past Bookings & Historical Usage */}
      <section className="rounded-2xl border border-black/[0.08] bg-white p-5 sm:p-6 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="title-2 flex items-center gap-2 text-[#111827]">
              <ClockCounterClockwise className="h-5 w-5 text-[#4338CA]" weight="bold" />
              <h2>Past Bookings</h2>
            </div>
            <p className="caption-5 mt-1 text-[#4B5563]">
              Completed visits, refunded trips, and cancelled reservations.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1 rounded-xl border border-black/[0.08] bg-[#F8F7F4] p-1">
            {(
              [
                { id: 'all', label: `All (${pastBookings.length})` },
                { id: 'completed', label: `Completed (${completedPastCount})` },
                { id: 'refunded', label: `Refunded (${refundedPastCount})` },
                { id: 'cancelled', label: `Cancelled (${cancelledPastCount})` },
              ] as const
            ).map((tab) => {
              const active = pastFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setPastFilter(tab.id)}
                  className={`button-xsm whitespace-nowrap shrink-0 rounded-lg px-3 py-2 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                    active
                      ? 'bg-white text-[#111827] shadow-sm'
                      : 'text-[#4B5563] hover:text-[#111827]'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {filteredPastBookings.length === 0 ? (
          <div className="caption-4 rounded-xl border border-dashed border-black/[0.12] bg-[#F8F7F4] p-5 text-center text-[#4B5563]">
            No past bookings match this filter yet.
          </div>
        ) : (
          <div className="space-y-3">
            {filteredPastBookings.map((bk) => {
              const refunded = isBookingRefunded(bk);
              const statusMeta = refunded
                ? {
                    label:
                      bk.paymentStatus === 'partially_refunded'
                        ? 'Partially refunded'
                        : 'Refunded',
                    toneClass: 'border-teal-200 bg-teal-50 text-teal-800',
                    Icon: ArrowCounterClockwise,
                  }
                : bk.status === 'completed'
                ? {
                    label: 'Completed',
                    toneClass: 'border-emerald-200 bg-emerald-50 text-[#047857]',
                    Icon: CheckCircle,
                  }
                : {
                    label: bk.status === 'expired' ? 'Expired' : 'Cancelled',
                    toneClass: 'border-rose-200 bg-rose-50 text-rose-700',
                    Icon: XCircle,
                  };
              const StatusIcon = statusMeta.Icon;

              return (
                <div
                  key={bk.id}
                  className="rounded-xl border border-black/[0.08] bg-[#F8F7F4] p-4"
                >
                  <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
                    <div className="space-y-1">
                      <div className="caption-4 flex flex-wrap items-center gap-2">
                        <span
                          className={`caption-3 inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 ${statusMeta.toneClass}`}
                        >
                          <StatusIcon className="h-3.5 w-3.5 shrink-0" weight="fill" />
                          <span>{statusMeta.label}</span>
                        </span>
                        <span className="text-[#374151]">
                          {new Date(bk.createdAt).toLocaleDateString()} · {fmt12(bk.startMin)} to{' '}
                          {fmt12(bk.endMin)}
                        </span>
                        {refunded && (
                          <span className="font-mono font-semibold text-teal-700">
                            · Refunded ₹{bk.refundAmountInr ?? bk.totalAmountInr}
                          </span>
                        )}
                      </div>

                      <div className="title-4 text-[#111827]">
                        {bk.facilityName} · Spot {bk.spaceCode}
                      </div>

                      <div className="caption-5 flex flex-wrap items-center gap-3 text-[#4B5563]">
                        <span>
                          {bk.vehicleLabel}
                          {bk.vehiclePlate ? ` (${bk.vehiclePlate})` : ''}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono text-[#374151]">
                          Parking ₹{bk.baseAmountInr} + Fee ₹{bk.platformFeeInr} + GST ₹{bk.gstInr} ={' '}
                          <strong className="font-semibold text-[#111827]">₹{bk.totalAmountInr}</strong>
                        </span>
                        {(bk.extraHoursChargedInr || 0) > 0 && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono font-semibold text-amber-800">
                              + Extra hours: ₹{bk.extraHoursChargedInr}
                              {bk.extraMinutesCharged ? ` (+${bk.extraMinutesCharged}m)` : ''} (Grand total: ₹
                              {bk.totalAmountInr + (bk.extraHoursChargedInr || 0)})
                            </span>
                          </>
                        )}
                        {bk.status === 'completed' &&
                          typeof bk.remainingBalanceAfterCheckoutInr === 'number' && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono font-semibold text-[#047857]">
                                Remaining wallet balance: ₹{bk.remainingBalanceAfterCheckoutInr}
                              </span>
                            </>
                          )}
                        {bk.status === 'completed' && (bk.unpaidDueAfterCheckoutInr || 0) > 0 && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono font-semibold text-rose-700">
                              Unpaid due: ₹{bk.unpaidDueAfterCheckoutInr}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setInvoiceBookingId(bk.id)}
                        className="button-xsm flex items-center gap-1 whitespace-nowrap shrink-0 rounded-lg border border-black/[0.08] bg-white px-3 py-2 text-[#111827] hover:bg-black/[0.03]"
                      >
                        <FileText className="h-3.5 w-3.5 text-[#047857]" weight="bold" />
                        <span>Receipt</span>
                      </button>

                      {bk.status === 'completed' && (
                        <button
                          type="button"
                          onClick={() => setReviewingId(reviewingId === bk.id ? null : bk.id)}
                          className="button-xsm flex items-center gap-1 whitespace-nowrap shrink-0 rounded-lg border border-black/[0.1] bg-white px-3 py-2 text-[#111827] hover:border-[#D93F0B]"
                        >
                          <Star className="h-3.5 w-3.5 text-amber-500" weight="fill" />
                          <span>Rate stay</span>
                        </button>
                      )}

                      {bk.paymentStatus === 'paid' && !refunded && (
                        <button
                          type="button"
                          onClick={() => {
                            setDisputeBookingId(disputeBookingId === bk.id ? null : bk.id);
                            setDisputeAmount(bk.totalAmountInr);
                          }}
                          className="button-xsm whitespace-nowrap shrink-0 rounded-lg border border-black/[0.08] bg-white px-3 py-2 text-[#4B5563] hover:text-[#111827]"
                        >
                          Request refund
                        </button>
                      )}
                    </div>
                  </div>

                  {reviewingId === bk.id && (
                    <div className="mt-3 flex flex-col gap-2.5 rounded-lg border border-black/[0.08] bg-white p-3 sm:flex-row sm:items-center sm:gap-3">
                      <select
                        value={rating}
                        onChange={(e) => setRating(Number(e.target.value))}
                        className="caption-3 rounded-lg border border-black/[0.1] bg-[#F8F7F4] px-2.5 py-2 text-[#111827]"
                      >
                        {[5, 4, 3, 2, 1].map((n) => (
                          <option key={n} value={n}>
                            {n} Stars
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        placeholder="How was the entrance and parking experience?"
                        className="caption-4 w-full flex-1 rounded-lg border border-black/[0.1] bg-[#F8F7F4] px-3 py-2 text-[#111827]"
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          await onSubmitReview(bk.id, rating, comment);
                          setReviewingId(null);
                          setComment('');
                        }}
                        className="button-xsm flex items-center justify-center gap-1 rounded-lg bg-[#C83709] px-3 py-2 text-white hover:bg-[#A62B05]"
                      >
                        <CheckCircle className="h-3.5 w-3.5" weight="fill" />
                        <span>Post review</span>
                      </button>
                    </div>
                  )}

                  {disputeBookingId === bk.id && (
                    <div className="mt-3 flex flex-col gap-2.5 rounded-lg border border-black/[0.08] bg-white p-3 sm:flex-row sm:items-center sm:gap-3">
                      <input
                        type="number"
                        min={10}
                        max={bk.totalAmountInr}
                        value={disputeAmount}
                        onChange={(e) => setDisputeAmount(Number(e.target.value))}
                        className="caption-4 w-28 rounded-lg border border-black/[0.1] bg-[#F8F7F4] px-2.5 py-2 font-mono text-[#111827]"
                      />
                      <input
                        type="text"
                        value={disputeReason}
                        onChange={(e) => setDisputeReason(e.target.value)}
                        placeholder="Tell us why you are requesting a refund..."
                        className="caption-4 w-full flex-1 rounded-lg border border-black/[0.1] bg-[#F8F7F4] px-3 py-2 text-[#111827]"
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          if (!disputeReason.trim()) return;
                          await onRaiseDispute({
                            bookingId: bk.id,
                            reason: disputeReason,
                            requestedRefundInr: disputeAmount,
                          });
                          setDisputeBookingId(null);
                          setDisputeReason('');
                        }}
                        className="button-xsm whitespace-nowrap shrink-0 rounded-lg bg-[#4338CA] px-3 py-2 text-white"
                      >
                        Send request
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Pop Up Modals */}
      {navBooking && navFacility && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/55 p-3 sm:p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Parking Spot Directions"
        >
          <div className="relative my-auto w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-2xl border-2 border-[#1A73E8] bg-white p-4 sm:p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3 pb-3">
              <div className="min-w-0">
                <div className="title-2 flex items-center gap-2 text-[#111827]">
                  <NavigationArrow className="h-4 w-4 shrink-0 text-[#1A73E8]" weight="fill" />
                  <span className="truncate">Parking spot directions · {navFacility.name}</span>
                </div>
                <p className="caption-5 mt-1 text-[#4B5563]">
                  {navFacility.address} ({navFacility.zone}) · Spot{' '}
                  <strong className="text-[#111827]">{navBooking.spaceCode}</strong> · Spot access PIN{' '}
                  <span className="font-mono font-semibold text-[#4338CA]">
                    {navBooking.accessCode}
                  </span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setNavBookingId(null)}
                aria-label="Close directions"
                className="shrink-0 rounded-lg border border-black/[0.08] p-2 text-[#4B5563] hover:text-[#111827]"
              >
                <X className="h-4 w-4" weight="bold" />
              </button>
            </div>

            <div className="mt-2">
              <GoogleParkingMap
                compact={true}
                destinationName={locations[0]?.name || 'Central Bengaluru Hub'}
                destinationCoords={{
                  lat: locations[0]?.lat ?? 12.9716,
                  lng: locations[0]?.lng ?? 77.5946,
                }}
                facilities={[navFacility]}
                selectedFacilityId={navFacility.id}
                onSelectFacility={() => {}}
                locations={locations}
                defaultTravelMode={
                  navBooking.vehicleLabel.toLowerCase().includes('ather') ||
                  navBooking.vehicleLabel.toLowerCase().includes('scooter') ||
                  navBooking.vehicleLabel.toLowerCase().includes('bike')
                    ? 'TWO_WHEELER'
                    : 'DRIVING'
                }
                directionsActive={true}
                liveTracking={false}
                bookedSpotCode={navBooking.spaceCode}
              />
            </div>

            <div className="caption-4 mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-black/[0.06] bg-[#F8F7F4] p-3.5">
                <div className="caption-3 text-[#4B5563]">Place and spot entrance</div>
                <div className="caption-3 mt-1 text-[#111827]">{navFacility.name}</div>
                <div className="mt-0.5 text-[#374151]">{navFacility.address}</div>
                <div className="caption-3 mt-1 text-[#C83709]">
                  Spot entrance: {navFacility.entranceLabel} · Spot {navBooking.spaceCode}
                </div>
              </div>
              <div className="rounded-xl border border-black/[0.06] bg-[#F8F7F4] p-3.5">
                <div className="caption-3 text-[#4B5563]">Spot entry and walk path</div>
                <div className="mt-1 text-[#111827]">{navFacility.accessInstructions}</div>
                <div className="caption-3 mt-1 text-[#047857]">
                  {navFacility.accessControl} · {navFacility.walkPathSafety}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {invoiceBooking && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-3 sm:p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Payment Receipt"
        >
          <div className="relative my-auto w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border-2 border-[#047857] bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3 pb-3">
              <div>
                <div className="title-3 flex items-center gap-2 text-[#111827]">
                  <FileText className="h-4 w-4 text-[#047857]" weight="bold" />
                  <span>Payment receipt</span>
                </div>
                <p className="caption-5 mt-0.5 text-[#4B5563]">
                  {invoiceBooking.facilityName} · Spot {invoiceBooking.spaceCode}
                  {invoiceBooking.invoiceNumber ? ` · ${invoiceBooking.invoiceNumber}` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInvoiceBookingId(null)}
                aria-label="Close receipt"
                className="rounded-lg border border-black/[0.08] p-2 text-[#4B5563] hover:text-[#111827]"
              >
                <X className="h-4 w-4" weight="bold" />
              </button>
            </div>
            <div className="caption-4 mt-3 space-y-2 rounded-xl border border-black/[0.06] bg-[#F8F7F4] p-4">
              <div className="flex justify-between">
                <span className="text-[#4B5563]">
                  Parking charge ({fmt12(invoiceBooking.startMin)} to {fmt12(invoiceBooking.endMin)})
                </span>
                <span className="font-mono font-semibold text-[#111827]">
                  ₹{invoiceBooking.baseAmountInr}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#4B5563]">Service and platform fee (10%, min ₹10)</span>
                <span className="font-mono font-semibold text-[#111827]">
                  ₹{invoiceBooking.platformFeeInr}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#4B5563]">Taxes (GST 18%)</span>
                <span className="font-mono font-semibold text-[#111827]">
                  ₹{invoiceBooking.gstInr}
                </span>
              </div>
              <div className="body-4 flex justify-between rounded-lg bg-white px-3 py-2 text-[#111827]">
                <span>
                  Subtotal paid (₹{invoiceBooking.baseAmountInr} + ₹{invoiceBooking.platformFeeInr} + ₹
                  {invoiceBooking.gstInr})
                </span>
                <span className="font-mono tabular-nums">₹{invoiceBooking.totalAmountInr}</span>
              </div>
              {(invoiceBooking.extraHoursChargedInr || 0) > 0 && (
                <>
                  <div className="caption-3 flex justify-between text-amber-800">
                    <span>
                      Extra hours deducted
                      {invoiceBooking.extraMinutesCharged
                        ? ` (+${invoiceBooking.extraMinutesCharged}m)`
                        : ''}
                    </span>
                    <span className="font-mono tabular-nums">
                      +₹{invoiceBooking.extraHoursChargedInr}
                    </span>
                  </div>
                  <div className="body-4 flex justify-between rounded-lg bg-white px-3 py-2 text-[#111827]">
                    <span>Total deducted from wallet</span>
                    <span className="font-mono tabular-nums">
                      ₹{invoiceBooking.totalAmountInr + (invoiceBooking.extraHoursChargedInr || 0)}
                    </span>
                  </div>
                </>
              )}
              {typeof invoiceBooking.remainingBalanceAfterCheckoutInr === 'number' && (
                <div className="caption-3 flex justify-between text-[#047857]">
                  <span>Remaining wallet balance after checkout</span>
                  <span className="font-mono tabular-nums">
                    ₹{invoiceBooking.remainingBalanceAfterCheckoutInr}
                  </span>
                </div>
              )}
              {invoiceOrder && (
                <div className="caption-5 pt-1 text-[#047857]">
                  Payment reference: {invoiceOrder.gatewayOrderRef}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {fullQrBooking && (
        <QrCheckinScannerModal
          booking={fullQrBooking}
          facility={fullQrFacility}
          onClose={() => setFullQrBookingId(null)}
        />
      )}

      {wallScannerBooking && (
        <WallQrScannerModal
          booking={wallScannerBooking}
          facility={wallScannerFacility}
          onVerifyCheckin={onVerifyQrCheckin}
          onClose={() => setWallScannerBookingId(null)}
        />
      )}
    </div>
  );
};
