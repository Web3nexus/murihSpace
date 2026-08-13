import { useState } from "react";
import { LifeBuoy, Loader2, CheckCircle, X } from "lucide-react";
import { createHelpTicket, deviceMetadata, type HelpTicketContext } from "~/lib/help";

interface ContactSupportProps {
  /**
   * Context that gets pre-filled into the ticket so the visitor never has to
   * retype what they were doing when self-service failed.
   */
  context?: HelpTicketContext;
  open?: boolean;
  onClose?: () => void;
}

/**
 * Pre-filled "contact support" form shown when a help search returns nothing
 * useful (or an article was not helpful). Captures the search query, the
 * attempted article, the current page and device metadata automatically.
 */
export function ContactSupport({ context, open = true, onClose }: ContactSupportProps) {
  const [email, setEmail] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const subject = context?.search_query
    ? `Couldn't find help for: ${context.search_query}`
    : "Help request";

  if (!open) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const { ticket_number } = await createHelpTicket({
        subject,
        description: description.trim() || "I could not find a helpful article.",
        email: email.trim(),
        context: {
          search_query: context?.search_query,
          attempted_article: context?.attempted_article,
          current_page: context?.current_page ?? (typeof window !== "undefined" ? window.location.pathname : undefined),
          user_id: context?.user_id,
          device: deviceMetadata(),
        },
      });
      setDone(ticket_number || "submitted");
    } catch {
      setError("Something went wrong sending your request. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-[#16A34A]/30 bg-[#16A34A]/10 p-6 text-center">
        <CheckCircle className="mx-auto size-8 text-[#16A34A]" />
        <p className="mt-3 font-bold text-[#102840]">Your request has been received.</p>
        <p className="mt-1 text-sm text-[#667085]">
          Our team will get back to you soon{done !== "submitted" ? ` — reference ${done}` : ""}.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[#D6E0E8] bg-white p-6 shadow-lg shadow-[rgba(16,40,64,0.08)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-[15px] font-bold text-[#102840]">
            <LifeBuoy className="size-4.5 text-[#2164b6]" />
            Couldn't find what you need?
          </h3>
          <p className="mt-1 text-[13px] text-[#667085]">
            Contact MurihSpace Support — we'll pick up from your search.
          </p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            aria-label="Close contact form"
            className="rounded-md p-1 text-[#98A2B3] transition-colors hover:bg-[#F0F5F8] hover:text-[#102840]"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      <form onSubmit={submit} className="mt-4 space-y-3">
        <div>
          <label htmlFor="contact-email" className="text-[12px] font-bold text-[#475467]">
            Your email
          </label>
          <input
            id="contact-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="mt-1 w-full rounded-xl border border-[#D6E0E8] bg-white px-3 py-2.5 text-sm text-[#102840] placeholder:text-[#98A2B3] outline-none focus:border-[#2164b6] focus:ring-4 focus:ring-[#2164b6]/10"
          />
        </div>
        <div>
          <label htmlFor="contact-description" className="text-[12px] font-bold text-[#475467]">
            What do you need help with? <span className="font-normal text-[#98A2B3]">(optional)</span>
          </label>
          <textarea
            id="contact-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            placeholder="Add any extra details (optional)…"
            className="mt-1 w-full rounded-xl border border-[#D6E0E8] bg-white p-3 text-sm text-[#102840] placeholder:text-[#98A2B3] outline-none focus:border-[#2164b6] focus:ring-4 focus:ring-[#2164b6]/10"
          />
        </div>

        {error && <p className="text-sm font-semibold text-[#DC2626]">{error}</p>}

        <button
          type="submit"
          disabled={submitting || !email.trim()}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#2164b6] px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#1b52a0] disabled:opacity-50"
        >
          {submitting && <Loader2 className="size-4 animate-spin" />}
          {submitting ? "Sending…" : "Contact support"}
        </button>
      </form>
    </div>
  );
}
