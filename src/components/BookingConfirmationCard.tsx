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
import { BookingRecord, Facility, PrepaidWallet } from '../types/parkpool';
import {
  BookingEntranceQrPayload,
  generateBookingConfirmationQr,
} from '../utils/qrPassGenerator';

interface BookingConfirmationCardProps {
  booking: BookingRecord;
  facility?: Facility;
  wallet?: PrepaidWallet;
  onClose: () => void;
  asModal?: boolean;
}

function fmt12(min: number): string {
  const h24 = Math.floor(min / 60);
  const m = min % 60;
  const period = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

export const BookingConfirmationCard: React.FC<BookingConfirmationCardProps> = ({
  booking,
  facility,
  wallet,
  onClose,
  asModal = true,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [encodedPayload, setEncodedPayload] = useState<string>('');
  const [payloadInfo, setPayloadInfo] = useState<BookingEntranceQrPayload | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    generateBookingConfirmationQr(booking, 196)
      .then((res) => {
        if (!active) return;
        setQrDataUrl(res.dataUrl);
        setEncodedPayload(res.encodedPayload);
        setPayloadInfo(res.payload);
      })
      .catch(() => {
        if (!active) return;
        setQrDataUrl(null);
      });
    return () => {
      active = false;
    };
  }, [booking]);

  const handleCopyPayload = async () => {
    if (!encodedPayload || !navigator.clipboard) return;
    await navigator.clipboard.writeText(encodedPayload);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const cardContent = (
    <section
      aria-label="Booking Confirmation"
      className="relative my-auto w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border-2 border-[#047857] bg-white p-4 sm:p-6 shadow-2xl"
    >
      <div className="flex items-start justify-between gap-3 pb-4">
        <div className="flex items-start gap-3 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-[#047857]">
            <CheckCircle className="h-5 w-5" weight="fill" />
          </div>
          <div className="min-w-0">
            <h2 className="heading-6 text-[#111827]">Booking confirmed and paid</h2>
            <p className="mt-0.5 caption-2 text-[#4B5563]">
              Show this QR pass at{' '}
              <strong className="text-[#111827]">
                {facility?.entranceLabel || booking.entranceLabel}
              </strong>{' '}
              when you arrive.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close booking confirmation"
          className="shrink-0 rounded-lg border border-black/[0.08] p-2 text-[#4B5563] transition-colors duration-300 hover:text-[#111827]"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
        <div
          onContextMenu={(e) => e.preventDefault()}
          className="flex select-none flex-col items-center justify-center rounded-xl border border-black/[0.08] bg-[#F8F7F4] p-4 text-center md:col-span-5"
        >
          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt={`Entry QR pass for ${booking.id}`}
              width={188}
              height={188}
              draggable={false}
              onContextMenu={(e) => e.preventDefault()}
              referrerPolicy="no-referrer"
              className="pointer-events-none select-none rounded-lg border border-black/[0.08] bg-white p-2 shadow-sm"
            />
          ) : (
            <div className="flex h-44 w-44 flex-col items-center justify-center rounded-lg border border-black/[0.08] bg-white p-4">
              <QrCode className="h-10 w-10 text-[#047857]" weight="duotone" />
              <span className="mt-2 caption-3 text-[#4B5563]">Preparing entry QR...</span>
            </div>
          )}

          <div className="mt-3 caption-3 text-[#111827]">
            Spot Access PIN: <span className="font-mono text-[#4338CA]">{booking.accessCode}</span>
          </div>

          <div className="mt-1 flex items-center gap-2 caption-4 text-[#047857]">
            <Clock className="h-3.5 w-3.5 shrink-0" />
            <span>
              {fmt12(booking.startMin)} to {fmt12(booking.endMin)}
            </span>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              disabled={!encodedPayload}
              onClick={() => void handleCopyPayload()}
              className="flex items-center gap-2 whitespace-nowrap shrink-0 rounded-lg border border-black/[0.1] bg-white px-3 py-2 button-xsm text-[#374151] transition-all duration-300 hover:border-[#4338CA] active:scale-[0.98] disabled:opacity-50"
            >
              <Copy className="h-3.5 w-3.5 text-[#4338CA]" />
              <span>{copied ? 'Copied' : 'Copy code'}</span>
            </button>
          </div>
        </div>

        <div className="flex flex-col justify-between space-y-4 md:col-span-7">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-black/[0.08] bg-[#F8F7F4] p-3">
              <div className="caption-3 text-[#4B5563]">Parking location and bay</div>
              <div className="mt-1 title-4 text-[#111827]">{booking.facilityName}</div>
              <div className="mt-0.5 caption-3 text-[#C83709]">Spot {booking.spaceCode}</div>
            </div>

            <div className="rounded-xl border border-black/[0.08] bg-[#F8F7F4] p-3">
              <div className="caption-3 text-[#4B5563]">Where to enter</div>
              <div className="mt-1 flex items-center gap-1 title-4 text-[#111827]">
                <MapPin className="h-3.5 w-3.5 shrink-0 text-[#047857]" weight="fill" />
                <span>{facility?.entranceLabel || booking.entranceLabel}</span>
              </div>
              <div className="mt-0.5 caption-5 text-[#4B5563]">
                Vehicle: {booking.vehiclePlate || booking.vehicleLabel}
              </div>
            </div>

            <div className="rounded-xl border border-black/[0.08] bg-[#F8F7F4] p-3">
              <div className="caption-3 text-[#4B5563]">Booking reference</div>
              <div className="mt-1 font-mono caption-3 text-[#111827]">
                {payloadInfo?.bookingId || booking.id}
              </div>
              <div className="mt-0.5 caption-5 text-[#4B5563]">{booking.vehicleLabel}</div>
            </div>

            <div className="rounded-xl border border-black/[0.08] bg-[#F8F7F4] p-3">
              <div className="caption-3 text-[#4B5563]">Paid via prepaid wallet</div>
              <div className="mt-1 space-y-1 caption-5 text-[#4B5563]">
                <div className="flex justify-between">
                  <span>Parking charge</span>
                  <span className="font-mono">₹{booking.baseAmountInr}</span>
                </div>
                <div className="flex justify-between">
                  <span>Service fee</span>
                  <span className="font-mono">₹{booking.platformFeeInr}</span>
                </div>
                <div className="flex justify-between">
                  <span>GST (18%)</span>
                  <span className="font-mono">₹{booking.gstInr}</span>
                </div>
              </div>
              <div className="mt-2 flex justify-between font-mono caption-3 text-[#047857]">
                <span>Total deducted</span>
                <span>₹{booking.totalAmountInr}</span>
              </div>
              {wallet ? (
                <div className="mt-1 font-mono caption-3 text-[#111827]">
                  Remaining balance: ₹{wallet.balanceInr}
                </div>
              ) : (
                <div className="mt-1 caption-5 text-[#4B5563]">
                  {booking.invoiceNumber ? `Receipt ${booking.invoiceNumber}` : 'Payment confirmed'}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 caption-2 text-emerald-950">
            <div className="flex items-center gap-2 title-5 text-[#047857]">
              <ShieldCheck className="h-4 w-4 shrink-0 text-[#047857]" weight="fill" />
              <span>Ready for gate entry</span>
            </div>
            <p className="mt-1 caption-4 leading-relaxed text-emerald-900">
              Show this QR code or share your Spot Access PIN at the gate entrance when you arrive.
            </p>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl bg-[#111827] px-3 py-2 button-sm text-white transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-black active:scale-[0.98]"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </section>
  );

  if (!asModal) return cardContent;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-3 sm:p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Booking Confirmation"
    >
      {cardContent}
    </div>
  );
};
