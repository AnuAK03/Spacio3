import QRCode from 'qrcode';
import { BookingRecord } from '../types/parkpool';

export interface BookingEntranceQrPayload {
  type: 'PARKPOOL_ENTRANCE_PASS';
  bookingId: string;
  arrivalTimestamp: string;
  facilityId: string;
  spaceCode: string;
  accessCode: string;
  signatureToken?: string;
}

/**
 * Computes an ISO-8601 arrival timestamp from the booking's scheduled start minute
 * and creation date (IST +05:30 for Bengaluru facilities).
 */
export function formatBookingArrivalTimestamp(booking: BookingRecord): string {
  const baseDate = booking.createdAt ? new Date(booking.createdAt) : new Date();
  const validDate = Number.isNaN(baseDate.getTime()) ? new Date() : baseDate;
  const year = validDate.getUTCFullYear();
  const month = String(validDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(validDate.getUTCDate()).padStart(2, '0');

  const clampedMin = Math.max(0, Math.min(23 * 60 + 59, Math.round(booking.startMin)));
  const hours = String(Math.floor(clampedMin / 60)).padStart(2, '0');
  const mins = String(clampedMin % 60).padStart(2, '0');

  return `${year}-${month}-${day}T${hours}:${mins}:00+05:30`;
}

export function buildBookingQrPayload(booking: BookingRecord): BookingEntranceQrPayload {
  return {
    type: 'PARKPOOL_ENTRANCE_PASS',
    bookingId: booking.id,
    arrivalTimestamp: formatBookingArrivalTimestamp(booking),
    facilityId: booking.facilityId,
    spaceCode: booking.spaceCode,
    accessCode: booking.accessCode,
    ...(booking.qrPassToken ? { signatureToken: booking.qrPassToken } : {}),
  };
}

export function encodeBookingQrPayload(payload: BookingEntranceQrPayload): string {
  return JSON.stringify(payload);
}

export async function generateBookingConfirmationQr(
  booking: BookingRecord,
  sizePx = 220
): Promise<{
  dataUrl: string;
  encodedPayload: string;
  payload: BookingEntranceQrPayload;
}> {
  const payload = buildBookingQrPayload(booking);
  const encodedPayload = encodeBookingQrPayload(payload);
  const dataUrl = await QRCode.toDataURL(encodedPayload, {
    width: sizePx * 2,
    margin: 2,
    color: {
      dark: '#111827',
      light: '#FFFFFF',
    },
    errorCorrectionLevel: 'M',
  });

  return {
    dataUrl,
    encodedPayload,
    payload,
  };
}
