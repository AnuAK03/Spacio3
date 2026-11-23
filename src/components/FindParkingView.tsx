import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bicycle,
  Broadcast,
  Car,
  CaretDown,
  CheckCircle,
  Clock,
  Crosshair,
  Lightning,
  MagnifyingGlass,
  MapPin,
  PencilSimple,
  Plus,
  ShieldCheck,
  ShieldWarning,
  Star,
  UserCheck,
  X,
} from '@phosphor-icons/react';
import {
  AgentStageResult,
  AgentStreamEvent,
  BengaluruLocation,
  BookingRecord,
  CandidateEvaluation,
  DriverProfile,
  Facility,
  MultiAgentWorkflowRun,
  ParkingSpace,
  PrepaidWallet,
  SupervisorVerdict,
  UserSession,
  VehicleProfile,
  VehicleType,
  WheelerCategory,
} from '../types/parkpool';
import { BengaluruLiveMap } from './BengaluruLiveMap';
import { DriverProfilePayload } from './DriverProfileView';

interface FindParkingViewProps {
  user: UserSession;
  locations: BengaluruLocation[];
  facilities: Facility[];
  spaces: ParkingSpace[];
  bookings: BookingRecord[];
  vehicles: VehicleProfile[];
  selectedVehicleId: string;
  driverProfile?: DriverProfile;
  wallet?: PrepaidWallet;
  onSelectVehicle: (id: string) => void;
  onSelectLocation: (loc: BengaluruLocation) => Promise<void>;
  onSaveProfile: (payload: DriverProfilePayload) => Promise<void>;
  onCreateHold: (params: {
    spaceId: string;
    vehicleId: string;
    startMin: number;
    endMin: number;
  }) => Promise<BookingRecord | null>;
  onPayWithWallet: (bookingId: string) => Promise<BookingRecord | null>;
  onTopUpWallet: (amountInr: number) => Promise<void>;
  onNavigateDashboard: () => void;
  onNavigateProfile?: () => void;
}

function extractVehicleModel(v: VehicleProfile): string {
  const idx = v.label.lastIndexOf('(');
  if (idx > 0 && v.label.includes(v.plateNumber)) {
    return v.label.slice(0, idx).trim();
  }
  return v.label;
}

function calcPedestrianMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.max(80, Math.round((R * c * 1.2) / 10) * 10);
}

function formatDist(meters: number, minutes: number): string {
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km away`;
  return `${meters}m (${minutes} min walk)`;
}

const TIME_OPTIONS = Array.from({ length: 36 }, (_, i) => {
  const min = 6 * 60 + i * 30;
  const h24 = Math.floor(min / 60);
  const m = min % 60;
  const period = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return {
    min,
    hhmm: `${String(h24).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
    label: `${h12}:${String(m).padStart(2, '0')} ${period}`,
  };
});

const FILTER_MODES = [
  { id: 'all', label: 'All Verified' },
  { id: 'covered', label: 'Covered' },
  { id: 'ev', label: 'EV Charging' },
  { id: 'lowest', label: 'Lowest Price' },
] as const;

const AGENT_STEPS = [
  { order: 1, title: 'Details' },
  { order: 2, title: 'Location' },
  { order: 3, title: 'Spot Fit' },
  { order: 4, title: 'Price' },
  { order: 5, title: 'Ready' },
];

function fmt(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function fmt12(min: number): string {
  const h24 = Math.floor(min / 60);
  const m = min % 60;
  const period = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

export const FindParkingView: React.FC<FindParkingViewProps> = ({
  user,
  locations,
  facilities,
  spaces,
  bookings,
  vehicles,
  selectedVehicleId,
  driverProfile,
  wallet,
  onSelectVehicle,
  onSelectLocation,
  onSaveProfile,
  onCreateHold,
  onPayWithWallet,
  onTopUpWallet,
  onNavigateDashboard,
  onNavigateProfile,
}) => {
  const defaultLoc = locations[0] || {
    id: 'LOC-PHX',
    name: 'Phoenix Mall of Asia',
    area: 'Hebbal / Byatarayanapura',
    lat: 13.0766,
    lng: 77.5944,
    source: 'hub',
  };

  // Applied Search State (drives map and space results)
  const [activeLocation, setActiveLocation] = useState<BengaluruLocation>(defaultLoc);
  const [appliedStartMin, setAppliedStartMin] = useState(14 * 60);
  const [appliedEndMin, setAppliedEndMin] = useState(17 * 60 + 30);
  const [appliedFilterMode, setAppliedFilterMode] = useState<'all' | 'covered' | 'ev' | 'lowest'>('all');
  const [appliedWheelerCategory, setAppliedWheelerCategory] = useState<WheelerCategory>(
    driverProfile?.wheelerCategory || 'four_wheeler'
  );

  // Draft Search State (staged until user presses Search button)
  const [draftLocation, setDraftLocation] = useState<BengaluruLocation>(defaultLoc);
  const [locationQuery, setLocationQuery] = useState(defaultLoc.name);
  const [locationResults, setLocationResults] = useState<BengaluruLocation[]>(locations);
  const [locationDropdownOpen, setLocationDropdownOpen] = useState(false);
  const [searchingLocations, setSearchingLocations] = useState(false);
  const locationBoxRef = useRef<HTMLDivElement | null>(null);

  const [draftStartMin, setDraftStartMin] = useState(14 * 60);
  const [draftEndMin, setDraftEndMin] = useState(17 * 60 + 30);
  const [draftFilterMode, setDraftFilterMode] = useState<'all' | 'covered' | 'ev' | 'lowest'>('all');
  const [draftWheelerCategory, setDraftWheelerCategory] = useState<WheelerCategory>(
    driverProfile?.wheelerCategory || 'four_wheeler'
  );
  const [draftVehicleId, setDraftVehicleId] = useState<string>(selectedVehicleId);
  const [selectedFacilityId, setSelectedFacilityId] = useState<string>('FAC-01');

  // GPS / Current Location Access State
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsStatusMsg, setGpsStatusMsg] = useState<string | null>(null);

  // Inline Quick-Edit / Mandatory Profile Enrollment State
  const [inlineEditOpen, setInlineEditOpen] = useState(false);
  const [enrollmentModalOpen, setEnrollmentModalOpen] = useState(false);
  const [pendingBookBay, setPendingBookBay] = useState<CandidateEvaluation | null>(null);

  const [formFullName, setFormFullName] = useState(driverProfile?.fullName || user.name);
  const [formPhone, setFormPhone] = useState(driverProfile?.phone || '+91 ');
  const [formLicense, setFormLicense] = useState(driverProfile?.licenseNumber || '');
  const [formLicenseValidTill, setFormLicenseValidTill] = useState(
    driverProfile?.licenseValidTill || '2032-12-31'
  );
  const [formWheeler, setFormWheeler] = useState<WheelerCategory>(
    driverProfile?.wheelerCategory || 'four_wheeler'
  );
  const [formVehicleType, setFormVehicleType] = useState<VehicleType>(
    driverProfile?.vehicleType || 'suv'
  );
  const [formVehicleModel, setFormVehicleModel] = useState(driverProfile?.vehicleModel || '');
  const [formPlateNumber, setFormPlateNumber] = useState(driverProfile?.plateNumber || '');
  const [formIsEv, setFormIsEv] = useState(driverProfile?.isEv ?? false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileFormError, setProfileFormError] = useState<string | null>(null);

  // Sync saved profile defaults when loaded or updated
  useEffect(() => {
    if (!driverProfile) return;
    setFormFullName(driverProfile.fullName);
    setFormPhone(driverProfile.phone);
    setFormLicense(driverProfile.licenseNumber);
    setFormLicenseValidTill(driverProfile.licenseValidTill);
    setFormWheeler(driverProfile.wheelerCategory);
    setFormVehicleType(driverProfile.vehicleType);
    setFormVehicleModel(driverProfile.vehicleModel);
    setFormPlateNumber(driverProfile.plateNumber);
    setFormIsEv(driverProfile.isEv);
  }, [driverProfile]);

  useEffect(() => {
    if (!selectedVehicleId) return;
    setDraftVehicleId(selectedVehicleId);
    const active = vehicles.find((v) => v.id === selectedVehicleId);
    if (active) {
      setDraftWheelerCategory(active.wheelerCategory);
      setAppliedWheelerCategory(active.wheelerCategory);
    }
  }, [selectedVehicleId, vehicles]);

  useEffect(() => {
    const onOutsideClick = (e: MouseEvent) => {
      if (locationBoxRef.current && !locationBoxRef.current.contains(e.target as Node)) {
        setLocationDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', onOutsideClick);
    return () => document.removeEventListener('mousedown', onOutsideClick);
  }, []);

  useEffect(() => {
    const q = locationQuery.trim();
    if (!locationDropdownOpen) return;
    if (!q || q === draftLocation.name) {
      setLocationResults(locations);
      return;
    }

    const timer = window.setTimeout(async () => {
      setSearchingLocations(true);
      try {
        const res = await fetch(`/api/locations/search?q=${encodeURIComponent(q)}`);
        if (res.ok) {
          const data = (await res.json()) as { results: BengaluruLocation[] };
          setLocationResults(data.results);
        }
      } finally {
        setSearchingLocations(false);
      }
    }, 260);

    return () => window.clearTimeout(timer);
  }, [locationQuery, locationDropdownOpen, locations, draftLocation.name]);

  const registeredVehicles = useMemo(() => {
    const cleanEmail = user.email.trim().toLowerCase();
    return vehicles.filter(
      (v) =>
        v.ownerEmail?.toLowerCase() === cleanEmail ||
        (driverProfile?.registeredVehicleId && v.id === driverProfile.registeredVehicleId)
    );
  }, [vehicles, user.email, driverProfile?.registeredVehicleId]);

  const headerVehicleOptions =
    registeredVehicles.length > 0 ? registeredVehicles : vehicles.slice(0, 4);

  const filteredDraftVehicles = useMemo(
    () => vehicles.filter((v) => v.wheelerCategory === draftWheelerCategory),
    [vehicles, draftWheelerCategory]
  );

  const filteredAppliedVehicles = useMemo(
    () => vehicles.filter((v) => v.wheelerCategory === appliedWheelerCategory),
    [vehicles, appliedWheelerCategory]
  );

  const draftVehicle =
    filteredDraftVehicles.find((v) => v.id === draftVehicleId) ||
    filteredDraftVehicles[0] ||
    vehicles[0];

  const vehicle =
    filteredAppliedVehicles.find((v) => v.id === selectedVehicleId) ||
    vehicles.find((v) => v.id === selectedVehicleId) ||
    filteredAppliedVehicles[0] ||
    vehicles[0];

  const handleHeaderVehicleSwitch = (chosen: VehicleProfile) => {
    onSelectVehicle(chosen.id);
    setDraftVehicleId(chosen.id);
    setDraftWheelerCategory(chosen.wheelerCategory);
    setAppliedWheelerCategory(chosen.wheelerCategory);
  };

  const handleDraftWheelerSwitch = (category: WheelerCategory) => {
    setDraftWheelerCategory(category);
    const matching = vehicles.filter((v) => v.wheelerCategory === category);
    if (matching.length > 0) {
      const ownRegistered = driverProfile
        ? matching.find((m) => m.id === driverProfile.registeredVehicleId)
        : undefined;
      setDraftVehicleId((ownRegistered || matching[0]).id);
    }
  };

  const handleDraftStartChange = (newStart: number) => {
    setDraftStartMin(newStart);
    if (draftEndMin <= newStart) {
      setDraftEndMin(Math.min(23 * 60 + 30, newStart + 180));
    }
  };

  const handleUseCurrentLocation = () => {
    setGpsStatusMsg(null);
    if (!navigator.geolocation) {
      setGpsStatusMsg('Location access is not supported in this browser.');
      return;
    }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const rawLat = pos.coords.latitude;
        const rawLng = pos.coords.longitude;
        // Check if within Bengaluru metro corridor (~65km radius of MG Road)
        const distFromBlr = calcPedestrianMeters(rawLat, rawLng, 12.9716, 77.5946);
        const insideBengaluru = distFromBlr <= 65000;
        const resolvedLoc: BengaluruLocation = insideBengaluru
          ? {
              id: 'LOC-GPS',
              name: 'My Current Location (GPS)',
              area: 'Live Device Location',
              lat: Number(rawLat.toFixed(5)),
              lng: Number(rawLng.toFixed(5)),
              source: 'hub',
            }
          : {
              id: 'LOC-GPS-BLR',
              name: 'Central Bengaluru (MG Road)',
              area: 'Outside Bengaluru GPS, snapped to city center',
              lat: 12.9716,
              lng: 77.5946,
              source: 'hub',
            };

        setDraftLocation(resolvedLoc);
        setLocationQuery(resolvedLoc.name);
        setActiveLocation(resolvedLoc);
        setLocationDropdownOpen(false);
        await onSelectLocation(resolvedLoc);
        setGpsStatusMsg(
          insideBengaluru
            ? 'Showing verified parking spots nearest to your live location.'
            : 'Your device GPS is outside Bengaluru, showing spots near Central Bengaluru.'
        );
        setGpsLoading(false);
      },
      (err) => {
        setGpsLoading(false);
        setGpsStatusMsg(
          err.code === err.PERMISSION_DENIED
            ? 'Location permission was declined. You can allow location access in your browser or search an area above.'
            : 'Could not detect your current GPS position. Please pick a location from the list.'
        );
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    );
  };

  const saveInlineProfileIfValid = async (): Promise<boolean> => {
    setProfileFormError(null);
    setProfileSaving(true);
    try {
      await onSaveProfile({
        fullName: formFullName,
        email: user.email,
        phone: formPhone,
        licenseNumber: formLicense,
        licenseValidTill: formLicenseValidTill,
        wheelerCategory: formWheeler,
        vehicleType: formWheeler === 'two_wheeler' ? 'two_wheeler' : formVehicleType,
        vehicleModel: formVehicleModel,
        plateNumber: formPlateNumber,
        isEv: formIsEv,
      });
      setDraftWheelerCategory(formWheeler);
      setAppliedWheelerCategory(formWheeler);
      setInlineEditOpen(false);
      return true;
    } catch (err: unknown) {
      setProfileFormError(
        err instanceof Error ? err.message : 'Please check your license and vehicle details.'
      );
      return false;
    } finally {
      setProfileSaving(false);
    }
  };

  // Explicit Search Button Handler: saves any open inline vehicle/license edit & commits all filters
  const handleApplySearch = async () => {
    setLocationDropdownOpen(false);
    if (inlineEditOpen) {
      const saved = await saveInlineProfileIfValid();
      if (!saved) return;
    }

    let chosenLoc = draftLocation;
    const trimmed = locationQuery.trim();
    if (trimmed && trimmed !== draftLocation.name) {
      const exactMatch = locations.find(
        (l) => l.name.toLowerCase() === trimmed.toLowerCase()
      );
      if (exactMatch) {
        chosenLoc = exactMatch;
      } else if (locationResults.length > 0) {
        chosenLoc = locationResults[0];
        setLocationQuery(chosenLoc.name);
      }
      setDraftLocation(chosenLoc);
    }

    setActiveLocation(chosenLoc);
    setAppliedStartMin(draftStartMin);
    setAppliedEndMin(draftEndMin);
    setAppliedFilterMode(draftFilterMode);
    setAppliedWheelerCategory(draftWheelerCategory);
    if (draftVehicle?.id) {
      onSelectVehicle(draftVehicle.id);
    }
    await onSelectLocation(chosenLoc);
  };

  const hasPendingSearchChanges =
    draftLocation.id !== activeLocation.id ||
    locationQuery.trim() !== activeLocation.name ||
    draftStartMin !== appliedStartMin ||
    draftEndMin !== appliedEndMin ||
    draftFilterMode !== appliedFilterMode ||
    draftWheelerCategory !== appliedWheelerCategory ||
    draftVehicle?.id !== selectedVehicleId ||
    inlineEditOpen;

  // Pop-Up Booking Verification & Confirmation Modal State
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [targetBay, setTargetBay] = useState<CandidateEvaluation | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [activeStage, setActiveStage] = useState<number | null>(null);
  const [completedStages, setCompletedStages] = useState<Record<number, AgentStageResult>>({});
  const [supervisorNote, setSupervisorNote] = useState<{
    verdict: SupervisorVerdict | 'CHECKING';
    text: string;
  }>({ verdict: 'CHECKING', text: 'Checking bay availability and rules...' });
  const [finalRun, setFinalRun] = useState<MultiAgentWorkflowRun | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmedBooking, setConfirmedBooking] = useState<BookingRecord | null>(null);
  const [mapDirectionsActive, setMapDirectionsActive] = useState(false);
  const [bookedNavigationTarget, setBookedNavigationTarget] = useState<{
    bookingId: string;
    facilityId: string;
    spaceCode: string;
  } | null>(null);

  const activeSlot = useMemo(
    () => ({
      startMin: appliedStartMin,
      endMin: appliedEndMin,
      start: fmt(appliedStartMin),
      end: fmt(appliedEndMin),
      label: `${fmt12(appliedStartMin)} to ${fmt12(appliedEndMin)}`,
    }),
    [appliedStartMin, appliedEndMin]
  );

  const evaluatedList = useMemo<CandidateEvaluation[]>(() => {
    const wheelerMatchedSpaces = spaces.filter(
      (space) =>
        space.publicationStatus === 'approved' &&
        (appliedWheelerCategory === 'two_wheeler'
          ? space.allowedTypes.includes('two_wheeler')
          : space.allowedTypes.some((t) => t !== 'two_wheeler'))
    );

    const raw = wheelerMatchedSpaces
      .map((space) => {
        const fac = facilities.find((f) => f.id === space.facilityId);
        if (!fac) return null;
        const rejectionReasons: string[] = [];

        const authOk = fac.verificationStatus === 'verified' && fac.operationalChecksPassed;
        if (!authOk) rejectionReasons.push('Verification pending');

        const vehicleOk =
          space.allowedTypes.includes(vehicle.vehicleType) &&
          vehicle.lengthCm <= space.maxLengthCm &&
          vehicle.widthCm <= space.maxWidthCm &&
          vehicle.heightCm <= space.maxHeightCm;
        if (!vehicleOk) rejectionReasons.push('Too small for your vehicle');

        const opsOk =
          activeSlot.startMin >= space.operatingStartMin &&
          activeSlot.endMin <= space.hardDepartureMin;
        if (!opsOk) rejectionReasons.push(`Closes at ${fmt12(space.hardDepartureMin)}`);

        const activeBks = bookings.filter(
          (b) =>
            b.spaceId === space.id &&
            (b.status === 'held' ||
              b.status === 'confirmed' ||
              b.status === 'checked-in' ||
              b.status === 'occupied')
        );
        const bkConflict = activeBks[0];
        if (bkConflict) {
          rejectionReasons.push(
            `Booked ${fmt12(bkConflict.startMin)} to ${fmt12(bkConflict.endMin)}`
          );
        }

        const todayIso = new Date().toISOString().slice(0, 10);
        const ownerConflict = space.ownerBlocks.find(
          (ob) =>
            (!ob.date || ob.date === todayIso) &&
            (ob.type === 'booking' ||
              (activeSlot.startMin < ob.endMin &&
                activeSlot.endMin > ob.startMin - space.bufferMinutes))
        );
        if (ownerConflict) {
          rejectionReasons.push(
            ownerConflict.type === 'booking'
              ? `Booked ${fmt12(ownerConflict.startMin)} to ${fmt12(ownerConflict.endMin)}`
              : `Host reserved from ${fmt12(ownerConflict.startMin)}`
          );
        }

        const occState = space.occupancyState || 'AVAILABLE';
        const clearanceActive =
          occState === 'CLEARANCE' &&
          (!space.clearanceEndsAt || Date.now() < Date.parse(space.clearanceEndsAt));
        const occupancyBlocked =
          occState === 'BOOKED' ||
          occState === 'OCCUPIED' ||
          occState === 'OVERSTAY' ||
          occState === 'DEPARTURE_PENDING' ||
          clearanceActive;
        if (occupancyBlocked) {
          rejectionReasons.push(
            occState === 'BOOKED' || occState === 'OCCUPIED'
              ? 'Slot allotted until checkout and turnaround buffer complete'
              : occState === 'OVERSTAY'
              ? 'Previous vehicle still in bay (Overstay locked)'
              : occState === 'DEPARTURE_PENDING'
              ? 'Driver departing, awaiting confirmation'
              : `${space.bufferMinutes || 15} min clearance turnaround buffer active`
          );
        }

        const eligible =
          authOk && vehicleOk && opsOk && !bkConflict && !ownerConflict && !occupancyBlocked;
        const hours = Math.max(0.5, (activeSlot.endMin - activeSlot.startMin) / 60);
        const base = Math.round(hours * space.hourlyPriceInr);
        const fee = Math.max(10, Math.round(base * 0.1));
        const gst = Math.round((base + fee) * 0.18);
        const totalQuoteInr = base + fee + gst;

        const avgRating =
          space.reviews.length > 0
            ? Number(
                (space.reviews.reduce((a, r) => a + r.rating, 0) / space.reviews.length).toFixed(1)
              )
            : 4.5;

        const dynamicDistM = calcPedestrianMeters(
          activeLocation.lat,
          activeLocation.lng,
          fac.entranceLat,
          fac.entranceLng
        );
        const dynamicWalkMin = Math.max(2, Math.round(dynamicDistM / 75));

        return {
          spaceId: space.id,
          facilityId: fac.id,
          facilityName: fac.name,
          spaceCode: space.spaceCode,
          providerType: fac.providerType,
          verificationStatus: fac.verificationStatus,
          eligible,
          rejectionReasons,
          constraintChecks: [],
          walkingDistanceM: dynamicDistM,
          walkingMinutes: dynamicWalkMin,
          entranceLabel: fac.entranceLabel,
          hourlyPriceInr: space.hourlyPriceInr,
          durationHours: hours,
          baseAmountInr: base,
          platformFeeInr: fee,
          gstInr: gst,
          totalQuoteInr,
          score: eligible ? Math.max(10, Math.round(100 - dynamicDistM * 0.02)) : 0,
          scoreBreakdown: {
            distanceFit: 0,
            priceFit: 0,
            safetyAmenityFit: 0,
            reviewFit: 0,
            availabilityFit: eligible ? 100 : 0,
          },
          covered: space.covered,
          evCharging: space.evCharging,
          avgRating,
          reviewCount: space.reviews.length,
          evidenceSummary: fac.walkPathSafety,
          restrictions: space.restrictions.length > 0 ? space.restrictions : fac.restrictions,
          lateArrivalSummary: fac.lateArrivalPolicy?.summary,
        };
      })
      .filter((c): c is NonNullable<typeof c> => c !== null);

    const filtered = raw.filter((c) => {
      if (c.verificationStatus !== 'verified') return false;
      if (!c.eligible) return false;
      if (appliedFilterMode === 'covered' && !c.covered) return false;
      if (appliedFilterMode === 'ev' && !c.evCharging) return false;
      return true;
    });

    const sorted = filtered.sort((a, b) => {
      if (appliedFilterMode === 'lowest') {
        return a.hourlyPriceInr - b.hourlyPriceInr;
      }
      return a.walkingDistanceM - b.walkingDistanceM;
    });

    const withinCluster = sorted.filter((c) => c.walkingDistanceM <= 1800);
    return withinCluster.length >= 5
      ? withinCluster
      : sorted.slice(0, Math.max(6, withinCluster.length));
  }, [
    spaces,
    facilities,
    bookings,
    vehicle,
    appliedWheelerCategory,
    activeSlot,
    appliedFilterMode,
    activeLocation,
  ]);

  const nearbyFacilities = useMemo(() => {
    const evalFacIds = new Set(evaluatedList.map((e) => e.facilityId));
    return facilities.filter(
      (f) =>
        f.verificationStatus === 'verified' &&
        (evalFacIds.has(f.id) ||
          (bookedNavigationTarget && bookedNavigationTarget.facilityId === f.id))
    );
  }, [facilities, evaluatedList, bookedNavigationTarget]);

  const distinctFacilityCount = useMemo(
    () => new Set(evaluatedList.map((e) => e.facilityId)).size,
    [evaluatedList]
  );

  useEffect(() => {
    if (evaluatedList.length === 0) return;
    if (!evaluatedList.some((e) => e.facilityId === selectedFacilityId)) {
      const firstEligible = evaluatedList.find((e) => e.eligible) || evaluatedList[0];
      setSelectedFacilityId(firstEligible.facilityId);
    }
  }, [evaluatedList, selectedFacilityId]);

  const beginBookingPopup = async (bay: CandidateEvaluation) => {
    setTargetBay(bay);
    setConfirmedBooking(null);
    setSelectedFacilityId(bay.facilityId);
    setCheckoutModalOpen(true);
    setVerifying(true);
    setVerifyError(null);
    setFinalRun(null);
    setCompletedStages({});
    setActiveStage(1);
    setSupervisorNote({
      verdict: 'CHECKING',
      text: `Checking spot ${bay.spaceCode} at ${bay.facilityName} for your vehicle...`,
    });

    try {
      const response = await fetch('/api/agents/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `Book ${bay.spaceCode} at ${bay.facilityName} near ${activeLocation.name} from ${activeSlot.start} to ${activeSlot.end}.`,
          vehicleId: vehicle.id,
          defaultStartTime: activeSlot.start,
          defaultEndTime: activeSlot.end,
          faultInjectionEnabled: false,
          targetSpaceId: bay.spaceId,
          destinationCoords: { lat: activeLocation.lat, lng: activeLocation.lng },
        }),
      });

      if (!response.ok || !response.body) {
        const errBody = await response.json().catch(() => ({}));
        throw new Error(errBody.error || 'Availability check failed');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const frames = buffer.split('\n\n');
        buffer = frames.pop() ?? '';

        for (const frame of frames) {
          const line = frame.trim();
          if (!line.startsWith('data:')) continue;
          const jsonStr = line.slice(5).trim();
          if (!jsonStr) continue;
          const ev: AgentStreamEvent = JSON.parse(jsonStr);

          if (ev.type === 'stage_start') {
            setActiveStage(ev.stageOrder);
            setSupervisorNote({ verdict: 'CHECKING', text: ev.message });
          } else if (ev.type === 'supervisor_check') {
            setSupervisorNote({ verdict: ev.verdict, text: ev.message });
          } else if (ev.type === 'stage_complete') {
            setCompletedStages((prev) => ({ ...prev, [ev.stage.stageOrder]: ev.stage }));
          } else if (ev.type === 'workflow_complete') {
            setFinalRun(ev.run);
            setActiveStage(null);
          } else if (ev.type === 'workflow_error') {
            throw new Error(ev.error);
          }
        }
      }
    } catch (err: unknown) {
      setVerifyError(err instanceof Error ? err.message : 'Unable to check spot availability');
      setActiveStage(null);
    } finally {
      setVerifying(false);
    }
  };

  const handleBookNowClick = (bay: CandidateEvaluation) => {
    // Require complete Driver Profile (Driving License & Vehicle Number) before first booking
    if (!driverProfile || !driverProfile.licenseNumber || !driverProfile.plateNumber) {
      setPendingBookBay(bay);
      setProfileFormError(null);
      setEnrollmentModalOpen(true);
      return;
    }
    void beginBookingPopup(bay);
  };

  const handleEnrollmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await saveInlineProfileIfValid();
    if (!ok) return;
    setEnrollmentModalOpen(false);
    if (pendingBookBay) {
      const bay = pendingBookBay;
      setPendingBookBay(null);
      void beginBookingPopup(bay);
    }
  };

  const handleConfirmAndPay = async () => {
    if (!targetBay) return;
    setConfirming(true);
    try {
      const created = await onCreateHold({
        spaceId: targetBay.spaceId,
        vehicleId: vehicle.id,
        startMin: activeSlot.startMin,
        endMin: activeSlot.endMin,
      });
      if (!created) return;

      const walletPaid = await onPayWithWallet(created.id);
      if (walletPaid) {
        setConfirmedBooking(walletPaid);
        return;
      }

      setCheckoutModalOpen(false);
      onNavigateDashboard();
    } finally {
      setConfirming(false);
    }
  };

  const targetFacility = targetBay
    ? facilities.find((f) => f.id === targetBay.facilityId)
    : undefined;

  return (
    <div className="space-y-6">
      {/* FindParkingView Header with Active Vehicle Readout & Visual Vehicle Switcher */}
      <header className="rounded-2xl border border-black/[0.08] bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="heading-5 text-[#111827]">
              Find verified parking
            </h1>
            <p className="body-6 mt-1 text-[#4B5563]">
              Choose your vehicle for this booking session and inspect compatible Bengaluru bays in real time.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {vehicle && (
              <div className="flex items-center gap-3 rounded-xl border border-[#D93F0B]/30 bg-[#FFF8F5] px-3 py-2">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#FFF0EA] text-[#C83709]">
                  {vehicle.wheelerCategory === 'two_wheeler' ? (
                    <Bicycle className="h-4 w-4" weight="bold" />
                  ) : (
                    <Car className="h-4 w-4" weight="bold" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="caption-4 uppercase tracking-wider text-[#4B5563]">
                    Active Vehicle
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="title-5 truncate text-[#111827]">
                      {extractVehicleModel(vehicle)}
                    </span>
                    <span className="caption-3 font-mono uppercase text-[#C83709]">
                      {vehicle.plateNumber}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {onNavigateProfile && (
              <button
                type="button"
                onClick={onNavigateProfile}
                className="button-xsm inline-flex items-center gap-1.5 rounded-xl border border-black/[0.1] bg-[#F8F7F4] px-3 py-2 text-[#111827] transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:border-[#D93F0B] hover:text-[#C83709] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D93F0B]/40"
              >
                <Plus className="h-3.5 w-3.5" weight="bold" />
                <span>{registeredVehicles.length > 0 ? 'Add vehicle' : 'Register vehicle'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Visual Registered Vehicle Switcher */}
        <div className="mt-4 rounded-xl border border-black/[0.06] bg-[#F8F7F4] p-3">
          <div className="caption-4 mb-2 flex items-center justify-between text-[#4B5563]">
            <span>
              {registeredVehicles.length > 0
                ? 'Switch registered vehicle for upcoming booking'
                : 'Select vehicle profile (register your own in My Profile)'}
            </span>
            <span className="caption-3 tabular-nums text-[#111827]">
              {headerVehicleOptions.length}{' '}
              {headerVehicleOptions.length === 1 ? 'vehicle' : 'vehicles'}
            </span>
          </div>

          <div
            role="radiogroup"
            aria-label="Switch active vehicle for booking"
            className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4"
          >
            {headerVehicleOptions.map((v) => {
              const active = v.id === vehicle?.id;
              const modelName = extractVehicleModel(v);
              return (
                <button
                  key={v.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => handleHeaderVehicleSwitch(v)}
                  className={`flex items-center justify-between gap-2.5 rounded-lg border px-3 py-2 text-left transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D93F0B]/40 ${
                    active
                      ? 'border-[#D93F0B] bg-[#FFF0EA] ring-1 ring-[#D93F0B] shadow-sm'
                      : 'border-black/[0.08] bg-white hover:border-[#FDBA74]'
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${
                        active
                          ? 'bg-[#C83709] text-white'
                          : 'border border-black/[0.08] bg-[#F8F7F4] text-[#374151]'
                      }`}
                    >
                      {v.wheelerCategory === 'two_wheeler' ? (
                        <Bicycle className="h-4 w-4" weight="bold" />
                      ) : (
                        <Car className="h-4 w-4" weight="bold" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="title-5 truncate text-[#111827]">
                        {modelName}
                      </div>
                      <div className="caption-3 mt-0.5 flex items-center gap-1.5 font-mono uppercase text-[#C83709]">
                        <span>{v.plateNumber}</span>
                        {v.isEv && (
                          <Lightning
                            aria-label="Electric Vehicle"
                            className="h-3 w-3 shrink-0 text-[#047857]"
                            weight="fill"
                          />
                        )}
                      </div>
                    </div>
                  </div>
                  {active && (
                    <CheckCircle className="h-4 w-4 shrink-0 text-[#C83709]" weight="fill" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Search & Filter Panel with Personal Location Access + Inline Vehicle/License Edit + Search Button */}
      <section className="rounded-2xl border border-black/[0.08] bg-white p-4 shadow-sm sm:p-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-12">
          {/* Destination + Personal Current Location */}
          <div className="sm:col-span-2 lg:col-span-4" ref={locationBoxRef}>
            <div className="mb-1 flex items-center justify-between gap-2">
              <label htmlFor="find-dest" className="caption-3 text-[#4B5563]">
                Where are you going?
              </label>
              <button
                type="button"
                onClick={handleUseCurrentLocation}
                disabled={gpsLoading}
                className="caption-3 flex items-center gap-1 text-[#047857] transition-colors duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:underline disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#047857]/40 rounded"
              >
                <Crosshair className="h-3.5 w-3.5" weight="bold" />
                <span>{gpsLoading ? 'Detecting GPS...' : 'Use current location'}</span>
              </button>
            </div>
            <div className="relative">
              <MagnifyingGlass className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-[#C83709]" weight="bold" />
              <input
                id="find-dest"
                type="text"
                value={locationQuery}
                onFocus={() => {
                  setLocationResults(locations);
                  setLocationDropdownOpen(true);
                }}
                onChange={(e) => {
                  setLocationQuery(e.target.value);
                  setLocationDropdownOpen(true);
                }}
                placeholder="Search Indiranagar, MG Road, Mall..."
                className="body-5 w-full rounded-xl border border-black/[0.1] bg-[#F8F7F4] py-2 pl-9 pr-8 text-[#111827] transition-colors duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] focus:border-[#D93F0B] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#D93F0B]/20"
              />
              <button
                type="button"
                aria-label="Browse Bengaluru locations"
                onClick={() => {
                  setLocationResults(locations);
                  setLocationDropdownOpen((o) => !o);
                }}
                className="absolute right-2.5 top-2.5 text-[#4B5563] transition-colors duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:text-[#111827]"
              >
                <CaretDown className="h-4 w-4" weight="bold" />
              </button>

              {locationDropdownOpen && (
                <div className="absolute left-0 right-0 z-40 mt-2 max-h-64 overflow-y-auto rounded-xl border border-black/[0.08] bg-white p-2 shadow-xl">
                  <button
                    type="button"
                    onClick={handleUseCurrentLocation}
                    className="caption-3 mb-1 flex w-full items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-left text-[#047857] transition-colors duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-emerald-100"
                  >
                    <Crosshair className="h-3.5 w-3.5 shrink-0" weight="bold" />
                    <span>Use my current location (GPS)</span>
                  </button>
                  <div className="caption-4 px-2.5 py-1 text-[#4B5563]">
                    {searchingLocations
                      ? 'Searching Bengaluru map...'
                      : 'Popular Bengaluru locations'}
                  </div>
                  {locationResults.length === 0 ? (
                    <div className="caption-5 px-3 py-2 text-[#4B5563]">
                      No matching location found. Try another road or landmark.
                    </div>
                  ) : (
                    locationResults.map((loc) => (
                      <button
                        key={loc.id}
                        type="button"
                        onClick={() => {
                          setDraftLocation(loc);
                          setLocationQuery(loc.name);
                          setLocationDropdownOpen(false);
                        }}
                        className={`caption-4 flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left transition-colors duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-[#FFF0EA] ${
                          draftLocation.id === loc.id ? 'bg-[#FFF0EA]' : ''
                        }`}
                      >
                        <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#C83709]" weight="fill" />
                        <div className="min-w-0">
                          <div className="caption-3 truncate text-[#111827]">{loc.name}</div>
                          <div className="caption-5 truncate text-[#4B5563]">{loc.area}</div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Wheeler Category */}
          <div className="lg:col-span-4">
            <span className="caption-3 mb-1 block text-[#4B5563]">
              Vehicle Type
            </span>
            <div className="grid grid-cols-2 gap-1 rounded-xl border border-black/[0.08] bg-[#F3F2EE] p-1">
              <button
                type="button"
                onClick={() => handleDraftWheelerSwitch('two_wheeler')}
                className={`button-xsm flex items-center justify-center gap-1.5 rounded-lg py-2 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.98] ${
                  draftWheelerCategory === 'two_wheeler'
                    ? 'bg-[#C83709] text-white shadow-sm'
                    : 'text-[#4B5563] hover:text-[#111827]'
                }`}
              >
                <Bicycle className="h-3.5 w-3.5" weight="bold" />
                <span>2 Wheeler</span>
              </button>
              <button
                type="button"
                onClick={() => handleDraftWheelerSwitch('four_wheeler')}
                className={`button-xsm flex items-center justify-center gap-1.5 rounded-lg py-2 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.98] ${
                  draftWheelerCategory === 'four_wheeler'
                    ? 'bg-[#C83709] text-white shadow-sm'
                    : 'text-[#4B5563] hover:text-[#111827]'
                }`}
              >
                <Car className="h-3.5 w-3.5" weight="bold" />
                <span>4 Wheeler</span>
              </button>
            </div>
          </div>

          {/* Vehicle Picker + Search CTA */}
          <div className="lg:col-span-4">
            <label htmlFor="find-vehicle" className="caption-3 mb-1 block text-[#4B5563]">
              Your Vehicle
            </label>
            <div className="flex gap-2">
              <select
                id="find-vehicle"
                value={draftVehicle.id}
                onChange={(e) => setDraftVehicleId(e.target.value)}
                className="body-5 min-w-0 flex-1 rounded-xl border border-black/[0.1] bg-[#F8F7F4] px-3 py-2 text-[#111827] transition-colors duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] focus:border-[#D93F0B] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#D93F0B]/20"
              >
                {filteredDraftVehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => void handleApplySearch()}
                className="button-sm flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-xl bg-[#C83709] px-3 py-2 text-white shadow-sm transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-[#A62B05] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D93F0B]"
              >
                <MagnifyingGlass className="h-3.5 w-3.5" weight="bold" />
                <span>Search</span>
              </button>
            </div>
          </div>

          {/* Parking Time Window */}
          <div className="sm:col-span-2 lg:col-span-12">
            <div className="flex flex-col gap-3 rounded-xl border border-[#FED7AA] bg-[#FFF8F4] p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="caption-3 flex items-center gap-2 text-[#111827]">
                <Clock className="h-4 w-4 text-[#C83709]" weight="bold" />
                <span>When do you need parking?</span>
              </div>

              <div className="grid flex-1 grid-cols-2 gap-3 sm:flex sm:flex-none sm:items-center sm:gap-3">
                <div className="flex items-center gap-2">
                  <label htmlFor="find-start" className="caption-4 text-[#4B5563]">
                    From
                  </label>
                  <select
                    id="find-start"
                    value={draftStartMin}
                    onChange={(e) => handleDraftStartChange(Number(e.target.value))}
                    className="caption-3 w-full rounded-lg border border-black/[0.1] bg-white px-2.5 py-1.5 text-[#111827] focus:border-[#D93F0B] focus:outline-none sm:w-auto"
                  >
                    {TIME_OPTIONS.slice(0, -1).map((opt) => (
                      <option key={opt.min} value={opt.min}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <label htmlFor="find-end" className="caption-4 text-[#4B5563]">
                    Until
                  </label>
                  <select
                    id="find-end"
                    value={draftEndMin}
                    onChange={(e) => setDraftEndMin(Number(e.target.value))}
                    className="caption-3 w-full rounded-lg border border-black/[0.1] bg-white px-2.5 py-1.5 text-[#111827] focus:border-[#D93F0B] focus:outline-none sm:w-auto"
                  >
                    {TIME_OPTIONS.filter((opt) => opt.min > draftStartMin).map((opt) => (
                      <option key={opt.min} value={opt.min}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>

        {gpsStatusMsg && (
          <div className="caption-4 mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-950">
            {gpsStatusMsg}
          </div>
        )}

        {/* Filter Chips + Saved License/Vehicle Strip (with Direct Inline Edit) */}
        <div className="mt-3 flex flex-col gap-3 rounded-xl border border-black/[0.06] bg-[#F8F7F4] p-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {FILTER_MODES.map((m) => {
              const active = draftFilterMode === m.id;
              const activeClass =
                m.id === 'ev'
                  ? 'bg-[#047857] text-white'
                  : m.id === 'covered'
                  ? 'bg-[#4338CA] text-white'
                  : m.id === 'lowest'
                  ? 'bg-[#C83709] text-white'
                  : 'bg-[#111827] text-white';
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setDraftFilterMode(m.id)}
                  className={`button-xsm whitespace-nowrap shrink-0 rounded-lg px-3 py-1.5 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.98] ${
                    active ? activeClass : 'border border-black/[0.08] bg-white text-[#374151] hover:bg-black/[0.04]'
                  }`}
                >
                  {m.label}
                </button>
              );
            })}
            {hasPendingSearchChanges && (
              <button
                type="button"
                onClick={() => void handleApplySearch()}
                className="button-xsm whitespace-nowrap shrink-0 rounded-lg border border-[#D93F0B] bg-[#FFF0EA] px-3 py-1.5 text-[#C83709] transition-colors duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-[#FFE4D6]"
              >
                Press Search to apply changes
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {driverProfile ? (
              <div className="caption-3 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[#047857]">
                <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-[#047857]" weight="fill" />
                <span className="truncate">
                  License: {driverProfile.licenseNumber} · Plate:{' '}
                  {vehicle?.plateNumber || driverProfile.plateNumber}
                </span>
                <button
                  type="button"
                  onClick={() => setInlineEditOpen((o) => !o)}
                  className="caption-3 inline-flex items-center gap-1 text-[#111827] underline hover:text-[#C83709]"
                >
                  <PencilSimple className="h-3 w-3" weight="bold" />
                  <span>{inlineEditOpen ? 'Cancel' : 'Edit'}</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setPendingBookBay(null);
                  setEnrollmentModalOpen(true);
                }}
                className="caption-3 flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-amber-900 transition-colors duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:border-[#D93F0B]"
              >
                <UserCheck className="h-3.5 w-3.5 shrink-0 text-amber-700" weight="bold" />
                <span>Add license and vehicle number (required to book)</span>
              </button>
            )}
            <span className="caption-3 text-[#047857]">
              {evaluatedList.filter((e) => e.eligible).length} spots free
            </span>
          </div>
        </div>

        {/* Inline Direct License & Vehicle Editor (only opens if user clicks Edit) */}
        {inlineEditOpen && (
          <div className="mt-3 rounded-xl border border-black/[0.08] bg-[#F8F7F4] p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="caption-3 text-[#111827]">
                Update driving license and vehicle details, then press Search to apply
              </span>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <input
                type="text"
                value={formLicense}
                onChange={(e) => setFormLicense(e.target.value.toUpperCase())}
                placeholder="Driving License (e.g. KA04...)"
                className="caption-4 rounded-lg border border-black/[0.1] bg-white px-3 py-2 font-mono uppercase text-[#111827]"
              />
              <input
                type="text"
                value={formPlateNumber}
                onChange={(e) => setFormPlateNumber(e.target.value.toUpperCase())}
                placeholder="Vehicle Number (KA 04 MN 8821)"
                className="caption-4 rounded-lg border border-black/[0.1] bg-white px-3 py-2 font-mono uppercase text-[#111827]"
              />
              <input
                type="text"
                value={formVehicleModel}
                onChange={(e) => setFormVehicleModel(e.target.value)}
                placeholder="Vehicle Model (e.g. Hyundai Creta)"
                className="caption-4 rounded-lg border border-black/[0.1] bg-white px-3 py-2 text-[#111827]"
              />
              <select
                value={formWheeler}
                onChange={(e) => {
                  const cat = e.target.value as WheelerCategory;
                  setFormWheeler(cat);
                  setFormVehicleType(cat === 'two_wheeler' ? 'two_wheeler' : 'hatchback');
                }}
                className="caption-4 rounded-lg border border-black/[0.1] bg-white px-3 py-2 text-[#111827]"
              >
                <option value="four_wheeler">4 Wheeler</option>
                <option value="two_wheeler">2 Wheeler</option>
              </select>
              <button
                type="button"
                disabled={profileSaving}
                onClick={() => void handleApplySearch()}
                className="button-xsm rounded-lg bg-[#111827] px-3 py-2 text-white transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-black active:scale-[0.98] disabled:opacity-50"
              >
                {profileSaving ? 'Saving...' : 'Save and search'}
              </button>
            </div>
            {profileFormError && (
              <div className="caption-4 mt-2 text-rose-700">{profileFormError}</div>
            )}
          </div>
        )}
      </section>

      {/* Main Split: Live Map + Available Parking Cards */}
      <div className="grid grid-cols-1 items-stretch gap-5 lg:grid-cols-12">
        <div className="min-h-[360px] sm:min-h-[420px] lg:col-span-7 lg:min-h-[480px]">
          <BengaluruLiveMap
            destinationName={activeLocation.name}
            destinationCoords={{ lat: activeLocation.lat, lng: activeLocation.lng }}
            facilities={nearbyFacilities}
            selectedFacilityId={selectedFacilityId}
            onSelectFacility={setSelectedFacilityId}
            evaluations={evaluatedList}
            locations={locations}
            defaultTravelMode={vehicle.wheelerCategory === 'two_wheeler' ? 'TWO_WHEELER' : 'DRIVING'}
            directionsActive={mapDirectionsActive}
            onToggleDirections={setMapDirectionsActive}
            liveTracking={Boolean(bookedNavigationTarget)}
            bookedSpotCode={
              bookedNavigationTarget?.facilityId === selectedFacilityId
                ? bookedNavigationTarget.spaceCode
                : undefined
            }
            onSearchPlaceSelected={(pl) => {
              const chosenLoc: BengaluruLocation = {
                id: `GMAP-${Date.now()}`,
                name: pl.name,
                area: pl.area,
                lat: pl.lat,
                lng: pl.lng,
                source: 'geocoded',
              };
              setDraftLocation(chosenLoc);
              setLocationQuery(pl.name);
              setActiveLocation(chosenLoc);
              void onSelectLocation(chosenLoc);
            }}
          />
        </div>

        <div className="flex flex-col rounded-2xl border border-black/[0.08] bg-white p-4 shadow-sm lg:col-span-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="title-3 truncate text-[#111827]">
              Near {activeLocation.name}
            </h2>
            <span className="caption-3 shrink-0 text-[#C83709]">
              {distinctFacilityCount} places · {activeSlot.label}
            </span>
          </div>

          <div className="flex-1 space-y-3 lg:max-h-[440px] lg:overflow-y-auto lg:pr-1">
            {evaluatedList.length === 0 ? (
              <div className="rounded-xl border border-black/[0.08] bg-[#FAF9F6] p-6 text-center">
                <div className="title-4 text-[#111827]">No open spots available here right now</div>
                <p className="caption-4 mt-2 text-[#4B5563]">
                  Booked spaces stay hidden until checkout and the turnaround buffer finish. Try another hub, time window, or filter.
                </p>
              </div>
            ) : (
              evaluatedList.map((cand) => {
                const isSelected = cand.facilityId === selectedFacilityId;
                return (
                  <div
                    key={cand.spaceId}
                    onClick={() => setSelectedFacilityId(cand.facilityId)}
                    className={`cursor-pointer rounded-xl border p-4 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 ${
                      isSelected
                        ? 'border-[#D93F0B] bg-[#FFF8F5] ring-1 ring-[#D93F0B]'
                        : 'border-black/[0.08] bg-white hover:border-[#FDBA74]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="title-4 truncate text-[#111827]">
                          {cand.facilityName}
                        </h3>
                        <div className="caption-5 mt-0.5 text-[#4B5563]">Spot {cand.spaceCode}</div>
                        <div className="caption-4 mt-2 flex flex-wrap items-center gap-2 text-[#374151]">
                          <span className="caption-3 flex items-center gap-1 text-[#111827]">
                            <Star className="h-3.5 w-3.5 text-amber-500" weight="fill" />
                            {cand.avgRating}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5 text-[#C83709]" weight="fill" />
                            {formatDist(cand.walkingDistanceM, cand.walkingMinutes)}
                          </span>
                          {cand.covered && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="caption-4 text-[#4338CA]">Covered</span>
                            </>
                          )}
                          {cand.evCharging && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="caption-3 flex items-center gap-0.5 text-[#047857]">
                                <Lightning className="h-3 w-3" weight="fill" /> EV
                              </span>
                            </>
                          )}
                        </div>
                        <div className="caption-5 mt-1 truncate text-[#4B5563]">
                          {cand.entranceLabel}
                          {cand.restrictions && cand.restrictions.length > 0
                            ? ` · ${cand.restrictions[0]}`
                            : ''}
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        <div className="title-2 font-mono font-semibold tabular-nums text-[#111827]">
                          ₹{cand.hourlyPriceInr}
                          <span className="caption-5 font-sans text-[#4B5563]">/hr</span>
                        </div>
                        <div className="caption-3 font-mono text-[#111827]">
                          Total ₹{cand.totalQuoteInr}
                        </div>
                        <div className="caption-5 font-mono text-[#4B5563]">
                          ₹{cand.baseAmountInr ?? cand.hourlyPriceInr} + ₹{cand.platformFeeInr ?? 10} fee + ₹
                          {cand.gstInr ?? 0} GST
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-2 rounded-lg border border-black/[0.06] bg-[#F8F7F4] p-2">
                      <span className="caption-3 flex items-center gap-1 text-[#047857]">
                        <CheckCircle className="h-3.5 w-3.5" weight="fill" />
                        Available now
                      </span>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleBookNowClick(cand);
                        }}
                        className="button-xsm whitespace-nowrap shrink-0 rounded-md bg-[#C83709] px-3 py-2 text-white shadow-sm transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-[#A62B05] active:scale-[0.98]"
                      >
                        Book now
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Mandatory First Time Driver Profile Pop Up (Triggered before booking if incomplete) */}
      {enrollmentModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-3 sm:p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Complete Your Driver Profile"
        >
          <div className="relative my-auto w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-black/[0.1] bg-white p-5 sm:p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-3 pb-3">
              <div>
                <h2 className="heading-6 text-[#111827]">
                  Add your license and vehicle details
                </h2>
                <p className="caption-5 mt-1 text-[#4B5563]">
                  We save this once to your account so you do not have to enter it for future bookings.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEnrollmentModalOpen(false);
                  setPendingBookBay(null);
                }}
                aria-label="Close profile dialog"
                className="rounded-lg border border-black/[0.08] p-2 text-[#4B5563] transition-colors duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:text-[#111827]"
              >
                <X className="h-4 w-4" weight="bold" />
              </button>
            </div>

            <form onSubmit={(e) => void handleEnrollmentSubmit(e)} className="mt-3 space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="caption-3 mb-1 block text-[#374151]">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={formFullName}
                    onChange={(e) => setFormFullName(e.target.value)}
                    className="caption-4 w-full rounded-xl border border-black/[0.1] bg-[#F8F7F4] px-3 py-2 text-[#111827]"
                  />
                </div>
                <div>
                  <label className="caption-3 mb-1 block text-[#374151]">
                    Mobile Number
                  </label>
                  <input
                    type="tel"
                    required
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="+91 98450 12345"
                    className="caption-4 w-full rounded-xl border border-black/[0.1] bg-[#F8F7F4] px-3 py-2 text-[#111827]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="caption-3 mb-1 block text-[#374151]">
                    Driving License Number
                  </label>
                  <input
                    type="text"
                    required
                    value={formLicense}
                    onChange={(e) => setFormLicense(e.target.value.toUpperCase())}
                    placeholder="KA04 20220048192"
                    className="caption-4 w-full rounded-xl border border-black/[0.1] bg-[#F8F7F4] px-3 py-2 font-mono uppercase text-[#111827]"
                  />
                </div>
                <div>
                  <label className="caption-3 mb-1 block text-[#374151]">
                    License Expiry Date
                  </label>
                  <input
                    type="date"
                    required
                    value={formLicenseValidTill}
                    onChange={(e) => setFormLicenseValidTill(e.target.value)}
                    className="caption-4 w-full rounded-xl border border-black/[0.1] bg-[#F8F7F4] px-3 py-2 text-[#111827]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="caption-3 mb-1 block text-[#374151]">
                    Wheeler Type
                  </label>
                  <select
                    value={formWheeler}
                    onChange={(e) => {
                      const cat = e.target.value as WheelerCategory;
                      setFormWheeler(cat);
                      setFormVehicleType(cat === 'two_wheeler' ? 'two_wheeler' : 'hatchback');
                    }}
                    className="caption-4 w-full rounded-xl border border-black/[0.1] bg-[#F8F7F4] px-3 py-2 text-[#111827]"
                  >
                    <option value="four_wheeler">4 Wheeler</option>
                    <option value="two_wheeler">2 Wheeler</option>
                  </select>
                </div>
                <div>
                  <label className="caption-3 mb-1 block text-[#374151]">
                    Vehicle Model
                  </label>
                  <input
                    type="text"
                    required
                    value={formVehicleModel}
                    onChange={(e) => setFormVehicleModel(e.target.value)}
                    placeholder={formWheeler === 'two_wheeler' ? 'Ather 450X' : 'Hyundai Creta'}
                    className="caption-4 w-full rounded-xl border border-black/[0.1] bg-[#F8F7F4] px-3 py-2 text-[#111827]"
                  />
                </div>
                <div>
                  <label className="caption-3 mb-1 block text-[#374151]">
                    Vehicle Number
                  </label>
                  <input
                    type="text"
                    required
                    value={formPlateNumber}
                    onChange={(e) => setFormPlateNumber(e.target.value.toUpperCase())}
                    placeholder="KA 04 MN 8821"
                    className="caption-4 w-full rounded-xl border border-black/[0.1] bg-[#F8F7F4] px-3 py-2 font-mono uppercase text-[#111827]"
                  />
                </div>
              </div>

              {profileFormError && (
                <div className="caption-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-rose-800">
                  {profileFormError}
                </div>
              )}

              <button
                type="submit"
                disabled={profileSaving}
                className="button-sm w-full rounded-xl bg-[#C83709] px-3 py-2 text-white shadow-sm transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-[#A62B05] active:scale-[0.98] disabled:opacity-50"
              >
                {profileSaving
                  ? 'Saving details...'
                  : pendingBookBay
                  ? 'Save and continue to booking'
                  : 'Save vehicle details'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Responsive Pop Up Booking & Instant Confirmation Modal */}
      {checkoutModalOpen &&
        targetBay &&
        (confirmedBooking ? (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-3 sm:p-4 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-label="Booking Confirmed"
          >
            <section className="relative my-auto w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border-2 border-[#047857] bg-white p-5 sm:p-6 shadow-2xl">
              <div className="flex items-start justify-between gap-3 pb-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-[#047857]">
                    <CheckCircle className="h-5 w-5" weight="fill" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="heading-6 text-[#111827]">
                      Booking confirmed and paid
                    </h2>
                    <p className="caption-5 mt-0.5 text-[#4B5563]">
                      {confirmedBooking.facilityName} · Spot {confirmedBooking.spaceCode}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setCheckoutModalOpen(false);
                    setConfirmedBooking(null);
                  }}
                  aria-label="Close booking confirmation"
                  className="shrink-0 rounded-lg border border-black/[0.08] p-2 text-[#4B5563] transition-colors duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:text-[#111827]"
                >
                  <X className="h-4 w-4" weight="bold" />
                </button>
              </div>

              <div className="mt-3 space-y-3">
                <div className="caption-4 rounded-xl bg-[#F8F7F4] p-3.5 space-y-1.5">
                  <div className="caption-3 text-[#111827]">
                    {targetFacility?.name || confirmedBooking.facilityName}
                  </div>
                  {targetFacility?.address && (
                    <div className="text-[#4B5563]">{targetFacility.address}</div>
                  )}
                  <div className="flex flex-wrap items-center gap-2 pt-1 text-[#374151]">
                    <span className="caption-3 flex items-center gap-1 text-[#C83709]">
                      <MapPin className="h-3.5 w-3.5" weight="fill" />
                      {targetFacility?.entranceLabel || confirmedBooking.entranceLabel}
                    </span>
                    <span>·</span>
                    <span>
                      {fmt12(confirmedBooking.startMin)} to {fmt12(confirmedBooking.endMin)}
                    </span>
                  </div>
                </div>

                <div className="caption-4 rounded-xl border border-black/[0.08] bg-white p-3.5 space-y-1.5">
                  <div className="caption-3 text-[#111827]">Paid via Prepaid Wallet</div>
                  <div className="flex justify-between text-[#4B5563]">
                    <span>Parking charge</span>
                    <span className="font-mono">₹{confirmedBooking.baseAmountInr}</span>
                  </div>
                  <div className="flex justify-between text-[#4B5563]">
                    <span>Service fee</span>
                    <span className="font-mono">₹{confirmedBooking.platformFeeInr}</span>
                  </div>
                  <div className="flex justify-between text-[#4B5563]">
                    <span>GST (18%)</span>
                    <span className="font-mono">₹{confirmedBooking.gstInr}</span>
                  </div>
                  <div className="caption-3 flex justify-between rounded-lg bg-emerald-50 px-2.5 py-1.5 font-mono text-[#047857]">
                    <span>Total deducted</span>
                    <span>₹{confirmedBooking.totalAmountInr}</span>
                  </div>
                  {wallet && (
                    <div className="caption-3 flex justify-between font-mono text-[#111827]">
                      <span>Remaining wallet balance</span>
                      <span>₹{wallet.balanceInr}</span>
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-3.5 text-indigo-950">
                  <div className="caption-3 flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4 shrink-0 text-[#4338CA]" weight="fill" />
                    <span>Entry QR stored in Active Bookings</span>
                  </div>
                  <p className="caption-5 mt-1 text-indigo-900">
                    For security, your Entry QR Code stays hidden until you open{' '}
                    <strong>Active Bookings &rarr; Show QR Code</strong>. If no attendant is at the
                    parking spot, you can also scan the spot wall QR placard using{' '}
                    <strong>Scan Spot Wall QR</strong>.
                  </p>
                </div>

                <div className="flex flex-col gap-2 pt-1 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => {
                      const booked = confirmedBooking;
                      setSelectedFacilityId(booked.facilityId);
                      setBookedNavigationTarget({
                        bookingId: booked.id,
                        facilityId: booked.facilityId,
                        spaceCode: booked.spaceCode,
                      });
                      setMapDirectionsActive(true);
                      setCheckoutModalOpen(false);
                      setConfirmedBooking(null);
                    }}
                    className="button-xsm flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#1A73E8] px-3 py-2 text-white shadow-sm transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:brightness-110 active:scale-[0.98]"
                  >
                    <MapPin className="h-3.5 w-3.5" weight="fill" />
                    <span>Get directions on map</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCheckoutModalOpen(false);
                      setConfirmedBooking(null);
                      onNavigateDashboard();
                    }}
                    className="button-xsm flex-1 rounded-xl border border-black/[0.12] bg-[#F8F7F4] px-3 py-2 text-[#111827] transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-black/[0.04] active:scale-[0.98]"
                  >
                    Go to Active Bookings
                  </button>
                </div>
              </div>
            </section>
          </div>
        ) : (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-3 sm:p-4 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-label="Booking Summary"
          >
            <section className="relative my-auto w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border-2 border-[#D93F0B] bg-white p-4 sm:p-6 shadow-2xl">
              <div className="mb-4 flex items-start justify-between gap-3 pb-2">
                <div className="min-w-0">
                  <h3 className="heading-6 text-[#111827]">
                    Confirm your parking · {targetBay.facilityName}
                  </h3>
                  <p className="caption-5 mt-0.5 text-[#4B5563]">
                    Spot {targetBay.spaceCode} · {activeSlot.label} · {vehicle.label}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setCheckoutModalOpen(false)}
                  aria-label="Close booking dialog"
                  className="shrink-0 rounded-lg border border-black/[0.08] p-2 text-[#4B5563] transition-colors duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:text-[#111827]"
                >
                  <X className="h-4 w-4" weight="bold" />
                </button>
              </div>

              {verifyError && (
                <div className="caption-4 mb-4 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-rose-800">
                  <ShieldWarning className="h-4 w-4 shrink-0 text-rose-600" weight="fill" />
                  <span>{verifyError}</span>
                </div>
              )}

              {/* Live Check Progress */}
              <div className="space-y-3">
                <div
                  className={`rounded-xl border p-3.5 ${
                    supervisorNote.verdict === 'VERIFIED'
                      ? 'border-emerald-200 bg-emerald-50'
                      : supervisorNote.verdict === 'FLAGGED_AND_CORRECTED'
                      ? 'border-amber-200 bg-amber-50'
                      : 'border-indigo-200 bg-indigo-50'
                  }`}
                >
                  <div className="caption-3 flex items-center gap-2 text-[#111827]">
                    {verifying ? (
                      <Broadcast className="h-4 w-4 animate-spin text-[#4338CA]" weight="bold" />
                    ) : (
                      <ShieldCheck className="h-4 w-4 text-[#047857]" weight="fill" />
                    )}
                    <span>
                      {verifyError
                        ? 'Verification interrupted'
                        : verifying
                        ? 'Checking spot and rules...'
                        : 'Spot verified and available'}
                    </span>
                  </div>
                  <p className="caption-5 mt-1 text-[#374151]">{supervisorNote.text}</p>
                </div>

                <div className="grid grid-cols-5 gap-2">
                  {AGENT_STEPS.map((st) => {
                    const isActive = activeStage === st.order;
                    const done = completedStages[st.order];
                    return (
                      <div
                        key={st.order}
                        className={`rounded-lg border p-2 text-center ${
                          isActive
                            ? 'border-[#D93F0B] bg-[#FFF0EA]'
                            : done
                            ? 'border-emerald-300 bg-emerald-50'
                            : 'border-black/[0.06] bg-[#F8F7F4]'
                        }`}
                      >
                        <div className="flex justify-center">
                          {done ? (
                            <CheckCircle className="h-3.5 w-3.5 text-[#047857]" weight="fill" />
                          ) : isActive ? (
                            <Broadcast className="h-3.5 w-3.5 animate-spin text-[#C83709]" weight="bold" />
                          ) : (
                            <Clock className="h-3.5 w-3.5 text-[#9CA3AF]" weight="bold" />
                          )}
                        </div>
                        <div className="caption-4 mt-1 text-[#111827]">
                          {st.title}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {finalRun && (
                  <p className="caption-5 text-[#374151]">
                    {finalRun.supervisorFinalReport}
                  </p>
                )}
              </div>

              {/* Clean Booking Summary */}
              <div className="caption-4 mt-4 rounded-xl border border-black/[0.08] bg-[#F8F7F4] p-4 space-y-2">
                <div className="flex justify-between text-[#374151]">
                  <span>Vehicle number</span>
                  <span className="font-mono font-semibold text-[#111827]">
                    {vehicle.plateNumber || driverProfile?.plateNumber}
                  </span>
                </div>
                {driverProfile && (
                  <div className="flex justify-between text-[#374151]">
                    <span>Driving license</span>
                    <span className="font-mono font-semibold text-[#047857]">
                      {driverProfile.licenseNumber}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-[#374151]">
                  <span>Spot entrance</span>
                  <span className="font-semibold text-[#111827]">{targetBay.entranceLabel}</span>
                </div>
                <div className="flex justify-between text-[#374151]">
                  <span>Walking distance</span>
                  <span className="font-semibold text-[#C83709]">
                    {targetBay.walkingDistanceM}m ({targetBay.walkingMinutes} min walk)
                  </span>
                </div>
                {targetBay.lateArrivalSummary && (
                  <div className="caption-5 rounded-lg border border-black/[0.06] bg-white px-3 py-2 text-[#4B5563]">
                    <span className="font-semibold text-[#111827]">Arrival rule: </span>
                    {targetBay.lateArrivalSummary}
                  </div>
                )}
                {(() => {
                  const hours =
                    targetBay.durationHours ??
                    Math.max(0.5, (activeSlot.endMin - activeSlot.startMin) / 60);
                  const base =
                    targetBay.baseAmountInr ?? Math.round(hours * targetBay.hourlyPriceInr);
                  const fee =
                    targetBay.platformFeeInr ?? Math.max(10, Math.round(base * 0.1));
                  const gst = targetBay.gstInr ?? Math.round((base + fee) * 0.18);
                  const total = base + fee + gst;
                  return (
                    <div className="space-y-1.5 rounded-lg border border-black/[0.06] bg-white p-3">
                      <div className="caption-3 uppercase tracking-wide text-[#4B5563]">
                        Price Breakdown
                      </div>
                      <div className="flex justify-between text-[#374151]">
                        <span>
                          Parking charge ({Number.isInteger(hours) ? hours : hours.toFixed(1)}h × ₹
                          {targetBay.hourlyPriceInr}/hr)
                        </span>
                        <span className="font-mono font-semibold text-[#111827]">₹{base}</span>
                      </div>
                      <div className="flex justify-between text-[#374151]">
                        <span>Service and platform fee (10%, min ₹10)</span>
                        <span className="font-mono font-semibold text-[#111827]">₹{fee}</span>
                      </div>
                      <div className="flex justify-between text-[#374151]">
                        <span>GST (18% on parking and service fee)</span>
                        <span className="font-mono font-semibold text-[#111827]">₹{gst}</span>
                      </div>
                      <div className="body-4 flex justify-between rounded-md bg-[#F8F7F4] px-2.5 py-1.5 text-[#111827]">
                        <span>
                          Total (₹{base} + ₹{fee} + ₹{gst})
                        </span>
                        <span className="font-mono tabular-nums">₹{total}</span>
                      </div>
                    </div>
                  );
                })()}
                {wallet && (
                  <div className="caption-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-black/[0.08] bg-white px-3 py-2">
                    <span className="text-[#374151]">
                      Prepaid Parking Balance:{' '}
                      <strong className="font-mono tabular-nums text-[#047857]">
                        ₹{wallet.balanceInr}
                      </strong>
                      {wallet.unpaidDueInr > 0 && (
                        <span className="ml-2 font-semibold text-rose-700">
                          (₹{wallet.unpaidDueInr} due, top up to book)
                        </span>
                      )}
                    </span>
                    {(wallet.bookingRestricted || wallet.balanceInr < targetBay.totalQuoteInr) && (
                      <button
                        type="button"
                        onClick={() => void onTopUpWallet(500)}
                        className="button-xsm rounded-md bg-[#047857] px-3 py-1.5 text-white hover:bg-[#065F46]"
                      >
                        + Add ₹500 to Wallet
                      </button>
                    )}
                  </div>
                )}
              </div>

              {wallet?.bookingRestricted && (
                <div className="caption-4 mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-rose-900">
                  Future bookings are paused until your ₹{wallet.unpaidDueInr} unpaid parking balance is cleared. Add funds above to unlock booking.
                </div>
              )}

              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  disabled={
                    verifying ||
                    confirming ||
                    Boolean(verifyError) ||
                    Boolean(wallet?.bookingRestricted) ||
                    (wallet ? wallet.balanceInr < targetBay.totalQuoteInr : false)
                  }
                  onClick={() => void handleConfirmAndPay()}
                  className="button-sm flex-1 rounded-xl bg-[#047857] px-3 py-2 text-white shadow-sm transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-[#065F46] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {verifying
                    ? 'Checking availability...'
                    : confirming
                    ? 'Deducting from Prepaid Wallet...'
                    : wallet && wallet.balanceInr < targetBay.totalQuoteInr
                    ? `Add funds above to pay ₹${targetBay.totalQuoteInr} from Wallet`
                    : `Pay from Prepaid Wallet · ₹${targetBay.totalQuoteInr}`}
                </button>
              </div>
            </section>
          </div>
        ))}
    </div>
  );
};
