import React from 'react';

export const LiveMobilityBackground: React.FC = () => {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[#F8F7F4]"
    >
      {/* Animated multi-hue ambient gradient washes */}
      <div className="live-orb live-orb-orange" />
      <div className="live-orb live-orb-emerald" />
      <div className="live-orb live-orb-indigo" />

      {/* Live urban route & moving ride-pulse vector layer */}
      <svg
        className="absolute inset-0 h-full w-full opacity-[0.42]"
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMid slice"
        fill="none"
      >
        <defs>
          <pattern id="city-grid" width="90" height="90" patternUnits="userSpaceOnUse">
            <path
              d="M 90 0 L 0 0 0 90"
              stroke="rgba(15, 23, 42, 0.045)"
              strokeWidth="1"
            />
          </pattern>
          <linearGradient id="route-orange" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#FF5A1F" stopOpacity="0" />
            <stop offset="50%" stopColor="#FF5A1F" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#F59E0B" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="route-emerald" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#10B981" stopOpacity="0" />
            <stop offset="50%" stopColor="#059669" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#14B8A6" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="route-indigo" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#6366F1" stopOpacity="0" />
            <stop offset="50%" stopColor="#4F46E5" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#3B82F6" stopOpacity="0" />
          </linearGradient>
        </defs>

        <rect width="1440" height="900" fill="url(#city-grid)" />

        {/* Subtle city boulevard curves */}
        <path
          d="M -60 220 C 260 180, 480 340, 820 260 C 1100 195, 1280 280, 1500 210"
          stroke="rgba(217, 63, 11, 0.10)"
          strokeWidth="2"
        />
        <path
          d="M -60 580 C 240 640, 560 450, 900 540 C 1160 610, 1320 490, 1500 530"
          stroke="rgba(5, 150, 105, 0.10)"
          strokeWidth="2"
        />
        <path
          d="M 280 -40 C 340 240, 220 500, 390 940"
          stroke="rgba(79, 70, 229, 0.08)"
          strokeWidth="2"
        />
        <path
          d="M 1080 -40 C 1020 280, 1180 560, 1020 940"
          stroke="rgba(217, 63, 11, 0.08)"
          strokeWidth="2"
        />

        {/* Animated live route streams */}
        <path
          d="M -60 220 C 260 180, 480 340, 820 260 C 1100 195, 1280 280, 1500 210"
          stroke="url(#route-orange)"
          strokeWidth="3"
          strokeDasharray="160 1100"
          strokeLinecap="round"
          className="live-route-flow"
        />
        <path
          d="M -60 580 C 240 640, 560 450, 900 540 C 1160 610, 1320 490, 1500 530"
          stroke="url(#route-emerald)"
          strokeWidth="3"
          strokeDasharray="140 1200"
          strokeLinecap="round"
          className="live-route-flow-reverse"
        />
        <path
          d="M 280 -40 C 340 240, 220 500, 390 940"
          stroke="url(#route-indigo)"
          strokeWidth="2.5"
          strokeDasharray="120 900"
          strokeLinecap="round"
          className="live-route-flow-slow"
        />

        {/* Subtle hub intersection rings */}
        <circle cx="315" cy="245" r="7" fill="#FF5A1F" fillOpacity="0.24" />
        <circle cx="315" cy="245" r="2.8" fill="#D93F0B" fillOpacity="0.55" />

        <circle cx="885" cy="536" r="7" fill="#10B981" fillOpacity="0.24" />
        <circle cx="885" cy="536" r="2.8" fill="#059669" fillOpacity="0.55" />

        <circle cx="1062" cy="240" r="6.5" fill="#6366F1" fillOpacity="0.24" />
        <circle cx="1062" cy="240" r="2.6" fill="#4F46E5" fillOpacity="0.55" />
      </svg>
    </div>
  );
};
