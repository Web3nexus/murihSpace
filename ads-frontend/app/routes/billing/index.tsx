import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Plus, CreditCard, Receipt } from "lucide-react";
import { adsRequest } from "../../lib/ads-api";
import { formatUsd } from "../../lib/ads-format";

export default function BillingIndex() {
  const [balanceCents, setBalanceCents] = useState<number | null>(null);
  const [balanceState, setBalanceState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    const controller = new AbortController();
    let advertiserId = "";
    try {
      advertiserId = window.localStorage.getItem("advertiser_id") || "";
    } catch {
      advertiserId = "";
    }
    if (!advertiserId) {
      setBalanceState("error");
      return () => controller.abort();
    }
    adsRequest<{ data?: { available_balance?: number } }>("/wallet", {
      params: { advertiser_id: advertiserId },
      signal: controller.signal,
    })
      .then((body) => {
        const value = body?.data?.available_balance;
        setBalanceCents(typeof value === "number" ? value : null);
        setBalanceState("ready");
      })
      .catch(() => {
        if (!controller.signal.aborted) setBalanceState("error");
      });
    return () => controller.abort();
  }, []);

  return (
    <div className="flex flex-col gap-6 max-w-[1400px] mx-auto w-full">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Billing &amp; Payments</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage your ad account balance, payment methods, and transaction history.</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="rounded-lg border-border shadow-none md:col-span-2">
          <CardHeader className="border-b border-border pb-4">
            <CardTitle className="text-base font-semibold">Account balance</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-6 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="mb-1 text-sm font-medium uppercase tracking-wider text-muted-foreground">Prepaid balance</p>
              {balanceState === "loading" ? (
                <p className="text-sm text-muted-foreground" role="status">Loading balance…</p>
              ) : balanceState === "error" || balanceCents === null ? (
                <p className="text-lg font-semibold text-muted-foreground">No data yet</p>
              ) : (
                <div className="text-4xl font-bold tracking-tight tabular-nums text-foreground">{formatUsd(balanceCents / 100)}</div>
              )}
              <p className="mt-2 text-xs text-muted-foreground">Funds are automatically deducted as your ads deliver.</p>
            </div>
            <div className="flex flex-col gap-3">
              <Button className="px-8">
                <Plus className="h-4 w-4 mr-2" aria-hidden="true" /> Add funds
              </Button>
              <Button variant="outline">
                <CreditCard className="h-4 w-4 mr-2" aria-hidden="true" /> Payment methods
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-lg border-border shadow-none md:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Latest invoice</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-medium text-foreground">No invoices yet</p>
            <p className="mt-1 text-xs text-muted-foreground">Invoices appear here once billing starts.</p>
            <Button variant="outline" size="sm" className="mt-4 w-full" disabled>
              <Receipt className="h-3 w-3 mr-2" aria-hidden="true" /> Download PDF
            </Button>
          </CardContent>
        </Card>
      </div>

      <section aria-labelledby="billing-transactions" className="rounded-lg border border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <h2 id="billing-transactions" className="text-base font-semibold">Transaction history</h2>
        </div>
        <div className="p-6 text-sm text-muted-foreground">No transactions yet.</div>
      </section>
    </div>
  );
}
