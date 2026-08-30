import { useState, useEffect, useCallback } from "react";
import {
  HardDrive,
  Film,
  Image as ImageIcon,
  Loader2,
  RefreshCw,
  Search,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { getAuthToken } from "@/lib/auth/token";
import { authFetch } from "@/lib/api/authFetch";

function authHeaders() {
  const t = getAuthToken();
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    ...(t ? { Authorization: `Bearer ${t}` } : {}),
  };
}

export default function AdminMediaManagerPage() {
  const [stats, setStats] = useState<any>(null);
  const [mediaList, setMediaList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setErrorMsg(null);
    try {
      // Fetch Stats & List in parallel
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (typeFilter) params.set("media_type", typeFilter);
      if (statusFilter) params.set("status", statusFilter);
      params.set("page", String(page));
      params.set("per_page", "15");

      const [statsRes, listRes] = await Promise.all([
        authFetch("/securegate/media/stats", { headers: authHeaders() }),
        authFetch(`/securegate/media?${params}`, { headers: authHeaders() }),
      ]);

      if (statsRes.ok) {
        const sj = await statsRes.json();
        setStats(sj.data);
      }

      if (listRes.ok) {
        const lj = await listRes.json();
        const listData = lj.data;
        setMediaList(listData?.data ?? []);
        setLastPage(listData?.last_page ?? 1);
      }
    } catch (e: any) {
      setErrorMsg(e.message || "Failed to load media management data.");
    } finally {
      setLoading(false);
    }
  }, [search, typeFilter, statusFilter, page]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRetry = async (uuid: string) => {
    setActionLoading(uuid);
    try {
      const res = await authFetch(`/securegate/media/${uuid}/retry`, {
        method: "POST",
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error("Failed to retry media processing.");
      await loadData();
    } catch (err: any) {
      alert(err.message || "Retry failed");
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (uuid: string) => {
    if (!confirm("Are you sure you want to delete this media file permanently from storage?")) return;
    setActionLoading(uuid);
    try {
      const res = await authFetch(`/securegate/media/${uuid}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error("Failed to delete media.");
      await loadData();
    } catch (err: any) {
      alert(err.message || "Deletion failed");
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="w-full mx-auto max-w-[1400px] space-y-6 p-6 lg:p-10">
      <div>
        <h1 className="text-2xl font-black tracking-tight flex items-center gap-2.5">
          <HardDrive className="h-6 w-6 text-primary" /> Media Service & Storage Audit
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          Monitor Contabo Object Storage, async video processing queues, and media lifecycles.
        </p>
      </div>

      {errorMsg && (
        <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-xs text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" /> {errorMsg}
        </div>
      )}

      {/* Metrics Grid */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="border border-border rounded-2xl p-5 bg-card space-y-1">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Total Storage</p>
            <p className="text-xl font-black text-foreground">{stats.total_storage_formatted}</p>
            <p className="text-[10px] text-muted-foreground">{stats.total_media_count} files stored</p>
          </div>

          <div className="border border-border rounded-2xl p-5 bg-card space-y-1">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Media Breakdown</p>
            <div className="flex items-center gap-3 text-xs font-bold text-foreground">
              <span className="flex items-center gap-1"><Film className="h-3.5 w-3.5 text-blue-500" /> {stats.by_type.videos} Videos</span>
              <span className="flex items-center gap-1"><ImageIcon className="h-3.5 w-3.5 text-emerald-500" /> {stats.by_type.images} Images</span>
            </div>
            <p className="text-[10px] text-muted-foreground">{stats.by_type.documents} documents & audio</p>
          </div>

          <div className="border border-border rounded-2xl p-5 bg-card space-y-1">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Processing Queue</p>
            <div className="flex items-center gap-3 text-xs font-bold text-foreground">
              <span className="flex items-center gap-1 text-emerald-500"><CheckCircle2 className="h-3.5 w-3.5" /> {stats.by_status.completed} Ready</span>
              <span className="flex items-center gap-1 text-amber-500"><Clock className="h-3.5 w-3.5" /> {stats.by_status.processing + stats.by_status.queued} Queued</span>
            </div>
            <p className="text-[10px] text-muted-foreground">FFmpeg HLS background workers</p>
          </div>

          <div className="border border-border rounded-2xl p-5 bg-card space-y-1">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Failed Jobs</p>
            <p className="text-xl font-black text-destructive">{stats.by_status.failed}</p>
            <p className="text-[10px] text-muted-foreground">Requires queue retry</p>
          </div>
        </div>
      )}

      {/* Filter Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-card border border-border rounded-2xl p-4">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search filename or UUID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-muted/30 border border-border rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 bg-muted/30 border border-border rounded-xl text-xs focus:outline-none"
          >
            <option value="">All Media Types</option>
            <option value="video">Videos</option>
            <option value="image">Images</option>
            <option value="audio">Audio</option>
            <option value="document">Documents</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-muted/30 border border-border rounded-xl text-xs focus:outline-none"
          >
            <option value="">All Statuses</option>
            <option value="completed">Completed</option>
            <option value="processing">Processing</option>
            <option value="queued">Queued</option>
            <option value="failed">Failed</option>
          </select>
        </div>
      </div>

      {/* Media Table */}
      <div className="border border-border rounded-2xl bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-muted/40 border-b border-border text-[10px] uppercase font-black text-muted-foreground tracking-wider">
              <tr>
                <th className="px-4 py-3">File / Preview</th>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Storage Disk</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Size / Specs</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {mediaList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground text-xs">
                    No media records found matching current filters.
                  </td>
                </tr>
              ) : (
                mediaList.map((m) => (
                  <tr key={m.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center overflow-hidden shrink-0 border border-border relative">
                          {m.thumbnail_url || m.url ? (
                            <img
                              src={m.thumbnail_url || m.url}
                              alt={m.original_name}
                              className="h-full w-full object-cover"
                            />
                          ) : m.media_type === "video" ? (
                            <Film className="h-5 w-5 text-blue-500" />
                          ) : (
                            <ImageIcon className="h-5 w-5 text-emerald-500" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-foreground truncate max-w-[200px]" title={m.original_name}>
                            {m.original_name || m.filename}
                          </p>
                          <p className="text-[10px] font-mono text-muted-foreground truncate" title={m.uuid}>
                            {m.uuid}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3 font-semibold text-foreground">
                      {m.user?.name || `@${m.user?.username}` || `User #${m.user_id}`}
                    </td>

                    <td className="px-4 py-3 font-mono text-[10px]">
                      <span className="px-2 py-0.5 rounded-md bg-muted font-bold text-foreground">
                        {m.disk}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                          m.processing_status === "completed"
                            ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                            : m.processing_status === "failed"
                            ? "bg-destructive/10 text-destructive border border-destructive/20"
                            : "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                        }`}
                      >
                        {m.processing_status}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-[11px] text-muted-foreground whitespace-nowrap">
                      <p>{(m.size_bytes / 1024 / 1024).toFixed(2)} MB</p>
                      {m.width && m.height && (
                        <p className="text-[10px]">{m.width}x{m.height} {m.duration_seconds ? `· ${m.duration_seconds}s` : ""}</p>
                      )}
                    </td>

                    <td className="px-4 py-3 text-[11px] text-muted-foreground whitespace-nowrap">
                      {new Date(m.created_at).toLocaleDateString()}
                    </td>

                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {m.processing_status === "failed" && (
                          <button
                            onClick={() => handleRetry(m.uuid)}
                            disabled={actionLoading === m.uuid}
                            className="p-1.5 rounded-lg border border-border hover:bg-muted text-amber-500 transition-colors"
                            title="Retry Processing"
                          >
                            <RefreshCw className={`h-3.5 w-3.5 ${actionLoading === m.uuid ? "animate-spin" : ""}`} />
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(m.uuid)}
                          disabled={actionLoading === m.uuid}
                          className="p-1.5 rounded-lg border border-border hover:bg-destructive/10 text-destructive transition-colors"
                          title="Delete File"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {lastPage > 1 && (
          <div className="flex items-center justify-between p-4 border-t border-border text-xs text-muted-foreground bg-muted/20">
            <span>Page {page} of {lastPage}</span>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
                className="px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-muted disabled:opacity-50 font-bold"
              >
                Previous
              </button>
              <button
                disabled={page >= lastPage}
                onClick={() => setPage((p) => Math.min(p + 1, lastPage))}
                className="px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-muted disabled:opacity-50 font-bold"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
