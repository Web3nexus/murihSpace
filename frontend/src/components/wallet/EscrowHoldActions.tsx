import { useEffect, useState } from "react";
import { authFetch } from "@/lib/api/authFetch";
import { Button } from "@/components/ui/button";

/** The escrow fields the buyer and seller actions depend on. */
export interface HoldableEscrow {
  id: number;
  status: string;
  hold_reason?: string | null;
  delivery_kind?: string | null;
  delivered_at?: string | null;
  buyer_confirmed_at?: string | null;
  release_at?: string | null;
  buyer_id: number;
  seller_id: number;
}

interface Contact {
  name: string | null;
  username: string | null;
  mobile_number: string | null;
}

const HOLD_LABELS: Record<string, string> = {
  no_delivery: "No delivery and no contact between the buyer and seller by the check date.",
};

function holdText(reason?: string | null): string {
  if (!reason) return "Funds are on hold while the order is reviewed.";
  if (reason.startsWith("manual:")) return "Our team has placed a hold on these funds while the order is reviewed.";
  return HOLD_LABELS[reason] ?? "Funds are on hold.";
}

/**
 * Buyer and seller actions for one escrow: the hold status, Continue, Release, Confirm receipt
 * and Dispute. Also shows the other party's phone number, which the server returns only for a paid order.
 */
export function EscrowHoldActions({
  escrow,
  currentUserId,
  onChanged,
}: {
  escrow: HoldableEscrow;
  currentUserId: number | undefined;
  onChanged: () => void;
}) {
  const isBuyer = currentUserId === escrow.buyer_id;
  const isSeller = currentUserId === escrow.seller_id;
  const isParty = isBuyer || isSeller;
  const onHold = escrow.status === "on_hold";
  const open = escrow.status === "held" || onHold;

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [contact, setContact] = useState<Contact | null>(null);
  const [disputing, setDisputing] = useState(false);
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!isParty) return;
    let active = true;
    authFetch(`/wallet/escrow/${escrow.id}/counterparty-contact`, { headers: { Accept: "application/json" } })
      .then(async (res) => {
        if (!active || !res.ok) return;
        const json = await res.json();
        setContact(json.data?.data ?? null);
      })
      .catch(() => {
        // Not shown until the order is paid, or when the request fails.
      });

    return () => {
      active = false;
    };
  }, [escrow.id, isParty]);

  async function act(path: string, body?: unknown, success?: string) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await authFetch(`/wallet/escrow/${escrow.id}/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message ?? "That action could not be completed.");
      setNotice(success ?? "Done.");
      setDisputing(false);
      setReason("");
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That action could not be completed.");
    } finally {
      setBusy(false);
    }
  }

  const canConfirmReceipt =
    isBuyer && escrow.status === "held" && escrow.delivery_kind === "physical" && !!escrow.delivered_at && !escrow.buyer_confirmed_at;

  return (
    <div className="space-y-3 rounded-lg border border-border/60 p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Order status</span>
        <span
          className={`rounded px-2 py-0.5 text-[11px] font-bold ${
            onHold ? "bg-amber-500/15 text-amber-700 dark:text-amber-300" : "bg-muted text-foreground"
          }`}
        >
          {onHold ? "On hold" : escrow.status === "held" ? "Active" : escrow.status}
        </span>
      </div>

      {onHold && <p className="text-sm text-muted-foreground">{holdText(escrow.hold_reason)}</p>}

      {isParty && contact?.mobile_number && (
        <p className="text-xs text-muted-foreground">
          Other party: {contact.name ?? contact.username} · {contact.mobile_number}
        </p>
      )}

      {error && <p className="text-xs font-semibold text-destructive">{error}</p>}
      {notice && <p className="text-xs font-semibold text-emerald-600">{notice}</p>}

      <div className="flex flex-wrap gap-2">
        {isParty && onHold && escrow.hold_reason === "no_delivery" && (
          <Button size="sm" disabled={busy} onClick={() => act("resume", undefined, "The order is active again.")}>
            Continue
          </Button>
        )}
        {canConfirmReceipt && (
          <Button size="sm" variant="outline" disabled={busy} onClick={() => act("confirm-receipt", undefined, "Receipt confirmed.")}>
            Confirm receipt
          </Button>
        )}
        {isBuyer && open && (
          <Button
            size="sm"
            disabled={busy}
            onClick={() => {
              if (window.confirm("Release these funds to the seller now? This cannot be undone.")) {
                void act("release-now", undefined, "Funds released to the seller.");
              }
            }}
          >
            Release funds
          </Button>
        )}
        {isParty && open && !disputing && (
          <Button size="sm" variant="outline" disabled={busy} onClick={() => setDisputing(true)}>
            Open dispute
          </Button>
        )}
      </div>

      {disputing && (
        <div className="space-y-2">
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="Describe the problem (at least 10 characters)"
            className="w-full rounded-md border border-border bg-background p-2 text-sm"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={busy || reason.trim().length < 10}
              onClick={() => act("dispute", { reason: reason.trim() }, "Dispute opened. Our team will review it.")}
            >
              Submit dispute
            </Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => setDisputing(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
