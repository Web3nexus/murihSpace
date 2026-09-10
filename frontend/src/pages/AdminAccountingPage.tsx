import { useState, useEffect, useCallback } from 'react';
import {
  CurrencyDollar as DollarSign,
  TrendUp as TrendingUp,
  Receipt as Receipt,
  FileText as FileText,
  DownloadSimple as Download,
  Buildings as Building2,
  ArrowsClockwise as RefreshCw,
  Plus as Plus,
  ShieldCheck as ShieldCheck,
  Stack as Layers,
  Percent as Percent
} from "@phosphor-icons/react";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { authFetch } from '@/lib/api/authFetch';

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
  status: 'accruing' | 'reported' | 'remitted';
  filing_reference: string | null;
}

export default function AdminAccountingPage() {
  const [activeTab, setActiveTab] = useState<'streams' | 'tax' | 'rates' | 'exports'>('streams');
  const [currency, setCurrency] = useState<string>('USD');
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
  const [newRate, setNewRate] = useState({
    country_code: '',
    country_name: '',
    tax_name: 'Value Added Tax (VAT)',
    standard_rate_percentage: '7.5',
    wht_rate_percentage: '5.0',
    notes: '',
  });

  const formatCurrency = (cents: number, curr: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: curr,
      minimumFractionDigits: 2,
    }).format(cents / 100);
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Overview & Streams
      const overviewRes = await authFetch(`/api/v1/securegate/accounting/overview?currency=${currency}`);
      if (overviewRes.ok) {
        const data = await overviewRes.json();
        const payload = data.data || data;
        setMetrics(payload.metrics || null);
        setStreams(payload.summary?.streams || []);
      }

      // 2. Tax Summary
      const taxRes = await authFetch('/api/v1/securegate/tax/summary');
      if (taxRes.ok) {
        const tData = await taxRes.json();
        const tPayload = tData.data || tData;
        setTaxTotals(tPayload.totals || null);
        setTaxLiabilities(tPayload.liabilities || []);
      }

      // 3. Tax Rates
      const ratesRes = await authFetch('/api/v1/securegate/tax/rates');
      if (ratesRes.ok) {
        const rData = await ratesRes.json();
        const rPayload = rData.data || rData;
        setTaxRates(rPayload.rates || []);
      }
    } catch (e) {
      console.error('Failed to load accounting data:', e);
    } finally {
      setLoading(false);
    }
  }, [currency]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateTaxRate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await authFetch('/api/v1/securegate/tax/rates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newRate,
          standard_rate_percentage: parseFloat(newRate.standard_rate_percentage),
          wht_rate_percentage: parseFloat(newRate.wht_rate_percentage),
          is_active: true,
        }),
      });

      if (res.ok) {
        setShowAddRate(false);
        setNewRate({
          country_code: '',
          country_name: '',
          tax_name: 'Value Added Tax (VAT)',
          standard_rate_percentage: '7.5',
          wht_rate_percentage: '5.0',
          notes: '',
        });
        loadData();
      }
    } catch (err) {
      console.error('Error saving tax rate:', err);
    }
  };

  const downloadReport = (endpoint: string, filename: string) => {
    const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
    fetch(endpoint, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => res.blob())
      .then((blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
      })
      .catch((err) => console.error('Export error:', err));
  };

  return (
    <div className="p-4 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Receipt weight="fill" className="size-6 text-primary" />
            Financial Accounting & Tax Hub
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Multi-stream revenue auditing, VAT schedules, creator withholding tax, and statutory filings.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="h-9 px-3 rounded-md border border-input bg-background text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="USD">USD ($)</option>
            <option value="NGN">NGN (₦)</option>
            <option value="GBP">GBP (£)</option>
            <option value="EUR">EUR (€)</option>
          </select>

          <Button variant="outline" size="sm" onClick={loadData} disabled={loading} className="gap-2">
            <RefreshCw weight="fill" className={`size-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Top Level Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-lg border bg-card text-card-foreground ">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>MONTH GROSS VOLUME</span>
            <DollarSign weight="fill" className="size-4 text-emerald-500" />
          </div>
          <div className="text-xl font-bold mt-2">
            {metrics ? formatCurrency(metrics.month_gross_cents, currency) : '$0.00'}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {metrics ? `${metrics.month_tx_count} transactions in ${metrics.period}` : 'No data'}
          </div>
        </div>

        <div className="p-4 rounded-lg border bg-card text-card-foreground ">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>NET PLATFORM REVENUE</span>
            <TrendingUp weight="fill" className="size-4 text-blue-500" />
          </div>
          <div className="text-xl font-bold mt-2 text-primary">
            {metrics ? formatCurrency(metrics.month_net_cents, currency) : '$0.00'}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            Net recognized revenue after creator share & fees
          </div>
        </div>

        <div className="p-4 rounded-lg border bg-card text-card-foreground ">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>VAT / SALES TAX COLLECTED</span>
            <Receipt weight="fill" className="size-4 text-amber-500" />
          </div>
          <div className="text-xl font-bold mt-2 text-amber-600">
            {taxTotals ? formatCurrency(taxTotals.total_tax_collected_cents, currency) : '$0.00'}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            Statutory tax liability on customer inflows
          </div>
        </div>

        <div className="p-4 rounded-lg border bg-card text-card-foreground ">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>WHT WITHHELD ON PAYOUTS</span>
            <ShieldCheck weight="fill" className="size-4 text-purple-500" />
          </div>
          <div className="text-xl font-bold mt-2 text-purple-600">
            {taxTotals ? formatCurrency(taxTotals.total_wht_withheld_cents, currency) : '$0.00'}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            Withholding tax deducted at source
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-border space-x-6">
        <button
          onClick={() => setActiveTab('streams')}
          className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'streams'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Layers weight="fill" className="size-4" />
          Revenue Streams Monitor
        </button>

        <button
          onClick={() => setActiveTab('tax')}
          className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'tax'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Receipt weight="fill" className="size-4" />
          Tax Liabilities & VAT
        </button>

        <button
          onClick={() => setActiveTab('rates')}
          className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'rates'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Percent weight="fill" className="size-4" />
          Tax Rates & Rules
        </button>

        <button
          onClick={() => setActiveTab('exports')}
          className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'exports'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Download weight="fill" className="size-4" />
          Audit & Tax Export Center
        </button>
      </div>

      {/* TAB 1: REVENUE STREAMS MONITOR */}
      {activeTab === 'streams' && (
        <div className="space-y-6">
          <div className="rounded-lg border bg-card  overflow-hidden">
            <div className="p-4 border-b bg-muted/30">
              <h2 className="text-base font-semibold">Revenue Stream Segregation</h2>
              <p className="text-xs text-muted-foreground">
                Breakdown of financial inflows distinguishing Advertising, Commerce, Subscriptions, Gifting, and Verification.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs uppercase bg-muted/50 text-muted-foreground border-b">
                  <tr>
                    <th className="px-4 py-3">Stream</th>
                    <th className="px-4 py-3 text-right">Transactions</th>
                    <th className="px-4 py-3 text-right">Gross Inflow</th>
                    <th className="px-4 py-3 text-right">Platform Fee</th>
                    <th className="px-4 py-3 text-right">Creator/Seller Share</th>
                    <th className="px-4 py-3 text-right">Gateway Cost</th>
                    <th className="px-4 py-3 text-right">VAT/Tax Accrued</th>
                    <th className="px-4 py-3 text-right">Net Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {streams.map((s) => (
                    <tr key={s.stream_type} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-primary" />
                        <div>
                          <div>{s.label}</div>
                          <span className="text-[10px] text-muted-foreground font-mono">stream: {s.stream_type}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-mono">{s.count.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-mono font-medium">{formatCurrency(s.gross_amount_cents, currency)}</td>
                      <td className="px-4 py-3 text-right font-mono text-muted-foreground">{formatCurrency(s.platform_fee_cents, currency)}</td>
                      <td className="px-4 py-3 text-right font-mono text-muted-foreground">{formatCurrency(s.creator_cents, currency)}</td>
                      <td className="px-4 py-3 text-right font-mono text-red-500">{formatCurrency(s.gateway_fee_cents, currency)}</td>
                      <td className="px-4 py-3 text-right font-mono text-amber-600">{formatCurrency(s.tax_amount_cents, currency)}</td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-emerald-600">
                        {formatCurrency(s.net_revenue_cents, currency)}
                      </td>
                    </tr>
                  ))}
                  {streams.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                        No revenue recorded yet for {currency}.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: TAX LIABILITIES */}
      {activeTab === 'tax' && (
        <div className="space-y-6">
          <div className="rounded-lg border bg-card  overflow-hidden">
            <div className="p-4 border-b bg-muted/30 flex justify-between items-center">
              <div>
                <h2 className="text-base font-semibold">Tax Liabilities by Jurisdiction</h2>
                <p className="text-xs text-muted-foreground">
                  Summary of output tax collected on customer checkouts and WHT retained from payouts.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs uppercase bg-muted/50 text-muted-foreground border-b">
                  <tr>
                    <th className="px-4 py-3">Period</th>
                    <th className="px-4 py-3">Country</th>
                    <th className="px-4 py-3">Tax TextT</th>
                    <th className="px-4 py-3 text-right">Taxable Base</th>
                    <th className="px-4 py-3 text-right">VAT Collected</th>
                    <th className="px-4 py-3 text-right">WHT Withheld</th>
                    <th className="px-4 py-3 text-right">Total Payable</th>
                    <th className="px-4 py-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {taxLiabilities.map((item) => (
                    <tr key={item.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium font-mono">{item.period_identifier}</td>
                      <td className="px-4 py-3 font-medium flex items-center gap-1.5">
                        <Building2 weight="fill" className="size-3.5 text-muted-foreground" />
                        {item.country_code}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{item.tax_type}</td>
                      <td className="px-4 py-3 text-right font-mono">{formatCurrency(item.taxable_base_cents, item.currency)}</td>
                      <td className="px-4 py-3 text-right font-mono text-amber-600 font-medium">
                        {formatCurrency(item.tax_collected_cents, item.currency)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-purple-600 font-medium">
                        {formatCurrency(item.wht_withheld_cents, item.currency)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold">
                        {formatCurrency(item.tax_collected_cents + item.wht_withheld_cents, item.currency)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge
                          variant={
                            item.status === 'remitted'
                              ? 'default'
                              : item.status === 'reported'
                              ? 'secondary'
                              : 'outline'
                          }
                          className="capitalize text-[11px]"
                        >
                          {item.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                  {taxLiabilities.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                        No periodic tax liabilities recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: TAX RATES & RULES */}
      {activeTab === 'rates' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-base font-semibold">Configured Country Tax Rates</h2>
              <p className="text-xs text-muted-foreground">
                Statutory VAT and Withholding Tax rules applied automatically across checkouts and creator payouts.
              </p>
            </div>
            <Button size="sm" onClick={() => setShowAddRate(true)} className="gap-2">
              <Plus weight="fill" className="size-4" />
              Add Tax Rule
            </Button>
          </div>

          <div className="rounded-lg border bg-card  overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead className="text-xs uppercase bg-muted/50 text-muted-foreground border-b">
                <tr>
                  <th className="px-4 py-3">Country</th>
                  <th className="px-4 py-3">Tax Name</th>
                  <th className="px-4 py-3 text-right">Standard VAT %</th>
                  <th className="px-4 py-3 text-right">Creator WHT %</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Compliance Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {taxRates.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">
                      <div className="font-semibold">{r.country_name}</div>
                      <div className="text-xs text-muted-foreground font-mono">{r.country_code}</div>
                    </td>
                    <td className="px-4 py-3">{r.tax_name}</td>
                    <td className="px-4 py-3 text-right font-mono font-medium">{r.standard_rate_percentage}%</td>
                    <td className="px-4 py-3 text-right font-mono text-purple-600 font-medium">{r.wht_rate_percentage}%</td>
                    <td className="px-4 py-3">
                      <Badge variant={r.is_active ? 'default' : 'secondary'} className="text-[10px]">
                        {r.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground max-w-xs truncate">{r.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Add Tax Rate Modal */}
          {showAddRate && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-card border rounded-lg max-w-md w-full p-4 shadow-xl space-y-4">
                <div className="flex justify-between items-center border-b pb-3">
                  <h3 className="font-bold text-lg">Add Country Tax Rule</h3>
                  <button onClick={() => setShowAddRate(false)} className="text-muted-foreground hover:text-foreground">
                    ✕
                  </button>
                </div>

                <form onSubmit={handleCreateTaxRate} className="space-y-3">
                  <div>
                    <label className="text-xs font-medium">Country Code (ISO 3)</label>
                    <Input
                      placeholder="e.g. NGA, GBR, USA"
                      maxLength={3}
                      value={newRate.country_code}
                      onChange={(e) => setNewRate({ ...newRate, country_code: e.target.value.toUpperCase() })}
                      required
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium">Country Name</label>
                    <Input
                      placeholder="e.g. Nigeria"
                      value={newRate.country_name}
                      onChange={(e) => setNewRate({ ...newRate, country_name: e.target.value })}
                      required
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium">Tax Name</label>
                    <Input
                      placeholder="e.g. Value Added Tax (VAT)"
                      value={newRate.tax_name}
                      onChange={(e) => setNewRate({ ...newRate, tax_name: e.target.value })}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium">Standard VAT Rate (%)</label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={newRate.standard_rate_percentage}
                        onChange={(e) => setNewRate({ ...newRate, standard_rate_percentage: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium">Creator WHT Rate (%)</label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={newRate.wht_rate_percentage}
                        onChange={(e) => setNewRate({ ...newRate, wht_rate_percentage: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-medium">Statutory Notes</label>
                    <Input
                      placeholder="e.g. FIRS statutory VAT"
                      value={newRate.notes}
                      onChange={(e) => setNewRate({ ...newRate, notes: e.target.value })}
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t">
                    <Button type="button" variant="outline" onClick={() => setShowAddRate(false)}>
                      Cancel
                    </Button>
                    <Button type="submit">Save Rule</Button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: AUDIT & STATUTORY EXPORTS */}
      {activeTab === 'exports' && (
        <div className="space-y-6">
          <div className="rounded-lg border bg-card p-4  space-y-6">
            <div>
              <h2 className="text-lg font-bold">Government Tax & Financial Audit Export Center</h2>
              <p className="text-sm text-muted-foreground mt-1">
                One-click formatted reports ready for submission to tax authorities (FIRS, IRS, HMRC) and quarterly audit compliance.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-lg border bg-muted/20 space-y-3">
                <div className="flex items-center gap-2 font-semibold">
                  <FileText weight="fill" className="size-5 text-primary" />
                  Master Revenue Journal
                </div>
                <p className="text-xs text-muted-foreground">
                  Complete line-by-line accounting entries categorized by stream (Ads, MurihStore, VIP Subscriptions, Tips, Badges).
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => downloadReport('/api/v1/securegate/accounting/export', 'murihspace_revenue_journal.csv')}
                >
                  <Download weight="fill" className="size-4" />
                  Download CSV
                </Button>
              </div>

              <div className="p-4 rounded-lg border bg-muted/20 space-y-3">
                <div className="flex items-center gap-2 font-semibold">
                  <Receipt weight="fill" className="size-5 text-amber-500" />
                  VAT & Sales Tax Schedule
                </div>
                <p className="text-xs text-muted-foreground">
                  Periodic statutory tax summary by country, taxable base, VAT collected, and unfiled/remitted statuses.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => downloadReport('/api/v1/securegate/tax/export', 'murihspace_vat_schedule.csv')}
                >
                  <Download weight="fill" className="size-4" />
                  Download CSV
                </Button>
              </div>

              <div className="p-4 rounded-lg border bg-muted/20 space-y-3">
                <div className="flex items-center gap-2 font-semibold">
                  <ShieldCheck weight="fill" className="size-5 text-purple-500" />
                  Creator WHT Schedule
                </div>
                <p className="text-xs text-muted-foreground">
                  Withholding Tax deduction schedule on creator payouts for filing annual withholding certificates.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => downloadReport('/api/v1/securegate/tax/export?type=wht', 'murihspace_wht_schedule.csv')}
                >
                  <Download weight="fill" className="size-4" />
                  Download CSV
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
