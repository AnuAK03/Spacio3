import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  Compass,
  Crosshair,
  MapPin,
  Navigation,
  Pause,
  Play,
  RotateCcw,
} from 'lucide-react';
import { BengaluruLocation, BookingRecord, Facility } from '../types/parkpool';

interface LiveTrackingPanelProps {
  bookings: BookingRecord[];
  facilities: Facility[];
  locations: BengaluruLocation[];
  onCheckInBooking: (bookingId: string) => Promise<void>;
  onOpenMapDirections?: (bookingId: string) => void;
}

function calcDistanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.max(40, Math.round(R * c));
}

function formatDriveDistance(meters: number): { distText: string; etaMinutes: number } {
  if (meters >= 1000) {
    return {
      distText: `${(meters / 1000).toFixed(1)} km`,
      etaMinutes: Math.max(3, Math.round((meters / 1000) * 3.2)),
    };
  }
  return {
    distText: `${meters} m`,
    etaMinutes: Math.max(1, Math.round(meters / 250)),
  };
}

export const LiveTrackingPanel: React.FC<LiveTrackingPanelProps> = ({
  bookings,
  facilities,
  locations,
  onCheckInBooking,
  onOpenMapDirections,
}) => {
  const trackableBookings = useMemo(
    () =>
      bookings.filter(
        (b) =>
          b.status === 'confirmed' ||
          b.status === 'checked-in' ||
          b.status === 'occupied'
      ),
    [bookings]
  );

  // Prefer checked-in bookings first so simulated bay path appears immediately on check-in
  const defaultBooking = useMemo(
    () =>
      trackableBookings.find(
        (b) => b.status === 'checked-in' || b.status === 'occupied'
      ) || trackableBookings[0],
    [trackableBookings]
  );

  const [selectedBookingId, setSelectedBookingId] = useState<string>(defaultBooking?.id || '');

  useEffect(() => {
    if (!trackableBookings.some((b) => b.id === selectedBookingId)) {
      setSelectedBookingId(defaultBooking?.id || '');
    }
  }, [trackableBookings, defaultBooking, selectedBookingId]);

  const verifiedFacilities = useMemo(
    () => facilities.filter((f) => f.verificationStatus === 'verified'),
    [facilities]
  );
  const [fallbackFacilityId, setFallbackFacilityId] = useState<string>(
    verifiedFacilities[0]?.id || facilities[0]?.id || ''
  );

  const activeBooking =
    trackableBookings.find((b) => b.id === selectedBookingId) || defaultBooking;

  const activeFacility = activeBooking
    ? facilities.find((f) => f.id === activeBooking.facilityId)
    : verifiedFacilities.find((f) => f.id === fallbackFacilityId) || verifiedFacilities[0] || facilities[0];

  // Live Location vs Manual Existing Destination state
  const [liveLocationEnabled, setLiveLocationEnabled] = useState(false);
  const [liveCoords, setLiveCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [liveOutsideCity, setLiveOutsideCity] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [manualLocationId, setManualLocationId] = useState<string>(
    locations[0]?.id || 'LOC-PHX'
  );

  // CSS animation controls
  const [isPaused, setIsPaused] = useState(false);
  const [replayKey, setReplayKey] = useState(0);
  const [checkingIn, setCheckingIn] = useState(false);

  const watchIdRef = useRef<number | null>(null);

  const stopGpsWatch = () => {
    if (watchIdRef.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  };

  useEffect(() => {
    return () => stopGpsWatch();
  }, []);

  const handleToggleLiveLocation = () => {
    if (liveLocationEnabled) {
      stopGpsWatch();
      setLiveLocationEnabled(false);
      setLocationError(null);
      return;
    }

    if (!navigator.geolocation) {
      setLocationError(
        'Live location is not supported in this browser. Pick a starting place from the list instead.'
      );
      return;
    }

    setLocationError(null);
    setLiveLocationEnabled(true);

    const handleCoords = (pos: GeolocationPosition) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      const distFromBlr = calcDistanceMeters(lat, lng, 12.9716, 77.5946);
      if (distFromBlr <= 65000) {
        setLiveCoords({ lat, lng });
        setLiveOutsideCity(false);
      } else {
        setLiveCoords({ lat: 12.9716, lng: 77.5946 });
        setLiveOutsideCity(true);
      }
    };

    const handleErr = (err: GeolocationPositionError) => {
      stopGpsWatch();
      setLiveLocationEnabled(false);
      setLocationError(
        err.code === err.PERMISSION_DENIED
          ? 'Location permission was declined. Choose an existing starting point below instead.'
          : 'Could not read GPS signal. You can choose an existing starting point below.'
      );
    };

    navigator.geolocation.getCurrentPosition(handleCoords, handleErr, {
      enableHighAccuracy: true,
      timeout: 8000,
    });

    watchIdRef.current = navigator.geolocation.watchPosition(handleCoords, handleErr, {
      enableHighAccuracy: true,
      maximumAge: 10000,
    });
  };

  const manualLocation = useMemo(
    () => locations.find((l) => l.id === manualLocationId) || locations[0],
    [locations, manualLocationId]
  );

  if (!activeFacility) {
    return null;
  }

  const isCheckedIn = Boolean(
    activeBooking &&
      (activeBooking.status === 'checked-in' || activeBooking.status === 'occupied')
  );

  const originCoords =
    liveLocationEnabled && liveCoords
      ? liveCoords
      : manualLocation
      ? { lat: manualLocation.lat, lng: manualLocation.lng }
      : { lat: 12.9716, lng: 77.5946 };

  const originLabel = liveLocationEnabled
    ? liveOutsideCity
      ? 'Central Bengaluru (GPS fallback)'
      : 'Your Live GPS Location'
    : manualLocation?.name || 'Selected Starting Point';

  const driveMeters = calcDistanceMeters(
    originCoords.lat,
    originCoords.lng,
    activeFacility.entranceLat,
    activeFacility.entranceLng
  );
  const { distText, etaMinutes } = formatDriveDistance(driveMeters);

  const handleCheckInClick = async () => {
    if (!activeBooking) return;
    setCheckingIn(true);
    try {
      await onCheckInBooking(activeBooking.id);
      setIsPaused(false);
      setReplayKey((k) => k + 1);
    } finally {
      setCheckingIn(false);
    }
  };

  const isTwoWheeler = Boolean(
    activeBooking &&
      (activeBooking.vehicleLabel.toLowerCase().includes('ather') ||
        activeBooking.vehicleLabel.toLowerCase().includes('scooter') ||
        activeBooking.vehicleLabel.toLowerCase().includes('bike'))
  );

  return (
    <section
      aria-label="Live Vehicle Tracking"
      className="rounded-2xl border border-black/[0.08] bg-white/92 p-5 shadow-sm backdrop-blur-md"
    >
      {/* Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/[0.06] pb-3.5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Compass className="h-5 w-5 shrink-0 text-[#4338CA]" />
            <h2 className="font-display text-lg font-bold text-[#111827]">
              {isCheckedIn ? 'Live Spot Tracking' : 'Drive to Parking Location'}
            </h2>
          </div>
          <p className="mt-0.5 text-xs text-[#4B5563]">
            {isCheckedIn && activeBooking
              ? `Checked in at ${activeBooking.facilityName} — following path into Spot ${activeBooking.spaceCode}.`
              : `Enable live location or pick an existing starting point to track your drive to ${activeFacility.name}.`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {trackableBookings.length > 1 && activeBooking ? (
            <select
              aria-label="Select booking to track"
              value={activeBooking.id}
              onChange={(e) => {
                setSelectedBookingId(e.target.value);
                setReplayKey((k) => k + 1);
              }}
              className="rounded-xl border border-black/[0.1] bg-[#F8F7F4] px-3 py-1.5 text-xs font-semibold text-[#111827]"
            >
              {trackableBookings.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.facilityName} · Spot {b.spaceCode} (
                  {b.status === 'checked-in' || b.status === 'occupied'
                    ? 'Checked In'
                    : 'Drive to Parking Spot'}
                  )
                </option>
              ))}
            </select>
          ) : (
            !activeBooking &&
            verifiedFacilities.length > 0 && (
              <select
                aria-label="Select destination parking facility"
                value={activeFacility.id}
                onChange={(e) => {
                  setFallbackFacilityId(e.target.value);
                  setReplayKey((k) => k + 1);
                }}
                className="rounded-xl border border-black/[0.1] bg-[#F8F7F4] px-3 py-1.5 text-xs font-semibold text-[#111827]"
              >
                {verifiedFacilities.map((f) => (
                  <option key={f.id} value={f.id}>
                    Destination: {f.name}
                  </option>
                ))}
              </select>
            )
          )}

          {activeBooking && onOpenMapDirections && (
            <button
              type="button"
              onClick={() => onOpenMapDirections(activeBooking.id)}
              className="flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-xl border border-indigo-200 bg-indigo-50/80 px-3 py-2 text-xs font-bold text-[#4338CA] hover:bg-indigo-100"
            >
              <Navigation className="h-3.5 w-3.5" />
              <span>Live Map Directions</span>
            </button>
          )}

          {activeBooking && !isCheckedIn && (
            <button
              type="button"
              disabled={checkingIn}
              onClick={() => void handleCheckInClick()}
              className="flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-xl bg-[#047857] px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#065F46] disabled:opacity-50"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>{checkingIn ? 'Checking In...' : 'Arrived & Check In'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Location Source Controls (Live Location vs Manual Existing Location) */}
      {!isCheckedIn && (
        <div className="mt-4 flex flex-col gap-3 rounded-xl border border-black/[0.07] bg-[#F8F7F4] p-3.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleToggleLiveLocation}
              className={`flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-xl px-3.5 py-2 text-xs font-bold transition-colors ${
                liveLocationEnabled
                  ? 'bg-[#047857] text-white shadow-sm'
                  : 'border border-black/[0.12] bg-white text-[#111827] hover:border-[#047857]'
              }`}
            >
              <Crosshair className="h-3.5 w-3.5" />
              <span>{liveLocationEnabled ? 'Live Location On' : 'Enable Live Location'}</span>
            </button>

            {!liveLocationEnabled && (
              <div className="flex items-center gap-2">
                <label
                  htmlFor="manual-origin-select"
                  className="text-xs font-semibold text-[#4B5563] whitespace-nowrap"
                >
                  Start from:
                </label>
                <select
                  id="manual-origin-select"
                  value={manualLocation?.id || ''}
                  onChange={(e) => {
                    setManualLocationId(e.target.value);
                    setReplayKey((k) => k + 1);
                  }}
                  className="rounded-xl border border-black/[0.1] bg-white px-3 py-1.5 text-xs font-semibold text-[#111827]"
                >
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name} ({loc.area})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="flex items-center gap-4 text-xs">
            <div>
              <span className="text-[#4B5563]">Distance: </span>
              <strong className="font-mono tabular-nums text-[#111827]">{distText}</strong>
            </div>
            <div>
              <span className="text-[#4B5563]">Drive Time: </span>
              <strong className="font-mono tabular-nums text-[#C83709]">~{etaMinutes} min</strong>
            </div>
          </div>
        </div>
      )}

      {locationError && (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2 text-xs text-amber-900">
          {locationError}
        </div>
      )}

      {/* CSS-Animated Route Canvas */}
      <div className="mt-4 overflow-hidden rounded-2xl border border-black/[0.08] bg-[#F8F7F4] p-3 sm:p-4">
        <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 font-semibold text-[#111827]">
            <Navigation className="h-3.5 w-3.5 text-[#C83709]" />
            <span>
              {isCheckedIn && activeBooking
                ? `${activeFacility.entranceLabel} → Spot ${activeBooking.spaceCode}`
                : `${originLabel} → ${activeFacility.name}`}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsPaused((p) => !p)}
              className="flex items-center gap-1 rounded-lg border border-black/[0.1] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#111827] hover:bg-black/[0.03]"
            >
              {isPaused ? (
                <>
                  <Play className="h-3 w-3 text-[#047857]" />
                  <span>Resume</span>
                </>
              ) : (
                <>
                  <Pause className="h-3 w-3 text-[#4B5563]" />
                  <span>Pause</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                setIsPaused(false);
                setReplayKey((k) => k + 1);
              }}
              className="flex items-center gap-1 rounded-lg border border-black/[0.1] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#111827] hover:bg-black/[0.03]"
            >
              <RotateCcw className="h-3 w-3 text-[#4338CA]" />
              <span>Replay</span>
            </button>
          </div>
        </div>

        {/* Responsive SVG Track using pure CSS offset-path + keyframes */}
        <div className="relative w-full overflow-hidden rounded-xl border border-black/[0.06] bg-white">
          <svg
            key={replayKey}
            viewBox="0 0 640 220"
            className="block h-auto w-full"
            role="img"
            aria-label={
              isCheckedIn && activeBooking
                ? `Animated route showing vehicle parked in spot ${activeBooking.spaceCode}`
                : `Animated route showing drive from ${originLabel} to ${activeFacility.name}`
            }
          >
            {/* Subtle Map Grid */}
            <defs>
              <pattern id="trackGrid" width="32" height="32" patternUnits="userSpaceOnUse">
                <path
                  d="M 32 0 L 0 0 0 32"
                  fill="none"
                  stroke="#111827"
                  strokeOpacity="0.045"
                  strokeWidth="1"
                />
              </pattern>
            </defs>
            <rect width="640" height="220" fill="url(#trackGrid)" />

            {/* Decorative Parking Bay Lanes when Checked In */}
            {isCheckedIn && (
              <g stroke="#E5E7EB" strokeWidth="1.5" fill="#F9FAFB">
                <rect x="495" y="28" width="54" height="32" rx="6" />
                <rect x="556" y="28" width="54" height="32" rx="6" />
                <rect
                  x="538"
                  y="68"
                  width="64"
                  height="38"
                  rx="8"
                  fill="#ECFDF5"
                  stroke="#047857"
                  strokeWidth="2"
                />
                <rect x="495" y="138" width="54" height="32" rx="6" />
                <rect x="556" y="138" width="54" height="32" rx="6" />
              </g>
            )}

            {/* Predefined Drive / Entry Path Track */}
            <path
              d={
                isCheckedIn
                  ? 'M 58 164 C 145 164, 180 78, 285 78 S 415 154, 495 112 L 568 86'
                  : 'M 58 158 C 165 158, 225 66, 345 96 S 475 150, 568 88'
              }
              fill="none"
              stroke="#E5E7EB"
              strokeWidth="12"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d={
                isCheckedIn
                  ? 'M 58 164 C 145 164, 180 78, 285 78 S 415 154, 495 112 L 568 86'
                  : 'M 58 158 C 165 158, 225 66, 345 96 S 475 150, 568 88'
              }
              fill="none"
              stroke={isCheckedIn ? '#047857' : '#C83709'}
              strokeWidth="3.5"
              strokeDasharray="10 6"
              strokeLinecap="round"
              className={`live-track-dash ${isPaused ? 'live-track-paused' : ''}`}
            />

            {/* Waypoint: Start Node */}
            <g transform={isCheckedIn ? 'translate(58, 164)' : 'translate(58, 158)'}>
              <circle r="10" fill="#111827" />
              <circle r="4" fill="#FFFFFF" />
            </g>
            <text
              x="58"
              y="196"
              textAnchor="middle"
              fontSize="11"
              fontWeight="700"
              fill="#111827"
            >
              {isCheckedIn ? 'Spot Entrance' : 'Start Point'}
            </text>

            {/* Mid Checkpoint */}
            <g transform={isCheckedIn ? 'translate(285, 78)' : 'translate(345, 96)'}>
              <circle r="6" fill="#FFFFFF" stroke="#4338CA" strokeWidth="2.5" />
            </g>
            <text
              x={isCheckedIn ? 285 : 345}
              y={isCheckedIn ? 58 : 76}
              textAnchor="middle"
              fontSize="10.5"
              fontWeight="600"
              fill="#4338CA"
            >
              {isCheckedIn ? 'Driveway Lane' : `~${etaMinutes} min drive`}
            </text>

            {/* Target Destination Node */}
            <g transform={isCheckedIn ? 'translate(568, 86)' : 'translate(568, 88)'}>
              <circle
                r="16"
                fill={isCheckedIn ? '#047857' : '#C83709'}
                fillOpacity="0.2"
                className={`live-track-beacon ${isPaused ? 'live-track-paused' : ''}`}
              />
              <circle r="11" fill={isCheckedIn ? '#047857' : '#C83709'} />
              <text
                y="4"
                textAnchor="middle"
                fontSize="11"
                fontWeight="800"
                fill="#FFFFFF"
              >
                P
              </text>
            </g>
            <text
              x="568"
              y="124"
              textAnchor="middle"
              fontSize="11"
              fontWeight="700"
              fill={isCheckedIn ? '#047857' : '#C83709'}
            >
              {isCheckedIn && activeBooking ? `Spot ${activeBooking.spaceCode}` : 'Parking Spot'}
            </text>

            {/* CSS-Animated Moving Vehicle Marker */}
            <g
              className={`${
                isCheckedIn ? 'live-track-vehicle-parked' : 'live-track-vehicle-enroute'
              } ${isPaused ? 'live-track-paused' : ''}`}
            >
              <rect
                x="-15"
                y="-10"
                width="30"
                height="20"
                rx="6"
                fill="#111827"
                stroke="#FFFFFF"
                strokeWidth="2"
              />
              {/* Headlights */}
              <circle cx="13" cy="-5" r="2" fill="#FBBF24" />
              <circle cx="13" cy="5" r="2" fill="#FBBF24" />
              {/* Windshield / Rider indicator */}
              {isTwoWheeler ? (
                <circle cx="2" cy="0" r="4" fill="#34D399" />
              ) : (
                <rect x="2" y="-6" width="6" height="12" rx="2" fill="#60A5FA" />
              )}
            </g>
          </svg>
        </div>

        {/* Bottom Info Strip */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[#374151]">
          <span className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 text-[#047857]" />
            <span>
              <strong className="text-[#111827]">{activeFacility.name}</strong> ·{' '}
              {activeFacility.entranceLabel}
            </span>
          </span>
          {activeBooking ? (
            <span className="font-mono text-[11px] font-semibold text-[#4338CA]">
              {activeBooking.vehiclePlate || activeBooking.vehicleLabel} · Spot Access PIN{' '}
              {activeBooking.accessCode}
            </span>
          ) : (
            <span className="text-[11px] font-medium text-[#4B5563]">
              Book a spot to unlock live spot tracking
            </span>
          )}
        </div>
      </div>
    </section>
  );
};
