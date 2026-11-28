import React, { useEffect, useRef, useState } from 'react';
import {
  Compass,
  Lightning,
  MapPin,
  PaperPlaneTilt,
  Pulse,
  Robot,
  Sparkle,
  Warning,
  X,
} from '@phosphor-icons/react';
import {
  BookingRecord,
  CandidateEvaluation,
  PrepaidWallet,
  VehicleProfile,
} from '../types/parkpool';

interface AiAssistantDrawerProps {
  open: boolean;
  onClose: () => void;
  vehicles: VehicleProfile[];
  selectedVehicleId: string;
  activeBooking?: BookingRecord;
  wallet?: PrepaidWallet;
  authToken?: string | null;
  onCreateHold: (params: {
    spaceId: string;
    vehicleId: string;
    startMin: number;
    endMin: number;
  }) => Promise<void>;
  onNavigateDashboard: () => void;
}

interface AssistantMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  citations?: Array<{ docId: string; title: string; section: string }>;
  recommendedSpots?: CandidateEvaluation[];
  suggestedPrompts?: string[];
  safetyNotice?: string;
  isError?: boolean;
}

const QUICK_CHIPS = [
  {
    label: 'How to check in?',
    prompt: 'How do I check in to my reserved parking spot? Can I scan a spot wall QR code?',
  },
  {
    label: 'Spots under 300m',
    prompt: 'Find the closest verified parking spot under 300m walk with transparent pricing.',
  },
  {
    label: 'Gate directions',
    prompt: 'Where is my reserved parking spot located and how do I get directions to the entrance?',
  },
  {
    label: 'Wallet breakdown',
    prompt: 'Explain my prepaid wallet balance, payment deduction, and the itemized price breakdown (parking, service fee, GST).',
  },
  {
    label: 'Late arrival rules',
    prompt: 'What happens if I arrive 20 minutes late or stay past my scheduled time? How do extensions work?',
  },
  {
    label: 'Instant refunds',
    prompt: 'What is the cancellation policy and how quickly do I get a full refund to my wallet?',
  },
];

export const AiAssistantDrawer: React.FC<AiAssistantDrawerProps> = ({
  open,
  onClose,
  vehicles,
  selectedVehicleId,
  activeBooking,
  wallet,
  authToken,
  onCreateHold,
  onNavigateDashboard,
}) => {
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [bookingBayId, setBookingBayId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const activeVehicle = vehicles.find((v) => v.id === selectedVehicleId) || vehicles[0];

  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([
        {
          id: 'welcome-0',
          role: 'assistant',
          text: `Ask about nearby bays, gate directions, QR entry, pricing, or your ₹${wallet?.balanceInr ?? 500} wallet balance.${
            activeBooking ? ` Active spot: **${activeBooking.facilityName}** (${activeBooking.spaceCode}).` : ''
          }`,
          suggestedPrompts: [
            'How to check in to my spot?',
            'Find parking spot under 300m',
            'Wallet and pricing breakdown',
          ],
        },
      ]);
    }
  }, [open, messages.length, activeVehicle, wallet?.balanceInr, activeBooking]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, busy]);

  if (!open) return null;

  const handleSendMessage = async (promptText: string) => {
    const trimmed = promptText.trim();
    if (!trimmed || busy) return;

    const userMsgId = `u-${Date.now()}`;
    const newMsg: AssistantMessage = { id: userMsgId, role: 'user', text: trimmed };
    setMessages((prev) => [...prev, newMsg]);
    setInput('');
    setBusy(true);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      const res = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          question: trimmed,
          vehicleId: activeVehicle?.id,
          activeBookingId: activeBooking?.id,
          history: messages.slice(-4).map((m) => ({ role: m.role, text: m.text })),
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.error || `Server responded with status ${res.status}`);
      }

      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          text: data.answer || 'Request evaluated.',
          citations: data.citations || [],
          recommendedSpots: data.recommendedSpots,
          suggestedPrompts: data.suggestedPrompts,
          safetyNotice: data.safetyNotice,
        },
      ]);
    } catch (err: unknown) {
      setMessages((prev) => [
        ...prev,
        {
          id: `e-${Date.now()}`,
          role: 'assistant',
          text:
            err instanceof Error
              ? `${err.message}`
              : 'Unable to complete request. Please try again.',
          isError: true,
        },
      ]);
    } finally {
      setBusy(false);
    }
  };

  const handleBookCandidateSpot = async (cand: CandidateEvaluation) => {
    setBookingBayId(cand.spaceId);
    try {
      await onCreateHold({
        spaceId: cand.spaceId,
        vehicleId: activeVehicle.id,
        startMin: 600,
        endMin: 720,
      });
      onClose();
      onNavigateDashboard();
    } finally {
      setBookingBayId(null);
    }
  };

  const formatInlineMarkdown = (text: string): string => {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-[#111827]">$1</strong>')
      .replace(/`([^`]+)`/g, '<code class="rounded bg-black/[0.06] px-1 py-0.5 font-mono text-xs text-[#4338CA]">$1</code>');
  };

  const renderFormattedContent = (content: string) => {
    const lines = content.split('\n');
    return lines.map((line, idx) => {
      const trimmed = line.trim();
      if (!trimmed) {
        return <div key={idx} className="h-1" />;
      }
      if (trimmed.startsWith('### ')) {
        return (
          <h4 key={idx} className="title-4 text-[#111827] mt-2 mb-1">
            {trimmed.slice(4)}
          </h4>
        );
      }
      if (trimmed.startsWith('#### ')) {
        return (
          <h5 key={idx} className="caption-3 text-[#111827] mt-1 mb-0.5">
            {trimmed.slice(5)}
          </h5>
        );
      }
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        return (
          <div key={idx} className="flex items-start gap-2 ml-1 caption-2 text-[#374151]">
            <span className="text-[#C83709] font-semibold">•</span>
            <span dangerouslySetInnerHTML={{ __html: formatInlineMarkdown(trimmed.slice(2)) }} />
          </div>
        );
      }
      if (/^\d+\.\s/.test(trimmed)) {
        const num = trimmed.match(/^(\d+\.)\s/)?.[1] || '•';
        const rest = trimmed.replace(/^\d+\.\s/, '');
        return (
          <div key={idx} className="flex items-start gap-2 ml-1 caption-2 text-[#374151]">
            <span className="font-semibold text-[#4338CA] shrink-0">{num}</span>
            <span dangerouslySetInnerHTML={{ __html: formatInlineMarkdown(rest) }} />
          </div>
        );
      }
      return (
        <p
          key={idx}
          className="caption-2 text-[#374151]"
          dangerouslySetInnerHTML={{ __html: formatInlineMarkdown(trimmed) }}
        />
      );
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/35 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-label="Parking Assistant"
    >
      <div className="flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
        <div className="bg-white px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#4338CA] text-white">
                <Sparkle className="h-5 w-5" weight="fill" />
              </div>
              <div className="min-w-0">
                <h2 className="truncate title-4 text-[#111827]">Parking assistant</h2>
                <p className="truncate caption-5 text-[#4B5563]">
                  {activeVehicle?.label} · ₹{wallet?.balanceInr ?? 500} balance
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close Parking Assistant"
              className="shrink-0 rounded-xl border border-black/[0.08] p-2 text-[#4B5563] transition-colors duration-300 hover:bg-black/[0.05] hover:text-[#111827]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="bg-[#F8F7F4] px-4 py-3">
          <div className="mb-2 flex items-center justify-between caption-4 text-[#4B5563]">
            <span>Suggested questions</span>
            <span className="caption-5 text-[#6B7280]">Tap to ask</span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {QUICK_CHIPS.map((chip) => (
              <button
                key={chip.label}
                type="button"
                disabled={busy}
                onClick={() => void handleSendMessage(chip.prompt)}
                className="whitespace-nowrap rounded-lg border border-black/[0.08] bg-white px-3 py-1 caption-4 text-[#111827] transition-colors duration-300 hover:border-[#C83709] hover:text-[#C83709] disabled:opacity-50"
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-4 bg-[#FAF9F6]">
          {messages.map((msg) => {
            if (msg.role === 'user') {
              return (
                <div key={msg.id} className="flex justify-end">
                  <div className="max-w-[85%] rounded-2xl bg-[#4338CA] px-4 py-2 caption-1 text-white">
                    {msg.text}
                  </div>
                </div>
              );
            }

            return (
              <div
                key={msg.id}
                className={`space-y-2 rounded-2xl border p-4 ${
                  msg.isError
                    ? 'border-rose-200 bg-rose-50'
                    : 'border-black/[0.08] bg-white'
                }`}
              >
                <div className="flex items-center gap-2 pb-1">
                  <Robot className="h-4 w-4 text-[#4338CA]" weight="duotone" />
                  <span className="caption-3 text-[#111827]">Spacio Assistant</span>
                </div>

                {msg.safetyNotice && (
                  <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 caption-4 text-amber-900">
                    <Warning className="h-4 w-4 shrink-0 text-amber-600" weight="fill" />
                    <span>{msg.safetyNotice}</span>
                  </div>
                )}

                <div className="space-y-1">{renderFormattedContent(msg.text)}</div>

                {msg.recommendedSpots && msg.recommendedSpots.length > 0 && (
                  <div className="space-y-2 pt-2">
                    <div className="caption-3 text-[#111827]">
                      Recommended bays (fits {activeVehicle.label}):
                    </div>
                    {msg.recommendedSpots.map((cand) => (
                      <div
                        key={cand.spaceId}
                        className="rounded-xl border border-black/[0.08] bg-[#F8F7F4] p-3 transition-colors duration-300 hover:border-[#C83709]"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate title-5 text-[#111827]">
                              {cand.facilityName}
                            </div>
                            <div className="mt-0.5 caption-5 text-[#4B5563]">
                              Spot {cand.spaceCode} · Entrance: {cand.entranceLabel}
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-2 caption-3 text-[#047857]">
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3 text-[#C83709]" weight="fill" />
                                {cand.walkingDistanceM}m walk
                              </span>
                              <span>·</span>
                              <span className="font-mono">₹{cand.hourlyPriceInr}/hr</span>
                              {cand.evCharging && (
                                <>
                                  <span>·</span>
                                  <span className="flex items-center gap-1 text-emerald-700">
                                    <Lightning className="h-3 w-3" weight="fill" />
                                    EV ready
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                          <button
                            type="button"
                            disabled={bookingBayId === cand.spaceId}
                            onClick={() => void handleBookCandidateSpot(cand)}
                            className="whitespace-nowrap shrink-0 rounded-lg bg-[#C83709] px-3 py-2 button-xsm text-white transition-all duration-300 hover:bg-[#B23008] active:scale-[0.98] disabled:opacity-50"
                          >
                            {bookingBayId === cand.spaceId ? 'Reserving...' : 'Book spot'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {activeBooking && (
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onNavigateDashboard();
                      }}
                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 py-2 button-xsm text-[#4338CA] transition-colors duration-300 hover:bg-indigo-100"
                    >
                      <Compass className="h-4 w-4" />
                      <span>View active booking and gate directions</span>
                    </button>
                  </div>
                )}

                {msg.citations && msg.citations.length > 0 && (
                  <div className="pt-2 flex flex-wrap gap-1 caption-5 text-[#6B7280]">
                    <span className="caption-3 text-[#4B5563]">Sources:</span>
                    {msg.citations.map((c) => (
                      <span key={c.docId} className="rounded bg-black/[0.04] px-2 py-0.5">
                        {c.docId} ({c.section})
                      </span>
                    ))}
                  </div>
                )}

                {msg.suggestedPrompts && msg.suggestedPrompts.length > 0 && (
                  <div className="pt-1 flex flex-wrap gap-1">
                    {msg.suggestedPrompts.map((sPrompt, sIdx) => (
                      <button
                        key={sIdx}
                        type="button"
                        disabled={busy}
                        onClick={() => void handleSendMessage(sPrompt)}
                        className="rounded-lg border border-black/[0.08] bg-white px-2 py-1 caption-4 text-[#4338CA] transition-colors duration-300 hover:border-[#4338CA] hover:bg-indigo-50 disabled:opacity-50"
                      >
                        {sPrompt}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {busy && (
            <div className="flex items-center gap-2 rounded-2xl border border-indigo-200 bg-white p-3 caption-4 text-[#4338CA]">
              <Pulse className="h-4 w-4 animate-pulse text-[#4338CA]" />
              <span>Checking parking availability and policy details...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleSendMessage(input);
          }}
          className="bg-white p-3"
        >
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about parking, directions, or rules..."
              className="flex-1 rounded-xl border border-black/[0.1] bg-[#F8F7F4] px-3 py-2 caption-2 text-[#111827] focus:border-[#4338CA] focus:bg-white focus:outline-none"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              aria-label="Send message"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#4338CA] text-white transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-[#3730A3] active:scale-[0.98] disabled:opacity-50"
            >
              <PaperPlaneTilt className="h-4 w-4" weight="fill" />
            </button>
          </div>
          <div className="mt-2 caption-5 text-[#6B7280]">
            <span>Private session · Transparent rates</span>
          </div>
        </form>
      </div>
    </div>
  );
};
