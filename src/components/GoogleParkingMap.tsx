/// <reference types="google.maps" />
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  APIProvider,
  AdvancedMarker,
  InfoWindow,
  Map as GoogleMapCanvas,
  useAdvancedMarkerRef,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Bike,
  Car,
  ChevronDown,
  ChevronUp,
  Compass,
  Crosshair,
  Footprints,
  Layers,
  MapPin,
  Navigation,
  Route as RouteIcon,
  Search,
  ShieldCheck,
  TrainFront,
  X,
} from 'lucide-react';
import { BengaluruLocation, CandidateEvaluation, Facility } from '../types/parkpool';
import {
  isGoogleMapsQuotaError,
  reportGoogleMapsQuotaExceeded,
  useGoogleMapsConfig,
} from '../utils/useGoogleMapsConfig';

export type MapTravelMode = 'DRIVING' | 'TWO_WHEELER' | 'TRANSIT' | 'WALKING';
export type MapLayerMode = 'roadmap' | 'satellite' | 'terrain';

export interface RouteStepInfo {
  instruction: string;
  distanceText: string;
  durationText: string;
}

export interface ComputedRouteSummary {
  distanceMeters: number;
  durationSeconds: number;
  distanceText: string;
  durationText: string;
  steps: RouteStepInfo[];
  path: Array<{ lat: number; lng: number }>;
  source: 'google_routes' | 'osrm' | 'corridor_estimate';
}

export interface GoogleParkingMapProps {
  destinationName: string;
  destinationCoords: { lat: number; lng: number };
  facilities: Facility[];
  selectedFacilityId: string;
  onSelectFacility: (id: string) => void;
  evaluations?: CandidateEvaluation[];
  locations?: BengaluruLocation[];
  defaultTravelMode?: MapTravelMode;
  directionsActive?: boolean;
  onToggleDirections?: (active: boolean) => void;
  liveTracking?: boolean;
  bookedSpotCode?: string;
  onSearchPlaceSelected?: (loc: { name: string; area: string; lat: number; lng: number }) => void;
  compact?: boolean;
}

const TRAVEL_MODES: Array<{
  id: MapTravelMode;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}> = [
  { id: 'DRIVING', label: 'Drive', icon: Car, color: '#1A73E8' },
  { id: 'TWO_WHEELER', label: '2-Wheeler', icon: Bike, color: '#D93F0B' },
  { id: 'TRANSIT', label: 'Transit', icon: TrainFront, color: '#0F9D58' },
  { id: 'WALKING', label: 'Walk', icon: Footprints, color: '#4338CA' },
];

const LAYER_OPTIONS: Array<{ id: MapLayerMode; label: string }> = [
  { id: 'roadmap', label: 'Default' },
  { id: 'satellite', label: 'Satellite' },
  { id: 'terrain', label: 'Terrain' },
];

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return Math.max(60, Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))));
}

function formatMeters(meters: number): string {
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
  return `${Math.round(meters)} m`;
}

function formatDuration(seconds: number): string {
  const mins = Math.max(1, Math.round(seconds / 60));
  if (mins >= 60) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h} hr ${m} min` : `${h} hr`;
  }
  return `${mins} min`;
}

function cleanStepText(raw: string): string {
  return raw.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

function buildFallbackRoute(
  origin: { lat: number; lng: number },
  dest: { lat: number; lng: number },
  facility: Facility,
  travelMode: MapTravelMode
): ComputedRouteSummary {
  const directMeters = haversineMeters(origin.lat, origin.lng, dest.lat, dest.lng);
  const roadFactor = travelMode === 'WALKING' ? 1.18 : 1.28;
  const totalMeters = Math.round(directMeters * roadFactor);
  const speedMps =
    travelMode === 'WALKING'
      ? 1.3
      : travelMode === 'TRANSIT'
      ? 6.2
      : travelMode === 'TWO_WHEELER'
      ? 8.5
      : 7.4;
  const totalSeconds = Math.max(90, Math.round(totalMeters / speedMps));

  const midLat = Number(((origin.lat + dest.lat) / 2 + 0.0012).toFixed(5));
  const midLng = Number(((origin.lng + dest.lng) / 2 - 0.001).toFixed(5));
  const path = [
    origin,
    { lat: midLat, lng: midLng },
    { lat: facility.entranceLat, lng: facility.entranceLng },
    { lat: facility.lat, lng: facility.lng },
  ];

  const leg1Meters = Math.round(totalMeters * 0.45);
  const leg2Meters = Math.round(totalMeters * 0.4);
  const leg3Meters = Math.max(50, totalMeters - leg1Meters - leg2Meters);

  const steps: RouteStepInfo[] =
    travelMode === 'TRANSIT'
      ? [
          {
            instruction: 'Walk to nearest Namma Metro / BMTC feeder stop along corridor',
            distanceText: formatMeters(Math.min(450, leg1Meters)),
            durationText: formatDuration(Math.min(450, leg1Meters) / 1.3),
          },
          {
            instruction: `Board Metro / AC feeder towards ${facility.zone}`,
            distanceText: formatMeters(leg2Meters),
            durationText: formatDuration(leg2Meters / 7.5),
          },
          {
            instruction: `Walk to ${facility.name} (${facility.entranceLabel})`,
            distanceText: formatMeters(leg3Meters),
            durationText: formatDuration(leg3Meters / 1.3),
          },
        ]
      : travelMode === 'WALKING'
      ? [
          {
            instruction: `Head along pedestrian footpath toward ${facility.zone}`,
            distanceText: formatMeters(leg1Meters + leg2Meters),
            durationText: formatDuration((leg1Meters + leg2Meters) / 1.3),
          },
          {
            instruction: `Arrive at ${facility.name} · ${facility.entranceLabel}`,
            distanceText: formatMeters(leg3Meters),
            durationText: formatDuration(leg3Meters / 1.3),
          },
        ]
      : [
          {
            instruction: `Head onto main arterial road toward ${facility.zone}`,
            distanceText: formatMeters(leg1Meters),
            durationText: formatDuration(leg1Meters / speedMps),
          },
          {
            instruction: `Continue toward ${facility.address}`,
            distanceText: formatMeters(leg2Meters),
            durationText: formatDuration(leg2Meters / speedMps),
          },
          {
            instruction: `Turn into ${facility.entranceLabel} at ${facility.name}`,
            distanceText: formatMeters(leg3Meters),
            durationText: formatDuration(leg3Meters / speedMps),
          },
        ];

  return {
    distanceMeters: totalMeters,
    durationSeconds: totalSeconds,
    distanceText: formatMeters(totalMeters),
    durationText: formatDuration(totalSeconds),
    steps,
    path,
    source: 'corridor_estimate',
  };
}

async function fetchOsrmRoute(
  origin: { lat: number; lng: number },
  dest: { lat: number; lng: number },
  facility: Facility,
  travelMode: MapTravelMode
): Promise<ComputedRouteSummary> {
  const profile = travelMode === 'WALKING' ? 'foot' : 'driving';
  try {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 5000);
    const url = `https://router.project-osrm.org/route/v1/${profile}/${origin.lng},${origin.lat};${dest.lng},${dest.lat}?overview=full&geometries=geojson&steps=true`;
    const res = await fetch(url, { signal: controller.signal });
    window.clearTimeout(timeout);
    if (!res.ok) throw new Error('OSRM failed');
    const data = (await res.json()) as {
      routes?: Array<{
        distance?: number;
        duration?: number;
        geometry?: { coordinates?: Array<[number, number]> };
        legs?: Array<{
          steps?: Array<{
            name?: string;
            distance?: number;
            duration?: number;
            maneuver?: { type?: string; modifier?: string };
          }>;
        }>;
      }>;
    };
    const r = data.routes?.[0];
    if (!r || !r.geometry?.coordinates?.length) throw new Error('No OSRM route');

    const rawMeters = Math.round(r.distance || haversineMeters(origin.lat, origin.lng, dest.lat, dest.lng));
    let rawSeconds = Math.round(r.duration || rawMeters / 7.5);
    if (travelMode === 'TWO_WHEELER') {
      rawSeconds = Math.max(60, Math.round(rawSeconds * 0.85));
    } else if (travelMode === 'TRANSIT') {
      rawSeconds = Math.max(120, Math.round(rawSeconds * 1.18 + 240));
    }

    const osrmSteps: RouteStepInfo[] =
      r.legs?.[0]?.steps
        ?.filter((s) => (s.distance || 0) >= 15)
        .slice(0, 8)
        .map((s) => {
          const action = s.maneuver?.type === 'arrive'
            ? `Arrive at ${facility.name} (${facility.entranceLabel})`
            : `${(s.maneuver?.type || 'Continue').replace(/_/g, ' ')}${
                s.maneuver?.modifier ? ` ${s.maneuver.modifier}` : ''
              }${s.name ? ` onto ${s.name}` : ''}`;
          return {
            instruction: action.charAt(0).toUpperCase() + action.slice(1),
            distanceText: formatMeters(s.distance || 0),
            durationText: formatDuration(s.duration || 60),
          };
        }) || [];

    return {
      distanceMeters: rawMeters,
      durationSeconds: rawSeconds,
      distanceText: formatMeters(rawMeters),
      durationText: formatDuration(rawSeconds),
      steps:
        osrmSteps.length > 0
          ? osrmSteps
          : buildFallbackRoute(origin, dest, facility, travelMode).steps,
      path: r.geometry.coordinates.map(([lng, lat]) => ({ lat, lng })),
      source: 'osrm',
    };
  } catch {
    return buildFallbackRoute(origin, dest, facility, travelMode);
  }
}

// ---------------------------------------------------------------------------
// Google Maps SDK Inner Controllers (rendered inside <APIProvider> & <GoogleMapCanvas>)
// ---------------------------------------------------------------------------

interface FacilityAdvancedMarkerProps {
  facility: Facility;
  isSelected: boolean;
  isPending: boolean;
  isEv: boolean;
  priceLabel: string;
  zIndex: number;
  onSelect: (id: string, marker: google.maps.marker.AdvancedMarkerElement | null) => void;
}

const FacilityAdvancedMarker: React.FC<FacilityAdvancedMarkerProps> = ({
  facility,
  isSelected,
  isPending,
  isEv,
  priceLabel,
  zIndex,
  onSelect,
}) => {
  const [markerRef, marker] = useAdvancedMarkerRef();
  const bg = isPending
    ? '#DC2626'
    : isSelected
    ? '#C83709'
    : isEv
    ? '#047857'
    : '#1A73E8';

  return (
    <AdvancedMarker
      ref={markerRef}
      position={{ lat: facility.lat, lng: facility.lng }}
      zIndex={zIndex}
      title={`${facility.name} — ${priceLabel}`}
      onClick={() => onSelect(facility.id, marker)}
    >
      <div
        className={`flex items-center gap-1 rounded-full border-2 border-white px-2 py-1 text-[11px] font-bold text-white shadow-md transition-transform ${
          isSelected ? 'scale-110 ring-2 ring-[#C83709]/40' : 'hover:scale-105'
        }`}
        style={{ backgroundColor: bg }}
      >
        <span
          className="flex h-4 w-4 items-center justify-center rounded-full bg-white text-[10px] font-extrabold"
          style={{ color: bg }}
        >
          P
        </span>
        <span>{priceLabel}</span>
      </div>
    </AdvancedMarker>
  );
};

interface GoogleTrafficAndRoutesControllerProps {
  origin: { lat: number; lng: number };
  destination: { lat: number; lng: number };
  facility: Facility;
  directionsActive: boolean;
  travelMode: MapTravelMode;
  showTraffic: boolean;
  centerTrigger: { lat: number; lng: number; zoom?: number; seq: number };
  onRouteComputed: (summary: ComputedRouteSummary | null) => void;
}

const GoogleTrafficAndRoutesController: React.FC<GoogleTrafficAndRoutesControllerProps> = ({
  origin,
  destination,
  facility,
  directionsActive,
  travelMode,
  showTraffic,
  centerTrigger,
  onRouteComputed,
}) => {
  const map = useMap();
  const routesLib = useMapsLibrary('routes');
  const mapsLib = useMapsLibrary('maps');
  const polylinesRef = useRef<google.maps.Polyline[]>([]);
  const trafficLayerRef = useRef<google.maps.TrafficLayer | null>(null);

  // Recenter camera when centerTrigger changes (and not fitting a route)
  useEffect(() => {
    if (!map || directionsActive) return;
    map.panTo({ lat: centerTrigger.lat, lng: centerTrigger.lng });
    if (centerTrigger.zoom) {
      map.setZoom(centerTrigger.zoom);
    }
  }, [map, centerTrigger.lat, centerTrigger.lng, centerTrigger.zoom, centerTrigger.seq, directionsActive]);

  // Traffic layer toggle
  useEffect(() => {
    if (!map || !mapsLib) return;
    if (showTraffic) {
      const layer = new mapsLib.TrafficLayer();
      layer.setMap(map);
      trafficLayerRef.current = layer;
      return () => {
        layer.setMap(null);
        trafficLayerRef.current = null;
      };
    }
    if (trafficLayerRef.current) {
      trafficLayerRef.current.setMap(null);
      trafficLayerRef.current = null;
    }
    return undefined;
  }, [map, mapsLib, showTraffic]);

  // Modern Route.computeRoutes() computation & polyline rendering
  useEffect(() => {
    polylinesRef.current.forEach((p) => p.setMap(null));
    polylinesRef.current = [];

    if (!directionsActive) {
      onRouteComputed(null);
      return;
    }

    if (!map || !routesLib) return;
    let cancelled = false;

    const strokeColor =
      travelMode === 'TRANSIT'
        ? '#0F9D58'
        : travelMode === 'WALKING'
        ? '#4338CA'
        : travelMode === 'TWO_WHEELER'
        ? '#D93F0B'
        : '#1A73E8';

    const computeWithSdk = async () => {
      try {
        const travelEnum = (
          routesLib as unknown as { TravelMode?: Record<string, string> }
        ).TravelMode;
        const sdkMode = travelEnum?.[travelMode] || travelMode;

        const request: Record<string, unknown> = {
          origin: { lat: origin.lat, lng: origin.lng },
          destination: { lat: destination.lat, lng: destination.lng },
          travelMode: sdkMode,
          fields: ['path', 'distanceMeters', 'durationMillis', 'viewport', 'legs'],
        };

        if (travelMode === 'DRIVING' || travelMode === 'TWO_WHEELER') {
          request.routingPreference = 'TRAFFIC_AWARE';
        }

        const RouteClass = (
          routesLib as unknown as {
            Route: {
              computeRoutes: (req: Record<string, unknown>) => Promise<{
                routes?: Array<{
                  distanceMeters?: number;
                  durationMillis?: number;
                  viewport?: google.maps.LatLngBounds;
                  path?: Array<google.maps.LatLng>;
                  legs?: Array<{
                    steps?: Array<{
                      instructions?: string;
                      distanceMeters?: number;
                      staticDurationMillis?: number;
                    }>;
                  }>;
                  createPolylines: () => google.maps.Polyline[];
                }>;
              }>;
            };
          }
        ).Route;

        const { routes } = await RouteClass.computeRoutes(request);
        if (cancelled) return;

        if (!routes || routes.length === 0) {
          const fb = await fetchOsrmRoute(origin, destination, facility, travelMode);
          if (!cancelled) onRouteComputed(fb);
          return;
        }

        const primaryRoute = routes[0];
        const created = primaryRoute.createPolylines();
        created.forEach((poly) => {
          poly.setOptions({
            strokeColor,
            strokeOpacity: travelMode === 'WALKING' ? 0.85 : 0.95,
            strokeWeight: travelMode === 'WALKING' ? 5 : 6,
          });
          poly.setMap(map);
        });
        polylinesRef.current = created;

        if (primaryRoute.viewport) {
          map.fitBounds(primaryRoute.viewport);
        }

        const distM = Number(primaryRoute.distanceMeters || 0);
        const durSec = Math.max(60, Math.round(Number(primaryRoute.durationMillis || 0) / 1000));
        const rawSteps = primaryRoute.legs?.[0]?.steps || [];
        const steps: RouteStepInfo[] = rawSteps
          .filter((s) => Boolean(s.instructions))
          .slice(0, 10)
          .map((s) => ({
            instruction: cleanStepText(s.instructions || ''),
            distanceText: formatMeters(Number(s.distanceMeters || 0)),
            durationText: formatDuration(Math.round(Number(s.staticDurationMillis || 60000) / 1000)),
          }));

        const pathCoords = (primaryRoute.path || []).map((pt) => ({
          lat: pt.lat(),
          lng: pt.lng(),
        }));

        onRouteComputed({
          distanceMeters: distM,
          durationSeconds: durSec,
          distanceText: formatMeters(distM),
          durationText: formatDuration(durSec),
          steps:
            steps.length > 0
              ? steps
              : buildFallbackRoute(origin, destination, facility, travelMode).steps,
          path: pathCoords.length > 1 ? pathCoords : [origin, destination],
          source: 'google_routes',
        });
      } catch (err) {
        if (cancelled) return;
        if (isGoogleMapsQuotaError(err)) {
          reportGoogleMapsQuotaExceeded();
        }
        const fb = await fetchOsrmRoute(origin, destination, facility, travelMode);
        if (!cancelled) onRouteComputed(fb);
      }
    };

    void computeWithSdk();

    return () => {
      cancelled = true;
      polylinesRef.current.forEach((p) => p.setMap(null));
      polylinesRef.current = [];
    };
  }, [
    map,
    routesLib,
    directionsActive,
    origin.lat,
    origin.lng,
    destination.lat,
    destination.lng,
    travelMode,
    facility,
    onRouteComputed,
  ]);

  return null;
};

interface GooglePlacesSearchBoxProps {
  onSelectPlace: (place: { name: string; area: string; lat: number; lng: number }) => void;
  fallbackLocations: BengaluruLocation[];
}

const GooglePlacesSearchBox: React.FC<GooglePlacesSearchBoxProps> = ({
  onSelectPlace,
  fallbackLocations,
}) => {
  const placesLib = useMapsLibrary('places');
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [googleSuggestions, setGoogleSuggestions] = useState<
    google.maps.places.AutocompleteSuggestion[]
  >([]);
  const boxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onOutside = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (!q || !placesLib) {
      setGoogleSuggestions([]);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const { AutocompleteSessionToken, AutocompleteSuggestion } = placesLib;
        if (!sessionTokenRef.current) {
          sessionTokenRef.current = new AutocompleteSessionToken();
        }
        const res = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: q,
          region: 'IN',
          locationBias: {
            north: 13.18,
            south: 12.82,
            east: 77.78,
            west: 77.45,
          },
          sessionToken: sessionTokenRef.current,
        });
        if (!cancelled) {
          setGoogleSuggestions(res.suggestions || []);
        }
      } catch (err) {
        if (isGoogleMapsQuotaError(err)) {
          reportGoogleMapsQuotaExceeded();
        }
        if (!cancelled) setGoogleSuggestions([]);
      }
    }, 260);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, placesLib]);

  const handleSelectPrediction = async (
    suggestion: google.maps.places.AutocompleteSuggestion
  ) => {
    if (!suggestion.placePrediction) return;
    try {
      const place = suggestion.placePrediction.toPlace();
      await place.fetchFields({
        fields: ['displayName', 'formattedAddress', 'location', 'viewport'],
      });
      if (place.location) {
        onSelectPlace({
          name: place.displayName || suggestion.placePrediction.text.text,
          area: place.formattedAddress || 'Bengaluru',
          lat: place.location.lat(),
          lng: place.location.lng(),
        });
        setQuery(place.displayName || suggestion.placePrediction.text.text);
      }
    } catch (err) {
      if (isGoogleMapsQuotaError(err)) {
        reportGoogleMapsQuotaExceeded();
      }
    } finally {
      sessionTokenRef.current = null;
      setGoogleSuggestions([]);
      setOpen(false);
    }
  };

  const localMatches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return fallbackLocations.slice(0, 5);
    return fallbackLocations
      .filter(
        (l) =>
          l.name.toLowerCase().includes(q) || l.area.toLowerCase().includes(q)
      )
      .slice(0, 5);
  }, [query, fallbackLocations]);

  return (
    <div ref={boxRef} className="relative w-full max-w-xs">
      <div className="flex items-center gap-2 rounded-xl border border-black/[0.12] bg-white/95 px-3 py-1.5 shadow-md backdrop-blur-md">
        <Search className="h-3.5 w-3.5 shrink-0 text-[#1A73E8]" />
        <input
          type="text"
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          placeholder="Search Google Maps..."
          className="w-full bg-transparent text-xs font-medium text-[#111827] placeholder-[#6B7280] focus:outline-none"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setGoogleSuggestions([]);
            }}
            className="text-[#6B7280] hover:text-[#111827]"
            aria-label="Clear map search"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {open && (googleSuggestions.length > 0 || localMatches.length > 0) && (
        <div className="absolute left-0 right-0 z-30 mt-1 max-h-56 overflow-y-auto rounded-xl border border-black/[0.1] bg-white p-1.5 shadow-xl">
          {googleSuggestions.map((s, idx) => (
            <button
              key={`g-${idx}`}
              type="button"
              onClick={() => void handleSelectPrediction(s)}
              className="flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left text-xs hover:bg-blue-50"
            >
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#1A73E8]" />
              <span className="truncate font-medium text-[#111827]">
                {s.placePrediction?.text.text}
              </span>
            </button>
          ))}
          {localMatches.map((loc) => (
            <button
              key={loc.id}
              type="button"
              onClick={() => {
                onSelectPlace({
                  name: loc.name,
                  area: loc.area,
                  lat: loc.lat,
                  lng: loc.lng,
                });
                setQuery(loc.name);
                setOpen(false);
              }}
              className="flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left text-xs hover:bg-[#FFF0EA]"
            >
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#C83709]" />
              <div className="min-w-0">
                <div className="truncate font-semibold text-[#111827]">{loc.name}</div>
                <div className="truncate text-[10px] text-[#4B5563]">{loc.area}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Leaflet + OSRM Interactive Google-Maps-Style Fallback
// ---------------------------------------------------------------------------

interface LeafletFallbackMapProps {
  destinationName: string;
  originCoords: { lat: number; lng: number };
  originLabel: string;
  facilities: Facility[];
  selectedFacilityId: string;
  onSelectFacility: (id: string) => void;
  evaluations: CandidateEvaluation[];
  layerMode: MapLayerMode;
  showTraffic: boolean;
  directionsActive: boolean;
  travelMode: MapTravelMode;
  liveTracking: boolean;
  simProgress: number;
  centerSeq: number;
  onRouteComputed: (summary: ComputedRouteSummary | null) => void;
  routeSummary: ComputedRouteSummary | null;
  heightClass: string;
}

const TILE_URLS: Record<MapLayerMode, { url: string; attribution: string }> = {
  roadmap: {
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attribution: '&copy; OpenStreetMap &copy; CARTO',
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri &mdash; World Imagery',
  },
  terrain: {
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap &copy; OpenTopoMap',
  },
};

const LeafletFallbackMap: React.FC<LeafletFallbackMapProps> = ({
  originCoords,
  originLabel,
  facilities,
  selectedFacilityId,
  onSelectFacility,
  evaluations,
  layerMode,
  showTraffic,
  directionsActive,
  travelMode,
  liveTracking,
  simProgress,
  centerSeq,
  onRouteComputed,
  routeSummary,
  heightClass,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileRef = useRef<L.TileLayer | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);
  const routeLayerRef = useRef<L.LayerGroup | null>(null);
  const trackingMarkerRef = useRef<L.Marker | null>(null);

  const activeFac = facilities.find((f) => f.id === selectedFacilityId) || facilities[0];

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      center: [originCoords.lat, originCoords.lng],
      zoom: 15,
      zoomControl: false,
    });
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    const tileCfg = TILE_URLS[layerMode];
    tileRef.current = L.tileLayer(tileCfg.url, {
      attribution: tileCfg.attribution,
      maxZoom: 19,
    }).addTo(map);

    layerGroupRef.current = L.layerGroup().addTo(map);
    routeLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      map.remove();
      mapRef.current = null;
      tileRef.current = null;
      layerGroupRef.current = null;
      routeLayerRef.current = null;
      trackingMarkerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (tileRef.current) {
      map.removeLayer(tileRef.current);
    }
    const tileCfg = TILE_URLS[layerMode];
    tileRef.current = L.tileLayer(tileCfg.url, {
      attribution: tileCfg.attribution,
      maxZoom: 19,
    }).addTo(map);
  }, [layerMode]);

  const lastOriginRef = useRef<{ lat: number; lng: number; seq: number }>({
    lat: originCoords.lat,
    lng: originCoords.lng,
    seq: centerSeq,
  });

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const prev = lastOriginRef.current;
    const coordsChanged =
      Math.abs(prev.lat - originCoords.lat) > 0.00001 ||
      Math.abs(prev.lng - originCoords.lng) > 0.00001;
    const seqChanged = prev.seq !== centerSeq && centerSeq > 0;
    if (!coordsChanged && !seqChanged) return;
    lastOriginRef.current = { lat: originCoords.lat, lng: originCoords.lng, seq: centerSeq };
    map.flyTo([originCoords.lat, originCoords.lng], 15, { duration: 0.65 });
  }, [centerSeq, originCoords.lat, originCoords.lng]);

  // Compute route when directionsActive changes
  useEffect(() => {
    if (!directionsActive || !activeFac) {
      onRouteComputed(null);
      return;
    }
    let cancelled = false;
    fetchOsrmRoute(
      originCoords,
      { lat: activeFac.entranceLat, lng: activeFac.entranceLng },
      activeFac,
      travelMode
    ).then((summary) => {
      if (!cancelled) onRouteComputed(summary);
    });
    return () => {
      cancelled = true;
    };
  }, [
    directionsActive,
    originCoords.lat,
    originCoords.lng,
    activeFac?.id,
    activeFac?.entranceLat,
    activeFac?.entranceLng,
    travelMode,
    onRouteComputed,
  ]);

  // Draw markers + radius
  useEffect(() => {
    const map = mapRef.current;
    const group = layerGroupRef.current;
    if (!map || !group) return;
    group.clearLayers();

    // Origin / Blue Google-style pulse dot
    const originIcon = L.divIcon({
      className: 'gmap-origin-pin',
      html: `<div style="position:relative;display:flex;align-items:center;gap:6px;">
        <div style="width:16px;height:16px;border-radius:999px;background:#1A73E8;border:3px solid #FFFFFF;box-shadow:0 2px 8px rgba(26,115,232,0.55);"></div>
        <div style="background:#111827;color:#FFFFFF;padding:3px 9px;border-radius:999px;font-weight:700;font-size:10px;white-space:nowrap;border:1.5px solid #1A73E8;box-shadow:0 4px 12px rgba(0,0,0,0.25);">${originLabel}</div>
      </div>`,
      iconSize: [140, 24],
      iconAnchor: [8, 12],
    });
    L.marker([originCoords.lat, originCoords.lng], { icon: originIcon }).addTo(group);

    facilities.forEach((fac) => {
      const facEvals = evaluations.filter((e) => e.facilityId === fac.id);
      const bestEval = facEvals.find((e) => e.eligible) || facEvals[0];
      const isPending = fac.verificationStatus !== 'verified';
      const isSelected = fac.id === selectedFacilityId;
      const bg = isPending
        ? '#DC2626'
        : isSelected
        ? '#C83709'
        : bestEval?.evCharging
        ? '#047857'
        : '#1A73E8';
      const priceText = isPending
        ? 'Pending'
        : bestEval
        ? `₹${bestEval.hourlyPriceInr}/hr`
        : fac.zone;

      const pinIcon = L.divIcon({
        className: 'parkpool-p-pin',
        html: `<div style="display:flex;align-items:center;gap:5px;background:${bg};color:#FFFFFF;padding:4px 9px 4px 5px;border-radius:999px;font-weight:700;font-size:11px;white-space:nowrap;border:2px solid #FFFFFF;box-shadow:0 4px 14px rgba(17,24,39,0.28);cursor:pointer;">
          <span style="display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:999px;background:#FFFFFF;color:${bg};font-weight:800;font-size:11px;">P</span>
          <span>${priceText}</span>
        </div>`,
        iconSize: [90, 28],
        iconAnchor: [45, 14],
      });

      const marker = L.marker([fac.lat, fac.lng], { icon: pinIcon }).addTo(group);
      marker.on('click', () => onSelectFacility(fac.id));
      marker.bindPopup(
        `<div style="font-size:12px;min-width:190px;">
          <div style="font-weight:700;color:#111827;">${fac.name}</div>
          <div style="color:#4B5563;margin-top:2px;">${fac.address}</div>
          <div style="color:#C83709;font-weight:600;margin-top:3px;">Spot Entrance: ${fac.entranceLabel}</div>
        </div>`
      );
    });
  }, [facilities, evaluations, selectedFacilityId, originCoords, originLabel, onSelectFacility]);

  // Draw route polyline & traffic corridor
  useEffect(() => {
    const map = mapRef.current;
    const rGroup = routeLayerRef.current;
    if (!map || !rGroup) return;
    rGroup.clearLayers();
    trackingMarkerRef.current = null;

    if (!directionsActive || !routeSummary || routeSummary.path.length < 2) {
      if (activeFac) {
        const previewPath: [number, number][] = [
          [originCoords.lat, originCoords.lng],
          [activeFac.entranceLat, activeFac.entranceLng],
        ];
        L.polyline(previewPath, {
          color: '#D93F0B',
          weight: 3,
          dashArray: '6 6',
          opacity: 0.65,
        }).addTo(rGroup);
      }
      return;
    }

    const latLngs: [number, number][] = routeSummary.path.map((p) => [p.lat, p.lng]);
    const color =
      travelMode === 'TRANSIT'
        ? '#0F9D58'
        : travelMode === 'WALKING'
        ? '#4338CA'
        : travelMode === 'TWO_WHEELER'
        ? '#D93F0B'
        : '#1A73E8';

    // Outer Google Maps route casing
    L.polyline(latLngs, {
      color: '#FFFFFF',
      weight: 9,
      opacity: 0.9,
    }).addTo(rGroup);

    const routeLine = L.polyline(latLngs, {
      color,
      weight: 5.5,
      opacity: 0.95,
      dashArray: travelMode === 'WALKING' ? '6 8' : undefined,
    }).addTo(rGroup);

    // Optional live Bengaluru traffic segment overlay
    if (showTraffic && latLngs.length >= 4) {
      const midStart = Math.floor(latLngs.length * 0.45);
      const midEnd = Math.min(latLngs.length, Math.floor(latLngs.length * 0.72));
      const congested = latLngs.slice(midStart, midEnd);
      if (congested.length >= 2) {
        L.polyline(congested, {
          color: '#F59E0B',
          weight: 6,
          opacity: 0.9,
        }).addTo(rGroup);
      }
    }

    map.fitBounds(routeLine.getBounds(), { padding: [46, 46] });
  }, [directionsActive, routeSummary, travelMode, showTraffic, activeFac, originCoords]);

  // Moving live tracker marker along route path
  useEffect(() => {
    const rGroup = routeLayerRef.current;
    if (!rGroup || !liveTracking || !directionsActive || !routeSummary || routeSummary.path.length < 2) {
      return;
    }
    const pts = routeSummary.path;
    const clamped = Math.max(0, Math.min(1, simProgress));
    const idxFloat = clamped * (pts.length - 1);
    const idx = Math.floor(idxFloat);
    const nextIdx = Math.min(pts.length - 1, idx + 1);
    const frac = idxFloat - idx;
    const lat = pts[idx].lat + (pts[nextIdx].lat - pts[idx].lat) * frac;
    const lng = pts[idx].lng + (pts[nextIdx].lng - pts[idx].lng) * frac;

    if (!trackingMarkerRef.current) {
      const trackerIcon = L.divIcon({
        className: 'gmap-live-tracker',
        html: `<div style="width:22px;height:22px;border-radius:999px;background:#1A73E8;border:3px solid #FFFFFF;box-shadow:0 0 0 6px rgba(26,115,232,0.28);display:flex;align-items:center;justify-content:center;">
          <div style="width:7px;height:7px;border-radius:999px;background:#FFFFFF;"></div>
        </div>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      });
      trackingMarkerRef.current = L.marker([lat, lng], {
        icon: trackerIcon,
        zIndexOffset: 1000,
      }).addTo(rGroup);
    } else {
      trackingMarkerRef.current.setLatLng([lat, lng]);
    }
  }, [liveTracking, directionsActive, routeSummary, simProgress]);

  return <div ref={containerRef} className={`${heightClass} w-full z-0`} />;
};

// ---------------------------------------------------------------------------
// Main Unified GoogleParkingMap Component
// ---------------------------------------------------------------------------

export const GoogleParkingMap: React.FC<GoogleParkingMapProps> = ({
  destinationName,
  destinationCoords,
  facilities,
  selectedFacilityId,
  onSelectFacility,
  evaluations = [],
  locations = [],
  defaultTravelMode = 'DRIVING',
  directionsActive: controlledDirections,
  onToggleDirections,
  liveTracking = false,
  bookedSpotCode,
  onSearchPlaceSelected,
  compact = false,
}) => {
  const { apiKey, quotaExceeded } = useGoogleMapsConfig();
  const useRealGoogleMaps = Boolean(apiKey) && !quotaExceeded;

  const [internalDirections, setInternalDirections] = useState(Boolean(controlledDirections));
  useEffect(() => {
    if (typeof controlledDirections === 'boolean') {
      setInternalDirections(controlledDirections);
    }
  }, [controlledDirections]);

  const directionsActive =
    typeof controlledDirections === 'boolean' ? controlledDirections : internalDirections;

  const setDirectionsMode = useCallback(
    (next: boolean) => {
      setInternalDirections(next);
      onToggleDirections?.(next);
    },
    [onToggleDirections]
  );

  const [travelMode, setTravelMode] = useState<MapTravelMode>(defaultTravelMode);
  useEffect(() => {
    setTravelMode(defaultTravelMode);
  }, [defaultTravelMode]);

  const [layerMode, setLayerMode] = useState<MapLayerMode>('roadmap');
  const [showTraffic, setShowTraffic] = useState<boolean>(true);
  const [layersMenuOpen, setLayersMenuOpen] = useState<boolean>(false);
  const [stepsExpanded, setStepsExpanded] = useState<boolean>(Boolean(liveTracking));

  // Live GPS / Origin coords
  const [gpsEnabled, setGpsEnabled] = useState(false);
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsLabel, setGpsLabel] = useState<string | null>(null);
  const [gpsNote, setGpsNote] = useState<string | null>(null);
  const [centerSeq, setCenterSeq] = useState(0);

  // Selected InfoWindow anchor for Google Maps markers
  const [infoFacilityId, setInfoFacilityId] = useState<string | null>(null);
  const [infoAnchor, setInfoAnchor] = useState<google.maps.marker.AdvancedMarkerElement | null>(null);

  // Route summary & live tracking simulator
  const [routeSummary, setRouteSummary] = useState<ComputedRouteSummary | null>(null);
  const [simProgress, setSimProgress] = useState<number>(0);

  const watchIdRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!liveTracking || !directionsActive) {
      setSimProgress(0);
      return;
    }
    if (gpsEnabled && gpsCoords) return; // Real GPS drives position
    const timer = window.setInterval(() => {
      setSimProgress((p) => (p >= 1 ? 0.05 : Number((p + 0.035).toFixed(3))));
    }, 650);
    return () => window.clearInterval(timer);
  }, [liveTracking, directionsActive, gpsEnabled, gpsCoords]);

  const activeFac = useMemo(
    () => facilities.find((f) => f.id === selectedFacilityId) || facilities[0],
    [facilities, selectedFacilityId]
  );

  const originPoint = gpsEnabled && gpsCoords ? gpsCoords : destinationCoords;
  const originLabel = gpsEnabled && gpsLabel ? gpsLabel : destinationName;

  const handleToggleMyLocation = () => {
    setGpsNote(null);
    if (gpsEnabled) {
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setGpsEnabled(false);
      setCenterSeq((s) => s + 1);
      return;
    }

    if (!navigator.geolocation) {
      setGpsNote('Browser location is unavailable. Using selected hub.');
      return;
    }

    const onSuccess = (pos: GeolocationPosition) => {
      const rawLat = pos.coords.latitude;
      const rawLng = pos.coords.longitude;
      const distBlr = haversineMeters(rawLat, rawLng, 12.9716, 77.5946);
      if (distBlr <= 65000) {
        setGpsCoords({ lat: rawLat, lng: rawLng });
        setGpsLabel('Your Live Location');
        setGpsNote(null);
      } else {
        setGpsCoords({ lat: 12.9716, lng: 77.5946 });
        setGpsLabel('Central Bengaluru (Live GPS Fallback)');
        setGpsNote('Device GPS is outside Bengaluru; routing from Central Bengaluru.');
      }
      setGpsEnabled(true);
      setCenterSeq((s) => s + 1);
    };

    const onError = () => {
      setGpsEnabled(false);
      setGpsNote('Location permission declined. Using selected hub as start point.');
    };

    navigator.geolocation.getCurrentPosition(onSuccess, onError, {
      enableHighAccuracy: true,
      timeout: 7000,
    });

    if (liveTracking) {
      watchIdRef.current = navigator.geolocation.watchPosition(onSuccess, onError, {
        enableHighAccuracy: true,
        maximumAge: 10000,
      });
    }
  };

  const handleRouteComputed = useCallback((summary: ComputedRouteSummary | null) => {
    setRouteSummary(summary);
  }, []);

  // Sort facilities south-last for AdvancedMarker zIndex depth
  const sortedFacilities = useMemo(() => {
    return [...facilities].sort((a, b) => b.lat - a.lat);
  }, [facilities]);

  // Moving simulated dot coords for Google Maps mode
  const liveTrackerPoint = useMemo(() => {
    if (!liveTracking || !directionsActive || !routeSummary || routeSummary.path.length < 2) {
      return null;
    }
    if (gpsEnabled && gpsCoords) return gpsCoords;
    const pts = routeSummary.path;
    const clamped = Math.max(0, Math.min(1, simProgress));
    const idxFloat = clamped * (pts.length - 1);
    const idx = Math.floor(idxFloat);
    const nextIdx = Math.min(pts.length - 1, idx + 1);
    const frac = idxFloat - idx;
    return {
      lat: pts[idx].lat + (pts[nextIdx].lat - pts[idx].lat) * frac,
      lng: pts[idx].lng + (pts[nextIdx].lng - pts[idx].lng) * frac,
    };
  }, [liveTracking, directionsActive, routeSummary, simProgress, gpsEnabled, gpsCoords]);

  if (!activeFac) return null;

  const activeEval =
    evaluations.find((e) => e.facilityId === activeFac.id && e.eligible) ||
    evaluations.find((e) => e.facilityId === activeFac.id);

  const infoFac = infoFacilityId
    ? facilities.find((f) => f.id === infoFacilityId) || null
    : null;

  const heightClass = compact
    ? 'h-[260px] sm:h-[300px]'
    : 'h-[310px] sm:h-[380px] lg:min-h-[430px]';

  const gmapExternalMode =
    travelMode === 'WALKING'
      ? 'walking'
      : travelMode === 'TRANSIT'
      ? 'transit'
      : travelMode === 'TWO_WHEELER'
      ? 'two_wheeler'
      : 'driving';

  const osmEngine =
    travelMode === 'WALKING' ? 'fossgis_osrm_foot' : 'fossgis_osrm_car';

  const externalDirectionsUrl = useRealGoogleMaps
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
        `${activeFac.name}, ${activeFac.address}`
      )}&travelmode=${gmapExternalMode}`
    : `https://www.openstreetmap.org/directions?engine=${osmEngine}&route=${originPoint.lat}%2C${originPoint.lng}%3B${activeFac.entranceLat}%2C${activeFac.entranceLng}`;

  const mapSurface = useRealGoogleMaps ? (
    <APIProvider apiKey={apiKey} language="en" region="IN">
      <div className={`relative w-full ${heightClass}`}>
        <GoogleMapCanvas
          mapId="DEMO_MAP_ID"
          defaultCenter={destinationCoords}
          defaultZoom={15}
          mapTypeId={
            layerMode === 'satellite'
              ? 'hybrid'
              : layerMode === 'terrain'
              ? 'terrain'
              : 'roadmap'
          }
          gestureHandling="greedy"
          disableDefaultUI={false}
          mapTypeControl={false}
          streetViewControl={!compact}
          fullscreenControl={!compact}
          internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
          className="h-full w-full"
        >
          {/* Floating Google Places Search Bar */}
          {!compact && onSearchPlaceSelected && (
            <div className="pointer-events-auto absolute left-3 top-3 z-20 right-24 sm:right-auto">
              <GooglePlacesSearchBox
                fallbackLocations={locations}
                onSelectPlace={(pl) => {
                  onSearchPlaceSelected(pl);
                  setCenterSeq((s) => s + 1);
                }}
              />
            </div>
          )}

          {/* Origin Marker */}
          <AdvancedMarker position={originPoint} zIndex={500} title={originLabel}>
            <div className="flex items-center gap-1.5">
              <div className="h-4 w-4 rounded-full border-[3px] border-white bg-[#1A73E8] shadow-md" />
              <span className="rounded-full border border-[#1A73E8] bg-[#111827] px-2 py-0.5 text-[10px] font-bold text-white shadow">
                {originLabel.length > 22 ? `${originLabel.slice(0, 20)}…` : originLabel}
              </span>
            </div>
          </AdvancedMarker>

          {/* Live Vehicle Tracker Marker */}
          {liveTrackerPoint && (
            <AdvancedMarker
              position={liveTrackerPoint}
              zIndex={1200}
              title="Live tracking vehicle"
            >
              <div className="flex h-6 w-6 items-center justify-center rounded-full border-[3px] border-white bg-[#1A73E8] shadow-[0_0_0_6px_rgba(26,115,232,0.28)]">
                <div className="h-2 w-2 rounded-full bg-white" />
              </div>
            </AdvancedMarker>
          )}

          {/* Parking Facility Markers */}
          {sortedFacilities.map((fac, idx) => {
            const facEvals = evaluations.filter((e) => e.facilityId === fac.id);
            const bestEval = facEvals.find((e) => e.eligible) || facEvals[0];
            const isPending = fac.verificationStatus !== 'verified';
            const isSelected = fac.id === activeFac.id;
            const priceLabel = isPending
              ? 'Pending'
              : bestEval
              ? `₹${bestEval.hourlyPriceInr}/hr`
              : fac.zone;

            return (
              <FacilityAdvancedMarker
                key={fac.id}
                facility={fac}
                isSelected={isSelected}
                isPending={isPending}
                isEv={Boolean(bestEval?.evCharging)}
                priceLabel={priceLabel}
                zIndex={isSelected ? 1000 : idx + 10}
                onSelect={(id, marker) => {
                  onSelectFacility(id);
                  setInfoFacilityId(id);
                  setInfoAnchor(marker);
                }}
              />
            );
          })}

          {infoFac && infoAnchor && (
            <InfoWindow
              anchor={infoAnchor}
              onCloseClick={() => {
                setInfoFacilityId(null);
                setInfoAnchor(null);
              }}
            >
              <div className="min-w-[180px] space-y-1 p-0.5 text-xs">
                <div className="font-bold text-[#111827]">{infoFac.name}</div>
                <div className="text-[11px] text-[#4B5563]">{infoFac.address}</div>
                <div className="font-semibold text-[#C83709]">
                  Spot Entrance: {infoFac.entranceLabel}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onSelectFacility(infoFac.id);
                    setDirectionsMode(true);
                    setInfoFacilityId(null);
                  }}
                  className="mt-1 inline-flex items-center gap-1 rounded-lg bg-[#1A73E8] px-2.5 py-1 text-[11px] font-bold text-white"
                >
                  <Navigation className="h-3 w-3" />
                  <span>Directions</span>
                </button>
              </div>
            </InfoWindow>
          )}

          <GoogleTrafficAndRoutesController
            origin={originPoint}
            destination={{ lat: activeFac.entranceLat, lng: activeFac.entranceLng }}
            facility={activeFac}
            directionsActive={directionsActive}
            travelMode={travelMode}
            showTraffic={showTraffic}
            centerTrigger={{ ...originPoint, zoom: 15, seq: centerSeq }}
            onRouteComputed={handleRouteComputed}
          />
        </GoogleMapCanvas>
      </div>
    </APIProvider>
  ) : (
    <LeafletFallbackMap
      destinationName={destinationName}
      originCoords={originPoint}
      originLabel={originLabel}
      facilities={facilities}
      selectedFacilityId={activeFac.id}
      onSelectFacility={onSelectFacility}
      evaluations={evaluations}
      layerMode={layerMode}
      showTraffic={showTraffic}
      directionsActive={directionsActive}
      travelMode={travelMode}
      liveTracking={liveTracking}
      simProgress={simProgress}
      centerSeq={centerSeq}
      onRouteComputed={handleRouteComputed}
      routeSummary={routeSummary}
      heightClass={heightClass}
    />
  );

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-black/[0.08] bg-white/95 shadow-sm backdrop-blur-md">
      {/* Google Maps-Style Top Control Strip: Destination + Travel Modes + Directions Toggle */}
      <div className="flex flex-col gap-2 border-b border-black/[0.06] bg-white px-3.5 py-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#E8F0FE] text-[#1A73E8]">
              {liveTracking ? (
                <Compass className="h-4 w-4 animate-pulse" />
              ) : (
                <Navigation className="h-4 w-4" />
              )}
            </div>
            <div className="min-w-0">
              <div className="truncate font-display text-xs font-bold text-[#111827] sm:text-sm">
                {activeFac.name}
                {bookedSpotCode ? ` · Spot ${bookedSpotCode}` : ''}
              </div>
              <div className="truncate text-[11px] text-[#4B5563]">
                {activeFac.address} · {activeFac.entranceLabel}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleToggleMyLocation}
              title="Use Live GPS Location"
              className={`flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-bold transition-colors ${
                gpsEnabled
                  ? 'border-[#1A73E8] bg-[#E8F0FE] text-[#1A73E8]'
                  : 'border-black/[0.1] bg-[#F8F7F4] text-[#374151] hover:border-[#1A73E8]'
              }`}
            >
              <Crosshair className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">
                {gpsEnabled ? 'GPS Live' : 'My Location'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setDirectionsMode(!directionsActive)}
              className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-[11px] font-bold transition-colors ${
                directionsActive
                  ? 'bg-[#1A73E8] text-white shadow-sm'
                  : 'border border-black/[0.1] bg-white text-[#1A73E8] hover:bg-[#E8F0FE]'
              }`}
            >
              <RouteIcon className="h-3.5 w-3.5" />
              <span>{directionsActive ? 'Directions On' : 'Directions'}</span>
            </button>
          </div>
        </div>

        {/* Travel Modes + Map Layers Strip */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1" role="tablist" aria-label="Travel mode">
            {TRAVEL_MODES.map((m) => {
              const Icon = m.icon;
              const active = travelMode === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => {
                    setTravelMode(m.id);
                    if (!directionsActive) setDirectionsMode(true);
                  }}
                  className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold transition-all ${
                    active
                      ? 'bg-[#E8F0FE] text-[#1A73E8] ring-1 ring-[#1A73E8]/40'
                      : 'bg-[#F3F2EE] text-[#4B5563] hover:text-[#111827]'
                  }`}
                >
                  <Icon className="h-3 w-3" />
                  <span>{m.label}</span>
                </button>
              );
            })}
          </div>

          <div className="relative flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setShowTraffic((t) => !t)}
              className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition-colors ${
                showTraffic
                  ? 'bg-emerald-50 text-[#047857] ring-1 ring-emerald-300'
                  : 'bg-[#F3F2EE] text-[#4B5563]'
              }`}
            >
              Traffic {showTraffic ? 'On' : 'Off'}
            </button>

            <button
              type="button"
              onClick={() => setLayersMenuOpen((o) => !o)}
              className="flex items-center gap-1 rounded-full border border-black/[0.1] bg-white px-2.5 py-1 text-[11px] font-bold text-[#374151] hover:border-[#1A73E8]"
            >
              <Layers className="h-3 w-3 text-[#1A73E8]" />
              <span className="capitalize">
                {layerMode === 'roadmap' ? 'Map' : layerMode}
              </span>
            </button>

            {layersMenuOpen && (
              <div className="absolute right-0 top-8 z-30 w-36 rounded-xl border border-black/[0.1] bg-white p-1.5 shadow-xl">
                {LAYER_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setLayerMode(opt.id);
                      setLayersMenuOpen(false);
                    }}
                    className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs font-semibold ${
                      layerMode === opt.id
                        ? 'bg-[#E8F0FE] text-[#1A73E8]'
                        : 'text-[#374151] hover:bg-[#F3F2EE]'
                    }`}
                  >
                    <span>{opt.label}</span>
                    {layerMode === opt.id && <span>•</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {gpsNote && (
          <div className="rounded-lg bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-900">
            {gpsNote}
          </div>
        )}
      </div>

      {/* Interactive Map Viewport */}
      <div className="relative flex-1 bg-[#ECEAE4]">
        {mapSurface}

        {/* Floating Bottom-Left Recenter + Live Tracking Pill */}
        <div className="pointer-events-auto absolute bottom-3 left-3 z-20 flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setCenterSeq((s) => s + 1)}
            className="flex items-center gap-1 rounded-full border border-black/[0.12] bg-white/95 px-2.5 py-1 text-[11px] font-bold text-[#111827] shadow-md hover:bg-white"
          >
            <Crosshair className="h-3 w-3 text-[#1A73E8]" />
            <span>Recenter</span>
          </button>

          {liveTracking && directionsActive && (
            <span className="flex items-center gap-1.5 rounded-full bg-[#1A73E8] px-2.5 py-1 text-[11px] font-bold text-white shadow-md">
              <span className="h-2 w-2 animate-ping rounded-full bg-white" />
              <span>Live Tracking</span>
            </span>
          )}
        </div>
      </div>

      {/* Directions Route Summary + Expandable Turn-by-Turn Steps */}
      {directionsActive && routeSummary && (
        <div className="border-t border-black/[0.08] bg-[#F8FAFC]">
          <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-mono text-sm font-extrabold text-[#1A73E8]">
                {routeSummary.durationText}
              </span>
              <span className="text-black/25">·</span>
              <span className="font-mono font-semibold text-[#111827]">
                {routeSummary.distanceText}
              </span>
              <span className="text-black/25">·</span>
              <span className="text-[11px] font-medium text-[#4B5563]">
                {originLabel} &rarr; {activeFac.entranceLabel}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <a
                href={externalDirectionsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-black/[0.1] bg-white px-2.5 py-1 text-[11px] font-bold text-[#1A73E8] hover:bg-[#E8F0FE]"
              >
                {useRealGoogleMaps ? 'Open in Google Maps' : 'Open Route in Map'}
              </a>
              <button
                type="button"
                onClick={() => setStepsExpanded((s) => !s)}
                className="flex items-center gap-1 rounded-lg bg-[#111827] px-2.5 py-1 text-[11px] font-bold text-white hover:bg-black"
              >
                <span>{stepsExpanded ? 'Hide Steps' : `Steps (${routeSummary.steps.length})`}</span>
                {stepsExpanded ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronUp className="h-3 w-3" />
                )}
              </button>
            </div>
          </div>

          {stepsExpanded && (
            <div className="max-h-40 space-y-1.5 overflow-y-auto border-t border-black/[0.06] bg-white px-3.5 py-2.5 text-xs">
              {routeSummary.steps.map((st, idx) => (
                <div
                  key={idx}
                  className="flex items-start justify-between gap-3 rounded-lg bg-[#F8F7F4] px-2.5 py-1.5"
                >
                  <div className="flex items-start gap-2 min-w-0">
                    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#E8F0FE] font-mono text-[10px] font-bold text-[#1A73E8]">
                      {idx + 1}
                    </span>
                    <span className="text-[#111827]">{st.instruction}</span>
                  </div>
                  <span className="shrink-0 font-mono text-[11px] text-[#4B5563]">
                    {st.distanceText} · {st.durationText}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Bottom Gate Safety Footer */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-black/[0.06] bg-[#F8F7F4]/90 px-3.5 py-2 text-xs text-[#374151]">
        <span className="flex items-center gap-1.5">
          <ShieldCheck className="h-4 w-4 shrink-0 text-[#047857]" />
          <span>
            <strong className="text-[#111827]">Entrance:</strong> {activeFac.entranceLabel}
            {activeEval ? ` · ${activeEval.walkingDistanceM}m (${activeEval.walkingMinutes} min walk to destination)` : ''}
          </span>
        </span>
        <span className="text-[11px] text-[#4B5563]">{activeFac.walkPathSafety}</span>
      </div>
    </div>
  );
};
