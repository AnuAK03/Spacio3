import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { QrCode } from 'lucide-react';

interface QrCodeDisplayProps {
  value: string;
  size?: number;
  label: string;
}

export const QrCodeDisplay: React.FC<QrCodeDisplayProps> = ({ value, size = 176, label }) => {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(value, {
      width: size * 2,
      margin: 2,
      color: {
        dark: '#111827',
        light: '#FFFFFF',
      },
      errorCorrectionLevel: 'M',
    })
      .then((url) => {
        if (active) setDataUrl(url);
      })
      .catch(() => {
        if (active) setDataUrl(null);
      });
    return () => {
      active = false;
    };
  }, [value, size]);

  if (!dataUrl) {
    return (
      <div
        style={{ width: size, height: size }}
        className="flex select-none flex-col items-center justify-center rounded-xl border border-black/[0.1] bg-[#F8F7F4] p-3 text-center"
      >
        <QrCode className="h-8 w-8 text-[#4338CA]" />
        <span className="mt-2 font-mono text-[11px] font-semibold text-[#374151]">{label}</span>
      </div>
    );
  }

  return (
    <div
      onContextMenu={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
      className="inline-block select-none"
      title="Entry QR pass (view-only — image download disabled)"
    >
      <img
        src={dataUrl}
        alt={label}
        width={size}
        height={size}
        draggable={false}
        onContextMenu={(e) => e.preventDefault()}
        referrerPolicy="no-referrer"
        className="pointer-events-none select-none rounded-xl border border-black/[0.08] bg-white p-1.5 shadow-sm"
      />
    </div>
  );
};
