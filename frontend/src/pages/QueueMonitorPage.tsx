import { useState, useEffect, useCallback } from 'react';
import { useConfirm } from '@/components/ui/DialogProvider';
import { Activity, Database, Clock, AlertTriangle, RefreshCcw, Trash2, Server, Cpu, Shield, HardDrive, AlertCircle } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { getAuthToken } from "@/lib/auth/token";

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1';

function getAuthHeaders() {
  const token = getAuthToken();
  return { 'Content-Type': 'application/json', Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

interface QueueStats {
  pending: number; failed: number; failed_last_hour: number;
  by_queue: Record<string, number>; horizon_path: string;
}

interface FailedJob {
  id: number; uuid: string; connection: string; queue: string;
  payload: string; exception: string; failed_at: string;
}

interface SystemInfo {
  php_version: string; laravel_version: string; environment: string;
  queue_connection: string; db_connection: string; redis_connected: boolean;
  sanctum_token_ttl: number; debug_mode: boolean; horizon_installed: boolean;
}

export function QueueMonitorPage() {
  const confirm = useConfirm();
  const [stats, setStats] = useState<QueueStats | null>(null);
  const [failedJobs, setFailedJobs] = useState<FailedJob[]>([]);
  const [sysInfo, setSysInfo] = useState<SystemInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'failed' | 'system'>('overview');

  const fetchAll = useCallback(async () => {
    setFetchError(null);
    try {
      const [statsRes, failedRes, sysRes] = await Promise.all([
        fetch(`${API_BASE}/securegate/queue/stats`, { headers: getAuthHeaders() }),
        fetch(`${API_BASE}/securegate/queue/failed-jobs?per_page=50`, { headers: getAuthHeaders() }),
        fetch(`${API_BASE}/securegate/queue/system-info`, { headers: getAuthHeaders() }),
      ]);
      if (statsRes.ok) { const j = await statsRes.json(); setStats(j.data?.data ?? j.data); }
      if (failedRes.ok) { const j = await failedRes.json(); setFailedJobs(j?.data?.data ?? j?.data ?? []); }
      if (sysRes.ok) { const j = await sysRes.json(); setSysInfo(j.data?.data ?? j.data); }

      const failed = [statsRes, failedRes, sysRes].filter(r => !r.ok);
      if (failed.length > 0) setFetchError(`${failed.length} data source(s) failed to load.`);
    } catch (e) { setFetchError(e instanceof Error ? e.message : 'Failed to load queue data'); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  async function retryJob(id: number) {
    try {
      const res = await fetch(`${API_BASE}/securegate/queue/failed-jobs/${id}/retry`, { method: 'POST', headers: getAuthHeaders() });
      const json = await res.json();
      if (res.ok) { setMessage({ type: 'success', text: 'Job requeued.' }); fetchAll(); }
      else { setMessage({ type: 'error', text: json.message ?? 'Failed.' }); }
    } catch { setMessage({ type: 'error', text: 'Network error.' }); }
  }

  async function retryAll() {
    try {
      const res = await fetch(`${API_BASE}/securegate/queue/failed-jobs/retry-all`, { method: 'POST', headers: getAuthHeaders() });
      const json = await res.json();
      if (res.ok) { setMessage({ type: 'success', text: 'All failed jobs requeued.' }); fetchAll(); }
      else { setMessage({ type: 'error', text: json.message ?? 'Failed.' }); }
    } catch { setMessage({ type: 'error', text: 'Network error.' }); }
  }

  async function flushFailed() {
    if (!await confirm({ title: 'Delete Failed Jobs', message: 'Delete all failed job records? This cannot be undone.', variant: 'destructive' })) return;
    try {
      const res = await fetch(`${API_BASE}/securegate/queue/failed-jobs`, { method: 'DELETE', headers: getAuthHeaders() });
      if (res.ok) { setMessage({ type: 'success', text: 'Failed jobs flushed.' }); fetchAll(); }
    } catch { setMessage({ type: 'error', text: 'Network error.' }); }
  }

  if (isLoading) {
    return <div className="w-full flex items-center justify-center h-64"><RefreshCcw className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  const tabs = [
    { key: 'overview' as const, label: 'Queue Overview', icon: Activity },
    { key: 'failed' as const, label: 'Failed Jobs', icon: AlertTriangle },
    { key: 'system' as const, label: 'System Info', icon: Server },
  ];

  return (
    <div className="space-y-6 w-full max-w-7xl mx-auto p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 sm:p-8 rounded-2xl bg-gradient-to-br from-[#102840] via-[#173852] to-[#102840] text-white shadow-lg">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-[#38A8D8]/20 text-[#38A8D8] text-xs font-semibold uppercase tracking-wider border border-[#38A8D8]/30">
              System
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Queue & System Monitor</h1>
          <p className="text-sm text-white/70 max-w-xl">Monitor background jobs, retry failures, and inspect system health.</p>
        </div>
        <Button onClick={fetchAll} variant="secondary" className="gap-2 shrink-0 self-start sm:self-auto">
          <RefreshCcw className="h-4 w-4" /> Refresh
        </Button>
      </div>

      {fetchError && (
        <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-xs text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" /> {fetchError}
          <button onClick={() => { setIsLoading(true); fetchAll(); }} className="ml-auto text-muted-foreground hover:text-foreground font-bold">Retry</button>
        </div>
      )}

      {message && (
        <div className={`px-4 py-3 rounded-xl text-sm flex items-center gap-2 border ${
          message.type === 'success' ? 'bg-emerald-50/50 text-emerald-600 border-emerald-200/50' : 'bg-destructive/10 text-destructive border-destructive/20'
        }`}>{message.text}</div>
      )}

      <div className="flex gap-1 border-b border-border pb-1">
        {tabs.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-t-lg text-sm font-bold transition-colors ${
                activeTab === t.key ? 'bg-card text-foreground border-x border-t border-border' : 'text-muted-foreground hover:text-foreground'
              }`}
            ><Icon className="h-4 w-4" />{t.label}</button>
          );
        })}
      </div>

      {activeTab === 'overview' && stats && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-border bg-card p-5 space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" /> Pending Jobs
              </div>
              <p className="text-3xl font-black text-foreground">{stats.pending}</p>
              {Object.keys(stats.by_queue).length > 0 && (
                <div className="text-xs text-muted-foreground space-y-0.5">
                  {Object.entries(stats.by_queue).map(([q, c]) => (
                    <div key={q} className="flex justify-between"><span>{q}</span><span className="font-bold">{c}</span></div>
                  ))}
                </div>
              )}
            </div>
            <div className="rounded-2xl border border-border bg-card p-5 space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <AlertTriangle className="h-4 w-4" /> Failed Jobs
              </div>
              <p className="text-3xl font-black text-foreground">{stats.failed}</p>
              <p className="text-xs text-muted-foreground">
                {stats.failed_last_hour > 0 ? (
                  <span className="text-destructive font-semibold">{stats.failed_last_hour} failed in the last hour</span>
                ) : 'No recent failures'}
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-5 space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Activity className="h-4 w-4" /> Status
              </div>
              <p className={`text-3xl font-black ${stats.pending > 50 ? 'text-amber-500' : 'text-emerald-500'}`}>
                {stats.pending > 50 ? 'Heavy' : stats.pending > 0 ? 'Active' : 'Idle'}
              </p>
              <p className="text-xs text-muted-foreground">
                Queue is {stats.pending === 0 ? 'empty — all caught up' : `processing ${stats.pending} job(s)`}
              </p>
            </div>
          </div>

          {stats.failed > 0 && (
            <div className="flex gap-2">
              <Button onClick={retryAll} variant="default" size="sm" className="gap-1.5">
                <RefreshCcw className="h-4 w-4" /> Retry All Failed
              </Button>
              <Button onClick={flushFailed} variant="destructive" size="sm" className="gap-1.5">
                <Trash2 className="h-4 w-4" /> Flush Failed
              </Button>
            </div>
          )}

          <div className="rounded-2xl border border-border bg-card p-5">
            <h3 className="font-semibold text-sm text-foreground mb-3">Links</h3>
            <div className="space-y-2">
              <a href={stats.horizon_path} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-[#38A8D8] hover:underline">
                <Activity className="h-4 w-4" /> Horizon Dashboard →
              </a>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'failed' && (
        <div className="space-y-4">
          {failedJobs.length > 0 && (
            <div className="flex gap-2">
              <Button onClick={retryAll} size="sm" className="gap-1.5"><RefreshCcw className="h-4 w-4" /> Retry All</Button>
              <Button onClick={flushFailed} variant="destructive" size="sm" className="gap-1.5"><Trash2 className="h-4 w-4" /> Flush All</Button>
            </div>
          )}

          {failedJobs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-12 text-center space-y-3 bg-card">
              <CheckCircleIcon />
              <h3 className="text-base font-semibold text-foreground">No failed jobs</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">All background jobs have completed successfully.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {failedJobs.map(job => {
                let display = '';
                try { const p = JSON.parse(job.payload); display = p.displayName ?? p.job ?? 'Unknown'; } catch { display = job.queue; }
                const exceptionPreview = job.exception?.substring(0, 300);
                return (
                  <div key={job.id} className="rounded-2xl border border-border bg-card p-4 space-y-2">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-foreground truncate">{display}</span>
                          <span className="text-xs px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive font-medium">{job.queue}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {job.connection} · {new Date(job.failed_at).toLocaleString()}
                        </p>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => retryJob(job.id)} title="Retry">
                        <RefreshCcw className="h-4 w-4" />
                      </Button>
                    </div>
                    {exceptionPreview && (
                      <pre className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-2 overflow-x-auto max-h-24">{exceptionPreview}</pre>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'system' && sysInfo && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { label: 'PHP Version', value: sysInfo.php_version, icon: Cpu },
            { label: 'Laravel Version', value: sysInfo.laravel_version, icon: Cpu },
            { label: 'Environment', value: sysInfo.environment, icon: Server },
            { label: 'Queue Connection', value: sysInfo.queue_connection, icon: Database },
            { label: 'DB Connection', value: sysInfo.db_connection, icon: Database },
            { label: 'Redis', value: sysInfo.redis_connected ? 'Connected' : 'Disconnected', icon: HardDrive, ok: sysInfo.redis_connected },
            { label: 'Token TTL', value: `${sysInfo.sanctum_token_ttl} min`, icon: Shield },
            { label: 'Debug Mode', value: sysInfo.debug_mode ? 'On' : 'Off', icon: AlertTriangle, ok: !sysInfo.debug_mode },
            { label: 'Horizon', value: sysInfo.horizon_installed ? 'Installed' : 'Not installed', icon: Activity },
          ].map((item, i) => {
            const Icon = item.icon;
            return (
              <div key={i} className="rounded-2xl border border-border bg-card p-4 flex items-center gap-3">
                <div className={`p-2 rounded-xl ${item.ok !== false ? 'bg-primary/10 text-primary' : 'bg-amber-100 text-amber-600'}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                  <p className="text-sm font-bold text-foreground">{item.value}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CheckCircleIcon() {
  return (
    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    </div>
  );
}
