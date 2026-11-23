import React, { useState } from 'react';
import {
  CheckCircle,
  Flag,
  Lifebuoy,
  Receipt,
  ShieldWarning,
  Warning,
} from '@phosphor-icons/react';
import {
  BookingRecord,
  DisputeRecord,
  IncidentRecord,
  TransactionHistoryItem,
} from '../types/parkpool';

interface DriverSupportViewProps {
  bookings: BookingRecord[];
  incidents: IncidentRecord[];
  disputes: DisputeRecord[];
  transactions: TransactionHistoryItem[];
  onSubmitIncident: (payload: {
    facilityId?: string;
    bookingId?: string;
    category: IncidentRecord['category'];
    severity: IncidentRecord['severity'];
    description: string;
  }) => Promise<void>;
  onRaiseDispute: (payload: {
    bookingId: string;
    reason: string;
    requestedRefundInr: number;
  }) => Promise<void>;
  onSubmitUserReport: (payload: { reportedEntity: string; reason: string }) => Promise<void>;
}

const INCIDENT_STATUS_LABELS: Record<IncidentRecord['status'], string> = {
  open: 'Open',
  investigating: 'Under Review',
  resolved: 'Resolved',
};

const INCIDENT_CATEGORY_LABELS: Record<IncidentRecord['category'], string> = {
  access_blocked: 'Gate or Spot Blocked',
  vehicle_overstay: 'Another Vehicle in Spot',
  safety_hazard: 'Safety or Lighting Issue',
  unauthorized_towing: 'Unauthorized Clamping or Towing',
  payment_issue: 'Payment or Billing Issue',
  other: 'Other Issue',
};

export const DriverSupportView: React.FC<DriverSupportViewProps> = ({
  bookings,
  incidents,
  disputes,
  transactions,
  onSubmitIncident,
  onRaiseDispute,
  onSubmitUserReport,
}) => {
  const [incCategory, setIncCategory] = useState<IncidentRecord['category']>('access_blocked');
  const [incSeverity, setIncSeverity] = useState<IncidentRecord['severity']>('medium');
  const [incBookingId, setIncBookingId] = useState('');
  const [incDesc, setIncDesc] = useState('');
  const [submittingIncident, setSubmittingIncident] = useState(false);

  const [disputeBookingId, setDisputeBookingId] = useState('');
  const [disputeAmount, setDisputeAmount] = useState<number>(0);
  const [disputeReason, setDisputeReason] = useState('');
  const [submittingDispute, setSubmittingDispute] = useState(false);

  const [repTarget, setRepTarget] = useState('');
  const [repReason, setRepReason] = useState('');
  const [submittingReport, setSubmittingReport] = useState(false);

  const paidBookings = bookings.filter(
    (b) => b.paymentStatus === 'paid' && b.refundStatus !== 'refunded'
  );

  const handleIncidentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!incDesc.trim()) return;
    setSubmittingIncident(true);
    try {
      await onSubmitIncident({
        bookingId: incBookingId || undefined,
        category: incCategory,
        severity: incSeverity,
        description: incDesc,
      });
      setIncDesc('');
    } finally {
      setSubmittingIncident(false);
    }
  };

  const handleDisputeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disputeBookingId || !disputeReason.trim()) return;
    setSubmittingDispute(true);
    try {
      await onRaiseDispute({
        bookingId: disputeBookingId,
        reason: disputeReason,
        requestedRefundInr: disputeAmount,
      });
      setDisputeReason('');
      setDisputeBookingId('');
      setDisputeAmount(0);
    } finally {
      setSubmittingDispute(false);
    }
  };

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repTarget.trim() || !repReason.trim()) return;
    setSubmittingReport(true);
    try {
      await onSubmitUserReport({ reportedEntity: repTarget, reason: repReason });
      setRepTarget('');
      setRepReason('');
    } finally {
      setSubmittingReport(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-black/[0.08] bg-white p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#FFF0EA] text-[#C83709]">
            <Lifebuoy className="h-5 w-5" weight="duotone" />
          </div>
          <div>
            <h1 className="heading-5 text-[#111827]">Safety and support center</h1>
            <p className="mt-1 body-6 text-[#4B5563]">
              Report a blocked gate, safety issue, misleading listing, or request a refund review.
              For urgent emergencies in India, call 112.
            </p>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <section className="rounded-2xl border border-black/[0.08] bg-white p-6 lg:col-span-6">
          <div className="flex items-center gap-2">
            <Warning className="h-5 w-5 text-[#C83709]" weight="duotone" />
            <h2 className="heading-6 text-[#111827]">Report incident or safety issue</h2>
          </div>
          <p className="mt-1 caption-2 text-[#4B5563]">
            Let operations know if a gate was locked, another vehicle blocked your bay, or site
            lighting felt unsafe.
          </p>

          <form onSubmit={(e) => void handleIncidentSubmit(e)} className="mt-4 space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block title-5 text-[#374151]">What happened?</label>
                <select
                  value={incCategory}
                  onChange={(e) => setIncCategory(e.target.value as IncidentRecord['category'])}
                  className="w-full rounded-xl border border-black/[0.1] bg-[#F8F7F4] px-3 py-2 caption-4 text-[#111827]"
                >
                  <option value="access_blocked">Gate or spot blocked</option>
                  <option value="vehicle_overstay">Another vehicle in bay</option>
                  <option value="unauthorized_towing">Clamping or towing</option>
                  <option value="safety_hazard">Safety or lighting issue</option>
                  <option value="payment_issue">Billing issue</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block title-5 text-[#374151]">Urgency</label>
                <select
                  value={incSeverity}
                  onChange={(e) => setIncSeverity(e.target.value as IncidentRecord['severity'])}
                  className="w-full rounded-xl border border-black/[0.1] bg-[#F8F7F4] px-3 py-2 caption-4 text-[#111827]"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High (Urgent)</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block title-5 text-[#374151]">Related booking</label>
                <select
                  value={incBookingId}
                  onChange={(e) => setIncBookingId(e.target.value)}
                  className="w-full rounded-xl border border-black/[0.1] bg-[#F8F7F4] px-3 py-2 caption-4 text-[#111827]"
                >
                  <option value="">Not linked to a booking</option>
                  {bookings.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.facilityName} ({b.spaceCode})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1 block title-5 text-[#374151]">Details</label>
              <textarea
                rows={3}
                required
                value={incDesc}
                onChange={(e) => setIncDesc(e.target.value)}
                placeholder="Tell us clearly what happened so support can act..."
                className="w-full rounded-xl border border-black/[0.1] bg-[#F8F7F4] px-3 py-2 caption-2 text-[#111827]"
              />
            </div>

            <button
              type="submit"
              disabled={submittingIncident}
              className="rounded-xl bg-[#111827] px-3 py-2 button-sm text-white transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-black active:scale-[0.98] disabled:opacity-50"
            >
              {submittingIncident ? 'Sending report...' : 'Submit safety report'}
            </button>
          </form>

          {incidents.length > 0 && (
            <div className="mt-6 space-y-2">
              <div className="title-5 text-[#111827]">Your submitted reports</div>
              {incidents.slice(0, 4).map((inc) => (
                <div
                  key={inc.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-black/[0.08] bg-[#F8F7F4] px-3 py-2 caption-4"
                >
                  <div className="min-w-0">
                    <div className="caption-3 text-[#111827]">
                      {INCIDENT_CATEGORY_LABELS[inc.category]}
                    </div>
                    <div className="truncate text-[#4B5563]">{inc.description}</div>
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-1 caption-3 text-[#047857]">
                    <CheckCircle className="h-3.5 w-3.5" weight="fill" />
                    <span>{INCIDENT_STATUS_LABELS[inc.status]}</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="space-y-6 lg:col-span-6">
          <section className="rounded-2xl border border-black/[0.08] bg-white p-6">
            <div className="flex items-center gap-2">
              <ShieldWarning className="h-5 w-5 text-[#4338CA]" weight="duotone" />
              <h2 className="heading-6 text-[#111827]">Request refund or billing review</h2>
            </div>
            <p className="mt-1 caption-2 text-[#4B5563]">
              Charged incorrectly or blocked from your paid spot? Request an operations refund review.
            </p>

            {paidBookings.length === 0 ? (
              <div className="mt-4 rounded-xl border border-dashed border-black/[0.12] bg-[#F8F7F4] p-4 caption-2 text-[#4B5563]">
                No paid bookings eligible for a refund review right now.
              </div>
            ) : (
              <form onSubmit={(e) => void handleDisputeSubmit(e)} className="mt-4 space-y-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block title-5 text-[#374151]">Select booking</label>
                    <select
                      required
                      value={disputeBookingId}
                      onChange={(e) => {
                        const chosen = paidBookings.find((b) => b.id === e.target.value);
                        setDisputeBookingId(e.target.value);
                        setDisputeAmount(chosen ? chosen.totalAmountInr : 0);
                      }}
                      className="w-full rounded-xl border border-black/[0.1] bg-[#F8F7F4] px-3 py-2 caption-4 text-[#111827]"
                    >
                      <option value="">Choose a paid booking</option>
                      {paidBookings.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.facilityName} · ₹{b.totalAmountInr}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block title-5 text-[#374151]">Refund amount (₹)</label>
                    <input
                      type="number"
                      min={10}
                      value={disputeAmount || ''}
                      onChange={(e) => setDisputeAmount(Number(e.target.value))}
                      placeholder="Amount in ₹"
                      className="w-full rounded-xl border border-black/[0.1] bg-[#F8F7F4] px-3 py-2 font-mono caption-4 text-[#111827]"
                    />
                  </div>
                </div>
                <input
                  type="text"
                  required
                  value={disputeReason}
                  onChange={(e) => setDisputeReason(e.target.value)}
                  placeholder="Briefly explain why you need a refund..."
                  className="w-full rounded-xl border border-black/[0.1] bg-[#F8F7F4] px-3 py-2 caption-2 text-[#111827]"
                />
                <button
                  type="submit"
                  disabled={submittingDispute}
                  className="rounded-xl bg-[#4338CA] px-3 py-2 button-sm text-white transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-[#3730A3] active:scale-[0.98] disabled:opacity-50"
                >
                  {submittingDispute ? 'Submitting...' : 'Submit refund request'}
                </button>
              </form>
            )}

            {disputes.length > 0 && (
              <div className="mt-4 space-y-2">
                {disputes.slice(0, 3).map((d) => (
                  <div
                    key={d.id}
                    className="flex items-center justify-between rounded-xl border border-black/[0.08] bg-[#F8F7F4] px-3 py-2 caption-4 text-[#374151]"
                  >
                    <span className="truncate">
                      ₹{d.requestedRefundInr} · {d.reason}
                    </span>
                    <span className="ml-2 shrink-0 caption-3 capitalize text-[#4338CA]">
                      {d.status.replace('_', ' ')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-black/[0.08] bg-white p-6">
            <div className="flex items-center gap-2">
              <Flag className="h-5 w-5 text-[#C83709]" weight="duotone" />
              <h2 className="heading-6 text-[#111827]">Flag listing or host issue</h2>
            </div>
            <p className="mt-1 caption-2 text-[#4B5563]">
              Report incorrect gate directions, wrong pricing, or unsafe site conditions.
            </p>
            <form onSubmit={(e) => void handleReportSubmit(e)} className="mt-3 space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  type="text"
                  required
                  value={repTarget}
                  onChange={(e) => setRepTarget(e.target.value)}
                  placeholder="Parking location name"
                  className="rounded-xl border border-black/[0.1] bg-[#F8F7F4] px-3 py-2 caption-2 text-[#111827] sm:w-48"
                />
                <input
                  type="text"
                  required
                  value={repReason}
                  onChange={(e) => setRepReason(e.target.value)}
                  placeholder="What was inaccurate or misleading?"
                  className="flex-1 rounded-xl border border-black/[0.1] bg-[#F8F7F4] px-3 py-2 caption-2 text-[#111827]"
                />
              </div>
              <button
                type="submit"
                disabled={submittingReport}
                className="rounded-xl border border-black/[0.12] bg-white px-3 py-2 button-sm text-[#111827] transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:border-[#C83709] active:scale-[0.98]"
              >
                {submittingReport ? 'Sending...' : 'Flag listing'}
              </button>
            </form>
          </section>
        </div>
      </div>

      <section className="rounded-2xl border border-black/[0.08] bg-white p-6">
        <div className="flex items-center gap-2">
          <Receipt className="h-5 w-5 text-[#047857]" weight="duotone" />
          <h2 className="heading-6 text-[#111827]">Recent payments and refunds</h2>
        </div>
        {transactions.length === 0 ? (
          <p className="mt-2 caption-2 text-[#4B5563]">No payments or refunds recorded yet.</p>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {transactions.slice(0, 6).map((tx) => {
              const friendlyType =
                tx.type === 'refund'
                  ? 'Refund Received'
                  : tx.type === 'extension_charge'
                  ? 'Extra Time Payment'
                  : tx.type === 'host_payout'
                  ? 'Facility Payout'
                  : 'Parking Payment';
              return (
                <div
                  key={tx.id}
                  className="flex items-center justify-between rounded-xl border border-black/[0.08] bg-[#F8F7F4] px-3 py-2 caption-4"
                >
                  <div className="min-w-0">
                    <div className="caption-3 text-[#111827]">{friendlyType}</div>
                    <div className="truncate caption-5 text-[#4B5563]">
                      {new Date(tx.timestamp).toLocaleDateString()} · Booking {tx.bookingId}
                    </div>
                  </div>
                  <span
                    className={`ml-2 shrink-0 font-mono caption-3 tabular-nums ${
                      tx.type === 'refund' ? 'text-[#047857]' : 'text-[#111827]'
                    }`}
                  >
                    {tx.type === 'refund' ? '+' : ''}₹{tx.amountInr}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
