import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router';
import { toast } from 'sonner';
import {
  ShieldCheck, Loader2, CheckCircle2, XCircle, AlertCircle,
  Clock, UserCheck, XSquare, Search, ChevronLeft, ChevronRight,
  FileText, Mail, Phone, Download, ExternalLink,
} from 'lucide-react';
import { apiClient } from '@/lib/api/client';

const TABS = [
  { key: 'pending', label: 'Pending Queue', icon: Clock },
  { key: 'verified', label: 'Approved Accounts', icon: UserCheck },
  { key: 'rejected', label: 'Rejected Submissions', icon: XSquare },
];

const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-purple-500/20 text-purple-400',
  creator: 'bg-blue-500/20 text-blue-400',
  vendor: 'bg-amber-500/20 text-amber-400',
  member: 'bg-muted text-muted-foreground',
};

interface KycUser {
  id: number; name: string; email: string; username: string;
  role: string; kyc_status: string; kyc_document?: string;
  kyc_rejection_reason?: string; kyc_provider?: string;
  sumsub_applicant_id?: string | null; created_at: string;
}

interface SumsubDetail {
  status?: { reviewStatus?: string; reviewResult?: { reviewAnswer?: string; moderationComment?: string } } | null;
  applicant?: { id?: string; fixedInfo?: Record<string, unknown> } | null;
}

interface KycDetail {
  id: number; name: string; email: string; username: string;
  role: string; kyc_status: string; kyc_provider: string;
  kyc_document?: string | null; kyc_rejection_reason?: string | null;
  sumsub_applicant_id?: string | null; created_at: string;
  sumsub?: SumsubDetail | null;
}

export function AdminKycPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const status = searchParams.get('status') || 'pending';
  const [users, setUsers] = useState<KycUser[]>([]);
  const [counts, setCounts] = useState({ pending: 0, verified: 0, rejected: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [detail, setDetail] = useState<KycDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const fetchKyc = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams({ status, page: String(page), per_page: '20' });
      if (search) params.set('search', search);
      const res = await apiClient.get(`/securegate/kyc?${params}`);
      const d = res.data?.data ?? res.data;
      const payload = d?.data ?? d;
      setUsers(payload?.data ?? []);
      setCounts(d?.counts ?? { pending: 0, verified: 0, rejected: 0 });
      setLastPage(payload?.last_page ?? d?.last_page ?? 1);
    } catch (e) {
      const err = e as { status?: number; message?: string };
      setError(err?.message && err.status ? `Failed to load KYC submissions (${err.status}: ${err.message})` : `Failed to load KYC submissions (${err?.status ?? 'network'})`);
    } finally { setLoading(false); }
  }, [status, page, search]);

  useEffect(() => { fetchKyc(); }, [fetchKyc]);

  const openDetail = async (id: number) => {
    setDetailLoading(true); setDetail(null);
    try {
      const res = await apiClient.get(`/securegate/kyc/${id}`);
      const d = res.data?.data ?? res.data;
      setDetail(d?.data ?? d ?? null);
    } catch (e) {
      setDetail(null);
      const err = e as { status?: number; message?: string };
      toast.error(`Failed to load KYC detail (${err?.status ?? 'network'}${err?.message ? ': ' + err.message : ''})`);
    } finally { setDetailLoading(false); }
  };

  const handleApprove = async (id: number) => {
    setProcessingId(id); setActionError(null);
    try {
      await apiClient.post(`/securegate/kyc/${id}/approve`);
      setUsers((prev) => prev.filter((u) => u.id !== id));
      setCounts((prev) => ({ ...prev, pending: Math.max(0, prev.pending - 1), verified: prev.verified + 1 }));
      if (detail?.id === id) setDetail((prev) => (prev ? { ...prev, kyc_status: 'verified', kyc_rejection_reason: null } : prev));
      toast.success('KYC approved — applicant notified by email.');
    } catch (e) {
      const err = e as { status?: number; message?: string };
      setActionError('Failed to approve');
      toast.error(`Failed to approve KYC (${err?.status ?? 'network'}${err?.message ? ': ' + err.message : ''})`);
    }
    finally { setProcessingId(null); }
  };

  const handleReject = async (id: number, reason: string) => {
    if (!reason.trim()) return;
    setProcessingId(id); setActionError(null);
    try {
      await apiClient.post(`/securegate/kyc/${id}/reject`, { reason });
      setUsers((prev) => prev.filter((u) => u.id !== id));
      setCounts((prev) => ({ ...prev, pending: Math.max(0, prev.pending - 1), rejected: prev.rejected + 1 }));
      if (detail?.id === id) setDetail((prev) => (prev ? { ...prev, kyc_status: 'rejected', kyc_rejection_reason: reason } : prev));
      setRejectTarget(null); setRejectReason('');
      toast.success('KYC rejected — applicant notified by email.');
    } catch (e) {
      const err = e as { status?: number; message?: string };
      setActionError('Failed to reject');
      toast.error(`Failed to reject KYC (${err?.status ?? 'network'}${err?.message ? ': ' + err.message : ''})`);
    }
    finally { setProcessingId(null); }
  };

  useEffect(() => {
    if (!detail && rejectTarget === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setDetail(null);
      setRejectTarget(null);
      setRejectReason('');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [detail, rejectTarget]);

  const reviewAnswer = detail?.sumsub?.status?.reviewResult?.reviewAnswer;

  const handleExportCsv = () => {
    const esc = (v: unknown) => {
      const s = String(v ?? '');
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const headers = ['id', 'name', 'email', 'username', 'role', 'kyc_status', 'kyc_provider', 'kyc_document', 'kyc_rejection_reason', 'created_at'];
    const rows = users.map((u) =>
      [u.id, u.name, u.email, u.username, u.role, u.kyc_status, u.kyc_provider ?? '', u.kyc_document ?? '', u.kyc_rejection_reason ?? '', u.created_at].map(esc).join(',')
    );
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kyc-${status}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${users.length} record${users.length === 1 ? '' : 's'} to CSV.`);
  };

  return (
    <div className="w-full min-h-screen bg-background text-foreground">
      <div className="w-full mx-auto max-w-[1400px] space-y-6 p-6 lg:p-10">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 sm:p-8 rounded-2xl bg-gradient-to-br from-[#102840] via-[#173852] to-[#102840] text-white shadow-lg">
          <div className="space-y-1.5">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#2164b6]/20 text-[#2164b6] dark:text-[#7ab0ff] text-xs font-semibold uppercase tracking-wider border border-[#2164b6]/30">
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
              onClick={() => { setPage(1); setSearchParams({ status: t.key }); }}
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

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { setSearch(searchInput.trim()); setPage(1); } }}
              placeholder="Search name, email, or username..."
              className="w-full h-9 pl-9 pr-4 rounded-xl border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
            />
          </div>
          {search && (
            <button onClick={() => { setSearch(''); setSearchInput(''); setPage(1); }} className="text-xs text-muted-foreground hover:text-foreground">
              Clear search
            </button>
          )}
          <button onClick={handleExportCsv} className="ml-auto flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors">
            <Download className="h-3.5 w-3.5" /> Export CSV
          </button>
        </div>

        {actionError && (
          <div className="flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-5 py-3">
            <AlertCircle className="h-5 w-5 shrink-0 text-destructive" />
            <p className="text-sm text-destructive">{actionError}</p>
            <button onClick={() => setActionError(null)} className="ml-auto text-xs text-muted-foreground hover:text-foreground">Dismiss</button>
          </div>
        )}

        {/* Data table */}
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
          <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Applicant</th>
                  <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Role</th>
                  <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Provider</th>
                  <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Reference</th>
                  <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Submitted</th>
                  <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-4">
                      <button onClick={() => openDetail(user.id)} className="flex items-center gap-3 text-left group">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
                          {user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">{user.name}</span>
                            <span className="text-xs text-muted-foreground">@{user.username}</span>
                          </div>
                          <p className="text-xs text-muted-foreground">{user.email}</p>
                        </div>
                      </button>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${ROLE_COLORS[user.role] ?? ROLE_COLORS.member}`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        {user.kyc_provider || 'manual'}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <FileText className="h-3.5 w-3.5 text-primary" />
                        <span className="font-mono max-w-[180px] truncate">{user.kyc_document || '—'}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-xs text-muted-foreground">
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-2">
                        {status === 'pending' && (
                          <>
                            <button
                              onClick={() => setRejectTarget(user.id)}
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
                        {status === 'verified' && (
                          <span className="flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-600">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Verified
                          </span>
                        )}
                        {status === 'rejected' && (
                          <span className="max-w-[220px] truncate rounded-lg bg-destructive/5 px-3 py-1.5 text-[10px] text-destructive/80" title={user.kyc_rejection_reason}>
                            {user.kyc_rejection_reason || 'Rejected'}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {lastPage > 1 && (
          <div className="flex items-center justify-center gap-2 pt-4">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold border border-border bg-card hover:bg-muted disabled:opacity-40">
              <ChevronLeft className="h-3.5 w-3.5" /> Previous
            </button>
            <span className="text-xs text-muted-foreground">Page {page} of {lastPage}</span>
            <button onClick={() => setPage(p => Math.min(lastPage, p + 1))} disabled={page >= lastPage} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold border border-border bg-card hover:bg-muted disabled:opacity-40">
              Next <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Detail drawer */}
      {detail && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <button
            aria-label="Close applicant details"
            className="absolute inset-0 bg-black/50 cursor-default"
            onClick={() => setDetail(null)}
          />
          <div className="relative h-full w-full max-w-lg bg-background border-l border-border shadow-2xl overflow-y-auto">
            <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-border bg-card/95 backdrop-blur px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-sm font-bold text-primary">
                  {detail.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">{detail.name}</h3>
                  <p className="text-xs text-muted-foreground">@{detail.username}</p>
                </div>
              </div>
              <button onClick={() => setDetail(null)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-5 p-6">
              {detailLoading ? (
                <div className="flex h-40 items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : (
                <>
                  {/* Status */}
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Status</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-3 py-1 text-xs font-bold ${
                        detail.kyc_status === 'verified' ? 'bg-emerald-500/10 text-emerald-600'
                        : detail.kyc_status === 'rejected' ? 'bg-red-500/10 text-red-600'
                        : 'bg-amber-500/10 text-amber-600'
                      }`}>
                        {detail.kyc_status}
                      </span>
                      <span className="rounded-full bg-muted px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        {detail.kyc_provider || 'manual'}
                      </span>
                      {reviewAnswer && (
                        <span className={`rounded-full px-3 py-1 text-xs font-bold ${
                          reviewAnswer === 'GREEN' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-600'
                        }`}>
                          Sumsub: {reviewAnswer}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Contact */}
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Contact</p>
                    <div className="space-y-2 rounded-xl border border-border bg-card p-4">
                      <div className="flex items-center gap-2 text-sm text-foreground">
                        <Mail className="h-4 w-4 text-muted-foreground" /> {detail.email}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-foreground">
                        <Phone className="h-4 w-4 text-muted-foreground" /> {detail.username}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-foreground">
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{detail.role}</span>
                      </div>
                    </div>
                  </div>

                  {/* Verification reference */}
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Verification Reference</p>
                    <div className="rounded-xl border border-border bg-card p-4 space-y-2">
                      <div className="flex items-center gap-2 text-sm text-foreground">
                        <FileText className="h-4 w-4 text-primary" />
                        <span className="font-mono text-xs">{detail.kyc_document || '—'}</span>
                      </div>
                      {detail.sumsub_applicant_id && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>Sumsub Applicant:</span>
                          <span className="font-mono">{detail.sumsub_applicant_id}</span>
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground">
                        Submitted {new Date(detail.created_at).toLocaleString()}
                      </div>
                    </div>
                  </div>

                  {detail.kyc_rejection_reason && (
                    <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-destructive mb-1">Rejection Reason</p>
                      <p className="text-xs text-muted-foreground">{detail.kyc_rejection_reason}</p>
                    </div>
                  )}

                  {/* Sumsub info */}
                  {detail.sumsub && (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Provider Data</p>
                      <div className="rounded-xl border border-border bg-card p-4 space-y-2 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Review status</span>
                          <span className="font-bold text-foreground">{detail.sumsub.status?.reviewStatus ?? '—'}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Review answer</span>
                          <span className="font-bold text-foreground">{reviewAnswer ?? '—'}</span>
                        </div>
                        {detail.sumsub.status?.reviewResult?.moderationComment && (
                          <p className="text-muted-foreground pt-1 border-t border-border">
                            {detail.sumsub.status.reviewResult.moderationComment}
                          </p>
                        )}
                        {detail.sumsub_applicant_id && (
                          <a
                            href={`https://cockpit.sumsub.com/checkus#/applicantDetail/${detail.sumsub_applicant_id}`}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1.5 pt-2 border-t border-border text-primary font-bold hover:underline"
                          >
                            <ExternalLink className="h-3.5 w-3.5" /> Open in Sumsub
                          </a>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  {detail.kyc_status === 'pending' && (
                    <div className="flex items-center gap-3 pt-2">
                      <button
                        onClick={() => setRejectTarget(detail.id)}
                        disabled={processingId === detail.id}
                        className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-border px-4 py-2.5 text-xs font-bold text-destructive hover:bg-destructive/5 disabled:opacity-50"
                      >
                        <XCircle className="h-4 w-4" /> Reject
                      </button>
                      <button
                        onClick={() => handleApprove(detail.id)}
                        disabled={processingId === detail.id}
                        className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                      >
                        {processingId === detail.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                        Approve
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Reject dialog */}
      {rejectTarget !== null && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <button
            aria-label="Close reject dialog"
            className="absolute inset-0 bg-black/50 cursor-default"
            onClick={() => setRejectTarget(null)}
          />
          <div className="relative w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <XCircle className="h-4 w-4 text-destructive" /> Reject verification
            </h3>
            <p className="text-xs text-muted-foreground mt-1 mb-4">
              Provide a reason this submission was rejected. The applicant will see this message.
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. Document illegible, please re-upload a clearer photo..."
              rows={3}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-destructive/50 resize-none"
            />
            <div className="flex items-center justify-end gap-2 mt-4">
              <button onClick={() => { setRejectTarget(null); setRejectReason(''); }} className="rounded-xl border border-border px-4 py-2 text-xs font-bold text-muted-foreground hover:text-foreground">
                Cancel
              </button>
              <button
                onClick={() => rejectTarget !== null && handleReject(rejectTarget, rejectReason)}
                disabled={processingId !== null || !rejectReason.trim()}
                className="rounded-xl bg-destructive px-4 py-2 text-xs font-bold text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {processingId !== null ? <Loader2 className="h-3.5 w-3.5 animate-spin inline mr-1" /> : null}
                Confirm reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
