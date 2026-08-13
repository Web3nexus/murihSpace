import { useState, useEffect, useCallback } from "react";
import {
  MessageSquare,
  Loader2,
  Send,
  AlertCircle,
  Plus,
  ChevronLeft,
  Star,
  Paperclip,
  X,
  RotateCcw,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { apiClient } from "@/lib/api/client";

interface TicketCategory {
  id: number;
  name: string;
  slug: string;
  children?: TicketCategory[];
}

interface TicketSummary {
  id: number;
  ticket_number: string;
  subject: string;
  description: string;
  status: string;
  priority: string;
  category: string | null;
  created_at: string;
  updated_at: string;
  message_count: number;
  has_rating: boolean;
}

interface TicketMessage {
  id: number;
  type: string;
  body: string;
  author: "customer" | "support";
  created_at: string;
}

interface TicketEvent {
  event: string;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
}

interface TicketDetail extends TicketSummary {
  resolved_at: string | null;
  closed_at: string | null;
  rating: number | null;
  rating_comment: string | null;
  rated_at: string | null;
  messages: TicketMessage[];
  events: TicketEvent[];
  attachments: { id: number; original_name: string }[];
}

const STATUS_LABELS: Record<string, string> = {
  new: "New",
  open: "Open",
  pending_customer: "Awaiting you",
  pending_internal: "In progress",
  escalated: "Escalated",
  resolved: "Resolved",
  closed: "Closed",
  reopened: "Reopened",
};

const STATUS_STYLES: Record<string, string> = {
  new: "bg-[#2164b6]/15 text-[#2164b6] dark:bg-[#7ab0ff]/15 dark:text-[#7ab0ff]",
  open: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  pending_customer: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  pending_internal: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
  escalated: "bg-red-500/15 text-red-600 dark:text-red-400",
  resolved: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
  closed: "bg-muted text-muted-foreground",
  reopened: "bg-orange-500/15 text-orange-600 dark:text-orange-400",
};

const PRIORITY_LABELS: Record<string, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
  urgent: "Urgent",
  critical: "Critical",
};

function eventLabel(event: string): string {
  const labels: Record<string, string> = {
    status_changed: "Status changed",
    assigned: "Assignment updated",
    escalated: "Ticket escalated",
    note_added: "Internal note",
    customer_closed: "Closed by you",
    customer_reopened: "Reopened by you",
  };
  return labels[event] ?? event.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function StarRating({ value, onChange, disabled }: { value: number; onChange?: (v: number) => void; disabled?: boolean }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={disabled}
          onClick={() => onChange?.(n)}
          className={`transition-colors ${onChange ? "cursor-pointer hover:scale-110" : "cursor-default"} ${disabled ? "opacity-60" : ""}`}
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
        >
          <Star className={`h-5 w-5 ${n <= value ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} />
        </button>
      ))}
    </div>
  );
}

export default function SupportThreadsPage() {
  const [tickets, setTickets] = useState<TicketSummary[]>([]);
  const [categories, setCategories] = useState<TicketCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<TicketDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  // Create ticket form
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createData, setCreateData] = useState({
    subject: "",
    description: "",
    category_id: "",
    priority: "normal",
    attachment: null as File | null,
  });

  // Reply form
  const [newMsg, setNewMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Rating form
  const [ratingValue, setRatingValue] = useState(0);
  const [ratingComment, setRatingComment] = useState("");
  const [ratingSent, setRatingSent] = useState(false);

  const fetchTickets = useCallback(async () => {
    setFetchError(null);
    try {
      const res = await apiClient.get<{ success: boolean; data: TicketSummary[] }>("/tickets", {
        params: { status: statusFilter === "all" ? undefined : statusFilter },
      });
      const list = res.data?.data ?? [];
      setTickets(list);
      setSelectedId((current) => {
        if (current !== null && !list.some((t) => t.id === current)) {
          setDetail(null);
          return null;
        }
        return current;
      });
    } catch (e) {
      setFetchError((e as { message?: string })?.message ?? "Failed to load tickets");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await apiClient.get<{ success: boolean; data: TicketCategory[] }>("/tickets/categories");
      setCategories(res.data?.data ?? []);
    } catch {
      setCategories([]);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    setLoading(true);
    fetchTickets();
  }, [fetchTickets]);

  const openTicket = useCallback(async (id: number) => {
    setSelectedId(id);
    setDetailLoading(true);
    setDetailError(null);
    setRatingSent(false);
    setRatingValue(0);
    setRatingComment("");
    setActionError(null);
    try {
      const res = await apiClient.get<{ success: boolean; data: TicketDetail }>(`/tickets/${id}`);
      const data = res.data?.data;
      setDetail(data ?? null);
      if (data?.rating) {
        setRatingValue(data.rating);
        setRatingComment(data.rating_comment ?? "");
        setRatingSent(true);
      }
    } catch (e) {
      setDetailError((e as { message?: string })?.message ?? "Failed to load ticket");
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const createTicket = async () => {
    if (!createData.subject.trim() || !createData.description.trim()) {
      setCreateError("Subject and description are required.");
      return;
    }
    setSubmitting(true);
    setCreateError(null);
    try {
      const form = new FormData();
      form.append("subject", createData.subject.trim());
      form.append("description", createData.description.trim());
      if (createData.category_id) form.append("category_id", createData.category_id);
      form.append("priority", createData.priority);
      if (createData.attachment) form.append("attachment", createData.attachment);

      const res = await apiClient.post<{ success: boolean; data: TicketDetail }>("/tickets", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const ticket = res.data?.data;
      setSubmitting(false);
      setShowCreateForm(false);
      setCreateData({ subject: "", description: "", category_id: "", priority: "normal", attachment: null });
      if (ticket) {
        if (statusFilter === "all" || statusFilter === ticket.status) {
          setTickets((prev) => [ticket as TicketSummary, ...prev]);
        }
        await fetchTickets();
        await openTicket(ticket.id);
      }
    } catch (e) {
      setSubmitting(false);
      setCreateError((e as { message?: string })?.message ?? "Failed to create ticket");
    }
  };

  const sendMessage = async () => {
    if (!newMsg.trim() || !selectedId) return;
    setSending(true);
    setActionError(null);
    try {
      await apiClient.post(`/tickets/${selectedId}/reply`, { body: newMsg.trim() });
      setNewMsg("");
      await openTicket(selectedId);
    } catch (e) {
      setActionError((e as { message?: string })?.message ?? "Failed to send reply");
    } finally {
      setSending(false);
    }
  };

  const changeStatus = async (status: "closed" | "reopened") => {
    if (!selectedId) return;
    setSending(true);
    setActionError(null);
    try {
      await apiClient.post(`/tickets/${selectedId}/status`, { status });
      await openTicket(selectedId);
      await fetchTickets();
    } catch (e) {
      setActionError((e as { message?: string })?.message ?? "Failed to update status");
    } finally {
      setSending(false);
    }
  };

  const submitRating = async () => {
    if (!selectedId || ratingValue === 0) return;
    setSending(true);
    setActionError(null);
    try {
      await apiClient.post(`/tickets/${selectedId}/rate`, { rating: ratingValue, comment: ratingComment.trim() || null });
      await openTicket(selectedId);
    } catch (e) {
      setActionError((e as { message?: string })?.message ?? "Failed to submit rating");
    } finally {
      setSending(false);
    }
  };

  const canClose = detail && ["resolved", "open", "pending_customer", "pending_internal", "reopened"].includes(detail.status);
  const canReopen = detail && ["resolved", "closed"].includes(detail.status);
  const canRate = detail && ["resolved", "closed"].includes(detail.status);
  const canReply = detail && !["resolved", "closed"].includes(detail.status);

  if (loading) {
    return <div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-[#2164b6] dark:text-[#7ab0ff]" /></div>;
  }

  return (
    <div className="w-full max-w-7xl mx-auto space-y-5 p-6 lg:p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight flex items-center gap-2.5">
            <MessageSquare className="h-6 w-6 text-[#2164b6] dark:text-[#7ab0ff]" /> My Tickets
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Track your requests, reply to support, and rate our help.
          </p>
        </div>
        <Button size="sm" className="h-9 shrink-0" onClick={() => setShowCreateForm(true)}>
          <Plus className="h-4 w-4 mr-1.5" /> New Ticket
        </Button>
      </div>

      {fetchError && (
        <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-xs text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" /> {fetchError}
          <button onClick={() => { setLoading(true); fetchTickets(); }} className="ml-auto text-muted-foreground hover:text-foreground font-bold">Retry</button>
        </div>
      )}

      {showCreateForm && (
        <div className="border border-border rounded-2xl bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold">Create a support ticket</p>
            <button onClick={() => { setShowCreateForm(false); setCreateError(null); }} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5 md:col-span-2">
              <label htmlFor="ticket-subject" className="text-xs font-semibold text-muted-foreground">Subject</label>
              <Input
                id="ticket-subject"
                value={createData.subject}
                onChange={(e) => setCreateData((d) => ({ ...d, subject: e.target.value }))}
                placeholder="Briefly describe your issue"
                className="text-sm"
                maxLength={255}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="ticket-category" className="text-xs font-semibold text-muted-foreground">Category</label>
              <select
                id="ticket-category"
                value={createData.category_id}
                onChange={(e) => setCreateData((d) => ({ ...d, category_id: e.target.value }))}
                className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">General</option>
                {categories.map((cat) => (
                  <optgroup key={cat.id} label={cat.name}>
                    <option value={cat.id}>{cat.name}</option>
                    {cat.children?.map((child) => (
                      <option key={child.id} value={child.id}>{child.name}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="ticket-priority" className="text-xs font-semibold text-muted-foreground">Priority</label>
              <select
                id="ticket-priority"
                value={createData.priority}
                onChange={(e) => setCreateData((d) => ({ ...d, priority: e.target.value }))}
                className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <label htmlFor="ticket-description" className="text-xs font-semibold text-muted-foreground">Description</label>
              <Textarea
                id="ticket-description"
                value={createData.description}
                onChange={(e) => setCreateData((d) => ({ ...d, description: e.target.value }))}
                placeholder="Give us the details so we can help faster"
                className="min-h-28 text-sm"
                maxLength={10000}
              />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <label htmlFor="ticket-attachment" className="text-xs font-semibold text-muted-foreground">Attachment (optional)</label>
              <label htmlFor="ticket-attachment" className="flex items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2.5 text-xs text-muted-foreground cursor-pointer hover:bg-muted/20 transition-colors">
                <Paperclip className="h-4 w-4 shrink-0" />
                {createData.attachment ? createData.attachment.name : "Attach a screenshot or file (max 5MB)"}
                <input
                  id="ticket-attachment"
                  type="file"
                  className="hidden"
                  accept="image/*,.pdf,.doc,.docx,.txt,.csv"
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null;
                    if (file && file.size > 5 * 1024 * 1024) {
                      setCreateError("Attachment must be 5MB or smaller.");
                      e.target.value = "";
                      return;
                    }
                    setCreateError(null);
                    setCreateData((d) => ({ ...d, attachment: file }));
                  }}
                />
              </label>
            </div>
          </div>

          {createError && (
            <p className="text-xs text-destructive flex items-center gap-1.5">
              <AlertCircle className="h-3.5 w-3.5" /> {createError}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => { setShowCreateForm(false); setCreateError(null); }}>Cancel</Button>
            <Button size="sm" onClick={createTicket} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 mr-1.5" />}
              {submitting ? "Submitting..." : "Submit Ticket"}
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        {["all", "open", "resolved", "closed"].map((f) => (
          <button
            key={f}
            onClick={() => { setStatusFilter(f); setSelectedId(null); setDetail(null); }}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
              statusFilter === f ? "bg-[#2164b6] text-white dark:bg-[#7ab0ff] dark:text-[#0d1b2a]" : "bg-muted text-muted-foreground hover:bg-muted/60"
            }`}
          >
            {f === "all" ? "All" : STATUS_LABELS[f] ?? f}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        {/* Ticket list */}
        <div className="lg:col-span-1 border border-border rounded-2xl bg-card overflow-hidden">
          <div className="p-3 border-b border-border">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Tickets</p>
          </div>
          {tickets.length === 0 ? (
            <div className="p-8 text-center">
              <MessageSquare className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">No tickets found</p>
            </div>
          ) : (
            <div className="divide-y divide-border/50 max-h-[480px] overflow-y-auto">
              {tickets.map((t) => (
                <button
                  key={t.id}
                  onClick={() => openTicket(t.id)}
                  className={`w-full text-left px-3 py-3 hover:bg-muted/10 transition-colors flex items-start gap-2 ${selectedId === t.id ? 'bg-muted/20' : ''}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-bold text-foreground truncate">{t.subject}</p>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{t.ticket_number}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{t.description}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <Badge className={`px-1.5 py-0.5 text-[9px] font-bold ${STATUS_STYLES[t.status] ?? "bg-muted"}`}>
                      {STATUS_LABELS[t.status] ?? t.status}
                    </Badge>
                    <span className="text-[9px] text-muted-foreground">{formatDate(t.updated_at)}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Detail */}
        <div className="lg:col-span-2 border border-border rounded-2xl bg-card flex flex-col min-h-[480px]">
          {!selectedId || (!detailLoading && !detail) ? (
            <div className="flex-1 flex items-center justify-center p-12">
              <div className="text-center">
                <MessageSquare className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm font-bold text-muted-foreground">
                  {selectedId && detailError ? "Could not load ticket" : "Select a ticket to view it"}
                </p>
                {detailError && (
                  <p className="text-xs text-destructive mt-1">{detailError}</p>
                )}
              </div>
            </div>
          ) : detailLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-[#2164b6] dark:text-[#7ab0ff]" />
            </div>
          ) : detail ? (
            <>
              <div className="p-4 border-b border-border">
                <button onClick={() => { setSelectedId(null); setDetail(null); }} className="text-[10px] text-muted-foreground hover:text-foreground mb-2 flex items-center gap-1">
                  <ChevronLeft className="h-3 w-3" /> Back to list
                </button>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-sm font-black truncate">{detail.subject}</h2>
                  <Badge className={`px-2 py-0.5 text-[10px] font-bold ${STATUS_STYLES[detail.status] ?? "bg-muted"}`}>
                    {STATUS_LABELS[detail.status] ?? detail.status}
                  </Badge>
                  {detail.priority !== "normal" && (
                    <Badge variant="outline" className="px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                      {PRIORITY_LABELS[detail.priority] ?? detail.priority} priority
                    </Badge>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {detail.ticket_number} · {detail.category ?? "General"} · Opened {formatDate(detail.created_at)}
                </p>
              </div>

              {actionError && (
                <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 m-4 mb-0 text-xs text-destructive">
                  <AlertCircle className="h-4 w-4 shrink-0" /> {actionError}
                </div>
              )}

              <div className="flex-1 p-4 space-y-3 overflow-y-auto max-h-[360px]">
                {/* Original description */}
                <div className="flex justify-start">
                  <div className="max-w-[85%] p-3 rounded-2xl bg-muted text-foreground text-xs">
                    <p className="font-bold text-[10px] text-muted-foreground mb-1">You</p>
                    <p>{detail.description}</p>
                    <p className="text-[9px] text-muted-foreground mt-1">{formatDate(detail.created_at)}</p>
                  </div>
                </div>

                {detail.messages.map((m) => (
                  <div key={m.id} className={`flex ${m.author === "customer" ? "justify-start" : "justify-end"}`}>
                    <div className={`max-w-[85%] p-3 rounded-2xl text-xs ${m.author === "customer" ? "bg-muted text-foreground" : "bg-[#2164b6]/15 text-foreground"}`}>
                      <p className="font-bold text-[10px] text-muted-foreground mb-1">
                        {m.author === "customer" ? "You" : "Support"}
                      </p>
                      <p className="whitespace-pre-wrap">{m.body}</p>
                      <p className="text-[9px] text-muted-foreground mt-1">{formatDate(m.created_at)}</p>
                    </div>
                  </div>
                ))}

                {detail.events.map((e, i) => (
                  <div key={i} className="flex justify-center">
                    <span className="text-[9px] text-muted-foreground bg-muted/50 px-2 py-1 rounded-full">
                      {eventLabel(e.event)}{e.new_value ? ` → ${STATUS_LABELS[e.new_value] ?? e.new_value}` : ""} · {formatDate(e.created_at)}
                    </span>
                  </div>
                ))}

                {/* Rating display */}
                {detail.rating !== null && (
                  <div className="flex justify-center">
                    <div className="flex items-center gap-2 bg-muted/50 px-3 py-2 rounded-full">
                      <StarRating value={detail.rating} disabled />
                      {detail.rating_comment && <span className="text-[10px] text-muted-foreground">"{detail.rating_comment}"</span>}
                    </div>
                  </div>
                )}
              </div>

              {/* Rating form */}
              {canRate && !detail.has_rating && !ratingSent && (
                <div className="p-4 border-t border-border space-y-2">
                  <p className="text-xs font-bold">How was your support experience?</p>
                  <div className="flex items-center gap-3 flex-wrap">
                    <StarRating value={ratingValue} onChange={setRatingValue} />
                    <Input
                      value={ratingComment}
                      onChange={(e) => setRatingComment(e.target.value)}
                      placeholder="Optional comment"
                      className="flex-1 text-xs h-9"
                      maxLength={1000}
                    />
                    <Button size="sm" className="h-9" disabled={sending || ratingValue === 0} onClick={submitRating}>
                      {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Star className="h-4 w-4 mr-1.5" />}
                      Submit
                    </Button>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="p-3 border-t border-border space-y-3">
                {canClose && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full h-8 text-xs"
                    disabled={sending}
                    onClick={() => changeStatus("closed")}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" /> Close this ticket
                  </Button>
                )}
                {canReopen && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full h-8 text-xs"
                    disabled={sending}
                    onClick={() => changeStatus("reopened")}
                  >
                    <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Reopen this ticket
                  </Button>
                )}
                {canReply && (
                  <div className="flex gap-2">
                    <Input
                      value={newMsg}
                      onChange={(e) => setNewMsg(e.target.value)}
                      placeholder="Type a reply..."
                      className="flex-1 text-xs"
                      onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                    />
                    <Button size="sm" disabled={sending || !newMsg.trim()} onClick={sendMessage} className="h-9 shrink-0">
                      {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </Button>
                  </div>
                )}
                {!canReply && (detail.has_rating || ratingSent) && (
                  <p className="text-center text-[10px] text-muted-foreground">This ticket is closed. Thanks for your feedback!</p>
                )}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
