import { getAuthToken } from "@/lib/auth/token";
import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router';
import {
  FileText, Loader2, Flag, AlertTriangle, CheckCircle2,
  XCircle, Trash2, Ban, MessageCircle, User as UserIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { authFetch } from "@/lib/api/authFetch";


const authHeaders = () => {
  const t = getAuthToken();
  return { Accept: 'application/json', 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) };
};

interface Report {
  id: number;
  reporter_id: number;
  reported_type: 'post' | 'user' | 'comment';
  reported_id: number;
  reason: string;
  details: string | null;
  status: 'pending' | 'reviewed' | 'dismissed' | 'actioned';
  reviewed_by: number | null;
  review_note: string | null;
  reviewed_at: string | null;
  created_at: string;
  reporter: { id: number; name: string; username: string } | null;
  reviewer: { id: number; name: string; username: string } | null;
}

const REASON_LABELS: Record<string, string> = {
  spam: 'Spam',
  harassment: 'Harassment & Bullying',
  inappropriate: 'Inappropriate Content',
  misinformation: 'Misinformation',
  other: 'Other Issue',
};

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-500/20 text-amber-400',
  reviewed: 'bg-blue-500/20 text-blue-400',
  dismissed: 'bg-muted text-muted-foreground',
  actioned: 'bg-emerald-500/20 text-emerald-400',
};

const TYPE_ICONS: Record<string, React.ReactNode> = {
  post: <MessageCircle className="h-4 w-4" />,
  user: <UserIcon className="h-4 w-4" />,
  comment: <MessageCircle className="h-4 w-4" />,
};

export function AdminReportsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') ?? 'pending');
  const [typeFilter, setTypeFilter] = useState(searchParams.get('type') ?? '');
  const [actionModal, setActionModal] = useState<{ report: Report; action: 'dismiss' | 'delete' | 'ban_author' } | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [processing, setProcessing] = useState(false);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);
    if (typeFilter) params.set('type', typeFilter);
    params.set('page', String(page));
    params.set('per_page', '20');
    try {
      const res = await authFetch(`/securegate/reports?${params}`, { headers: authHeaders() });
      const j = await res.json();
      if (res.ok) {
        const list = j?.success ? j?.data : j;
        setReports(Array.isArray(list?.data ?? list) ? (list?.data ?? list) : []);
        setLastPage(j.data?.last_page ?? j.data?.data?.last_page ?? 1);
      } else throw new Error(`HTTP ${res.status}`);
    } catch (e) { setFetchError(e instanceof Error ? e.message : 'Failed to load reports'); setReports([]); }
    finally { setLoading(false); }
  }, [statusFilter, typeFilter, page]);

  useEffect(() => { fetchReports(); }, [fetchReports]);

  useEffect(() => { setPage(1); }, [statusFilter, typeFilter]);

  useEffect(() => {
    const next = new URLSearchParams();
    if (statusFilter && statusFilter !== 'pending') next.set('status', statusFilter);
    if (typeFilter) next.set('type', typeFilter);
    setSearchParams(next, { replace: true });
  }, [statusFilter, typeFilter, setSearchParams]);

  const handleAction = async () => {
    if (!actionModal) return;
    setProcessing(true);
    try {
      const res = await authFetch(`/securegate/reports/${actionModal.report.id}/action`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ action: actionModal.action, review_note: reviewNote || undefined }),
      });
      if (res.ok) {
        setActionModal(null);
        setReviewNote('');
        fetchReports();
      }
    } catch {}
    setProcessing(false);
  };

  const statusTabs = [
    { key: 'pending', label: 'Pending', icon: AlertTriangle },
    { key: 'actioned', label: 'Actioned', icon: CheckCircle2 },
    { key: 'dismissed', label: 'Dismissed', icon: XCircle },
    { key: '', label: 'All', icon: FileText },
  ];

  const typeTabs = ['', 'post', 'user', 'comment'];

  return (
    <div className="w-full mx-auto max-w-[1400px] space-y-6 p-6 lg:p-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight flex items-center gap-2.5">
            <Flag className="h-6 w-6 text-[#2164b6] dark:text-[#7ab0ff]" /> Posts & Reports
          </h1>
          <p className="text-xs text-muted-foreground mt-1">Review reported content and take action.</p>
        </div>
      </div>

      {fetchError && (
        <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-xs text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {fetchError}
          <button onClick={() => { setLoading(true); fetchReports(); }} className="ml-auto text-muted-foreground hover:text-foreground font-bold">Retry</button>
        </div>
      )}

      {/* Status Tabs */}
      <div className="flex flex-wrap gap-1 border-b border-border pb-3">
        {statusTabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setStatusFilter(key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-colors ${
              statusFilter === key
                ? 'bg-[#2164b6] text-foreground'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon className="h-3 w-3" /> {label}
          </button>
        ))}
      </div>

      {/* Type Filter */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Type:</span>
        {typeTabs.map((t) => (
          <button
            key={t}
            onClick={() => setTypeFilter(t)}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors flex items-center gap-1 ${
              typeFilter === t ? 'bg-[#2164b6] text-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            {t ? (t === 'post' ? 'Posts' : t === 'user' ? 'Users' : 'Comments') : 'All Types'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-[#2164b6] dark:text-[#7ab0ff]" /></div>
      ) : reports.length === 0 ? (
        <div className="p-16 text-center border border-dashed border-border rounded-3xl bg-card">
          <Flag className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
          <h3 className="text-sm font-bold">No {statusFilter || ''} reports</h3>
          <p className="text-xs text-muted-foreground mt-1">{statusFilter === 'pending' ? 'All clear! No pending reports to review.' : 'No reports match the current filters.'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((r) => (
            <div key={r.id} className="border border-border rounded-2xl bg-card p-5 space-y-3">
              {/* Header */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="rounded-xl bg-muted p-2.5 text-muted-foreground shrink-0">
                    {TYPE_ICONS[r.reported_type] || <Flag className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-foreground">{REASON_LABELS[r.reason] || r.reason}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${STATUS_STYLES[r.status]}`}>{r.status}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {r.reported_type}#{r.reported_id}
                      {r.reporter && <> · reported by <strong>{r.reporter.name}</strong></>}
                      {r.reviewer && <> · reviewed by <strong>{r.reviewer.name}</strong></>}
                      {' · '}{new Date(r.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>

              {/* Details */}
              {r.details && (
                <p className="text-xs text-foreground/80 bg-muted/20 rounded-xl px-3 py-2 border border-border/50">{r.details}</p>
              )}
              {r.review_note && (
                <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/10 rounded-xl px-3 py-2 border border-border/50">
                  <FileText className="h-3 w-3 mt-0.5 shrink-0" />
                  <span>Review note: {r.review_note}</span>
                </div>
              )}

              {/* Action Buttons (only for pending reports) */}
              {r.status === 'pending' && (
                <div className="flex flex-wrap gap-2 pt-1 border-t border-border/50">
                  <Button
                    size="sm" variant="outline"
                    className="h-8 text-[10px] font-bold text-muted-foreground"
                    onClick={() => { setActionModal({ report: r, action: 'dismiss' }); setReviewNote(''); }}
                  >
                    <XCircle className="h-3 w-3 mr-1" /> Dismiss
                  </Button>
                  <Button
                    size="sm" variant="outline"
                    className="h-8 text-[10px] font-bold text-amber-600"
                    onClick={() => { setActionModal({ report: r, action: 'delete' }); setReviewNote(''); }}
                  >
                    <Trash2 className="h-3 w-3 mr-1" /> Delete {r.reported_type}
                  </Button>
                  <Button
                    size="sm" variant="outline"
                    className="h-8 text-[10px] font-bold text-destructive"
                    onClick={() => { setActionModal({ report: r, action: 'ban_author' }); setReviewNote(''); }}
                  >
                    <Ban className="h-3 w-3 mr-1" /> Ban Author
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {lastPage > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="px-3 py-1.5 rounded-lg text-xs font-bold border border-border bg-card hover:bg-muted disabled:opacity-40">Previous</button>
          <span className="text-xs text-muted-foreground">Page {page} of {lastPage}</span>
          <button onClick={() => setPage(p => Math.min(lastPage, p + 1))} disabled={page >= lastPage} className="px-3 py-1.5 rounded-lg text-xs font-bold border border-border bg-card hover:bg-muted disabled:opacity-40">Next</button>
        </div>
      )}

      {/* Action Confirmation Modal */}
      {actionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-md mx-4 rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className={`rounded-xl p-2.5 ${
                actionModal.action === 'dismiss' ? 'bg-muted text-muted-foreground' :
                actionModal.action === 'delete' ? 'bg-amber-500/15 text-amber-500' :
                'bg-destructive/15 text-destructive'
              }`}>
                {actionModal.action === 'dismiss' ? <XCircle className="h-5 w-5" /> :
                 actionModal.action === 'delete' ? <Trash2 className="h-5 w-5" /> :
                 <Ban className="h-5 w-5" />}
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">
                  {actionModal.action === 'dismiss' ? 'Dismiss Report' :
                   actionModal.action === 'delete' ? `Delete ${actionModal.report.reported_type}` :
                   'Ban Author'}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {actionModal.report.reported_type}#{actionModal.report.reported_id} · {REASON_LABELS[actionModal.report.reason]}
                </p>
              </div>
            </div>
            <textarea
              className="w-full min-h-[60px] rounded-xl border border-border bg-card p-3 text-xs text-foreground placeholder:text-muted-foreground resize-none"
              placeholder="Optional review note..."
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
            />
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="outline" className="text-xs" onClick={() => setActionModal(null)} disabled={processing}>Cancel</Button>
              <Button size="sm" variant={actionModal.action === 'ban_author' ? 'destructive' : 'default'} className="text-xs" onClick={handleAction} disabled={processing}>
                {processing ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                Confirm {actionModal.action === 'dismiss' ? 'Dismiss' : actionModal.action === 'delete' ? 'Delete' : 'Ban'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
