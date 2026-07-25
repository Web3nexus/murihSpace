import { useState, useEffect, useCallback } from 'react';
import { FileText, Loader2, Flag } from 'lucide-react';
import type { AuditLog } from '@/types/admin';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1';
const authHeaders = () => {
  const t = localStorage.getItem('auth_token') || localStorage.getItem('murihspace-token');
  return { Accept: 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) };
};

export function AdminReportsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState('');

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    const params = actionFilter ? `?action=${actionFilter}` : '';
    try {
      const res = await fetch(`${API_BASE}/securegate/audit-logs${params}`, { headers: authHeaders() });
      if (res.ok) { const j = await res.json(); setLogs(j.data ?? []); }
    } finally { setLoading(false); }
  }, [actionFilter]);

  useEffect(() => { // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchLogs(); }, [fetchLogs]);

  const actions = ['', 'user.suspended', 'user.activated', 'user.banned', 'kyc.approved', 'kyc.rejected', 'withdrawal.approved', 'withdrawal.rejected', 'feature_flag.updated'];

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-black text-foreground tracking-tight flex items-center gap-2.5">
          <FileText className="h-6 w-6 text-secondary" /> Reports & Audit
        </h1>
        <p className="text-xs text-muted-foreground mt-1">Content reports and audit trail.</p>
      </div>

      <div className="flex flex-wrap gap-1">
        {actions.map((a) => (
          <button key={a} onClick={() => setActionFilter(a)} className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors ${actionFilter === a ? 'bg-secondary text-white' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>
            {a ? a.split('.').pop() : 'All'}
          </button>
        ))}
      </div>

      {loading ? <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-secondary" /></div>
        : logs.length === 0 ? <div className="p-12 text-center border border-dashed border-border rounded-3xl bg-card"><FileText className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" /><h3 className="text-sm font-bold">No audit logs</h3></div>
        : <div className="border border-border rounded-2xl bg-card overflow-hidden shadow-sm">
            <div className="divide-y divide-border/50">
              {logs.map((l) => (
                <div key={l.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/10 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <Flag className="h-4 w-4 text-secondary shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-foreground truncate">{l.action}</p>
                      <p className="text-[11px] text-muted-foreground">{l.user?.name ? `by ${l.user.name}` : 'System'} · {l.resource_type ? `${l.resource_type}#${l.resource_id}` : ''}</p>
                    </div>
                  </div>
                  <span className="text-[11px] text-muted-foreground shrink-0">{new Date(l.created_at).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>}
    </div>
  );
}
