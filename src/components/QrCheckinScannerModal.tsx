import React, { useEffect, useState } from 'react';
import {
  CheckCircle,
  Clock,
  Copy,
  MapPin,
  QrCode,
  ShieldCheck,
  X,
} from '@phosphor-icons/react';
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
        <div className="flex items-start justify-between gap-3 pb-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <QrCode className="h-5 w-5 shrink-0 text-[#047857]" weight="duotone" />
              <h2 className="truncate heading-6 text-[#111827]">Your entry QR pass</h2>
            </div>
            <p className="mt-0.5 caption-4 text-[#4B5563]">
              {booking.facilityName} · Spot {booking.spaceCode}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg border border-black/[0.08] p-2 text-[#4B5563] transition-colors duration-300 hover:text-[#111827]"
            aria-label="Close QR pass"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-col items-center rounded-xl border border-black/[0.08] bg-[#F8F7F4] p-4 sm:p-6 text-center">
          <QrCodeDisplay
            value={riderQrValue}
            size={200}
            label={`Entry QR pass for ${booking.id}`}
          />

          <div className="mt-3 flex flex-wrap items-center justify-center gap-2 caption-3 text-[#111827]">
            <span>Spot Access PIN:</span>
            <span className="rounded-lg bg-white px-3 py-1 font-mono body-4 text-[#4338CA] border border-black/[0.08]">
              {booking.accessCode}
            </span>
            <button
              type="button"
              onClick={() => void handleCopyPin()}
              className="flex items-center gap-1 rounded-lg border border-black/[0.08] bg-white px-2 py-1 button-xsm text-[#374151] transition-colors duration-300 hover:border-[#4338CA]"
            >
              <Copy className="h-3.5 w-3.5" />
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-center gap-3 caption-4 text-[#374151]">
            <span className="flex items-center gap-1">
              <Clock className="h-4 w-4 text-[#047857]" />
              {fmt12(booking.startMin)} to {fmt12(booking.endMin)}
            </span>
            <span aria-hidden="true">·</span>
            <span className="flex items-center gap-1">
              <MapPin className="h-4 w-4 text-[#C83709]" weight="fill" />
              {facility?.entranceLabel || booking.entranceLabel}
            </span>
          </div>

          <div className="mt-4 w-full rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-left text-emerald-950">
            <div className="flex items-center gap-2 title-5 text-[#047857]">
              {booking.status === 'checked-in' || booking.status === 'occupied' ? (
                <CheckCircle className="h-4 w-4 shrink-0 text-[#047857]" weight="fill" />
              ) : (
                <ShieldCheck className="h-4 w-4 shrink-0 text-[#047857]" weight="fill" />
              )}
              <span>
                {booking.status === 'checked-in' || booking.status === 'occupied'
                  ? 'You are checked in'
                  : 'Confirmed and paid parking spot pass'}
              </span>
            </div>
            <p className="mt-1 caption-4 text-emerald-900">
              Show this live QR code to gate security or scan the wall placard from your booking
              card upon arrival. Image saving stays disabled for spot protection.
            </p>
          </div>

          <div className="mt-4 flex w-full justify-center">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl bg-[#111827] px-3 py-2 button-sm text-white transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-black active:scale-[0.98]"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
