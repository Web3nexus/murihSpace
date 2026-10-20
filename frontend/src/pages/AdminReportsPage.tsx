import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router';
import { Document as FileText, DangerTriangle as AlertTriangle, TickSquare as CheckCircle2, CloseSquare as XCircle, Delete as Trash2, Chat as MessageCircle, Profile as UserIcon } from "@/components/icons";
import { Spinner as Loader2, Flag, Prohibit } from "@/components/icons/rounded";;
import { Button } from '@/components/ui/button';
import { authFetch } from "@/lib/api/authFetch";


const authHeaders = () => {
  return { Accept: 'application/json', 'Content-Type': 'application/json', };
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
  reviewed: 'bg-[var(--shell-accent-solid)]/20 text-[var(--shell-accent)]',
  dismissed: 'bg-muted text-muted-foreground',
  actioned: 'bg-emerald-500/20 text-emerald-400',
};

const TYPE_ICONS: Record<string, React.ReactNode> = {
  post: <MessageCircle weight="fill" className="h-4 w-4" />,
  user: <UserIcon weight="fill" className="h-4 w-4" />,
  comment: <MessageCircle weight="fill" className="h-4 w-4" />,
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

  const [fetchReportsKey, setFetchReportsKey] = useState(0);
  const fetchReports = () => {
    setLoading(true);
    setFetchError(null);
    setFetchReportsKey((k) => k + 1);
  };

  useEffect(() => {
    (async () => {
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
    })();
  }, [fetchReportsKey, statusFilter, typeFilter, page]);


  // Back to page 1 whenever a filter changes.
  const filterKey = `${statusFilter}|${typeFilter}`;
  const [pagedFilterKey, setPagedFilterKey] = useState(filterKey);
  if (filterKey !== pagedFilterKey) {
    setPagedFilterKey(filterKey);
    setPage(1);
  }

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
    } catch { /* ignored: best-effort, failure is non-fatal */ }
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
    <div className="w-full mx-auto max-w-[1400px] space-y-6 p-4 lg:p-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black tracking-tight flex items-center gap-2.5">
            <Flag weight="fill" className="h-6 w-6 text-[var(--shell-accent)] dark:text-[var(--shell-accent)]" /> Posts & Reports
          </h1>
          <p className="text-xs text-muted-foreground mt-1">Review reported content and take action.</p>
        </div>
      </div>

      {fetchError && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-xs text-destructive">
          <AlertTriangle weight="fill" className="h-4 w-4 shrink-0" /> {fetchError}
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
                ? 'bg-[var(--shell-accent-solid)] text-foreground'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon className="h-3 w-3" /> {label}
          </button>
        ))}
      </div>

      {/* Type Filters */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Type:</span>
        {typeTabs.map((t) => (
          <button
            key={t}
            onClick={() => setTypeFilter(t)}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors flex items-center gap-1 ${
              typeFilter === t ? 'bg-[var(--shell-accent-solid)] text-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            {t ? (t === 'post' ? 'Posts' : t === 'user' ? 'Users' : 'Comments') : 'All Types'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 weight="fill" className="h-8 w-8 animate-spin text-[var(--shell-accent)] dark:text-[var(--shell-accent)]" /></div>
      ) : reports.length === 0 ? (
        <div className="p-16 text-center border border-dashed border-border rounded-3xl bg-card">
          <Flag weight="fill" className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
          <h3 className="text-sm font-bold">No {statusFilter || ''} reports</h3>
          <p className="text-xs text-muted-foreground mt-1">{statusFilter === 'pending' ? 'All clear! No pending reports to review.' : 'No reports match the current filters.'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((r) => (
            <div key={r.id} className="border-none rounded-lg bg-card p-5 space-y-3">
              {/* Header */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="rounded-lg bg-muted p-2.5 text-muted-foreground shrink-0">
                    {TYPE_ICONS[r.reported_type] || <Flag weight="fill" className="h-4 w-4" />}
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
                <p className="text-xs text-foreground/80 bg-muted/20 rounded-lg px-3 py-2 border-none/50">{r.details}</p>
              )}
              {r.review_note && (
                <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/10 rounded-lg px-3 py-2 border-none/50">
                  <FileText weight="fill" className="h-3 w-3 mt-0.5 shrink-0" />
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
                    <XCircle weight="fill" className="h-3 w-3 mr-1" /> Dismiss
                  </Button>
                  <Button
                    size="sm" variant="outline"
                    className="h-8 text-[10px] font-bold text-amber-600"
                    onClick={() => { setActionModal({ report: r, action: 'delete' }); setReviewNote(''); }}
                  >
                    <Trash2 weight="fill" className="h-3 w-3 mr-1" /> Delete {r.reported_type}
                  </Button>
                  <Button
                    size="sm" variant="outline"
                    className="h-8 text-[10px] font-bold text-destructive"
                    onClick={() => { setActionModal({ report: r, action: 'ban_author' }); setReviewNote(''); }}
                  >
                    <Prohibit weight="fill" className="h-3 w-3 mr-1" /> Prohibit Author
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {lastPage > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="px-3 py-1.5 rounded-lg text-xs font-bold border-none bg-card hover:bg-muted disabled:opacity-40">Previous</button>
          <span className="text-xs text-muted-foreground">Page {page} of {lastPage}</span>
          <button onClick={() => setPage(p => Math.min(lastPage, p + 1))} disabled={page >= lastPage} className="px-3 py-1.5 rounded-lg text-xs font-bold border-none bg-card hover:bg-muted disabled:opacity-40">Next</button>
        </div>
      )}

      {/* Action Confirmation Modal */}
      {actionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-md mx-4 rounded-lg border-none bg-card p-4 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className={`rounded-lg p-2.5 ${
                actionModal.action === 'dismiss' ? 'bg-muted text-muted-foreground' :
                actionModal.action === 'delete' ? 'bg-amber-500/15 text-amber-500' :
                'bg-destructive/15 text-destructive'
              }`}>
                {actionModal.action === 'dismiss' ? <XCircle weight="fill" className="h-5 w-5" /> :
                 actionModal.action === 'delete' ? <Trash2 weight="fill" className="h-5 w-5" /> :
                 <Prohibit weight="fill" className="h-5 w-5" />}
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">
                  {actionModal.action === 'dismiss' ? 'Dismiss Report' :
                   actionModal.action === 'delete' ? `Delete ${actionModal.report.reported_type}` :
                   'Prohibit Author'}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {actionModal.report.reported_type}#{actionModal.report.reported_id} · {REASON_LABELS[actionModal.report.reason]}
                </p>
              </div>
            </div>
            <textarea
              className="w-full min-h-[60px] rounded-lg border-none bg-card p-3 text-xs text-foreground placeholder:text-muted-foreground resize-none"
              placeholder="Optional review note..."
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
            />
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="outline" className="text-xs" onClick={() => setActionModal(null)} disabled={processing}>Cancel</Button>
              <Button size="sm" variant={actionModal.action === 'ban_author' ? 'destructive' : 'default'} className="text-xs" onClick={handleAction} disabled={processing}>
                {processing ? <Loader2 weight="fill" className="h-3 w-3 animate-spin mr-1" /> : null}
                Confirm {actionModal.action === 'dismiss' ? 'Dismiss' : actionModal.action === 'delete' ? 'Delete' : 'Prohibit'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
