import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router';
import {
  ShieldCheck, FileText, Loader2, CheckCircle2, XCircle, AlertCircle,
  Clock, UserCheck, XSquare,
} from 'lucide-react';
import { apiClient } from '@/lib/api/client';

const TABS = [
  { key: 'pending', label: 'Pending Queue', icon: Clock },
  { key: 'verified', label: 'Approved Creators', icon: UserCheck },
  { key: 'rejected', label: 'Rejected Submissions', icon: XSquare },
];

interface KycUser {
  id: number; name: string; email: string; username: string;
  role: string; kyc_status: string; kyc_document?: string;
  kyc_rejection_reason?: string; created_at: string;
}

export function AdminKycPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const status = searchParams.get('status') || 'pending';
  const [users, setUsers] = useState<KycUser[]>([]);
  const [counts, setCounts] = useState({ pending: 0, verified: 0, rejected: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);

  const fetchKyc = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await apiClient.get(`/securegate/kyc?status=${status}&page=${page}&per_page=20`);
      const d = res.data?.success ? res.data : res.data;
      setUsers(d?.data?.data ?? []);
      setCounts(d?.data?.counts ?? { pending: 0, verified: 0, rejected: 0 });
      setLastPage(d?.data?.last_page ?? d?.last_page ?? 1);
    } catch {
      setError('Failed to load KYC submissions');
    } finally { setLoading(false); }
  }, [status, page]);

  useEffect(() => { fetchKyc(); }, [fetchKyc]);

  useEffect(() => { setPage(1); }, [status]);

  const handleApprove = async (id: number) => {
    setProcessingId(id);
    setActionError(null);
    try {
      await apiClient.post(`/securegate/kyc/${id}/approve`);
      setUsers((prev) => prev.filter((u) => u.id !== id));
      setCounts((prev) => ({ ...prev, pending: Math.max(0, prev.pending - 1), verified: prev.verified + 1 }));
    } catch { setActionError('Failed to approve'); }
    finally { setProcessingId(null); }
  };

  const handleReject = async (id: number) => {
    if (!rejectReason) return;
    setProcessingId(id);
    setActionError(null);
    try {
      await apiClient.post(`/securegate/kyc/${id}/reject`, { reason: rejectReason });
      setUsers((prev) => prev.filter((u) => u.id !== id));
      setCounts((prev) => ({ ...prev, pending: Math.max(0, prev.pending - 1), rejected: prev.rejected + 1 }));
      setRejectId(null); setRejectReason('');
    } catch { setActionError('Failed to reject'); }
    finally { setProcessingId(null); }
  };

  return (
    <div className="w-full min-h-screen bg-background text-foreground">
      <div className="w-full mx-auto max-w-[1400px] space-y-6 p-6 lg:p-10">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 sm:p-8 rounded-2xl bg-gradient-to-br from-[#102840] via-[#173852] to-[#102840] text-white shadow-lg">
          <div className="space-y-1.5">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#38A8D8]/20 text-[#38A8D8] text-xs font-semibold uppercase tracking-wider border border-[#38A8D8]/30">
              <ShieldCheck className="h-3.5 w-3.5" /> Admin
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">KYC Verification</h1>
            <p className="text-sm text-white/70">Review and manage identity verification requests</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card p-1 w-fit">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setSearchParams({ status: t.key })}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-all duration-200 ${
                status === t.key
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
              <span className={`ml-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                status === t.key ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted-foreground/10 text-muted-foreground'
              }`}>
                {counts[t.key as keyof typeof counts]}
              </span>
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-12 text-center">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <p className="text-sm text-muted-foreground">{error}</p>
            <button onClick={fetchKyc} className="rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90">Retry</button>
          </div>
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-16 text-center">
            <CheckCircle2 className="h-10 w-10 text-muted-foreground/40" />
            <h3 className="text-sm font-bold text-muted-foreground">No {status} submissions</h3>
            <p className="text-xs text-muted-foreground/60">All requests in this category have been processed.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {actionError && (
              <div className="flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-5 py-3">
                <AlertCircle className="h-5 w-5 shrink-0 text-destructive" />
                <p className="text-sm text-destructive">{actionError}</p>
                <button onClick={() => setActionError(null)} className="ml-auto text-xs text-muted-foreground hover:text-foreground">Dismiss</button>
              </div>
            )}
            <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="divide-y divide-border">
              {users.map((user) => (
                <div key={user.id} className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between hover:bg-muted/30 transition-colors">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
                        {user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-foreground">{user.name}</span>
                          <span className="text-xs text-muted-foreground">@{user.username}</span>
                          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{user.role}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">{user.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 w-fit">
                      <FileText className="h-3.5 w-3.5 text-primary" />
                      <span className="text-xs font-mono text-muted-foreground">{user.kyc_document || 'No document attached'}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end md:self-center">
                    {rejectId === user.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          placeholder="Rejection reason..."
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          className="h-8 w-44 rounded-lg border border-border bg-background px-3 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50"
                        />
                        <button
                          onClick={() => handleReject(user.id)}
                          disabled={processingId === user.id || !rejectReason}
                          className="rounded-lg bg-destructive/10 px-3 py-1.5 text-xs font-bold text-destructive hover:bg-destructive/20 disabled:opacity-50"
                        >
                          {processingId === user.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Confirm'}
                        </button>
                        <button onClick={() => { setRejectId(null); setRejectReason(''); }} className="rounded-lg bg-muted px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground">Cancel</button>
                      </div>
                    ) : (
                      <>
                        {status === 'pending' && (
                          <>
                            <button
                              onClick={() => setRejectId(user.id)}
                              disabled={processingId === user.id}
                              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-bold text-destructive hover:bg-destructive/5 disabled:opacity-50"
                            >
                              <XCircle className="h-3.5 w-3.5" /> Reject
                            </button>
                            <button
                              onClick={() => handleApprove(user.id)}
                              disabled={processingId === user.id}
                              className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                            >
                              {processingId === user.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                              Approve
                            </button>
                          </>
                        )}
                        {status === 'rejected' && user.kyc_rejection_reason && (
                          <span className="rounded-lg bg-destructive/5 px-3 py-1.5 text-[10px] text-destructive/80 max-w-[200px] truncate" title={user.kyc_rejection_reason}>
                            Reason: {user.kyc_rejection_reason}
                          </span>
                        )}
                        {status === 'verified' && (
                          <span className="flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-600">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Verified
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
          </div>
        )}

        {lastPage > 1 && (
          <div className="flex items-center justify-center gap-2 pt-4">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="px-3 py-1.5 rounded-lg text-xs font-bold border border-border bg-card hover:bg-muted disabled:opacity-40">Previous</button>
            <span className="text-xs text-muted-foreground">Page {page} of {lastPage}</span>
            <button onClick={() => setPage(p => Math.min(lastPage, p + 1))} disabled={page >= lastPage} className="px-3 py-1.5 rounded-lg text-xs font-bold border border-border bg-card hover:bg-muted disabled:opacity-40">Next</button>
          </div>
        )}
      </div>
    </div>
  );
}
