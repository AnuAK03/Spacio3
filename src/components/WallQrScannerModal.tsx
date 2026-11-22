import React, { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import {
  Camera,
  CheckCircle2,
  KeyRound,
  QrCode,
  ScanLine,
  ShieldAlert,
  ShieldCheck,
  Upload,
  X,
} from 'lucide-react';
import { BookingRecord, Facility } from '../types/parkpool';
import { QrCodeDisplay } from './QrCodeDisplay';

interface WallQrScannerModalProps {
  booking: BookingRecord;
  facility?: Facility;
  onVerifyCheckin: (
    bookingId: string,
    payload: {
      scannedToken: string;
      scanMethod: 'camera' | 'upload' | 'gate_placard' | 'manual_token';
      arrivalMinutesLate: number;
    }
  ) => Promise<{ ok: boolean; error?: string }>;
  onClose: () => void;
}

type ScanTab = 'camera' | 'upload' | 'placard';

export const WallQrScannerModal: React.FC<WallQrScannerModalProps> = ({
  booking,
  facility,
  onVerifyCheckin,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<ScanTab>('camera');
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualToken, setManualToken] = useState('');
  const [arrivalMinutesLate, setArrivalMinutesLate] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [detectedToken, setDetectedToken] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const stopCamera = () => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        stopCamera();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      stopCamera();
    };
  }, [onClose]);

  const submitScannedToken = async (
    token: string,
    method: 'camera' | 'upload' | 'gate_placard' | 'manual_token'
  ) => {
    const cleaned = token.trim();
    if (!cleaned) {
      setStatusError('No QR token detected. Point camera at the spot wall QR or upload a clear photo.');
      return;
    }
    setStatusError(null);
    setSubmitting(true);
    try {
      const res = await onVerifyCheckin(booking.id, {
        scannedToken: cleaned,
        scanMethod: method,
        arrivalMinutesLate,
      });
      if (res.ok) {
        stopCamera();
        onClose();
      } else {
        setStatusError(res.error || 'Spot wall QR verification failed.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const startCamera = async () => {
    setCameraError(null);
    setStatusError(null);
    setDetectedToken(null);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError(
        'Camera access is unavailable in this browser context. Upload a photo of the wall QR or verify using the spot wall placard tab.'
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraActive(true);

      const attachAndScan = () => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas) return;
        video.srcObject = stream;
        void video.play().catch(() => {});

        const tick = () => {
          if (!streamRef.current || !videoRef.current || !canvasRef.current) return;
          const v = videoRef.current;
          if (v.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA && v.videoWidth > 0) {
            const c = canvasRef.current;
            c.width = v.videoWidth;
            c.height = v.videoHeight;
            const ctx = c.getContext('2d');
            if (ctx) {
              ctx.drawImage(v, 0, 0, c.width, c.height);
              const imgData = ctx.getImageData(0, 0, c.width, c.height);
              const code = jsQR(imgData.data, imgData.width, imgData.height, {
                inversionAttempts: 'dontInvert',
              });
              if (code?.data) {
                setDetectedToken(code.data);
                stopCamera();
                void submitScannedToken(code.data, 'camera');
                return;
              }
            }
          }
          rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
      };

      window.setTimeout(attachAndScan, 80);
    } catch {
      setCameraError(
        'Camera permission was denied or no camera was detected. You can upload a photo of the spot wall QR or scan the spot wall placard below.'
      );
      setCameraActive(false);
    }
  };

  const handleUploadQrPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatusError(null);
    setDetectedToken(null);

    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = img.width;
        c.height = img.height;
        const ctx = c.getContext('2d');
        if (!ctx) {
          setStatusError('Could not read uploaded image.');
          return;
        }
        ctx.drawImage(img, 0, 0);
        const imgData = ctx.getImageData(0, 0, c.width, c.height);
        const decoded = jsQR(imgData.data, imgData.width, imgData.height);
        if (!decoded?.data) {
          setStatusError(
            'Could not find a valid ParkPool QR code in that photo. Try a sharper image or use the Spot Wall Placard option.'
          );
          return;
        }
        setDetectedToken(decoded.data);
        void submitScannedToken(decoded.data, 'upload');
      };
      img.onerror = () => setStatusError('Invalid image file.');
      img.src = String(reader.result || '');
    };
    reader.readAsDataURL(file);
  };

  const gateToken = facility?.facilityGateQrToken || '';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/55 p-3 sm:p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Scan Spot Wall QR for Self Check-In"
    >
      <div className="relative my-auto w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-2xl border-2 border-[#4338CA] bg-white p-4 sm:p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-black/[0.06] pb-3.5">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <ScanLine className="h-5 w-5 shrink-0 text-[#4338CA]" />
              <h2 className="truncate font-display text-base sm:text-lg font-bold text-[#111827]">
                Backup Self Check-In · Scan Spot Wall QR
              </h2>
            </div>
            <p className="mt-0.5 text-xs text-[#4B5563]">
              Self checking in at {booking.facilityName}? Scan the mounted wall QR placard at Spot Entrance{' '}
              <strong className="text-[#111827]">{booking.entranceLabel}</strong> to check in to Spot{' '}
              {booking.spaceCode}.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              stopCamera();
              onClose();
            }}
            aria-label="Close scanner"
            className="shrink-0 rounded-lg border border-black/[0.08] p-1.5 text-[#4B5563] hover:text-[#111827]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Mode Tabs */}
        <div className="mt-4 grid grid-cols-3 gap-1.5 rounded-xl border border-black/[0.08] bg-[#F3F2EE] p-1">
          <button
            type="button"
            onClick={() => {
              setActiveTab('camera');
              setStatusError(null);
            }}
            className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition-colors ${
              activeTab === 'camera'
                ? 'bg-white text-[#4338CA] shadow-sm'
                : 'text-[#4B5563] hover:text-[#111827]'
            }`}
          >
            <Camera className="h-3.5 w-3.5" />
            <span>Live Camera</span>
          </button>
          <button
            type="button"
            onClick={() => {
              stopCamera();
              setActiveTab('upload');
              setStatusError(null);
            }}
            className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition-colors ${
              activeTab === 'upload'
                ? 'bg-white text-[#4338CA] shadow-sm'
                : 'text-[#4B5563] hover:text-[#111827]'
            }`}
          >
            <Upload className="h-3.5 w-3.5" />
            <span>Upload Photo</span>
          </button>
          <button
            type="button"
            onClick={() => {
              stopCamera();
              setActiveTab('placard');
              setStatusError(null);
            }}
            className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition-colors ${
              activeTab === 'placard'
                ? 'bg-white text-[#4338CA] shadow-sm'
                : 'text-[#4B5563] hover:text-[#111827]'
            }`}
          >
            <QrCode className="h-3.5 w-3.5" />
            <span>Spot Wall Placard</span>
          </button>
        </div>

        {/* Arrival Timing Selector */}
        <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-black/[0.06] bg-[#F8F7F4] px-3.5 py-2 text-xs">
          <span className="font-semibold text-[#374151]">Arrival timing:</span>
          <select
            value={arrivalMinutesLate}
            onChange={(e) => setArrivalMinutesLate(Number(e.target.value))}
            className="rounded-lg border border-black/[0.1] bg-white px-2.5 py-1 text-xs font-semibold text-[#111827]"
          >
            <option value={0}>On time (0 min late)</option>
            <option value={10}>10 min after start (within grace)</option>
            <option value={25}>25 min late (late arrival tag)</option>
          </select>
        </div>

        {statusError && (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-800">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
            <span>{statusError}</span>
          </div>
        )}

        {detectedToken && (
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs text-emerald-900">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-[#047857]" />
            <span className="truncate font-mono">QR detected — verifying spot check-in signature...</span>
          </div>
        )}

        {/* Camera Scanner */}
        {activeTab === 'camera' && (
          <div className="mt-4 space-y-3 rounded-2xl border border-black/[0.08] bg-[#F8F7F4] p-4 text-center">
            {cameraActive ? (
              <div className="relative overflow-hidden rounded-xl border border-indigo-200 bg-black">
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  className="h-56 w-full object-cover"
                />
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="h-36 w-36 rounded-2xl border-2 border-emerald-400 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
                </div>
                <canvas ref={canvasRef} className="hidden" />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-black/[0.14] bg-white px-4 py-8">
                <Camera className="h-9 w-9 text-[#4338CA]" />
                <div className="mt-2 font-display text-sm font-bold text-[#111827]">
                  Point Camera at Spot Wall QR Placard
                </div>
                <p className="mt-1 max-w-xs text-xs text-[#4B5563]">
                  Uses live device camera to verify the signed ParkPool wall placard at Spot Entrance{' '}
                  {booking.entranceLabel}.
                </p>
              </div>
            )}

            {cameraError && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 text-left">
                {cameraError}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-center gap-2">
              {!cameraActive ? (
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => void startCamera()}
                  className="flex items-center gap-1.5 rounded-xl bg-[#4338CA] px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-[#3730A3] disabled:opacity-50"
                >
                  <Camera className="h-3.5 w-3.5" />
                  <span>Start Camera Scanner</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={stopCamera}
                  className="rounded-xl border border-rose-200 bg-white px-4 py-2 text-xs font-bold text-rose-700 hover:bg-rose-50"
                >
                  Stop Camera
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  stopCamera();
                  setActiveTab('placard');
                }}
                className="rounded-xl border border-black/[0.1] bg-white px-3.5 py-2 text-xs font-semibold text-[#111827] hover:border-[#4338CA]"
              >
                Use Wall Placard / Code Instead
              </button>
            </div>
          </div>
        )}

        {/* Upload Photo */}
        {activeTab === 'upload' && (
          <div className="mt-4 space-y-3 rounded-2xl border border-black/[0.08] bg-[#F8F7F4] p-5 text-center">
            <Upload className="mx-auto h-9 w-9 text-[#4338CA]" />
            <div className="font-display text-sm font-bold text-[#111827]">
              Upload Photo of Spot Wall QR Placard
            </div>
            <p className="text-xs text-[#4B5563]">
              Take or select a photo of the QR code mounted near the parking spot entrance wall.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleUploadQrPhoto}
              className="hidden"
            />
            <button
              type="button"
              disabled={submitting}
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#4338CA] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#3730A3] disabled:opacity-50"
            >
              <Upload className="h-3.5 w-3.5" />
              <span>{submitting ? 'Verifying...' : 'Choose QR Photo'}</span>
            </button>
          </div>
        )}

        {/* Wall Placard & Manual Token */}
        {activeTab === 'placard' && (
          <div className="mt-4 space-y-3 rounded-2xl border border-black/[0.08] bg-[#F8F7F4] p-4">
            {gateToken && (
              <div className="flex flex-col items-center rounded-xl border border-emerald-200 bg-white p-3.5 text-center">
                <div className="mb-2 flex items-center gap-1.5 text-xs font-bold text-[#047857]">
                  <ShieldCheck className="h-4 w-4" />
                  <span>Spot Wall Placard · {booking.entranceLabel}</span>
                </div>
                <QrCodeDisplay
                  value={gateToken}
                  size={132}
                  label={`Spot wall QR for ${booking.facilityName}`}
                />
                <p className="mt-2 text-[11px] text-[#4B5563]">
                  Verified signed wall placard stationed at {booking.facilityName}.
                </p>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => void submitScannedToken(gateToken, 'gate_placard')}
                  className="mt-3 flex items-center gap-1.5 rounded-xl bg-[#047857] px-4 py-2 text-xs font-bold text-white hover:bg-[#065F46] disabled:opacity-50"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>
                    {submitting
                      ? 'Checking In...'
                      : `Verify Spot Wall QR & Check In to Spot ${booking.spaceCode}`}
                  </span>
                </button>
              </div>
            )}

            <div className="rounded-xl border border-black/[0.08] bg-white p-3.5">
              <label
                htmlFor="wall-qr-manual"
                className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-[#111827]"
              >
                <KeyRound className="h-3.5 w-3.5 text-[#4338CA]" />
                <span>Or Enter Spot Wall QR Token / Spot PIN</span>
              </label>
              <div className="flex gap-2">
                <input
                  id="wall-qr-manual"
                  type="text"
                  value={manualToken}
                  onChange={(e) => setManualToken(e.target.value)}
                  placeholder="PKP-GATE:... or Spot PIN"
                  className="min-w-0 flex-1 rounded-xl border border-black/[0.1] bg-[#F8F7F4] px-3 py-2 font-mono text-xs text-[#111827] focus:border-[#4338CA] focus:bg-white focus:outline-none"
                />
                <button
                  type="button"
                  disabled={submitting || !manualToken.trim()}
                  onClick={() => void submitScannedToken(manualToken, 'manual_token')}
                  className="shrink-0 rounded-xl bg-[#111827] px-4 py-2 text-xs font-bold text-white hover:bg-black disabled:opacity-50"
                >
                  {submitting ? 'Verifying...' : 'Verify'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
