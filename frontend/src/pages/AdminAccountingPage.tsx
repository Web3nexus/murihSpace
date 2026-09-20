import { useState, useEffect, useCallback } from "react";
import {
  CurrencyDollar as DollarSign,
  TrendUp as TrendingUp,
  Receipt,
  FileText,
  DownloadSimple as Download,
  Buildings as Building2,
  ArrowsClockwise as RefreshCw,
  Plus,
  ShieldCheck,
  Stack as Layers,
  Percent,
  Globe,
  Coins,
  Spinner,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { authFetch } from "@/lib/api/authFetch";
import { toast } from "sonner";

interface StreamSummary {
  stream_type: string;
  label: string;
  count: number;
  gross_amount_cents: number;
  platform_fee_cents: number;
  creator_cents: number;
  gateway_fee_cents: number;
  tax_amount_cents: number;
  net_revenue_cents: number;
}

interface OverviewMetrics {
  currency: string;
  period: string;
  month_gross_cents: number;
  month_net_cents: number;
  month_tax_cents: number;
  month_tx_count: number;
}

interface TaxRateRule {
  id: number;
  country_code: string;
  country_name: string;
  tax_name: string;
  standard_rate_percentage: number | string;
  wht_rate_percentage: number | string;
  stream_rates: Record<string, number> | null;
  is_active: boolean;
  notes: string | null;
}

interface TaxLiabilityItem {
  id: number;
  period_identifier: string;
  period_start: string;
  period_end: string;
  country_code: string;
  currency: string;
  tax_type: string;
  taxable_base_cents: number;
  tax_collected_cents: number;
  wht_withheld_cents: number;
  status: "accruing" | "reported" | "remitted";
  filing_reference: string | null;
}

export default function AdminAccountingPage() {
  const [activeTab, setActiveTab] = useState<"streams" | "tax" | "rates" | "exports">("streams");
  const [currency, setCurrency] = useState<string>("USD");
  const [loading, setLoading] = useState<boolean>(true);
  const [metrics, setMetrics] = useState<OverviewMetrics | null>(null);
  const [streams, setStreams] = useState<StreamSummary[]>([]);
  const [taxRates, setTaxRates] = useState<TaxRateRule[]>([]);
  const [taxLiabilities, setTaxLiabilities] = useState<TaxLiabilityItem[]>([]);
  const [taxTotals, setTaxTotals] = useState<{
    total_taxable_base_cents: number;
    total_tax_collected_cents: number;
    total_wht_withheld_cents: number;
    net_liability_cents: number;
  } | null>(null);

  // New rate modal state
  const [showAddRate, setShowAddRate] = useState<boolean>(false);
  const [savingRate, setSavingRate] = useState<boolean>(false);
  const [exportingType, setExportingType] = useState<string | null>(null);
  const [newRate, setNewRate] = useState({
    country_code: "",
    country_name: "",
    tax_name: "Value Added Tax (VAT)",
    standard_rate_percentage: "7.5",
    wht_rate_percentage: "5.0",
    notes: "",
  });

  const formatCurrency = (cents: number, curr: string = "USD") => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: curr,
      minimumFractionDigits: 2,
    }).format(cents / 100);
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Overview & Streams
      const overviewRes = await authFetch(`/securegate/accounting/overview?currency=${currency}`);
      if (overviewRes.ok) {
        const data = await overviewRes.json();
        const payload = data.data || data;
        setMetrics(payload.metrics || null);
        setStreams(payload.summary?.streams || []);
      }

      // 2. Tax Summary
      const taxRes = await authFetch("/securegate/tax/summary");
      if (taxRes.ok) {
        const tData = await taxRes.json();
        const tPayload = tData.data || tData;
        setTaxTotals(tPayload.totals || null);
        setTaxLiabilities(tPayload.liabilities || []);
      }

      // 3. Tax Rates
      const ratesRes = await authFetch("/securegate/tax/rates");
      if (ratesRes.ok) {
        const rData = await ratesRes.json();
        const rPayload = rData.data || rData;
        setTaxRates(rPayload.rates || []);
      }
    } catch (e) {
      console.error("Failed to load accounting data:", e);
      toast.error("Failed to load accounting & tax data.");
    } finally {
      setLoading(false);
    }
  }, [currency]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateTaxRate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingRate(true);
    try {
      const res = await authFetch("/securegate/tax/rates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newRate,
          standard_rate_percentage: parseFloat(newRate.standard_rate_percentage),
          wht_rate_percentage: parseFloat(newRate.wht_rate_percentage),
          is_active: true,
        }),
      });

      if (res.ok) {
        toast.success(`Tax rule for ${newRate.country_name} created successfully.`);
        setShowAddRate(false);
        setNewRate({
          country_code: "",
          country_name: "",
          tax_name: "Value Added Tax (VAT)",
          standard_rate_percentage: "7.5",
          wht_rate_percentage: "5.0",
          notes: "",
        });
        loadData();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.message || "Failed to save tax rate.");
      }
    } catch (err) {
      console.error("Error saving tax rate:", err);
      toast.error("Network error saving tax rate.");
    } finally {
      setSavingRate(false);
    }
  };

  const downloadReport = async (path: string, filename: string, exportKey: string) => {
    setExportingType(exportKey);
    try {
      const res = await authFetch(path, {
        headers: { Accept: "text/csv, application/octet-stream" },
      });
      if (!res.ok) {
        toast.error("Failed to generate export file.");
        return;
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
      toast.success(`Downloaded ${filename}`);
    } catch (err) {
      console.error("Export error:", err);
      toast.error("Error downloading report.");
    } finally {
      setExportingType(null);
    }
  };

  const getStreamBadgeColor = (type: string) => {
    switch (type) {
      case "ad_campaign":
        return "bg-purple-500/10 text-purple-400 border-purple-500/20";
      case "commerce":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
      case "subscription":
        return "bg-blue-500/10 text-blue-400 border-blue-500/20";
      case "gifting":
        return "bg-pink-500/10 text-pink-400 border-pink-500/20";
      case "verification":
        return "bg-amber-500/10 text-amber-500 border-amber-500/20";
      default:
        return "bg-muted text-muted-foreground border-border/40";
    }
  };

  // Aggregated totals across streams
  const totalGross = streams.reduce((acc, s) => acc + (s.gross_amount_cents || 0), 0);
  const totalPlatformFees = streams.reduce((acc, s) => acc + (s.platform_fee_cents || 0), 0);
  const totalCreatorShare = streams.reduce((acc, s) => acc + (s.creator_cents || 0), 0);
  const totalGatewayCosts = streams.reduce((acc, s) => acc + (s.gateway_fee_cents || 0), 0);
  const totalTaxAccrued = streams.reduce((acc, s) => acc + (s.tax_amount_cents || 0), 0);
  const totalNet = streams.reduce((acc, s) => acc + (s.net_revenue_cents || 0), 0);
  const totalTransactions = streams.reduce((acc, s) => acc + (s.count || 0), 0);

  return (
    <div className="w-full mx-auto max-w-[1400px] space-y-6 p-4 lg:p-10">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 sm:p-6 rounded-2xl bg-gradient-to-br from-[#102840] via-[#173852] to-[#102840] text-white shadow-xl border border-white/10">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#2164b6]/30 text-[#7ab0ff] text-xs font-bold uppercase tracking-wider border border-[#2164b6]/40">
            <Receipt weight="fill" className="h-3.5 w-3.5" /> Financial Accounting & Tax
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Financial Accounting & Tax Hub</h1>
          <p className="text-sm text-white/80 max-w-xl">
            Multi-stream revenue auditing, statutory VAT schedules, creator withholding tax (WHT), and audit exports.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Currency Pill Switcher */}
          <div className="flex items-center bg-white/10 rounded-xl p-1 border border-white/15">
            {["USD", "NGN", "GBP", "EUR"].map((curr) => (
              <button
                key={curr}
                onClick={() => setCurrency(curr)}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                  currency === curr
                    ? "bg-[#2164b6] text-white shadow-sm"
                    : "text-white/70 hover:text-white hover:bg-white/5"
                }`}
              >
                {curr}
              </button>
            ))}
          </div>

          <Button
            onClick={loadData}
            disabled={loading}
            className="bg-[#2164b6] hover:bg-[#2d94c2] text-white font-bold h-10 px-4 rounded-xl shadow-md transition-all gap-2"
          >
            <RefreshCw weight="bold" className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Top Level KPI Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="rounded-2xl border border-border/40 bg-card p-5 text-center shadow-sm flex flex-col justify-between hover:border-primary/40 transition-all">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-bold uppercase tracking-wider">
            <span>Month Gross Volume</span>
            <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500">
              <DollarSign weight="fill" className="h-4 w-4" />
            </span>
          </div>
          <div className="py-2">
            <p className="text-2xl sm:text-3xl font-black text-foreground">
              {metrics ? formatCurrency(metrics.month_gross_cents, currency) : "$0.00"}
            </p>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {metrics ? `${metrics.month_tx_count.toLocaleString()} transactions (${metrics.period})` : "No activity"}
          </p>
        </div>

        <div className="rounded-2xl border border-border/40 bg-card p-5 text-center shadow-sm flex flex-col justify-between hover:border-primary/40 transition-all">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-bold uppercase tracking-wider">
            <span>Net Platform Revenue</span>
            <span className="p-1.5 rounded-lg bg-blue-500/10 text-blue-500">
              <TrendingUp weight="fill" className="h-4 w-4" />
            </span>
          </div>
          <div className="py-2">
            <p className="text-2xl sm:text-3xl font-black text-primary">
              {metrics ? formatCurrency(metrics.month_net_cents, currency) : "$0.00"}
            </p>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Net retained revenue after creator split & fees
          </p>
        </div>

        <div className="rounded-2xl border border-border/40 bg-card p-5 text-center shadow-sm flex flex-col justify-between hover:border-primary/40 transition-all">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-bold uppercase tracking-wider">
            <span>VAT / Sales Tax</span>
            <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-500">
              <Receipt weight="fill" className="h-4 w-4" />
            </span>
          </div>
          <div className="py-2">
            <p className="text-2xl sm:text-3xl font-black text-amber-500">
              {taxTotals ? formatCurrency(taxTotals.total_tax_collected_cents, currency) : "$0.00"}
            </p>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Output statutory tax accrued on customer checkouts
          </p>
        </div>

        <div className="rounded-2xl border border-border/40 bg-card p-5 text-center shadow-sm flex flex-col justify-between hover:border-primary/40 transition-all">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-bold uppercase tracking-wider">
            <span>Creator WHT Withheld</span>
            <span className="p-1.5 rounded-lg bg-purple-500/10 text-purple-500">
              <ShieldCheck weight="fill" className="h-4 w-4" />
            </span>
          </div>
          <div className="py-2">
            <p className="text-2xl sm:text-3xl font-black text-purple-500">
              {taxTotals ? formatCurrency(taxTotals.total_wht_withheld_cents, currency) : "$0.00"}
            </p>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Withholding tax deducted at source on payouts
          </p>
        </div>
      </div>

      {/* Modern Segmented Navigation Tabs */}
      <div className="flex items-center gap-1.5 p-1.5 bg-muted/20 border border-border/40 rounded-2xl overflow-x-auto">
        <button
          onClick={() => setActiveTab("streams")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === "streams"
              ? "bg-[#2164b6] text-white shadow-md"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
          }`}
        >
          <Layers weight="fill" className="h-4 w-4" />
          Revenue Streams Monitor
        </button>

        <button
          onClick={() => setActiveTab("tax")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === "tax"
              ? "bg-[#2164b6] text-white shadow-md"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
          }`}
        >
          <Receipt weight="fill" className="h-4 w-4" />
          Tax Liabilities & VAT
        </button>

        <button
          onClick={() => setActiveTab("rates")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === "rates"
              ? "bg-[#2164b6] text-white shadow-md"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
          }`}
        >
          <Percent weight="fill" className="h-4 w-4" />
          Tax Rates & Rules
        </button>

        <button
          onClick={() => setActiveTab("exports")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === "exports"
              ? "bg-[#2164b6] text-white shadow-md"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
          }`}
        >
          <Download weight="fill" className="h-4 w-4" />
          Audit & Tax Export Center
        </button>
      </div>

      {/* TAB 1: REVENUE STREAMS MONITOR */}
      {activeTab === "streams" && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-border/50 bg-card overflow-hidden shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-5 border-b border-border/40 bg-muted/20">
              <div>
                <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                  <Layers weight="fill" className="h-4 w-4 text-primary" />
                  Revenue Stream Segregation
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Audited financial inflows breakdown across Advertising, Commerce, Subscriptions, Gifting, and Verification.
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
                <span className="px-2.5 py-1 rounded-lg bg-muted/40 border border-border/40">
                  {streams.length} Active Streams
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground bg-muted/30 border-b border-border/40">
                  <tr>
                    <th className="px-5 py-3.5">Stream Category</th>
                    <th className="px-4 py-3.5 text-right">Transactions</th>
                    <th className="px-4 py-3.5 text-right">Gross Inflow</th>
                    <th className="px-4 py-3.5 text-right">Platform Fee</th>
                    <th className="px-4 py-3.5 text-right">Creator Share</th>
                    <th className="px-4 py-3.5 text-right">Gateway Cost</th>
                    <th className="px-4 py-3.5 text-right">Tax Accrued</th>
                    <th className="px-5 py-3.5 text-right">Net Platform Rev</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="px-5 py-16 text-center text-muted-foreground">
                        <div className="flex flex-col items-center gap-2">
                          <Spinner weight="bold" className="h-6 w-6 animate-spin text-primary" />
                          <span className="text-xs font-medium">Loading revenue stream breakdown...</span>
                        </div>
                      </td>
                    </tr>
                  ) : streams.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-5 py-16 text-center text-muted-foreground">
                        <div className="flex flex-col items-center gap-2">
                          <Coins weight="fill" className="h-10 w-10 text-muted-foreground/30" />
                          <p className="text-sm font-bold text-foreground">No revenue recorded yet</p>
                          <p className="text-xs text-muted-foreground">No transactions recorded for currency {currency}.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <>
                      {streams.map((s) => (
                        <tr key={s.stream_type} className="hover:bg-muted/15 transition-colors">
                          <td className="px-5 py-3.5 font-medium">
                            <div className="flex items-center gap-2.5">
                              <span
                                className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${getStreamBadgeColor(
                                  s.stream_type
                                )}`}
                              >
                                {s.label}
                              </span>
                              <span className="text-xs font-mono text-muted-foreground/80 hidden md:inline">
                                ({s.stream_type})
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3.5 text-right font-mono text-xs">
                            {s.count.toLocaleString()}
                          </td>
                          <td className="px-4 py-3.5 text-right font-mono font-bold text-foreground">
                            {formatCurrency(s.gross_amount_cents, currency)}
                          </td>
                          <td className="px-4 py-3.5 text-right font-mono text-muted-foreground">
                            {formatCurrency(s.platform_fee_cents, currency)}
                          </td>
                          <td className="px-4 py-3.5 text-right font-mono text-muted-foreground">
                            {formatCurrency(s.creator_cents, currency)}
                          </td>
                          <td className="px-4 py-3.5 text-right font-mono text-rose-500">
                            {formatCurrency(s.gateway_fee_cents, currency)}
                          </td>
                          <td className="px-4 py-3.5 text-right font-mono text-amber-500">
                            {formatCurrency(s.tax_amount_cents, currency)}
                          </td>
                          <td className="px-5 py-3.5 text-right font-mono font-black text-emerald-500">
                            {formatCurrency(s.net_revenue_cents, currency)}
                          </td>
                        </tr>
                      ))}

                      {/* Summary Totals Row */}
                      <tr className="bg-muted/40 font-bold border-t-2 border-border/60">
                        <td className="px-5 py-4 font-black text-foreground">
                          TOTAL ({currency})
                        </td>
                        <td className="px-4 py-4 text-right font-mono text-xs font-black">
                          {totalTransactions.toLocaleString()}
                        </td>
                        <td className="px-4 py-4 text-right font-mono font-black text-foreground">
                          {formatCurrency(totalGross, currency)}
                        </td>
                        <td className="px-4 py-4 text-right font-mono text-muted-foreground">
                          {formatCurrency(totalPlatformFees, currency)}
                        </td>
                        <td className="px-4 py-4 text-right font-mono text-muted-foreground">
                          {formatCurrency(totalCreatorShare, currency)}
                        </td>
                        <td className="px-4 py-4 text-right font-mono text-rose-500">
                          {formatCurrency(totalGatewayCosts, currency)}
                        </td>
                        <td className="px-4 py-4 text-right font-mono text-amber-500">
                          {formatCurrency(totalTaxAccrued, currency)}
                        </td>
                        <td className="px-5 py-4 text-right font-mono text-base font-black text-emerald-500">
                          {formatCurrency(totalNet, currency)}
                        </td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: TAX LIABILITIES */}
      {activeTab === "tax" && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-border/50 bg-card overflow-hidden shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-5 border-b border-border/40 bg-muted/20">
              <div>
                <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                  <Receipt weight="fill" className="h-4 w-4 text-amber-500" />
                  Statutory Tax Liabilities by Jurisdiction
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Output VAT/Sales tax collected from checkouts and WHT withheld on creator payouts.
                </p>
              </div>

              {taxTotals && (
                <div className="flex items-center gap-3 text-xs font-bold">
                  <span className="px-3 py-1 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
                    Net Liability: {formatCurrency(taxTotals.net_liability_cents, currency)}
                  </span>
                </div>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground bg-muted/30 border-b border-border/40">
                  <tr>
                    <th className="px-5 py-3.5">Filing Period</th>
                    <th className="px-4 py-3.5">Country</th>
                    <th className="px-4 py-3.5">Tax Type</th>
                    <th className="px-4 py-3.5 text-right">Taxable Base</th>
                    <th className="px-4 py-3.5 text-right">VAT Collected</th>
                    <th className="px-4 py-3.5 text-right">WHT Withheld</th>
                    <th className="px-4 py-3.5 text-right">Total Payable</th>
                    <th className="px-5 py-3.5 text-center">Filing Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="px-5 py-16 text-center text-muted-foreground">
                        <div className="flex flex-col items-center gap-2">
                          <Spinner weight="bold" className="h-6 w-6 animate-spin text-primary" />
                          <span className="text-xs font-medium">Loading tax liabilities...</span>
                        </div>
                      </td>
                    </tr>
                  ) : taxLiabilities.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-5 py-16 text-center text-muted-foreground">
                        <div className="flex flex-col items-center gap-2">
                          <Receipt weight="fill" className="h-10 w-10 text-muted-foreground/30" />
                          <p className="text-sm font-bold text-foreground">No tax liabilities recorded</p>
                          <p className="text-xs text-muted-foreground">Statutory liabilities will accrue as orders are placed.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    taxLiabilities.map((item) => (
                      <tr key={item.id} className="hover:bg-muted/15 transition-colors">
                        <td className="px-5 py-3.5 font-bold font-mono text-xs">
                          {item.period_identifier}
                        </td>
                        <td className="px-4 py-3.5 font-bold flex items-center gap-2">
                          <Building2 weight="fill" className="h-4 w-4 text-[#2164b6]" />
                          <span>{item.country_code}</span>
                        </td>
                        <td className="px-4 py-3.5 text-muted-foreground text-xs font-medium">
                          {item.tax_type}
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono text-xs text-muted-foreground">
                          {formatCurrency(item.taxable_base_cents, item.currency)}
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono text-xs text-amber-500 font-bold">
                          {formatCurrency(item.tax_collected_cents, item.currency)}
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono text-xs text-purple-500 font-bold">
                          {formatCurrency(item.wht_withheld_cents, item.currency)}
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono font-black text-foreground">
                          {formatCurrency(item.tax_collected_cents + item.wht_withheld_cents, item.currency)}
                        </td>
                        <td className="px-5 py-3.5 text-center">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                              item.status === "remitted"
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                                : item.status === "reported"
                                ? "bg-blue-500/10 text-blue-400 border-blue-500/30"
                                : "bg-amber-500/10 text-amber-400 border-amber-500/30"
                            }`}
                          >
                            {item.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: TAX RATES & RULES */}
      {activeTab === "rates" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-black text-foreground flex items-center gap-2">
                <Percent weight="fill" className="h-5 w-5 text-primary" />
                Configured Country Tax Rates & Rules
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Statutory VAT and Withholding Tax rules applied automatically across checkouts and creator payouts.
              </p>
            </div>
            <Button
              onClick={() => setShowAddRate(true)}
              className="bg-[#2164b6] hover:bg-[#2d94c2] text-white font-bold h-10 px-4 rounded-xl shadow-md gap-2"
            >
              <Plus weight="bold" className="h-4 w-4" />
              Add Country Tax Rule
            </Button>
          </div>

          <div className="rounded-2xl border border-border/50 bg-card overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground bg-muted/30 border-b border-border/40">
                  <tr>
                    <th className="px-5 py-3.5">Jurisdiction</th>
                    <th className="px-4 py-3.5">Tax Name</th>
                    <th className="px-4 py-3.5 text-right">Standard VAT %</th>
                    <th className="px-4 py-3.5 text-right">Creator WHT %</th>
                    <th className="px-4 py-3.5">Status</th>
                    <th className="px-5 py-3.5">Compliance Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-16 text-center text-muted-foreground">
                        <div className="flex flex-col items-center gap-2">
                          <Spinner weight="bold" className="h-6 w-6 animate-spin text-primary" />
                          <span className="text-xs font-medium">Loading statutory tax rules...</span>
                        </div>
                      </td>
                    </tr>
                  ) : taxRates.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-16 text-center text-muted-foreground">
                        <div className="flex flex-col items-center gap-2">
                          <Globe weight="fill" className="h-10 w-10 text-muted-foreground/30" />
                          <p className="text-sm font-bold text-foreground">No tax rules configured</p>
                          <p className="text-xs text-muted-foreground">Click &quot;Add Country Tax Rule&quot; to set up country VAT & WHT rates.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    taxRates.map((r) => (
                      <tr key={r.id} className="hover:bg-muted/15 transition-colors">
                        <td className="px-5 py-3.5 font-medium">
                          <div className="flex items-center gap-2">
                            <Globe weight="fill" className="h-4 w-4 text-[#2164b6]" />
                            <span className="font-bold text-foreground">{r.country_name}</span>
                            <span className="text-xs font-mono text-muted-foreground px-1.5 py-0.5 rounded bg-muted/50 border border-border/40">
                              {r.country_code}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 font-medium text-xs text-foreground">
                          {r.tax_name}
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono font-bold text-amber-500">
                          {r.standard_rate_percentage}%
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono font-bold text-purple-500">
                          {r.wht_rate_percentage}%
                        </td>
                        <td className="px-4 py-3.5">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                              r.is_active
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                                : "bg-muted text-muted-foreground border-border/40"
                            }`}
                          >
                            {r.is_active ? "Active" : "Disabled"}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-xs text-muted-foreground max-w-xs truncate">
                          {r.notes || "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Add Tax Rate Dialog */}
          <Dialog open={showAddRate} onOpenChange={setShowAddRate}>
            <DialogContent className="sm:max-w-lg rounded-2xl border border-border/50 bg-card p-6 shadow-xl">
              <DialogHeader className="space-y-1.5">
                <DialogTitle className="text-lg font-black text-foreground flex items-center gap-2">
                  <Percent weight="fill" className="h-5 w-5 text-primary" />
                  Add Country Tax Rule
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Define statutory sales tax / VAT and creator withholding rates for a country.
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleCreateTaxRate} className="space-y-4 pt-2">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold">Country Code (ISO 3) *</Label>
                    <Input
                      placeholder="e.g. NGA, GBR, USA"
                      maxLength={3}
                      value={newRate.country_code}
                      onChange={(e) =>
                        setNewRate({ ...newRate, country_code: e.target.value.toUpperCase() })
                      }
                      className="rounded-xl font-mono uppercase"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold">Country Name *</Label>
                    <Input
                      placeholder="e.g. Nigeria"
                      value={newRate.country_name}
                      onChange={(e) => setNewRate({ ...newRate, country_name: e.target.value })}
                      className="rounded-xl"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Tax Name *</Label>
                  <Input
                    placeholder="e.g. Value Added Tax (VAT)"
                    value={newRate.tax_name}
                    onChange={(e) => setNewRate({ ...newRate, tax_name: e.target.value })}
                    className="rounded-xl"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold">Standard VAT Rate (%) *</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={newRate.standard_rate_percentage}
                      onChange={(e) =>
                        setNewRate({ ...newRate, standard_rate_percentage: e.target.value })
                      }
                      className="rounded-xl font-mono"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold">Creator WHT Rate (%) *</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={newRate.wht_rate_percentage}
                      onChange={(e) =>
                        setNewRate({ ...newRate, wht_rate_percentage: e.target.value })
                      }
                      className="rounded-xl font-mono"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Statutory & Compliance Notes</Label>
                  <Input
                    placeholder="e.g. FIRS statutory VAT regulation"
                    value={newRate.notes}
                    onChange={(e) => setNewRate({ ...newRate, notes: e.target.value })}
                    className="rounded-xl"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-border/40">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowAddRate(false)}
                    className="rounded-xl font-bold"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={savingRate}
                    className="bg-[#2164b6] hover:bg-[#2d94c2] text-white font-bold rounded-xl h-10 px-5"
                  >
                    {savingRate ? <Spinner weight="bold" className="h-4 w-4 mr-2 animate-spin" /> : null}
                    Save Rule
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {/* TAB 4: AUDIT & STATUTORY EXPORTS */}
      {activeTab === "exports" && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-border/50 bg-card p-6 shadow-sm space-y-6">
            <div>
              <h2 className="text-xl font-black text-foreground flex items-center gap-2">
                <Download weight="fill" className="h-5 w-5 text-primary" />
                Government Tax & Financial Audit Export Center
              </h2>
              <p className="text-xs text-muted-foreground mt-1 max-w-2xl">
                One-click formatted accounting ledgers and tax schedules ready for submission to regulatory authorities (FIRS, IRS, HMRC) and periodic statutory audits.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-5 rounded-2xl border border-border/50 bg-muted/15 space-y-4 hover:border-primary/40 transition-all flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500">
                    <FileText weight="fill" className="h-5 w-5" />
                  </div>
                  <h3 className="font-black text-sm text-foreground">Master Revenue Journal</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Complete line-by-line accounting entries categorized by stream (Ads, Commerce, VIP Subscriptions, Gifting, Verification).
                  </p>
                </div>
                <Button
                  onClick={() =>
                    downloadReport("/securegate/accounting/export", "murihspace_revenue_journal.csv", "journal")
                  }
                  disabled={exportingType === "journal"}
                  className="w-full bg-[#2164b6] hover:bg-[#2d94c2] text-white font-bold rounded-xl h-10 gap-2 shadow-sm"
                >
                  {exportingType === "journal" ? (
                    <Spinner weight="bold" className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download weight="bold" className="h-4 w-4" />
                  )}
                  Download Journal CSV
                </Button>
              </div>

              <div className="p-5 rounded-2xl border border-border/50 bg-muted/15 space-y-4 hover:border-primary/40 transition-all flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
                    <Receipt weight="fill" className="h-5 w-5" />
                  </div>
                  <h3 className="font-black text-sm text-foreground">VAT & Sales Tax Schedule</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Periodic statutory tax summary by jurisdiction, taxable bases, accrued output VAT, and filing status for revenue agencies.
                  </p>
                </div>
                <Button
                  onClick={() =>
                    downloadReport("/securegate/tax/export", "murihspace_vat_schedule.csv", "vat")
                  }
                  disabled={exportingType === "vat"}
                  className="w-full bg-[#2164b6] hover:bg-[#2d94c2] text-white font-bold rounded-xl h-10 gap-2 shadow-sm"
                >
                  {exportingType === "vat" ? (
                    <Spinner weight="bold" className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download weight="bold" className="h-4 w-4" />
                  )}
                  Download VAT Schedule CSV
                </Button>
              </div>

              <div className="p-5 rounded-2xl border border-border/50 bg-muted/15 space-y-4 hover:border-primary/40 transition-all flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-500">
                    <ShieldCheck weight="fill" className="h-5 w-5" />
                  </div>
                  <h3 className="font-black text-sm text-foreground">Creator WHT Schedule</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Withholding Tax deduction schedule on creator payouts for filing annual withholding credit notes and compliance certificates.
                  </p>
                </div>
                <Button
                  onClick={() =>
                    downloadReport("/securegate/tax/export?type=wht", "murihspace_wht_schedule.csv", "wht")
                  }
                  disabled={exportingType === "wht"}
                  className="w-full bg-[#2164b6] hover:bg-[#2d94c2] text-white font-bold rounded-xl h-10 gap-2 shadow-sm"
                >
                  {exportingType === "wht" ? (
                    <Spinner weight="bold" className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download weight="bold" className="h-4 w-4" />
                  )}
                  Download WHT Schedule CSV
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
