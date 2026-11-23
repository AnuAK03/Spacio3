import React from 'react';

export const LiveMobilityBackground: React.FC = () => {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[#F8F7F4]"
    >
      <svg
        className="absolute inset-0 h-full w-full opacity-[0.45]"
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMid slice"
        fill="none"
      >
        <defs>
          <pattern id="city-grid" width="96" height="96" patternUnits="userSpaceOnUse">
            <path
              d="M 96 0 L 0 0 0 96"
              stroke="rgba(17, 24, 39, 0.045)"
              strokeWidth="1"
            />
          </pattern>
        </defs>

        <rect width="1440" height="900" fill="url(#city-grid)" />

        <path
          d="M -60 220 C 260 180, 480 340, 820 260 C 1100 195, 1280 280, 1500 210"
          stroke="rgba(200, 55, 9, 0.08)"
          strokeWidth="1.5"
        />
        <path
          d="M -60 580 C 240 640, 560 450, 900 540 C 1160 610, 1320 490, 1500 530"
          stroke="rgba(4, 120, 87, 0.08)"
          strokeWidth="1.5"
        />
        <path
          d="M 280 -40 C 340 240, 220 500, 390 940"
          stroke="rgba(67, 56, 202, 0.07)"
          strokeWidth="1.5"
        />
        <path
          d="M 1080 -40 C 1020 280, 1180 560, 1020 940"
          stroke="rgba(17, 24, 39, 0.06)"
          strokeWidth="1.5"
        />

        <circle cx="315" cy="245" r="5" fill="#C83709" fillOpacity="0.16" />
        <circle cx="885" cy="536" r="5" fill="#047857" fillOpacity="0.16" />
        <circle cx="1062" cy="240" r="5" fill="#4338CA" fillOpacity="0.16" />
      </svg>
    </div>
  );
};
