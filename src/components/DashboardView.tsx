import React, { useState } from 'react';
import {
  Bell,
  Bot,
  CalendarClock,
  CheckCircle2,
  Clock,
  FileText,
  History,
  IndianRupee,
  LogOut,
  MapPin,
  Navigation,
  QrCode,
  Radio,
  RotateCcw,
  ScanLine,
  ShieldAlert,
  ShieldCheck,
  Star,
  Wallet,
  X,
  XCircle,
} from 'lucide-react';
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
    return { label: 'Reserved — Waiting for Payment', colorClass: 'text-[#C83709]' };
  }
  if (bk.status === 'confirmed') {
    return {
      label: bk.paymentStatus === 'paid' ? 'Confirmed & Paid' : 'Confirmed',
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
  const [gpsWatchBookingId, setGpsWatchBookingId] = useState<string | null>(null);
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
    <div className="space-y-5">
      {/* Compact Header & Slim Summary Row */}
      <section className="rounded-2xl border border-black/[0.08] bg-white/92 p-5 shadow-sm backdrop-blur-md">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-[#111827]">
              {firstName}&apos;s Booking History
            </h1>
            <p className="mt-0.5 text-sm text-[#4B5563]">
              Your active parking passes, entry QR codes, payments, and past trips in one place.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={onOpenProfile}
              className="flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-xl border border-black/[0.08] bg-[#F8F7F4] px-3.5 py-2 text-xs font-semibold text-[#111827] transition-colors hover:border-[#D93F0B]"
            >
              <ShieldCheck className="h-4 w-4 text-[#047857]" />
              <span>
                {driverProfile
                  ? `${driverProfile.plateNumber} · License ${driverProfile.licenseNumber}`
                  : 'Add License & Vehicle'}
              </span>
            </button>
            <button
              type="button"
              onClick={onFindParking}
              className="whitespace-nowrap shrink-0 rounded-xl bg-gradient-to-r from-[#E0430D] to-[#C83709] px-4 py-2 text-xs font-bold text-white shadow-sm transition-all hover:brightness-110"
            >
              Book a Spot
            </button>
          </div>
        </div>

        {/* Reduced Compact Summary Strip */}
        <div className="mt-4 grid grid-cols-3 gap-2.5">
          <div className="flex items-center justify-between rounded-xl border border-[#FED7AA] bg-[#FFF5F0] px-3 py-2">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-[#9A3412]">
              <CalendarClock className="h-3.5 w-3.5 shrink-0 text-[#C83709]" />
              <span className="truncate">Active</span>
            </span>
            <span className="font-mono text-base font-bold tabular-nums text-[#C83709]">
              {activeBookings.length}
            </span>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-indigo-200/80 bg-indigo-50/75 px-3 py-2">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-[#3730A3]">
              <Clock className="h-3.5 w-3.5 shrink-0 text-[#4338CA]" />
              <span className="truncate">Completed</span>
            </span>
            <span className="font-mono text-base font-bold tabular-nums text-[#4338CA]">
              {completedPastCount}
            </span>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-emerald-200/80 bg-emerald-50/80 px-3 py-2">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-[#065F46]">
              <IndianRupee className="h-3.5 w-3.5 shrink-0 text-[#047857]" />
              <span className="truncate">Refunds</span>
            </span>
            <span className="font-mono text-base font-bold tabular-nums text-[#047857]">
              {refunds.length + disputes.length}
            </span>
          </div>
        </div>
      </section>

      {/* Prepaid Parking Balance Wallet */}
      {wallet && (
        <section className="rounded-2xl border border-black/[0.08] bg-white/92 p-5 shadow-sm backdrop-blur-md">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-[#047857]">
                <Wallet className="h-5 w-5" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-display text-base font-bold text-[#111827]">
                    Prepaid Parking Balance
                  </h2>
                  {wallet.bookingRestricted && (
                    <span className="text-xs font-bold text-rose-700">
                      · Bookings Paused (₹{wallet.unpaidDueInr} Unpaid Due)
                    </span>
                  )}
                </div>
                <p className="text-xs text-[#4B5563]">
                  Used for instant bookings, accepted extension offers, and automatic overstay settlement.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="mr-2 text-right">
                <div className="text-[11px] font-medium text-[#4B5563]">Available Balance</div>
                <div className="font-mono text-2xl font-extrabold tabular-nums text-[#047857]">
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
                  className="whitespace-nowrap shrink-0 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 font-mono text-xs font-bold text-[#047857] hover:bg-emerald-100 disabled:opacity-50"
                >
                  +₹{amt}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setShowLedger((s) => !s)}
                className="whitespace-nowrap shrink-0 rounded-xl border border-black/[0.08] bg-[#F8F7F4] px-3 py-2 text-xs font-semibold text-[#111827] hover:bg-black/[0.04]"
              >
                {showLedger ? 'Hide Ledger' : `Ledger (${wallet.ledger.length})`}
              </button>
            </div>
          </div>

          {wallet.bookingRestricted && (
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-900">
              <ShieldAlert className="h-4 w-4 shrink-0 text-rose-600" />
              <span>
                Your wallet has ₹{wallet.unpaidDueInr} in unpaid overstay charges. Add funds above to clear your balance and unlock new bookings.
              </span>
            </div>
          )}

          {showLedger && (
            <div className="mt-3 max-h-48 space-y-1.5 overflow-y-auto border-t border-black/[0.06] pt-3 text-xs">
              {wallet.ledger.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 rounded-lg bg-[#F8F7F4] px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-[#111827]">{item.description}</div>
                    <div className="text-[11px] text-[#4B5563]">
                      {new Date(item.timestamp).toLocaleString()} · Balance after: ₹{item.balanceAfterInr}
                    </div>
                  </div>
                  <span
                    className={`shrink-0 font-mono font-bold tabular-nums ${
                      item.amountInr >= 0 ? 'text-[#047857]' : 'text-[#C83709]'
                    }`}
                  >
                    {item.amountInr >= 0 ? `+₹${item.amountInr}` : `-₹${Math.abs(item.amountInr)}`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Important Schedule Updates */}
      {unreadNotifications.length > 0 && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50/90 p-4 shadow-sm">
          <div className="mb-2.5 flex items-center gap-2 font-display text-sm font-bold text-amber-950">
            <Bell className="h-4 w-4 text-amber-700" />
            <span>Important Updates ({unreadNotifications.length})</span>
          </div>
          <div className="space-y-2">
            {unreadNotifications.map((ntf) => (
              <div
                key={ntf.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200/80 bg-white p-3 text-xs"
              >
                <div className="space-y-0.5">
                  <div className="font-bold text-[#111827]">{ntf.title}</div>
                  <div className="text-[#4B5563]">{ntf.message}</div>
                </div>
                <button
                  type="button"
                  onClick={() => void onMarkNotificationRead(ntf.id)}
                  className="whitespace-nowrap shrink-0 rounded-lg border border-black/[0.08] px-3 py-1.5 text-xs font-semibold text-[#111827] hover:bg-black/[0.04]"
                >
                  Got it
                </button>
              </div>
            ))}
          </div>
        </section>
      )}


      {/* Active Reservations — Entry QR Revealed Only Upon Pressing Show QR Code */}
      <section className="rounded-2xl border border-black/[0.08] bg-white/92 p-5 sm:p-6 shadow-sm backdrop-blur-md">
        <h2 className="mb-4 font-display text-lg font-bold text-[#111827]">
          Upcoming &amp; Active Bookings
        </h2>

        {activeBookings.length === 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-black/[0.12] bg-[#F8F7F4]/80 p-5 text-xs text-[#4B5563]">
            <span>You have no upcoming or ongoing parking bookings right now.</span>
            <button
              type="button"
              onClick={onFindParking}
              className="whitespace-nowrap shrink-0 rounded-lg bg-[#111827] px-3.5 py-2 font-bold text-white hover:bg-black"
            >
              Find Parking
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
                  className="rounded-xl border border-black/[0.08] bg-[#F8F7F4]/90 p-4"
                >
                  <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                    {/* Left: Plain-English Booking Summary */}
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className={`font-bold ${statusInfo.colorClass}`}>
                          {statusInfo.label}
                        </span>
                        <span aria-hidden="true" className="text-black/20">
                          ·
                        </span>
                        <span className="font-semibold text-[#111827]">
                          {fmt12(bk.startMin)} – {fmt12(bk.endMin)}
                        </span>
                        <span aria-hidden="true" className="text-black/20">
                          ·
                        </span>
                        <span className="font-mono font-bold text-[#111827]">
                          ₹{bk.totalAmountInr}
                        </span>
                        {bk.refundStatus && bk.refundStatus !== 'none' && (
                          <>
                            <span aria-hidden="true" className="text-black/20">
                              ·
                            </span>
                            <span className="font-semibold text-[#047857]">
                              Refund {bk.refundStatus}
                              {bk.refundAmountInr ? ` (₹${bk.refundAmountInr})` : ''}
                            </span>
                          </>
                        )}
                      </div>

                      <div className="font-display text-base font-bold text-[#111827]">
                        {bk.facilityName} · Spot {bk.spaceCode}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#374151]">
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5 text-[#C83709]" />
                          {bk.entranceLabel}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>
                          {bk.vehicleLabel}
                          {bk.vehiclePlate ? ` (${bk.vehiclePlate})` : ''}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>
                          Spot Access PIN:{' '}
                          <strong className="font-mono text-[#4338CA]">{bk.accessCode}</strong>
                        </span>
                      </div>

                      <div className="rounded-lg border border-black/[0.06] bg-white px-3 py-1.5 text-[11px] text-[#374151]">
                        <span className="font-semibold text-[#111827]">Price Breakdown: </span>
                        <span className="font-mono">
                          Parking ₹{bk.baseAmountInr} + Service Fee ₹{bk.platformFeeInr} + GST ₹
                          {bk.gstInr} = <strong className="text-[#111827]">₹{bk.totalAmountInr}</strong>
                        </span>
                      </div>

                      <p className="text-xs text-[#4B5563]">
                        {bk.status === 'held'
                          ? 'Complete payment within 10 minutes to lock this spot.'
                          : 'Tap Show QR Code when arriving at your spot, or tap Scan Spot Wall QR if no attendant is present.'}
                      </p>

                      {bk.overstayStatus === 'flagged_overstay' && (
                        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-900">
                          <strong>Overstay Fee Applied:</strong> You stayed past your booked time
                          (+₹{bk.overstayPenaltyInr}). Please exit the spot as soon as possible.
                        </div>
                      )}

                      {bk.overstayResolution && (
                        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-2.5 text-xs text-emerald-950">
                          <span>
                            <strong>Spot Protection Active:</strong> {bk.overstayResolution.detail}
                          </span>
                          {bk.overstayResolution.status === 'choice_required' && (
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => void onResolveOverstayImpact(bk.id, 'reschedule')}
                                className="rounded-lg bg-[#047857] px-2.5 py-1 font-bold text-white"
                              >
                                Move Time (Free)
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  void onResolveOverstayImpact(bk.id, 'refund_with_credit')
                                }
                                className="rounded-lg border border-emerald-400 bg-white px-2.5 py-1 font-bold text-[#047857]"
                              >
                                Full Refund + ₹50 Credit
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {bk.hostExceptionFlagged && (
                        <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs text-indigo-900">
                          Your confirmed booking remains protected while we check a host schedule
                          update.
                        </div>
                      )}

                      {bk.withdrawalResolution && (
                        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-950">
                          <span>
                            <strong>Parking Host Cancelled This Slot:</strong>{' '}
                            {bk.withdrawalResolution.status === 'affected'
                              ? 'Choose how you would like to proceed:'
                              : bk.withdrawalResolution.resolvedOption}
                          </span>
                          {bk.withdrawalResolution.status === 'affected' && (
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => void onResolveWithdrawal(bk.id, 'rebook')}
                                className="rounded-lg bg-[#047857] px-2.5 py-1 font-bold text-white"
                              >
                                Move Nearby (Free)
                              </button>
                              <button
                                type="button"
                                onClick={() => void onResolveWithdrawal(bk.id, 'refund')}
                                className="rounded-lg border border-rose-300 bg-white px-2.5 py-1 font-bold text-rose-700"
                              >
                                Full Refund
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
                              className="rounded-lg border border-black/[0.06] bg-white px-3 py-1.5 text-xs text-[#374151]"
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
                        <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-950">
                          <div className="font-bold">Nearby Open Spots Available Instead:</div>
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
                        const linkedSpace = spaces.find((s) => s.id === bk.spaceId);
                        const occState = linkedSpace?.occupancyState;
                        return (
                          <>
                            {occState && (
                              <div className="rounded-lg border border-black/[0.08] bg-white px-3 py-2 text-xs">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <span className="font-semibold text-[#374151]">
                                    Live Bay State:{' '}
                                    <strong
                                      className={`font-mono ${
                                        occState === 'OVERSTAY'
                                          ? 'text-rose-700'
                                          : occState === 'DEPARTURE_PENDING'
                                          ? 'text-amber-700'
                                          : occState === 'CLEARANCE'
                                          ? 'text-[#4338CA]'
                                          : 'text-[#047857]'
                                      }`}
                                    >
                                      {occState}
                                    </strong>
                                  </span>
                                  {linkedSpace?.lastOccupancyEvent && (
                                    <span className="text-[11px] text-[#4B5563]">
                                      {linkedSpace.lastOccupancyEvent}
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}

                            {pendingOffers.map((offer) => (
                              <div
                                key={offer.id}
                                className="rounded-xl border-2 border-indigo-200 bg-indigo-50/80 p-3 text-xs text-indigo-950"
                              >
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <span className="flex items-center gap-1.5 font-bold">
                                    <Bot className="h-4 w-4 text-[#4338CA]" />
                                    Extension Offer (+{offer.additionalMinutes}m until{' '}
                                    {fmt12(offer.requestedEndMin)}) — ₹{offer.additionalTotalInr}
                                  </span>
                                  <span className="font-mono text-[11px] font-semibold text-[#4338CA]">
                                    Awaiting Your Acceptance
                                  </span>
                                </div>
                                <p className="mt-1 text-[11px] text-[#374151]">
                                  {offer.pricingReason} {offer.providerApprovalNote}
                                </p>
                                <div className="mt-2.5 flex flex-wrap gap-2">
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
                                    className="rounded-lg bg-[#047857] px-3 py-1.5 font-bold text-white hover:bg-[#065F46] disabled:opacity-50"
                                  >
                                    Accept &amp; Pay ₹{offer.additionalTotalInr} from Wallet
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
                                    className="rounded-lg border border-black/[0.1] bg-white px-3 py-1.5 font-bold text-[#374151] hover:bg-black/[0.04]"
                                  >
                                    Decline &amp; Leave Now
                                  </button>
                                </div>
                              </div>
                            ))}

                            {(bk.status === 'checked-in' || bk.status === 'occupied') && (
                              <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 text-xs">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <span className="flex items-center gap-1.5 font-bold text-[#111827]">
                                    <Radio className="h-3.5 w-3.5 text-[#047857]" />
                                    Smart Exit &amp; Geofence Departure Detection
                                  </span>
                                  {bk.departureSignal && (
                                    <span className="font-mono text-[11px] font-bold text-amber-800">
                                      DEPARTURE_PENDING ({bk.departureSignal.type})
                                    </span>
                                  )}
                                </div>
                                <p className="mt-1 text-[11px] text-[#4B5563]">
                                  GPS monitors your smartphone location—not the vehicle itself—so the
                                  bay stays safely locked until checkout is confirmed and the 15m
                                  clearance buffer runs.
                                </p>
                                <div className="mt-2.5 flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={async () => {
                                      setBusyId(bk.id);
                                      try {
                                        await onSendDepartureSignal(bk.id, 'im_leaving_button');
                                      } finally {
                                        setBusyId(null);
                                      }
                                    }}
                                    className="flex items-center gap-1 rounded-lg border border-amber-300 bg-white px-3 py-1.5 font-bold text-amber-900 hover:bg-amber-50"
                                  >
                                    <LogOut className="h-3.5 w-3.5" />
                                    <span>I&apos;m Leaving</span>
                                  </button>
                                  <button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={() => {
                                      if (gpsWatchBookingId === bk.id) {
                                        setGpsWatchBookingId(null);
                                        return;
                                      }
                                      setGpsWatchBookingId(bk.id);
                                      if (navigator.geolocation) {
                                        navigator.geolocation.getCurrentPosition(
                                          async (pos) => {
                                            const fac = facilities.find(
                                              (f) => f.id === bk.facilityId
                                            );
                                            if (!fac) return;
                                            const R = 6371000;
                                            const toRad = (d: number) => (d * Math.PI) / 180;
                                            const dLat = toRad(
                                              pos.coords.latitude - fac.entranceLat
                                            );
                                            const dLng = toRad(
                                              pos.coords.longitude - fac.entranceLng
                                            );
                                            const a =
                                              Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                                              Math.cos(toRad(fac.entranceLat)) *
                                                Math.cos(toRad(pos.coords.latitude)) *
                                                Math.sin(dLng / 2) *
                                                Math.sin(dLng / 2);
                                            const dist = Math.round(
                                              R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
                                            );
                                            if (dist > 120) {
                                              await onSendDepartureSignal(
                                                bk.id,
                                                'geofence_exit',
                                                dist
                                              );
                                            }
                                          },
                                          () => {
                                            // Ignore GPS decline when testing manually
                                          },
                                          { enableHighAccuracy: true, timeout: 6000 }
                                        );
                                      }
                                    }}
                                    className={`rounded-lg border px-3 py-1.5 font-semibold ${
                                      gpsWatchBookingId === bk.id
                                        ? 'border-[#4338CA] bg-indigo-50 text-[#4338CA]'
                                        : 'border-black/[0.1] bg-white text-[#374151]'
                                    }`}
                                  >
                                    {gpsWatchBookingId === bk.id
                                      ? 'GPS Geofence Armed'
                                      : 'Arm GPS Geofence'}
                                  </button>
                                  <button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={async () => {
                                      setBusyId(bk.id);
                                      try {
                                        await onSendDepartureSignal(bk.id, 'geofence_exit', 185);
                                      } finally {
                                        setBusyId(null);
                                      }
                                    }}
                                    className="rounded-lg border border-black/[0.1] bg-white px-3 py-1.5 font-semibold text-[#374151] hover:bg-black/[0.04]"
                                  >
                                    Test GPS Exit (&gt;150m)
                                  </button>
                                  <button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={async () => {
                                      setBusyId(bk.id);
                                      try {
                                        await onConfirmDeparture(bk.id);
                                      } finally {
                                        setBusyId(null);
                                      }
                                    }}
                                    className="rounded-lg bg-[#047857] px-3 py-1.5 font-bold text-white hover:bg-[#065F46]"
                                  >
                                    Confirm Checkout &amp; Left Bay
                                  </button>
                                </div>
                              </div>
                            )}
                          </>
                        );
                      })()}

                      {/* Action Buttons */}
                      <div className="flex flex-wrap items-center gap-2 pt-1">
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
                              className="flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg bg-[#047857] px-3.5 py-2 text-xs font-bold text-white transition-all hover:bg-[#065F46] disabled:opacity-50"
                            >
                              <Wallet className="h-3.5 w-3.5" />
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
                                  className="whitespace-nowrap shrink-0 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-bold text-[#047857] hover:bg-emerald-100 disabled:opacity-50"
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
                                  className="flex items-center gap-1 whitespace-nowrap shrink-0 rounded-lg bg-[#111827] px-3 py-2 text-xs font-bold text-white hover:bg-black"
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                                  <span>Arrived &amp; Check In</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setWallScannerBookingId(bk.id)}
                                  className="flex items-center gap-1 whitespace-nowrap shrink-0 rounded-lg border border-indigo-200 bg-indigo-50/75 px-3 py-2 text-xs font-bold text-[#4338CA] hover:bg-indigo-100"
                                >
                                  <ScanLine className="h-3.5 w-3.5" />
                                  <span>Scan Spot Wall QR</span>
                                </button>
                              </>
                            )}
                            <button
                              type="button"
                              onClick={() => setFullQrBookingId(bk.id)}
                              className="flex items-center gap-1 whitespace-nowrap shrink-0 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs font-semibold text-[#047857] hover:bg-emerald-50"
                            >
                              <QrCode className="h-3.5 w-3.5" />
                              <span>Show QR Code</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setNavBookingId(bk.id)}
                              className="flex items-center gap-1 whitespace-nowrap shrink-0 rounded-lg border border-indigo-200 bg-white px-3 py-2 text-xs font-semibold text-[#4338CA] hover:bg-indigo-50"
                            >
                              <Navigation className="h-3.5 w-3.5" />
                              <span>Parking Spot Directions</span>
                            </button>
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => void handleExtensionClick(bk.id, 30)}
                              className="whitespace-nowrap shrink-0 rounded-lg border border-black/[0.1] bg-white px-3 py-2 text-xs font-semibold text-[#111827] hover:bg-black/[0.03]"
                            >
                              Add 30 Mins
                            </button>
                            <button
                              type="button"
                              onClick={() => void onConfirmDeparture(bk.id)}
                              className="whitespace-nowrap shrink-0 rounded-lg bg-[#047857] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#065F46]"
                            >
                              Finish &amp; Exit
                            </button>
                          </>
                        )}

                        <button
                          type="button"
                          onClick={() => setInvoiceBookingId(bk.id)}
                          className="flex items-center gap-1 whitespace-nowrap shrink-0 rounded-lg border border-black/[0.08] bg-white px-3 py-2 text-xs font-semibold text-[#111827] hover:bg-black/[0.03]"
                        >
                          <FileText className="h-3.5 w-3.5 text-[#047857]" />
                          <span>Receipt</span>
                        </button>

                        {bk.paymentStatus === 'paid' && bk.refundStatus !== 'refunded' && (
                          <button
                            type="button"
                            onClick={() => {
                              setDisputeBookingId(disputeBookingId === bk.id ? null : bk.id);
                              setDisputeAmount(bk.totalAmountInr);
                            }}
                            className="whitespace-nowrap shrink-0 rounded-lg border border-black/[0.08] bg-white px-3 py-2 text-xs font-semibold text-[#4B5563] hover:text-[#111827]"
                          >
                            Request Refund
                          </button>
                        )}

                        {bk.status !== 'completed' &&
                          bk.status !== 'cancelled' &&
                          bk.status !== 'expired' && (
                            <button
                              type="button"
                              onClick={() => void onBookingAction(bk.id, 'cancel')}
                              className="whitespace-nowrap shrink-0 rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                            >
                              Cancel
                            </button>
                          )}
                      </div>
                    </div>
                  </div>

                  {/* Inline Refund Dispute Box */}
                  {disputeBookingId === bk.id && (
                    <div className="mt-3 flex flex-col gap-2.5 border-t border-black/[0.06] pt-3 sm:flex-row sm:items-center sm:gap-3">
                      <input
                        type="number"
                        min={10}
                        max={bk.totalAmountInr}
                        value={disputeAmount}
                        onChange={(e) => setDisputeAmount(Number(e.target.value))}
                        className="w-28 rounded-lg border border-black/[0.1] bg-white px-2.5 py-1.5 font-mono text-xs text-[#111827]"
                      />
                      <input
                        type="text"
                        value={disputeReason}
                        onChange={(e) => setDisputeReason(e.target.value)}
                        placeholder="Briefly tell us why you need a refund..."
                        className="w-full flex-1 rounded-lg border border-black/[0.1] bg-white px-3 py-1.5 text-xs text-[#111827]"
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
                        className="whitespace-nowrap shrink-0 rounded-lg bg-[#4338CA] px-3.5 py-1.5 text-xs font-bold text-white"
                      >
                        Send Request
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
      <section className="rounded-2xl border border-black/[0.08] bg-white/92 p-5 sm:p-6 shadow-sm backdrop-blur-md">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 font-display text-lg font-bold text-[#111827]">
              <History className="h-5 w-5 text-[#4338CA]" />
              <h2>Past Bookings</h2>
            </div>
            <p className="mt-0.5 text-xs text-[#4B5563]">
              Completed visits, refunded trips, and cancelled reservations.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-black/[0.08] bg-[#F8F7F4] p-1">
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
                  className={`whitespace-nowrap shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
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
          <div className="rounded-xl border border-dashed border-black/[0.12] bg-[#F8F7F4]/80 p-5 text-center text-xs text-[#4B5563]">
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
                        ? 'Partially Refunded'
                        : 'Refunded',
                    toneClass: 'border-teal-200 bg-teal-50 text-teal-800',
                    Icon: RotateCcw,
                  }
                : bk.status === 'completed'
                ? {
                    label: 'Completed',
                    toneClass: 'border-emerald-200 bg-emerald-50 text-[#047857]',
                    Icon: CheckCircle2,
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
                  className="rounded-xl border border-black/[0.08] bg-[#F8F7F4]/80 p-4"
                >
                  <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span
                          className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[11px] font-bold ${statusMeta.toneClass}`}
                        >
                          <StatusIcon className="h-3.5 w-3.5 shrink-0" />
                          <span>{statusMeta.label}</span>
                        </span>
                        <span className="text-[#374151]">
                          {new Date(bk.createdAt).toLocaleDateString()} · {fmt12(bk.startMin)} –{' '}
                          {fmt12(bk.endMin)}
                        </span>
                        {refunded && (
                          <span className="font-mono font-bold text-teal-700">
                            · Refunded ₹{bk.refundAmountInr ?? bk.totalAmountInr}
                          </span>
                        )}
                      </div>

                      <div className="font-display text-sm font-bold text-[#111827]">
                        {bk.facilityName} · Spot {bk.spaceCode}
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-[#4B5563]">
                        <span>
                          {bk.vehicleLabel}
                          {bk.vehiclePlate ? ` (${bk.vehiclePlate})` : ''}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono text-[11px] text-[#374151]">
                          Parking ₹{bk.baseAmountInr} + Fee ₹{bk.platformFeeInr} + GST ₹{bk.gstInr} ={' '}
                          <strong className="font-bold text-[#111827]">₹{bk.totalAmountInr}</strong>
                        </span>
                        {(bk.extraHoursChargedInr || 0) > 0 && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono font-semibold text-amber-800">
                              + Extra hours: ₹{bk.extraHoursChargedInr}
                              {bk.extraMinutesCharged ? ` (+${bk.extraMinutesCharged}m)` : ''} (Grand Total: ₹
                              {bk.totalAmountInr + (bk.extraHoursChargedInr || 0)})
                            </span>
                          </>
                        )}
                        {bk.status === 'completed' &&
                          typeof bk.remainingBalanceAfterCheckoutInr === 'number' && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono font-semibold text-[#047857]">
                                Remaining Wallet Balance: ₹{bk.remainingBalanceAfterCheckoutInr}
                              </span>
                            </>
                          )}
                        {bk.status === 'completed' && (bk.unpaidDueAfterCheckoutInr || 0) > 0 && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono font-semibold text-rose-700">
                              Unpaid Due: ₹{bk.unpaidDueAfterCheckoutInr}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setInvoiceBookingId(bk.id)}
                        className="flex items-center gap-1 whitespace-nowrap shrink-0 rounded-lg border border-black/[0.08] bg-white px-3 py-2 text-xs font-semibold text-[#111827] hover:bg-black/[0.03]"
                      >
                        <FileText className="h-3.5 w-3.5 text-[#047857]" />
                        <span>Receipt</span>
                      </button>

                      {bk.status === 'completed' && (
                        <button
                          type="button"
                          onClick={() => setReviewingId(reviewingId === bk.id ? null : bk.id)}
                          className="flex items-center gap-1 whitespace-nowrap shrink-0 rounded-lg border border-black/[0.1] bg-white px-3 py-2 text-xs font-semibold text-[#111827] hover:border-[#D93F0B]"
                        >
                          <Star className="h-3.5 w-3.5 text-amber-400" />
                          <span>Rate Stay</span>
                        </button>
                      )}

                      {bk.paymentStatus === 'paid' && !refunded && (
                        <button
                          type="button"
                          onClick={() => {
                            setDisputeBookingId(disputeBookingId === bk.id ? null : bk.id);
                            setDisputeAmount(bk.totalAmountInr);
                          }}
                          className="whitespace-nowrap shrink-0 rounded-lg border border-black/[0.08] bg-white px-3 py-2 text-xs font-semibold text-[#4B5563] hover:text-[#111827]"
                        >
                          Request Refund
                        </button>
                      )}
                    </div>
                  </div>

                  {reviewingId === bk.id && (
                    <div className="mt-3 flex flex-col gap-2.5 border-t border-black/[0.06] pt-3 sm:flex-row sm:items-center sm:gap-3">
                      <select
                        value={rating}
                        onChange={(e) => setRating(Number(e.target.value))}
                        className="rounded-lg border border-black/[0.1] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#111827]"
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
                        className="w-full flex-1 rounded-lg border border-black/[0.1] bg-white px-3 py-1.5 text-xs text-[#111827]"
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          await onSubmitReview(bk.id, rating, comment);
                          setReviewingId(null);
                          setComment('');
                        }}
                        className="flex items-center justify-center gap-1 rounded-lg bg-gradient-to-r from-[#E0430D] to-[#C83709] px-3 py-1.5 text-xs font-bold text-white hover:brightness-110"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>Post Review</span>
                      </button>
                    </div>
                  )}

                  {disputeBookingId === bk.id && (
                    <div className="mt-3 flex flex-col gap-2.5 border-t border-black/[0.06] pt-3 sm:flex-row sm:items-center sm:gap-3">
                      <input
                        type="number"
                        min={10}
                        max={bk.totalAmountInr}
                        value={disputeAmount}
                        onChange={(e) => setDisputeAmount(Number(e.target.value))}
                        className="w-28 rounded-lg border border-black/[0.1] bg-white px-2.5 py-1.5 font-mono text-xs text-[#111827]"
                      />
                      <input
                        type="text"
                        value={disputeReason}
                        onChange={(e) => setDisputeReason(e.target.value)}
                        placeholder="Tell us why you are requesting a refund..."
                        className="w-full flex-1 rounded-lg border border-black/[0.1] bg-white px-3 py-1.5 text-xs text-[#111827]"
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
                        className="whitespace-nowrap shrink-0 rounded-lg bg-[#4338CA] px-3.5 py-1.5 text-xs font-bold text-white"
                      >
                        Send Request
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Pop-Up Modals */}
      {navBooking && navFacility && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/55 p-3 sm:p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Live Parking Spot Directions"
        >
          <div className="relative my-auto w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-2xl border-2 border-[#1A73E8] bg-white p-4 sm:p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-black/[0.06] pb-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 font-display text-base sm:text-lg font-bold text-[#111827]">
                  <Navigation className="h-4 w-4 shrink-0 text-[#1A73E8]" />
                  <span className="truncate">Parking Spot Directions · {navFacility.name}</span>
                </div>
                <p className="mt-0.5 text-xs text-[#4B5563]">
                  {navFacility.address} ({navFacility.zone}) · Spot{' '}
                  <strong className="text-[#111827]">{navBooking.spaceCode}</strong> · Spot Access PIN{' '}
                  <span className="font-mono font-bold text-[#4338CA]">
                    {navBooking.accessCode}
                  </span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setNavBookingId(null)}
                aria-label="Close directions"
                className="shrink-0 rounded-lg border border-black/[0.08] p-1.5 text-[#4B5563] hover:text-[#111827]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-3.5">
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
                liveTracking={true}
                bookedSpotCode={navBooking.spaceCode}
              />
            </div>

            <div className="mt-3.5 grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
              <div className="rounded-xl bg-[#F8F7F4] p-3.5">
                <div className="font-semibold text-[#4B5563]">Place &amp; Spot Entrance</div>
                <div className="mt-1 font-bold text-[#111827]">{navFacility.name}</div>
                <div className="mt-0.5 text-[#374151]">{navFacility.address}</div>
                <div className="mt-1 font-semibold text-[#C83709]">
                  Spot Entrance: {navFacility.entranceLabel} · Spot {navBooking.spaceCode}
                </div>
              </div>
              <div className="rounded-xl bg-[#F8F7F4] p-3.5">
                <div className="font-semibold text-[#4B5563]">Spot Entry &amp; Walk Path</div>
                <div className="mt-1 text-[#111827]">{navFacility.accessInstructions}</div>
                <div className="mt-1 font-semibold text-[#047857]">
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
            <div className="flex items-start justify-between gap-3 border-b border-black/[0.06] pb-3">
              <div>
                <div className="flex items-center gap-2 font-display text-base font-bold text-[#111827]">
                  <FileText className="h-4 w-4 text-[#047857]" />
                  <span>Payment Receipt</span>
                </div>
                <p className="mt-0.5 text-xs text-[#4B5563]">
                  {invoiceBooking.facilityName} · Spot {invoiceBooking.spaceCode}
                  {invoiceBooking.invoiceNumber ? ` · ${invoiceBooking.invoiceNumber}` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInvoiceBookingId(null)}
                aria-label="Close receipt"
                className="rounded-lg border border-black/[0.08] p-1.5 text-[#4B5563] hover:text-[#111827]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-4 space-y-2 rounded-xl bg-[#F8F7F4] p-4 text-xs">
              <div className="flex justify-between">
                <span className="text-[#4B5563]">
                  Parking Charge ({fmt12(invoiceBooking.startMin)} – {fmt12(invoiceBooking.endMin)})
                </span>
                <span className="font-mono font-semibold text-[#111827]">
                  ₹{invoiceBooking.baseAmountInr}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#4B5563]">Service &amp; Platform Fee (10%, min ₹10)</span>
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
              <div className="flex justify-between border-t border-black/[0.08] pt-2 text-sm font-bold text-[#111827]">
                <span>
                  Subtotal Paid (₹{invoiceBooking.baseAmountInr} + ₹{invoiceBooking.platformFeeInr} + ₹
                  {invoiceBooking.gstInr})
                </span>
                <span className="font-mono tabular-nums">₹{invoiceBooking.totalAmountInr}</span>
              </div>
              {(invoiceBooking.extraHoursChargedInr || 0) > 0 && (
                <>
                  <div className="flex justify-between text-xs font-semibold text-amber-800">
                    <span>
                      Extra Hours Deducted
                      {invoiceBooking.extraMinutesCharged
                        ? ` (+${invoiceBooking.extraMinutesCharged}m)`
                        : ''}
                    </span>
                    <span className="font-mono tabular-nums">
                      +₹{invoiceBooking.extraHoursChargedInr}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-dashed border-black/[0.1] pt-1.5 text-sm font-bold text-[#111827]">
                    <span>Total Deducted from Wallet</span>
                    <span className="font-mono tabular-nums">
                      ₹{invoiceBooking.totalAmountInr + (invoiceBooking.extraHoursChargedInr || 0)}
                    </span>
                  </div>
                </>
              )}
              {typeof invoiceBooking.remainingBalanceAfterCheckoutInr === 'number' && (
                <div className="flex justify-between text-xs font-bold text-[#047857]">
                  <span>Remaining Wallet Balance After Checkout</span>
                  <span className="font-mono tabular-nums">
                    ₹{invoiceBooking.remainingBalanceAfterCheckoutInr}
                  </span>
                </div>
              )}
              {invoiceOrder && (
                <div className="pt-1 text-[11px] text-[#047857]">
                  Payment Reference: {invoiceOrder.gatewayOrderRef}
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
