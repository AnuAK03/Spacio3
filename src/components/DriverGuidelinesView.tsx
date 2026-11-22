import React from 'react';
import {
  CalendarClock,
  CheckCircle2,
  Clock,
  Navigation,
  QrCode,
  RefreshCw,
  ShieldCheck,
  Wallet,
} from 'lucide-react';

export const DriverGuidelinesView: React.FC = () => {
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-black/[0.08] bg-white/92 p-6 shadow-sm backdrop-blur-md">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-[#047857]">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-[#111827]">
              Parking Guidelines &amp; Rider Protection
            </h1>
            <p className="mt-1 text-sm text-[#4B5563]">
              Everything you need to know about arrival timing, QR entry passes, prepaid wallet
              payments, smart departure checks, and how we protect you if another vehicle
              overstays.
            </p>
          </div>
        </div>
      </section>

      {/* Overstay Protection & Next-Rider Guarantee */}
      <section className="rounded-2xl border border-black/[0.08] bg-white/92 p-6 shadow-sm backdrop-blur-md">
        <div className="flex items-center gap-2 font-display text-lg font-bold text-[#111827]">
          <RefreshCw className="h-5 w-5 text-[#047857]" />
          <h2>Overstay Protection &amp; Next-Rider Guarantee</h2>
        </div>
        <p className="mt-1 text-xs text-[#4B5563]">
          If a previous driver does not return on time, you never lose your money or your trip.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-black/[0.07] bg-[#F8F7F4] p-4 text-xs leading-relaxed text-[#374151]">
            <div className="font-display text-sm font-bold text-[#111827]">
              1. Built-in 15-Minute Buffer
            </div>
            <p className="mt-1.5">
              Every booking includes a 15-minute gap before the next driver arrives. If a driver
              stays past their booked time and the buffer, the spot locks for new bookings and the
              overstaying driver pays an extra fee.
            </p>
          </div>

          <div className="rounded-xl border border-black/[0.07] bg-[#F8F7F4] p-4 text-xs leading-relaxed text-[#374151]">
            <div className="font-display text-sm font-bold text-[#111827]">
              2. Free Move to Another Spot
            </div>
            <p className="mt-1.5">
              If your reserved spot is still occupied when you arrive, we automatically move you to
              another available spot at the same or nearest verified parking location at ₹0 extra
              charge and update your Entry QR Pass immediately.
            </p>
          </div>

          <div className="rounded-xl border border-black/[0.07] bg-[#F8F7F4] p-4 text-xs leading-relaxed text-[#374151]">
            <div className="font-display text-sm font-bold text-[#111827]">
              3. Full Refund + ₹50 Credit
            </div>
            <p className="mt-1.5">
              If no backup spot is free at that hour, you can choose a free reschedule for a later
              time or take a 100% instant refund plus a ₹50 delay credit.
            </p>
          </div>
        </div>
      </section>

      {/* Core Booking & Entry Guidelines */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-black/[0.08] bg-white/92 p-6 shadow-sm backdrop-blur-md">
          <div className="flex items-center gap-2 font-display text-base font-bold text-[#111827]">
            <QrCode className="h-4 w-4 text-[#4338CA]" />
            <h2>Gate Entry &amp; QR Pass Rules</h2>
          </div>
          <ul className="mt-3 space-y-2.5 text-xs leading-relaxed text-[#374151]">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#047857]" />
              <span>
                <strong className="text-[#111827]">Your QR Pass Comes With Every Paid Booking:</strong>{' '}
                As soon as your payment succeeds, your Entry QR Pass and Gate PIN appear right on
                your booking in Booking History.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#047857]" />
              <span>
                <strong className="text-[#111827]">No Self-Scanning Needed:</strong> Just show your
                Entry QR Pass or Gate PIN to the gate guard or single host scanner when you arrive.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#047857]" />
              <span>
                <strong className="text-[#111827]">License &amp; Vehicle Plate Check:</strong> Make
                sure the vehicle number on your profile matches the vehicle you drive in, so gate
                security matches your booking smoothly.
              </span>
            </li>
          </ul>
        </section>

        <section className="rounded-2xl border border-black/[0.08] bg-white/92 p-6 shadow-sm backdrop-blur-md">
          <div className="flex items-center gap-2 font-display text-base font-bold text-[#111827]">
            <Clock className="h-4 w-4 text-[#C83709]" />
            <h2>Late Arrival, Extensions &amp; Cancellations</h2>
          </div>
          <ul className="mt-3 space-y-2.5 text-xs leading-relaxed text-[#374151]">
            <li className="flex items-start gap-2">
              <CalendarClock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#C83709]" />
              <span>
                <strong className="text-[#111827]">Late Arrival Window:</strong> Every location gives
                a grace window (usually 15 minutes) after your start time. Arriving very late past
                the facility cutoff may mark your slot as missed.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CalendarClock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#C83709]" />
              <span>
                <strong className="text-[#111827]">Extending Your Stay Safely:</strong> Before
                approving extra time, we check if another driver has booked that spot next and ask
                the host. You will always receive a clear extension price offer to accept before
                any extra fee is charged.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CalendarClock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#C83709]" />
              <span>
                <strong className="text-[#111827]">Host Cancellations:</strong> If a host ever
                withdraws a future slot due to maintenance or an emergency, you get notified right
                away to either move to a nearby spot for free or take a full refund.
              </span>
            </li>
          </ul>
        </section>
      </div>

      {/* Prepaid Wallet & Smart Exit Disclosure */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-black/[0.08] bg-white/92 p-6 shadow-sm backdrop-blur-md">
          <div className="flex items-center gap-2 font-display text-base font-bold text-[#111827]">
            <Wallet className="h-4 w-4 text-[#047857]" />
            <h2>Prepaid Parking Wallet &amp; Auto-Settlement</h2>
          </div>
          <ul className="mt-3 space-y-2.5 text-xs leading-relaxed text-[#374151]">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#047857]" />
              <span>
                <strong className="text-[#111827]">Pay Bookings &amp; Extensions Easily:</strong>{' '}
                Keep money in your Prepaid Parking Wallet to unlock your QR pass right away and
                settle accepted time extensions or overstay fees automatically.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#047857]" />
              <span>
                <strong className="text-[#111827]">Low-Balance Alerts &amp; Booking Pause:</strong>{' '}
                If your wallet drops low, we send an early reminder to add funds. If an overstay
                fee leaves an unpaid due on your account, new bookings pause until you top up and
                clear that balance.
              </span>
            </li>
          </ul>
        </section>

        <section className="rounded-2xl border border-black/[0.08] bg-white/92 p-6 shadow-sm backdrop-blur-md">
          <div className="flex items-center gap-2 font-display text-base font-bold text-[#111827]">
            <Navigation className="h-4 w-4 text-[#4338CA]" />
            <h2>Smart Exit, GPS Disclosure &amp; Turnaround Buffer</h2>
          </div>
          <ul className="mt-3 space-y-2.5 text-xs leading-relaxed text-[#374151]">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#4338CA]" />
              <span>
                <strong className="text-[#111827]">Important GPS Disclosure:</strong> Phone GPS
                monitors your smartphone&apos;s movement—not the parked car or bike itself. If you
                walk away from the lot on foot, the bay stays reserved in a{' '}
                <span className="font-mono font-semibold">DEPARTURE_PENDING</span> state until you
                or the host confirms the vehicle has physically left.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#4338CA]" />
              <span>
                <strong className="text-[#111827]">
                  Spots Never Reopen Just Because Time Ended:
                </strong>{' '}
                Even after your booked end time passes, the space only opens for the next driver
                after exit is confirmed and the 15-minute clearance buffer completes.
              </span>
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
};
