import React from 'react';
import {
  ArrowsClockwise,
  CalendarBlank,
  CheckCircle,
  Clock,
  NavigationArrow,
  QrCode,
  ShieldCheck,
  Wallet,
} from '@phosphor-icons/react';

export const DriverGuidelinesView: React.FC = () => {
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-black/[0.08] bg-white p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-[#047857]">
            <ShieldCheck className="h-5 w-5" weight="duotone" />
          </div>
          <div>
            <h1 className="heading-5 text-[#111827]">
              Parking guidelines and rider protection
            </h1>
            <p className="mt-1 body-6 text-[#4B5563]">
              Everything you need to know about arrival timing, QR entry passes, prepaid wallet
              payments, smart departure checks, and overstay coverage.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-black/[0.08] bg-white p-6">
        <div className="flex items-center gap-2">
          <ArrowsClockwise className="h-5 w-5 text-[#047857]" weight="duotone" />
          <h2 className="heading-6 text-[#111827]">Overstay protection and next rider cover</h2>
        </div>
        <p className="mt-1 caption-2 text-[#4B5563]">
          If a previous driver does not return on time, you keep your trip and your balance.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-black/[0.08] bg-[#F8F7F4] p-4 body-6 text-[#374151]">
            <div className="title-4 text-[#111827]">1. Built in 15 minute buffer</div>
            <p className="mt-2">
              Every booking includes a 15 minute gap before the next driver arrives. If a driver
              stays past their booked window and buffer, the bay locks and an added charge applies.
            </p>
          </div>

          <div className="rounded-xl border border-black/[0.08] bg-[#F8F7F4] p-4 body-6 text-[#374151]">
            <div className="title-4 text-[#111827]">2. Free move to another bay</div>
            <p className="mt-2">
              If your reserved bay is still occupied on arrival, we relocate you to another open
              bay at the same or nearest verified site at ₹0 added charge and update your QR pass.
            </p>
          </div>

          <div className="rounded-xl border border-black/[0.08] bg-[#F8F7F4] p-4 body-6 text-[#374151]">
            <div className="title-4 text-[#111827]">3. Full refund plus ₹50 credit</div>
            <p className="mt-2">
              When no backup bay is free at that hour, choose a free reschedule for later or take
              an instant 100% refund plus a ₹50 delay credit.
            </p>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-black/[0.08] bg-white p-6">
          <div className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-[#4338CA]" weight="duotone" />
            <h2 className="heading-6 text-[#111827]">Gate entry and QR pass rules</h2>
          </div>
          <ul className="mt-4 space-y-3 body-6 text-[#374151]">
            <li className="flex items-start gap-2">
              <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#047857]" weight="fill" />
              <span>
                <strong className="text-[#111827]">QR pass with every paid booking:</strong> As
                soon as payment clears, your Entry QR pass and Gate PIN appear on your booking card.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#047857]" weight="fill" />
              <span>
                <strong className="text-[#111827]">Simple gate verification:</strong> Show your
                Entry QR pass or Gate PIN to security or scan the wall placard on arrival.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#047857]" weight="fill" />
              <span>
                <strong className="text-[#111827]">Vehicle plate matching:</strong> Confirm the
                vehicle selected on your profile matches the vehicle arriving at the gate.
              </span>
            </li>
          </ul>
        </section>

        <section className="rounded-2xl border border-black/[0.08] bg-white p-6">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-[#C83709]" weight="duotone" />
            <h2 className="heading-6 text-[#111827]">Late arrival, extensions, and cancellations</h2>
          </div>
          <ul className="mt-4 space-y-3 body-6 text-[#374151]">
            <li className="flex items-start gap-2">
              <CalendarBlank className="mt-0.5 h-4 w-4 shrink-0 text-[#C83709]" weight="duotone" />
              <span>
                <strong className="text-[#111827]">Grace window on arrival:</strong> Locations
                allow a 15 minute grace arrival window after your start time before cutoff review.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CalendarBlank className="mt-0.5 h-4 w-4 shrink-0 text-[#C83709]" weight="duotone" />
              <span>
                <strong className="text-[#111827]">Safe stay extensions:</strong> Extra time is
                checked against upcoming holds and host approval with clear upfront pricing.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CalendarBlank className="mt-0.5 h-4 w-4 shrink-0 text-[#C83709]" weight="duotone" />
              <span>
                <strong className="text-[#111827]">Host cancellations:</strong> If a host ever
                withdraws a future slot for maintenance, choose free rebooking or a full refund.
              </span>
            </li>
          </ul>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-black/[0.08] bg-white p-6">
          <div className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-[#047857]" weight="duotone" />
            <h2 className="heading-6 text-[#111827]">Prepaid parking wallet and settlement</h2>
          </div>
          <ul className="mt-4 space-y-3 body-6 text-[#374151]">
            <li className="flex items-start gap-2">
              <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#047857]" weight="fill" />
              <span>
                <strong className="text-[#111827]">Instant QR pass unlock:</strong> Keep balance
                in your Prepaid Wallet to confirm holds and settle accepted extensions cleanly.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#047857]" weight="fill" />
              <span>
                <strong className="text-[#111827]">Low balance protection:</strong> If an overstay
                creates an unpaid due, new holds pause until you top up and settle that balance.
              </span>
            </li>
          </ul>
        </section>

        <section className="rounded-2xl border border-black/[0.08] bg-white p-6">
          <div className="flex items-center gap-2">
            <NavigationArrow className="h-5 w-5 text-[#4338CA]" weight="duotone" />
            <h2 className="heading-6 text-[#111827]">Smart exit, GPS check, and turnaround gap</h2>
          </div>
          <ul className="mt-4 space-y-3 body-6 text-[#374151]">
            <li className="flex items-start gap-2">
              <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#4338CA]" weight="fill" />
              <span>
                <strong className="text-[#111827]">Phone GPS notice:</strong> Location tracks
                your phone rather than the parked vehicle. If you walk away on foot, the bay stays
                reserved in <span className="font-mono body-4">DEPARTURE_PENDING</span> until
                confirmed clear.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#4338CA]" weight="fill" />
              <span>
                <strong className="text-[#111827]">Confirmed physical vacancy:</strong> A bay
                only opens for the next driver after exit confirmation and the 15 minute clearance
                buffer complete.
              </span>
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
};
