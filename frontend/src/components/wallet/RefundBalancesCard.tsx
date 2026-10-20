import { useEffect, useState } from "react";
import { authFetch } from "@/lib/api/authFetch";
import { Button } from "@/components/ui/button";

interface RefundBalance {
  id: number;
  order_id: number;
  original_amount: string | number;
  original_currency: string;
  amount_usd: number;
  status: "available" | "refunded_to_card" | "failed";
  refunded_at: string | null;
  failure_reason: string | null;
}

const usd = (cents: number) => new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(cents / 100);

/**
 * Refunds from disputes the buyer won. The money stays on the platform: it can be spent on purchases
 * or gifts, but not withdrawn. "Send to card" refunds it to the card that paid for the order.
 */
export function RefundBalancesCard({ onChanged }: { onChanged?: () => void }) {
  const [rows, setRows] = useState<RefundBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    authFetch("/wallet/refund-balances", { headers: { Accept: "application/json" } })
      .then(async (res) => {
        if (!active || !res.ok) return;
        const json = await res.json();
        setRows(json.data?.data ?? json.data ?? []);
      })
      .catch(() => {
        // Empty list is shown when the request fails.
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [reloadKey]);

  if (!loading && rows.length === 0) return null;

  async function sendToCard(id: number) {
    setBusyId(id);
    setMessage(null);
    try {
      const res = await authFetch(`/wallet/refund-balances/${id}/refund-to-card`, {
        method: "POST",
        headers: { Accept: "application/json" },
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        setMessage({ ok: true, text: "Refund sent to the card that paid for this order." });
        setReloadKey((k) => k + 1);
        onChanged?.();
      } else {
        setMessage({ ok: false, text: json.message ?? "The refund could not be sent to the card." });
      }
    } catch {
      setMessage({ ok: false, text: "Network error. Try again." });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div>
        <h2 className="text-sm font-bold">Dispute refunds</h2>
        <p className="text-xs text-muted-foreground">
          Refunds from disputes you won. Spend them on purchases or gifts, or send them back to the card that paid. They
          cannot be withdrawn.
        </p>
      </div>

      {message && (
        <p className={`text-xs font-semibold ${message.ok ? "text-emerald-600" : "text-destructive"}`}>{message.text}</p>
      )}

      <ul className="divide-y divide-border/60">
        {rows.map((row) => (
          <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <div>
              <p className="text-sm font-semibold">
                {usd(row.amount_usd)} · order #{row.order_id}
              </p>
              <p className="text-xs text-muted-foreground">
                Charged {row.original_amount} {row.original_currency}
                {row.status === "refunded_to_card" && " · sent to card"}
                {row.failure_reason && ` · ${row.failure_reason}`}
              </p>
            </div>
            {row.status === "available" && (
              <Button size="sm" disabled={busyId === row.id} onClick={() => void sendToCard(row.id)}>
                {busyId === row.id ? "Sending…" : "Send to card"}
              </Button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
