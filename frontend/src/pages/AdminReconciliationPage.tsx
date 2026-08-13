import { useState, useEffect, useCallback } from 'react';
import { BarChart3, Loader2, Check, AlertCircle, X, RefreshCw, Wallet, FileText, ShieldCheck } from 'lucide-react';
import { authFetch } from "@/lib/api/authFetch";





function formatPrice(cents: number, currency = 'NGN'): string {
  const symbols: Record<string, string> = { NGN: '₦', USD: '$', GBP: '£', EUR: '€' };
  return (symbols[currency] ?? currency + ' ') + (cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2 });
}

export function AdminReconciliationPage() {
  const [summary, setSummary] = useState<any>(null);
  const [audit, setAudit] = useState<any>(null);
  const [isLoadingSummary, setIsLoadingSummary] = useState(true);
  const [isLoadingAudit, setIsLoadingAudit] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchSummary = useCallback(async () => {
    setIsLoadingSummary(true);
    try {
      const res = await authFetch(`/securegate/reconciliation/ledger-summary`, {  });
      if (res.ok) {
        const json = await res.json();
        setSummary(json.data?.data ?? json.data);
      }
    } catch { /* silent */ }
    setIsLoadingSummary(false);
  }, []);

  const fetchAudit = useCallback(async () => {
    setIsLoadingAudit(true);
    try {
      const res = await authFetch(`/securegate/reconciliation/audit`, {  });
      if (res.ok) {
        const json = await res.json();
        setAudit(json.data?.data ?? json.data);
      }
    } catch { /* silent */ }
    setIsLoadingAudit(false);
  }, []);

  useEffect(() => { fetchSummary(); fetchAudit(); }, [fetchSummary, fetchAudit]);

  const StatCard = ({ label, value, color }: { label: string; value: string; color?: string }) => (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-[11px] text-muted-foreground font-medium">{label}</p>
      <p className={`text-lg font-extrabold mt-1 ${color ?? 'text-foreground'}`}>{value}</p>
    </div>
  );

  return (
    <div className="w-full mx-auto max-w-[1400px] space-y-6 p-6 lg:p-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight flex items-center gap-2.5">
            <BarChart3 className="h-6 w-6 text-[#2164b6] dark:text-[#7ab0ff]" />
            Reconciliation & Audit
          </h1>
          <p className="text-xs text-muted-foreground mt-1">Ledger audit, wallet discrepancy detection, and escrow summary for platform ops.</p>
        </div>
        <button onClick={() => { fetchSummary(); fetchAudit(); }} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#2164b6] text-foreground font-bold text-xs hover:bg-[#2164b6]/80 transition-all shrink-0">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      {message && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-xs font-medium ${message.type === 'success' ? 'bg-green-500/10 text-green-600' : 'bg-destructive/10 text-destructive'}`}>
          {message.type === 'success' ? <Check className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          <span className="flex-1">{message.text}</span>
          <button onClick={() => setMessage(null)} className="p-0.5 hover:opacity-70"><X className="h-3.5 w-3.5" /></button>
        </div>
      )}

      {/* Ledger Summary */}
      <div>
        <h2 className="text-sm font-bold text-foreground flex items-center gap-2 mb-3">
          <FileText className="h-4 w-4 text-[#2164b6] dark:text-[#7ab0ff]" />
          Ledger Summary
        </h2>
        {isLoadingSummary ? (
          <div className="py-8 text-center"><Loader2 className="h-5 w-5 animate-spin text-[#2164b6] dark:text-[#7ab0ff] mx-auto" /></div>
        ) : summary ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard label="Total Credits" value={formatPrice(summary.total_credits ?? 0)} color="text-emerald-500" />
              <StatCard label="Total Debits" value={formatPrice(summary.total_debits ?? 0)} color="text-red-500" />
              <StatCard label="Net Flow" value={formatPrice((summary.total_credits ?? 0) - (summary.total_debits ?? 0))} />
              <StatCard label="Audited At" value={audit?.audited_at ? new Date(audit.audited_at).toLocaleTimeString() : '—'} />
            </div>

            {/* By Type */}
            {summary.by_type && summary.by_type.length > 0 && (
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/30 border-b border-border">
                      <th className="text-left px-4 py-2 font-bold text-muted-foreground">Type</th>
                      <th className="text-right px-4 py-2 font-bold text-muted-foreground">Count</th>
                      <th className="text-right px-4 py-2 font-bold text-muted-foreground">Net</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.by_type.map((item: any, i: number) => (
                      <tr key={i} className="border-b border-border/50 last:border-0">
                        <td className="px-4 py-2 font-medium capitalize">{item.type?.replace(/_/g, ' ')}</td>
                        <td className="px-4 py-2 text-right text-muted-foreground">{item.count}</td>
                        <td className="px-4 py-2 text-right font-semibold">{formatPrice(item.net ?? 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Escrow Summary */}
            {summary.escrow_summary && (
              <div>
                <h3 className="text-xs font-bold text-foreground uppercase tracking-wider mb-2">Escrow Summary</h3>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  <StatCard label="Held" value={formatPrice(summary.escrow_summary.held ?? 0)} color="text-amber-500" />
                  <StatCard label="Released" value={formatPrice(summary.escrow_summary.released ?? 0)} color="text-emerald-500" />
                  <StatCard label="Refunded" value={formatPrice(summary.escrow_summary.refunded ?? 0)} color="text-blue-500" />
                  <StatCard label="Disputed" value={formatPrice(summary.escrow_summary.disputed ?? 0)} color="text-red-500" />
                  <StatCard label="Open Disputes" value={String(summary.escrow_summary.open_disputes ?? 0)} color={summary.escrow_summary.open_disputes > 0 ? 'text-red-500' : 'text-muted-foreground'} />
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="p-8 text-center border border-dashed border-border rounded-xl bg-card">
            <p className="text-xs text-muted-foreground">Failed to load ledger summary.</p>
          </div>
        )}
      </div>

      {/* Wallet Audit */}
      <div>
        <h2 className="text-sm font-bold text-foreground flex items-center gap-2 mb-3">
          <Wallet className="h-4 w-4 text-[#2164b6] dark:text-[#7ab0ff]" />
          Wallet Balance Audit
        </h2>
        {isLoadingAudit ? (
          <div className="py-8 text-center"><Loader2 className="h-5 w-5 animate-spin text-[#2164b6] dark:text-[#7ab0ff] mx-auto" /></div>
        ) : audit ? (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <StatCard label="Wallets Checked" value={String(audit.wallet_count ?? 0)} />
              <StatCard label="Discrepancies" value={String(audit.discrepancies ?? 0)} color={(audit.discrepancies ?? 0) > 0 ? 'text-red-500' : 'text-emerald-500'} />
              <StatCard label="Unbalanced TXs" value={String(audit.unbalanced_transactions ?? 0)} color={(audit.unbalanced_transactions ?? 0) > 0 ? 'text-red-500' : 'text-emerald-500'} />
            </div>

            {audit.issues && audit.issues.length > 0 && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 overflow-hidden">
                <div className="px-4 py-2 border-b border-destructive/20 flex items-center gap-2">
                  <AlertCircle className="h-3.5 w-3.5 text-destructive" />
                  <span className="text-xs font-bold text-destructive">Balance Discrepancies Detected</span>
                </div>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-destructive/10">
                      <th className="text-left px-4 py-2 font-bold text-muted-foreground">User</th>
                      <th className="text-right px-4 py-2 font-bold text-muted-foreground">Wallet</th>
                      <th className="text-right px-4 py-2 font-bold text-muted-foreground">Ledger</th>
                      <th className="text-right px-4 py-2 font-bold text-muted-foreground text-destructive">Diff</th>
                    </tr>
                  </thead>
                  <tbody>
                    {audit.issues.map((issue: any, i: number) => (
                      <tr key={i} className="border-b border-destructive/10 last:border-0">
                        <td className="px-4 py-2 font-medium">{issue.user?.name ?? 'Unknown'}</td>
                        <td className="px-4 py-2 text-right font-semibold">{formatPrice(issue.wallet_balance ?? 0, issue.currency)}</td>
                        <td className="px-4 py-2 text-right">{formatPrice(issue.ledger_balance ?? 0, issue.currency)}</td>
                        <td className="px-4 py-2 text-right font-bold text-destructive">{formatPrice(issue.difference ?? 0, issue.currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {audit.unbalanced_txns && audit.unbalanced_txns.length > 0 && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 overflow-hidden">
                <div className="px-4 py-2 border-b border-destructive/20 flex items-center gap-2">
                  <AlertCircle className="h-3.5 w-3.5 text-destructive" />
                  <span className="text-xs font-bold text-destructive">Unbalanced Transactions</span>
                </div>
                <div className="divide-y divide-destructive/10">
                  {audit.unbalanced_txns.map((txn: any, i: number) => (
                    <div key={i} className="px-4 py-2.5 flex items-center justify-between">
                      <div>
                        <span className="text-xs font-semibold text-foreground">{txn.type}</span>
                        <span className="text-[10px] text-muted-foreground ml-2">{txn.description ?? ''}</span>
                      </div>
                      <span className="text-[10px] font-mono text-muted-foreground">#{txn.ulid}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {audit.discrepancies === 0 && audit.unbalanced_transactions === 0 && (
              <div className="p-6 text-center border border-emerald-500/30 bg-emerald-500/5 rounded-xl">
                <ShieldCheck className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
                <p className="text-sm font-bold text-emerald-600">All wallets balanced</p>
                <p className="text-xs text-muted-foreground mt-1">No discrepancies found between wallet balances and ledger entries.</p>
              </div>
            )}
          </div>
        ) : (
          <div className="p-8 text-center border border-dashed border-border rounded-xl bg-card">
            <p className="text-xs text-muted-foreground">Failed to load audit data.</p>
          </div>
        )}
      </div>
    </div>
  );
}
