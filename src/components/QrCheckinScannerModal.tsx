import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Copy,
  MapPin,
  QrCode,
  ShieldCheck,
  X,
} from 'lucide-react';
import { BookingRecord, Facility } from '../types/parkpool';
import { buildBookingQrPayload, encodeBookingQrPayload } from '../utils/qrPassGenerator';
import { QrCodeDisplay } from './QrCodeDisplay';

interface QrCheckinScannerModalProps {
  booking: BookingRecord;
  facility?: Facility;
  onClose: () => void;
}

function fmt12(min: number): string {
  const h24 = Math.floor(min / 60);
  const m = min % 60;
  const period = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

export const QrCheckinScannerModal: React.FC<QrCheckinScannerModalProps> = ({
  booking,
  facility,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const riderPayload = buildBookingQrPayload(booking);
  const riderQrValue = encodeBookingQrPayload(riderPayload);

  const handleCopyPin = async () => {
    if (!navigator.clipboard) return;
    await navigator.clipboard.writeText(booking.accessCode);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-3 sm:p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Entry QR Pass"
    >
      <div className="relative my-auto w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-black/[0.1] bg-white p-4 sm:p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-black/[0.06] pb-3.5">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <QrCode className="h-5 w-5 shrink-0 text-[#047857]" />
              <h2 className="truncate font-display text-base sm:text-lg font-bold text-[#111827]">
                Your Entry QR Pass
              </h2>
            </div>
            <p className="mt-0.5 text-xs text-[#4B5563]">
              {booking.facilityName} · Spot {booking.spaceCode}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg border border-black/[0.08] p-1.5 text-[#4B5563] hover:text-[#111827]"
            aria-label="Close QR pass"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="mt-4 flex flex-col items-center rounded-2xl border border-black/[0.08] bg-[#F8F7F4] p-4 sm:p-5 text-center">
          <QrCodeDisplay
            value={riderQrValue}
            size={200}
            label={`Entry QR pass for ${booking.id}`}
          />

          <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-xs font-bold text-[#111827]">
            <span>Spot Access PIN:</span>
            <span className="rounded-lg bg-white px-2.5 py-1 font-mono text-sm text-[#4338CA] border border-black/[0.08]">
              {booking.accessCode}
            </span>
            <button
              type="button"
              onClick={() => void handleCopyPin()}
              className="flex items-center gap-1 rounded-lg border border-black/[0.08] bg-white px-2 py-1 text-[11px] font-semibold text-[#374151] hover:border-[#4338CA]"
            >
              <Copy className="h-3 w-3" />
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>

          <div className="mt-2.5 flex flex-wrap items-center justify-center gap-3 text-xs text-[#374151]">
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5 text-[#047857]" />
              {fmt12(booking.startMin)} – {fmt12(booking.endMin)}
            </span>
            <span aria-hidden="true">·</span>
            <span className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5 text-[#C83709]" />
              {facility?.entranceLabel || booking.entranceLabel}
            </span>
          </div>

          <div className="mt-3 w-full rounded-xl border border-emerald-200 bg-emerald-50/80 p-3 text-left text-xs text-emerald-950">
            <div className="flex items-center gap-1.5 font-bold">
              {booking.status === 'checked-in' || booking.status === 'occupied' ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-[#047857]" />
              ) : (
                <ShieldCheck className="h-4 w-4 shrink-0 text-[#047857]" />
              )}
              <span>
                {booking.status === 'checked-in' || booking.status === 'occupied'
                  ? 'You are checked in'
                  : 'Confirmed & Paid — Parking Spot Pass'}
              </span>
            </div>
            <p className="mt-1 text-xs text-emerald-900">
              Show this live QR code to the parking attendant or entrance scanner when you arrive. Saving
              screenshots/images is disabled for parking spot security; if no attendant is present, use Scan
              Spot Wall QR from your active booking card.
            </p>
          </div>

          <div className="mt-4 flex w-full justify-center">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl bg-[#111827] px-6 py-2.5 text-xs font-bold text-white hover:bg-black"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
