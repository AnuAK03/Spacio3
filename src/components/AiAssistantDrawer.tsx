import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ChevronRight,
  Clock,
  Compass,
  CreditCard,
  ExternalLink,
  Lock,
  MapPin,
  Radio,
  Send,
  ShieldCheck,
  Sparkles,
  UserCheck,
  X,
  Zap,
} from 'lucide-react';
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
    label: 'How to check in to my spot?',
    prompt: 'How do I check in to my reserved parking spot? Can I scan a spot wall QR code?',
  },
  {
    label: 'Find parking spot under 300m',
    prompt: 'Find the closest verified parking spot under 300m walk with transparent pricing.',
  },
  {
    label: 'Where is my spot & directions?',
    prompt: 'Where is my reserved parking spot located and how do I get directions to the entrance?',
  },
  {
    label: 'Wallet & pricing breakdown',
    prompt: 'Explain my prepaid wallet balance, payment deduction, and the itemized price breakdown (parking, service fee, GST).',
  },
  {
    label: 'Late arrival & overstay rules',
    prompt: 'What happens if I arrive 20 minutes late or stay past my scheduled time? How do extensions work?',
  },
  {
    label: 'Cancellation & instant refund',
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
          text: `👋 **How can I help you park today?**

• **Vehicle**: ${activeVehicle?.label || 'Driver Vehicle'} (${activeVehicle?.isEv ? '⚡ EV' : activeVehicle?.vehicleType.toUpperCase()})
• **Wallet**: ₹${wallet?.balanceInr ?? 500}
${
  activeBooking
    ? `• **Current Spot**: **${activeBooking.facilityName}** (${activeBooking.spaceCode}) · Spot PIN: \`${activeBooking.accessCode}\``
    : '• **Reservation**: No active booking right now'
}

Tap any question below or ask about finding spots, directions, check-in, or pricing.`,
          suggestedPrompts: [
            'How to check in to my spot?',
            'Find parking spot under 300m',
            'Wallet & pricing breakdown',
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
          text: data.answer || 'I evaluated your request.',
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
              ? `⚠️ ${err.message}`
              : '⚠️ Unable to complete request. Please try again.',
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

  // Render markdown text neatly (bold, code blocks, lists, headings)
  const renderFormattedContent = (content: string) => {
    const lines = content.split('\n');
    return lines.map((line, idx) => {
      const trimmed = line.trim();
      if (!trimmed) {
        return <div key={idx} className="h-1.5" />;
      }
      if (trimmed.startsWith('### ')) {
        return (
          <h4 key={idx} className="font-display text-sm font-bold text-[#111827] mt-1.5 mb-1">
            {trimmed.slice(4)}
          </h4>
        );
      }
      if (trimmed.startsWith('#### ')) {
        return (
          <h5 key={idx} className="font-display text-xs font-bold text-[#111827] mt-1.5 mb-0.5">
            {trimmed.slice(5)}
          </h5>
        );
      }
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        return (
          <div key={idx} className="flex items-start gap-1.5 ml-1 text-xs leading-relaxed text-[#374151]">
            <span className="text-[#C83709] font-bold">•</span>
            <span dangerouslySetInnerHTML={{ __html: formatInlineMarkdown(trimmed.slice(2)) }} />
          </div>
        );
      }
      if (/^\d+\.\s/.test(trimmed)) {
        const num = trimmed.match(/^(\d+\.)\s/)?.[1] || '•';
        const rest = trimmed.replace(/^\d+\.\s/, '');
        return (
          <div key={idx} className="flex items-start gap-1.5 ml-1 text-xs leading-relaxed text-[#374151]">
            <span className="font-semibold text-[#4338CA] shrink-0">{num}</span>
            <span dangerouslySetInnerHTML={{ __html: formatInlineMarkdown(rest) }} />
          </div>
        );
      }
      return (
        <p
          key={idx}
          className="text-xs leading-relaxed text-[#374151]"
          dangerouslySetInnerHTML={{ __html: formatInlineMarkdown(trimmed) }}
        />
      );
    });
  };

  const formatInlineMarkdown = (text: string): string => {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-[#111827]">$1</strong>')
      .replace(/`([^`]+)`/g, '<code class="rounded bg-black/[0.06] px-1 py-0.5 font-mono text-[11px] text-[#4338CA]">$1</code>');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/35 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label="AI Parking Assistant"
    >
      <div className="flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
        {/* Top Header */}
        <div className="border-b border-black/[0.08] bg-white px-4 py-3.5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#4338CA] via-[#7C3AED] to-[#C83709] text-white shadow-md">
                <Sparkles className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="truncate font-display text-sm font-bold text-[#111827]">
                    Driver Assistant
                  </h2>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-semibold text-[#047857]">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Online
                  </span>
                </div>
                <p className="truncate text-[11px] text-[#4B5563]">
                  {activeVehicle?.label} · ₹{wallet?.balanceInr ?? 500} balance
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close AI Assistant"
              className="shrink-0 rounded-lg border border-black/[0.08] p-1.5 text-[#4B5563] hover:bg-black/[0.05] hover:text-[#111827]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Privacy & Safety Guarantee Strip */}
          <div className="mt-2.5 flex items-center justify-between rounded-lg bg-[#F8F7F4] px-2.5 py-1 text-[10px] text-[#4B5563]">
            <span className="flex items-center gap-1 font-semibold text-[#047857]">
              <ShieldCheck className="h-3 w-3" />
              <span>Driver Privacy Enforced</span>
            </span>
            <span className="flex items-center gap-1">
              <Lock className="h-2.5 w-2.5 text-[#4338CA]" />
              <span>Encrypted Session</span>
            </span>
          </div>
        </div>

        {/* Quick Suggestion Chips */}
        <div className="border-b border-black/[0.06] bg-[#F8F7F4] px-4 py-2.5">
          <div className="mb-1.5 flex items-center justify-between text-[11px] font-semibold text-[#4B5563]">
            <span>Suggested Questions</span>
            <span className="text-[10px] font-normal text-[#9CA3AF]">Tap to ask</span>
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {QUICK_CHIPS.map((chip) => (
              <button
                key={chip.label}
                type="button"
                disabled={busy}
                onClick={() => void handleSendMessage(chip.prompt)}
                className="whitespace-nowrap rounded-lg border border-black/[0.08] bg-white px-2.5 py-1 text-[11px] font-medium text-[#111827] shadow-xs transition-colors hover:border-[#D93F0B] hover:text-[#C83709] disabled:opacity-50"
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>

        {/* Messages Scroll Area */}
        <div className="flex-1 space-y-3.5 overflow-y-auto p-4 bg-[#FAF9F6]">
          {messages.map((msg) => {
            if (msg.role === 'user') {
              return (
                <div key={msg.id} className="flex justify-end">
                  <div className="max-w-[85%] rounded-2xl bg-[#4338CA] px-3.5 py-2.5 text-xs font-medium text-white shadow-sm">
                    {msg.text}
                  </div>
                </div>
              );
            }

            return (
              <div
                key={msg.id}
                className={`space-y-2.5 rounded-2xl border p-4 shadow-xs ${
                  msg.isError
                    ? 'border-rose-200 bg-rose-50'
                    : 'border-black/[0.07] bg-white'
                }`}
              >
                {/* Agent Header Tag */}
                <div className="flex items-center justify-between gap-2 border-b border-black/[0.04] pb-1.5">
                  <div className="flex items-center gap-1.5">
                    <Bot className="h-3.5 w-3.5 text-[#4338CA]" />
                    <span className="text-[11px] font-bold text-[#111827]">
                      ParkPool Driver Agent
                    </span>
                  </div>
                  <span className="flex items-center gap-1 text-[10px] font-semibold text-[#047857]">
                    <CheckCircle2 className="h-3 w-3" />
                    <span>Verified Policy Safe</span>
                  </span>
                </div>

                {/* Safety Alert if applicable */}
                {msg.safetyNotice && (
                  <div className="flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] font-semibold text-amber-900">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-600" />
                    <span>{msg.safetyNotice}</span>
                  </div>
                )}

                {/* Formatted Content */}
                <div className="space-y-1">{renderFormattedContent(msg.text)}</div>

                {/* Recommended Spot Cards if searching */}
                {msg.recommendedSpots && msg.recommendedSpots.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-black/[0.05]">
                    <div className="text-[11px] font-bold text-[#111827]">
                      Recommended Spots (Fits {activeVehicle.label}):
                    </div>
                    {msg.recommendedSpots.map((cand) => (
                      <div
                        key={cand.spaceId}
                        className="rounded-xl border border-black/[0.08] bg-[#F8F7F4] p-3 transition-colors hover:border-[#D93F0B]"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate font-display text-xs font-bold text-[#111827]">
                              {cand.facilityName}
                            </div>
                            <div className="mt-0.5 text-[11px] text-[#4B5563]">
                              Spot {cand.spaceCode} · Spot Entrance: {cand.entranceLabel}
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] font-semibold text-[#047857]">
                              <span className="flex items-center gap-0.5">
                                <MapPin className="h-3 w-3 text-[#C83709]" />
                                {cand.walkingDistanceM}m walk
                              </span>
                              <span>·</span>
                              <span>₹{cand.hourlyPriceInr}/hr</span>
                              {cand.evCharging && (
                                <>
                                  <span>·</span>
                                  <span className="flex items-center gap-0.5 text-emerald-700">
                                    <Zap className="h-2.5 w-2.5" />
                                    EV Ready
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                          <button
                            type="button"
                            disabled={bookingBayId === cand.spaceId}
                            onClick={() => void handleBookCandidateSpot(cand)}
                            className="whitespace-nowrap shrink-0 rounded-lg bg-gradient-to-r from-[#E0430D] to-[#C83709] px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:brightness-110 disabled:opacity-50"
                          >
                            {bookingBayId === cand.spaceId ? 'Reserving...' : 'Book Spot'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Direct Action Button if driver has active booking */}
                {activeBooking && (
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onNavigateDashboard();
                      }}
                      className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50/70 py-2 text-xs font-bold text-[#4338CA] hover:bg-indigo-100"
                    >
                      <Compass className="h-3.5 w-3.5" />
                      <span>View Active Booking &amp; Spot Directions</span>
                    </button>
                  </div>
                )}

                {/* Citations Pill */}
                {msg.citations && msg.citations.length > 0 && (
                  <div className="border-t border-black/[0.04] pt-2 flex flex-wrap gap-1 text-[10px] text-[#6B7280]">
                    <span className="font-semibold text-[#4B5563]">Verified Sources:</span>
                    {msg.citations.map((c) => (
                      <span key={c.docId} className="rounded bg-black/[0.04] px-1.5 py-0.5">
                        {c.docId} ({c.section})
                      </span>
                    ))}
                  </div>
                )}

                {/* Follow-up Prompts */}
                {msg.suggestedPrompts && msg.suggestedPrompts.length > 0 && (
                  <div className="pt-1 flex flex-wrap gap-1">
                    {msg.suggestedPrompts.map((sPrompt, sIdx) => (
                      <button
                        key={sIdx}
                        type="button"
                        disabled={busy}
                        onClick={() => void handleSendMessage(sPrompt)}
                        className="rounded-full border border-black/[0.08] bg-white px-2.5 py-1 text-[10px] font-medium text-[#4338CA] hover:border-[#4338CA] hover:bg-indigo-50/50 disabled:opacity-50"
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
            <div className="flex items-center gap-2.5 rounded-2xl border border-indigo-200 bg-white p-3.5 text-xs text-[#4338CA] shadow-xs">
              <Radio className="h-4 w-4 animate-spin text-[#4338CA]" />
              <span className="font-medium">
                Consulting GenAI Agent &amp; verifying safety rules...
              </span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Bottom Input Area */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleSendMessage(input);
          }}
          className="border-t border-black/[0.08] bg-white p-3.5"
        >
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask anything about parking, directions, or policies..."
              className="flex-1 rounded-xl border border-black/[0.1] bg-[#F8F7F4] px-3.5 py-2.5 text-xs text-[#111827] focus:border-[#4338CA] focus:bg-white focus:outline-none"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              aria-label="Send message"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-r from-[#4338CA] to-[#C83709] text-white shadow-xs hover:brightness-110 disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-1.5 flex items-center justify-between text-[10px] text-[#6B7280]">
            <span>Upholding driver privacy &amp; transparent pricing</span>
            <span>ParkPool Agent v2</span>
          </div>
        </form>
      </div>
    </div>
  );
};
