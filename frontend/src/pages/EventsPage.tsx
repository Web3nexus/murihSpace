import { useState, useEffect, useCallback, useMemo } from "react";
import { Link, useSearchParams } from "react-router";
import {
  VideoCamera,
  Calendar,
  CalendarCheck,
  Radio,
  MagnifyingGlass,
  MapPin,
  Users,
  Clock,
  Plus,
  Trash,
  Check,
  WarningCircle,
  ShieldCheck,
  X,
  Globe,
  Compass,
  ArrowsClockwise,
  Broadcast,
  Spinner,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { useConfirm } from "@/components/ui/DialogProvider";
import { CreateEventModal } from "@/components/events/CreateEventModal";
import { LiveKitVideoConference } from "@/components/video/LiveKitVideoConference";
import { ActionTooltip } from "@/components/ui/action-tooltip";
import { authFetch } from "@/lib/api/authFetch";
import { safeArray } from "@/lib/api/cacheStore";
import { env } from "@/config/env";
import { getAuthToken } from "@/lib/auth/token";
import type { EventData } from "@/types/events";

const API = env.VITE_API_BASE_URL;

type TabType = "discover" | "my-events" | "live";
type FilterDateType = "all" | "today" | "this_week" | "upcoming" | "online" | "in_person";
type MyEventsFilterType = "all" | "published" | "draft" | "past";

interface AudioRoom {
  id: number;
  community_id: number | null;
  creator_id: number;
  title: string;
  description: string | null;
  cover_url: string | null;
  status: string;
  scheduled_at: string | null;
  started_at: string | null;
  ended_at: string | null;
  max_participants: number | null;
  is_recorded: boolean;
  recording_url: string | null;
  creator?: { id: number; name: string; username: string; avatar_url: string | null };
  community?: { id: number; name: string; slug: string };
  active_participants_count?: number;
}

function formatDateBadge(dateStr: string) {
  const d = new Date(dateStr);
  return {
    month: d.toLocaleDateString("en-US", { month: "short" }).toUpperCase(),
    day: d.toLocaleDateString("en-US", { day: "numeric" }),
    weekdayTime:
      d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) +
      " · " +
      d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
  };
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function formatDateTime(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const EVENT_TYPE_LABELS: Record<string, string> = {
  online: "Online",
  in_person: "In Person",
  hybrid: "Hybrid",
};

const STATUS_BADGE_STYLE: Record<string, { bg: string; label: string }> = {
  published: {
    bg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    label: "Published",
  },
  draft: { bg: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20", label: "Draft" },
  cancelled: { bg: "bg-destructive/10 text-destructive border-destructive/20", label: "Cancelled" },
  completed: { bg: "bg-muted text-muted-foreground border-border/60", label: "Completed" },
};

export function EventsPage() {
  const { user } = useAuth();
  const confirm = useConfirm();
  const isKycVerified = user?.kyc_status === "verified";

  const [searchParams, setSearchParams] = useSearchParams();
  const activeTabParam = searchParams.get("tab") as TabType | null;
  const activeTab: TabType =
    activeTabParam && ["discover", "my-events", "live"].includes(activeTabParam)
      ? activeTabParam
      : "discover";

  const setActiveTab = (tab: TabType) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (tab === "discover") {
        next.delete("tab");
      } else {
        next.set("tab", tab);
      }
      return next;
    });
  };

  // ── Discover Events State ──
  const [events, setEvents] = useState<EventData[]>([]);
  const [isEventsLoading, setIsEventsLoading] = useState(true);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterDate, setFilterDate] = useState<FilterDateType>("all");

  // ── My Events State ──
  const [myEvents, setMyEvents] = useState<EventData[]>([]);
  const [isMyEventsLoading, setIsMyEventsLoading] = useState(false);
  const [myEventsError, setMyEventsError] = useState<string | null>(null);
  const [myEventsFilter, setMyEventsFilter] = useState<MyEventsFilterType>("all");

  // ── Live Video & Audio Rooms State ──
  const [rooms, setRooms] = useState<AudioRoom[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<AudioRoom | null>(null);
  const [isVideoMode, setIsVideoMode] = useState(false);

  // ── Modals & Action States ──
  const [isCreateEventOpen, setIsCreateEventOpen] = useState(false);
  const [showKycRequiredModal, setShowKycRequiredModal] = useState(false);
  const [showLiveStudioModal, setShowLiveStudioModal] = useState(false);
  const [showScheduleLiveModal, setShowScheduleLiveModal] = useState(false);
  const [isSubmittingLive, setIsSubmittingLive] = useState(false);
  const [liveErrorNotice, setLiveErrorNotice] = useState<string | null>(null);

  // Live Studio fields
  const [liveTitle, setLiveTitle] = useState("");
  const [liveDestination, setLiveDestination] = useState("profile");
  const [schedTitle, setSchedTitle] = useState("");
  const [schedDesc, setSchedDesc] = useState("");
  const [schedDateTime, setSchedDateTime] = useState("");
  const [schedMaxParticipants, setSchedMaxParticipants] = useState("");

  // ── Fetch Discover Events ──
  const fetchEvents = useCallback(async () => {
    setIsEventsLoading(true);
    setEventsError(null);
    try {
      const token = getAuthToken();
      const res = await fetch(`${API}/events`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Failed to load community events");
      const body = await res.json();
      setEvents(safeArray<EventData>(body));
    } catch (e) {
      setEventsError(e instanceof Error ? e.message : "Unable to load events");
    } finally {
      setIsEventsLoading(false);
    }
  }, []);

  // ── Fetch My Events ──
  const fetchMyEvents = useCallback(async () => {
    setIsMyEventsLoading(true);
    setMyEventsError(null);
    try {
      const token = getAuthToken();
      const res = await fetch(`${API}/my-events`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Failed to load your events");
      const body = await res.json();
      setMyEvents(safeArray<EventData>(body));
    } catch (e) {
      setMyEventsError(e instanceof Error ? e.message : "Unable to load your events");
    } finally {
      setIsMyEventsLoading(false);
    }
  }, []);

  // ── Fetch Audio / Live Rooms ──
  const fetchRooms = useCallback(async () => {
    try {
      const token = getAuthToken();
      const res = await authFetch("/audio-rooms", {
        headers: { Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      if (res.ok) {
        const json = await res.json();
        setRooms(safeArray<AudioRoom>(json));
      }
    } catch {
      setRooms([]);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
    fetchRooms();
  }, [fetchEvents, fetchRooms]);

  useEffect(() => {
    if (activeTab === "my-events") {
      fetchMyEvents();
    }
  }, [activeTab, fetchMyEvents]);

  // ── Go Live Actions ──
  const handleOpenGoLive = () => {
    if (!isKycVerified) {
      setShowKycRequiredModal(true);
    } else {
      setShowLiveStudioModal(true);
    }
  };

  const handleStartLiveNow = async () => {
    if (!isKycVerified) return;
    setIsSubmittingLive(true);
    setLiveErrorNotice(null);
    const token = getAuthToken();
    try {
      const body = {
        title: liveTitle.trim() || `${user?.name ?? "Creator"}'s Live Video Stream`,
        description: null,
        scheduled_at: null,
      };
      const res = await authFetch("/audio-rooms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Failed to create live broadcast.");
      const roomData = json.data ?? json;
      await authFetch(`/audio-rooms/${roomData.id}/start`, {
        method: "POST",
        headers: { Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      setShowLiveStudioModal(false);
      setSelectedRoom({ ...roomData, status: "live" });
      setIsVideoMode(true);
      setActiveTab("live");
      fetchRooms();
    } catch (err: unknown) {
      setLiveErrorNotice(err instanceof Error ? err.message : "Could not launch live video broadcast.");
    } finally {
      setIsSubmittingLive(false);
    }
  };

  const handleScheduleLiveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isKycVerified) return;
    setIsSubmittingLive(true);
    setLiveErrorNotice(null);
    const token = getAuthToken();
    try {
      const body = {
        title: schedTitle.trim(),
        description: schedDesc || null,
        scheduled_at: schedDateTime || null,
        max_participants: schedMaxParticipants ? parseInt(schedMaxParticipants) : null,
      };
      const res = await authFetch("/audio-rooms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Failed to schedule live stream.");
      setShowScheduleLiveModal(false);
      setSchedTitle(""); setSchedDesc(""); setSchedDateTime(""); setSchedMaxParticipants("");
      setActiveTab("live");
      fetchRooms();
    } catch (err: unknown) {
      setLiveErrorNotice(err instanceof Error ? err.message : "Could not schedule live stream.");
    } finally {
      setIsSubmittingLive(false);
    }
  };

  // ── My Events Management ──
  const handlePublishToggle = async (event: EventData) => {
    const newStatus = event.status === "published" ? "draft" : "published";
    try {
      const token = getAuthToken();
      const res = await fetch(`${API}/my-events/${event.id}/publish`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      fetchMyEvents();
      fetchEvents();
    } catch {
      console.error("Failed to update event status");
    }
  };

  const handleDeleteEvent = async (id: number) => {
    const ok = await confirm({
      title: "Delete Event",
      message: "Are you sure you want to delete this event? This cannot be undone.",
      variant: "destructive",
    });
    if (!ok) return;
    try {
      const token = getAuthToken();
      const res = await fetch(`${API}/my-events/${id}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Failed to delete");
      setMyEvents((prev) => prev.filter((e) => e.id !== id));
      setEvents((prev) => prev.filter((e) => e.id !== id));
    } catch {
      console.error("Failed to delete event");
    }
  };

  // ── Filtered Discover Events ──
  const filteredEvents = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    const weekEnd = new Date(todayStart.getTime() + 7 * 24 * 60 * 60 * 1000);
    return events.filter((e) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        if (
          !e.title.toLowerCase().includes(q) &&
          !e.description?.toLowerCase().includes(q) &&
          !e.creator?.name.toLowerCase().includes(q) &&
          !e.community?.name.toLowerCase().includes(q) &&
          !e.location?.toLowerCase().includes(q)
        ) return false;
      }
      const startDate = new Date(e.start_date);
      if (filterDate === "today") return startDate >= todayStart && startDate <= todayEnd;
      if (filterDate === "this_week") return startDate >= todayStart && startDate <= weekEnd;
      if (filterDate === "upcoming") return new Date(e.end_date || e.start_date) >= todayStart;
      if (filterDate === "online") return e.event_type === "online" || e.event_type === "hybrid";
      if (filterDate === "in_person") return e.event_type === "in_person" || e.event_type === "hybrid";
      return true;
    });
  }, [events, searchQuery, filterDate]);

  // ── Filtered My Events ──
  const filteredMyEvents = useMemo(() => {
    const now = new Date();
    return myEvents.filter((e) => {
      if (myEventsFilter === "published") return e.status === "published";
      if (myEventsFilter === "draft") return e.status === "draft";
      if (myEventsFilter === "past") return new Date(e.end_date || e.start_date) < now;
      return true;
    });
  }, [myEvents, myEventsFilter]);

  // ── Live Rooms Breakdown ──
  const activeLiveRooms = useMemo(() => rooms.filter((r) => r.status === "live"), [rooms]);
  const upcomingRooms = useMemo(() => rooms.filter((r) => r.status === "scheduled"), [rooms]);
  const pastRooms = useMemo(() => rooms.filter((r) => r.status === "ended"), [rooms]);

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 px-4 py-5 sm:px-6 sm:py-6 lg:px-8">

      {/* ── HEADER ────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border/40">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <VideoCamera weight="fill" className="h-6 w-6" />
            </div>
            <h1 className="text-2xl sm:text-[28px] font-black tracking-tight text-foreground">
              Live Video &amp; Events
            </h1>
          </div>
          <p className="text-sm sm:text-[15px] text-muted-foreground pl-14">
            Discover upcoming events, workshops, live sessions and community experiences.
          </p>
        </div>
        <div className="flex items-center gap-2.5 shrink-0 pl-14 md:pl-0">
          <Button
            variant="outline"
            onClick={() => setActiveTab("my-events")}
            className="h-10 px-4 rounded-xl text-sm font-semibold"
          >
            <CalendarCheck weight="fill" className="mr-1.5 h-4 w-4 text-primary" />
            Manage My Events
          </Button>
          <ActionTooltip
            content={!isKycVerified ? "Identity verification (KYC) required to go live." : "Start a live broadcast"}
          >
            <Button
              onClick={handleOpenGoLive}
              className="h-10 px-5 rounded-xl text-sm font-semibold bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
            >
              <Radio weight="fill" className="h-4 w-4 animate-pulse" />
              Go Live
            </Button>
          </ActionTooltip>
        </div>
      </div>

      {/* Error notice */}
      {liveErrorNotice && (
        <div className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium flex items-center justify-between">
          <span>{liveErrorNotice}</span>
          <button onClick={() => setLiveErrorNotice(null)} className="ml-3 p-1 hover:opacity-75">
            <X weight="bold" className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ── PAGE TABS ──────────────────────────────────── */}
      <div className="flex items-center border-b border-border/60 overflow-x-auto scrollbar-none gap-1">
        {([
          { id: "discover", label: "Discover Events", Icon: Compass },
          { id: "my-events", label: "My Events", Icon: CalendarCheck },
          { id: "live", label: "Live Video & Audio Rooms", Icon: Broadcast },
        ] as const).map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={[
              "flex items-center gap-2 px-4 py-3 text-sm whitespace-nowrap border-b-2 -mb-px transition-colors",
              activeTab === id
                ? "border-primary text-primary font-bold"
                : "border-transparent text-muted-foreground hover:text-foreground font-medium",
            ].join(" ")}
          >
            <Icon weight="fill" className="h-4 w-4" />
            {label}
            {id === "live" && activeLiveRooms.length > 0 && (
              <span className="flex items-center gap-1 ml-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-destructive/10 text-destructive border border-destructive/20">
                <span className="h-1.5 w-1.5 rounded-full bg-destructive animate-pulse" />
                {activeLiveRooms.length} LIVE
              </span>
            )}
            {id === "my-events" && myEvents.length > 0 && (
              <span className="ml-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                {myEvents.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════
          TAB 1 — DISCOVER EVENTS
      ══════════════════════════════════════════════════ */}
      {activeTab === "discover" && (
        <div className="space-y-6">
          {/* Search + Filters */}
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <MagnifyingGlass
                weight="bold"
                className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none"
              />
              <Input
                placeholder="Search events by title, topic, or host..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-10 pl-10 pr-9 rounded-xl bg-card border-border/70 text-sm focus-visible:ring-primary"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
                >
                  <X weight="bold" className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-1">
              {(
                [
                  { id: "all", label: "All" },
                  { id: "today", label: "Today" },
                  { id: "this_week", label: "This Week" },
                  { id: "upcoming", label: "Upcoming" },
                  { id: "online", label: "Online" },
                  { id: "in_person", label: "In Person" },
                ] as const
              ).map((chip) => (
                <button
                  key={chip.id}
                  onClick={() => setFilterDate(chip.id)}
                  className={[
                    "px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all",
                    filterDate === chip.id
                      ? "bg-primary text-primary-foreground"
                      : "bg-card border border-border/70 text-muted-foreground hover:text-foreground hover:bg-muted/60",
                  ].join(" ")}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>

          {/* Events grid */}
          {isEventsLoading ? (
            <div className="py-24 text-center space-y-3">
              <Spinner weight="bold" className="h-8 w-8 animate-spin text-primary mx-auto" />
              <p className="text-sm font-medium text-muted-foreground">Discovering events across MurihSpace…</p>
            </div>
          ) : eventsError ? (
            <div className="py-16 text-center max-w-md mx-auto space-y-4">
              <div className="h-12 w-12 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
                <WarningCircle weight="fill" className="h-6 w-6" />
              </div>
              <h3 className="text-base font-bold text-foreground">Could not load events</h3>
              <p className="text-xs text-muted-foreground">{eventsError}</p>
              <Button onClick={fetchEvents} size="sm" variant="outline" className="rounded-xl text-xs gap-1.5">
                <ArrowsClockwise weight="bold" className="h-3.5 w-3.5" /> Try Again
              </Button>
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="py-20 text-center max-w-sm mx-auto space-y-4">
              <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center mx-auto text-primary">
                <Calendar weight="fill" className="h-7 w-7" />
              </div>
              <h3 className="text-lg font-bold text-foreground">
                {searchQuery || filterDate !== "all" ? "No matching events" : "No upcoming events"}
              </h3>
              <p className="text-sm text-muted-foreground">
                {searchQuery || filterDate !== "all"
                  ? "Try adjusting your search or filter."
                  : "There aren't any upcoming events right now."}
              </p>
              <div className="flex items-center justify-center gap-3 pt-1">
                {(searchQuery || filterDate !== "all") && (
                  <Button
                    onClick={() => { setSearchQuery(""); setFilterDate("all"); }}
                    variant="outline"
                    className="h-9 px-4 rounded-xl text-xs font-semibold"
                  >
                    Reset Filters
                  </Button>
                )}
                <Button
                  onClick={() => setIsCreateEventOpen(true)}
                  className="h-9 px-4 rounded-xl text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5"
                >
                  <Plus weight="bold" className="h-3.5 w-3.5" /> Create Event
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {filteredEvents.map((event) => {
                const dateInfo = formatDateBadge(event.start_date);
                const isOnline = event.event_type === "online";
                const isHybrid = event.event_type === "hybrid";
                return (
                  <div
                    key={event.id}
                    className="group flex flex-col rounded-2xl border border-border/70 bg-card overflow-hidden transition-all duration-200 hover:shadow-lg hover:border-primary/30 hover:-translate-y-0.5"
                  >
                    {/* 16:9 Cover */}
                    <Link to={`/app/events/${event.id}`} className="aspect-video relative overflow-hidden bg-muted/40 block">
                      {event.cover_url ? (
                        <img
                          src={event.cover_url}
                          alt={event.title}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-primary/10 via-muted/30 to-card flex flex-col items-center justify-center">
                          <Calendar weight="duotone" className="h-10 w-10 text-primary/40 mb-1" />
                          <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">
                            MurihSpace Event
                          </span>
                        </div>
                      )}
                      <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2 pointer-events-none">
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-background/85 backdrop-blur-md text-foreground border border-border/50">
                          {EVENT_TYPE_LABELS[event.event_type] || event.event_type}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-black/60 text-white backdrop-blur-md">
                          {dateInfo.month} {dateInfo.day}
                        </span>
                      </div>
                    </Link>

                    {/* Card body */}
                    <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-primary">
                          <Clock weight="fill" className="h-3.5 w-3.5 shrink-0" />
                          <span>{dateInfo.weekdayTime}</span>
                        </div>
                        <Link to={`/app/events/${event.id}`}>
                          <h3 className="text-[15px] font-bold text-foreground leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                            {event.title}
                          </h3>
                        </Link>
                        <div className="flex items-center gap-2 pt-0.5">
                          <div className="h-5 w-5 rounded-full bg-muted overflow-hidden flex items-center justify-center text-[10px] font-bold text-foreground shrink-0 border border-border/60">
                            {event.creator?.avatar ? (
                              <img src={event.creator.avatar} alt="" className="w-full h-full object-cover" />
                            ) : (
                              event.creator?.name?.charAt(0) || "M"
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground truncate">
                            {event.creator?.name || event.community?.name || "Creator"}
                          </span>
                        </div>
                      </div>
                      <div className="space-y-3 pt-2 border-t border-border/40">
                        <div className="flex items-center justify-between text-xs text-muted-foreground gap-2">
                          <span className="flex items-center gap-1 truncate max-w-[60%]">
                            <MapPin weight="fill" className="h-3.5 w-3.5 shrink-0 text-primary" />
                            <span className="truncate">
                              {isOnline ? "Online Room" : isHybrid ? "Online & In Person" : event.location || "Venue"}
                            </span>
                          </span>
                          <span className="flex items-center gap-1 font-medium shrink-0">
                            <Users weight="fill" className="h-3.5 w-3.5" />
                            {event.registration_count ?? 0} attending
                          </span>
                        </div>
                        <Button
                          asChild
                          className="w-full h-9 rounded-xl text-xs font-bold bg-muted/70 hover:bg-primary hover:text-primary-foreground text-foreground border border-border/70 hover:border-primary transition-all"
                        >
                          <Link to={`/app/events/${event.id}`}>View Event</Link>
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          TAB 2 — MY EVENTS
      ══════════════════════════════════════════════════ */}
      {activeTab === "my-events" && (
        <div className="space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-1">
              {(
                [
                  { id: "all", label: "All Events" },
                  { id: "published", label: "Published" },
                  { id: "draft", label: "Drafts" },
                  { id: "past", label: "Past" },
                ] as const
              ).map((chip) => (
                <button
                  key={chip.id}
                  onClick={() => setMyEventsFilter(chip.id)}
                  className={[
                    "px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all",
                    myEventsFilter === chip.id
                      ? "bg-primary text-primary-foreground"
                      : "bg-card border border-border/70 text-muted-foreground hover:text-foreground hover:bg-muted/60",
                  ].join(" ")}
                >
                  {chip.label}
                </button>
              ))}
            </div>
            <Button
              onClick={() => setIsCreateEventOpen(true)}
              className="h-9 px-4 rounded-xl text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5 shrink-0 self-start sm:self-auto"
            >
              <Plus weight="bold" className="h-3.5 w-3.5" /> Create Event
            </Button>
          </div>

          {isMyEventsLoading ? (
            <div className="py-24 text-center space-y-3">
              <Spinner weight="bold" className="h-8 w-8 animate-spin text-primary mx-auto" />
              <p className="text-sm font-medium text-muted-foreground">Loading your events…</p>
            </div>
          ) : myEventsError ? (
            <div className="py-16 text-center max-w-md mx-auto space-y-4">
              <WarningCircle weight="fill" className="h-8 w-8 text-destructive mx-auto" />
              <p className="text-sm font-medium text-foreground">{myEventsError}</p>
              <Button onClick={fetchMyEvents} size="sm" variant="outline" className="rounded-xl text-xs gap-1.5">
                <ArrowsClockwise weight="bold" className="h-3.5 w-3.5" /> Retry
              </Button>
            </div>
          ) : filteredMyEvents.length === 0 ? (
            <div className="py-20 text-center max-w-sm mx-auto space-y-4">
              <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center mx-auto text-primary">
                <CalendarCheck weight="fill" className="h-7 w-7" />
              </div>
              <h3 className="text-lg font-bold text-foreground">No events yet</h3>
              <p className="text-sm text-muted-foreground">
                Create and publish events to engage your audience.
              </p>
              <Button
                onClick={() => setIsCreateEventOpen(true)}
                className="h-9 px-4 rounded-xl text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5"
              >
                <Plus weight="bold" className="h-3.5 w-3.5" /> Create First Event
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredMyEvents.map((event) => {
                const dateInfo = formatDateBadge(event.start_date);
                const badge = STATUS_BADGE_STYLE[event.status] ?? STATUS_BADGE_STYLE.completed;
                return (
                  <div
                    key={event.id}
                    className="p-4 sm:p-5 rounded-2xl border border-border/70 bg-card flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-primary/30 hover:shadow-sm transition-all"
                  >
                    <div className="flex items-start sm:items-center gap-3.5 min-w-0 flex-1">
                      <div className="h-16 w-24 rounded-xl bg-muted/60 overflow-hidden shrink-0 border border-border/60">
                        {event.cover_url ? (
                          <img src={event.cover_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-card">
                            <Calendar weight="duotone" className="h-6 w-6 text-primary/40" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 space-y-1 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Link
                            to={`/app/events/${event.id}`}
                            className="font-bold text-sm sm:text-base text-foreground hover:text-primary transition-colors truncate"
                          >
                            {event.title}
                          </Link>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badge.bg}`}>
                            {badge.label}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1 font-medium text-primary">
                            <Clock weight="fill" className="h-3.5 w-3.5 shrink-0" />
                            {dateInfo.weekdayTime}
                          </span>
                          <span className="flex items-center gap-1">
                            <Users weight="fill" className="h-3.5 w-3.5 shrink-0" />
                            {event.registration_count ?? 0}
                            {event.capacity ? ` / ${event.capacity}` : ""} registered
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-border/40 justify-end">
                      <Button asChild variant="outline" size="sm" className="h-8 px-3 rounded-lg text-xs font-semibold">
                        <Link to={`/app/events/${event.id}`}>View</Link>
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handlePublishToggle(event)}
                        className="h-8 px-3 rounded-lg text-xs font-semibold"
                      >
                        {event.status === "published" ? "Unpublish" : "Publish"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteEvent(event.id)}
                        className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        aria-label="Delete event"
                      >
                        <Trash weight="bold" className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          TAB 3 — LIVE VIDEO & AUDIO ROOMS
      ══════════════════════════════════════════════════ */}
      {activeTab === "live" && (
        <div className="space-y-8">
          {/* Active room (LiveKit) */}
          {selectedRoom && isVideoMode && (
            <div className="p-4 sm:p-5 rounded-2xl bg-card border border-primary/40 shadow-xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-border/60">
                <div className="flex items-center gap-2.5">
                  <span className="h-3 w-3 rounded-full bg-destructive animate-ping" />
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-foreground">{selectedRoom.title}</h2>
                    <p className="text-xs text-muted-foreground">
                      {selectedRoom.creator_id === user?.id ? "You are hosting" : "Viewer"}
                    </p>
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={() => setIsVideoMode(false)} className="rounded-xl text-xs font-bold">
                  Leave Room
                </Button>
              </div>
              <LiveKitVideoConference
                roomId={selectedRoom.id}
                roomTitle={selectedRoom.title}
                isHost={selectedRoom.creator_id === user?.id}
                onLeave={() => setIsVideoMode(false)}
              />
            </div>
          )}

          {/* Promo bar */}
          <div className="p-5 sm:p-6 rounded-2xl border border-border/70 bg-gradient-to-r from-primary/10 via-card to-card flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1 max-w-xl">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-destructive animate-pulse" />
                <span className="text-xs font-bold uppercase tracking-wider text-primary">Interactive Broadcasting</span>
              </div>
              <h2 className="text-lg sm:text-xl font-black text-foreground">
                Go live with HD video and real-time audio
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Connect directly with your followers, answer questions live, and record for your community.
              </p>
            </div>
            <div className="flex items-center gap-2.5 shrink-0">
              <Button
                variant="outline"
                onClick={() => { if (!isKycVerified) setShowKycRequiredModal(true); else setShowScheduleLiveModal(true); }}
                className="h-9 px-4 rounded-xl text-xs font-semibold"
              >
                <Calendar weight="fill" className="mr-1.5 h-3.5 w-3.5 text-primary" /> Schedule
              </Button>
              <Button
                onClick={handleOpenGoLive}
                className="h-9 px-4 rounded-xl text-xs font-semibold bg-destructive hover:bg-destructive/90 text-white gap-1.5"
              >
                <Radio weight="fill" className="h-3.5 w-3.5" /> Go Live Now
              </Button>
            </div>
          </div>

          {/* LIVE NOW */}
          <div className="space-y-4">
            <div className="flex items-center gap-2.5">
              <span className="h-3 w-3 rounded-full bg-destructive animate-pulse" />
              <h3 className="text-lg font-bold text-foreground">Live Now</h3>
              <span className="text-xs text-muted-foreground">({activeLiveRooms.length})</span>
            </div>
            {activeLiveRooms.length === 0 ? (
              <div className="p-8 text-center rounded-2xl border border-dashed border-border/70 bg-card/60 space-y-2">
                <Radio weight="fill" className="h-7 w-7 text-muted-foreground/50 mx-auto mb-1" />
                <p className="text-sm font-bold text-foreground">No creators are live right now</p>
                <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                  Start your own broadcast or check upcoming scheduled sessions below.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {activeLiveRooms.map((room) => (
                  <div key={room.id} className="rounded-2xl border border-destructive/30 bg-card p-5 space-y-4 flex flex-col justify-between">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-destructive text-white">
                          <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" /> LIVE
                        </span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Users weight="fill" className="h-3.5 w-3.5" />
                          {room.active_participants_count ?? 1} watching
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-muted overflow-hidden flex items-center justify-center font-bold text-foreground shrink-0 border border-border/60">
                          {room.creator?.avatar_url
                            ? <img src={room.creator.avatar_url} alt="" className="w-full h-full object-cover" />
                            : room.creator?.name?.charAt(0) || "C"}
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-foreground truncate">{room.creator?.name || "Host"}</h4>
                          <p className="text-[11px] text-muted-foreground">{room.started_at ? timeAgo(room.started_at) : "recently"}</p>
                        </div>
                      </div>
                      <h4 className="font-bold text-base text-foreground line-clamp-1">{room.title}</h4>
                    </div>
                    <Button
                      onClick={() => { setSelectedRoom(room); setIsVideoMode(true); }}
                      className="w-full h-9 rounded-xl text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5"
                    >
                      <Broadcast weight="bold" className="h-4 w-4" /> Join Live
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* UPCOMING */}
          <div className="space-y-4 pt-4 border-t border-border/40">
            <div className="flex items-center gap-2.5">
              <Calendar weight="fill" className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-bold text-foreground">Upcoming Live Sessions</h3>
              <span className="text-xs text-muted-foreground">({upcomingRooms.length})</span>
            </div>
            {upcomingRooms.length === 0 ? (
              <div className="p-8 text-center rounded-2xl border border-dashed border-border/70 bg-card/60 space-y-2">
                <Clock weight="fill" className="h-7 w-7 text-muted-foreground/50 mx-auto mb-1" />
                <p className="text-sm font-bold text-foreground">No upcoming sessions</p>
                <p className="text-xs text-muted-foreground max-w-xs mx-auto">Schedule in advance so your audience can RSVP.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {upcomingRooms.map((room) => (
                  <div key={room.id} className="rounded-2xl border border-border/70 bg-card p-5 space-y-3 flex flex-col justify-between hover:border-primary/30 transition-all">
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-secondary/20 text-secondary-foreground border border-border/60">
                          Scheduled
                        </span>
                        <span className="text-xs font-semibold text-primary">{formatDateTime(room.scheduled_at)}</span>
                      </div>
                      <h4 className="font-bold text-sm sm:text-base text-foreground line-clamp-1">{room.title}</h4>
                      {room.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2">{room.description}</p>
                      )}
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Users weight="fill" className="h-3.5 w-3.5 text-primary" />
                        {room.creator?.name || "Creator"}
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => {
                        if (room.creator_id === user?.id) { setSelectedRoom(room); setIsVideoMode(true); }
                      }}
                      className="w-full h-9 rounded-xl text-xs font-semibold"
                    >
                      {room.creator_id === user?.id ? "Start Broadcast" : "Notify Me"}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* PAST */}
          {pastRooms.length > 0 && (
            <div className="space-y-4 pt-4 border-t border-border/40">
              <div className="flex items-center gap-2.5">
                <Clock weight="fill" className="h-5 w-5 text-muted-foreground" />
                <h3 className="text-lg font-bold text-foreground">Past Sessions</h3>
                <span className="text-xs text-muted-foreground">({pastRooms.length})</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {pastRooms.slice(0, 6).map((room) => (
                  <div key={room.id} className="rounded-2xl border border-border/60 bg-card p-4 space-y-1.5 opacity-80 hover:opacity-100 transition-opacity">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Ended</span>
                      <span>{room.ended_at ? timeAgo(room.ended_at) : "Recently"}</span>
                    </div>
                    <h4 className="font-bold text-sm text-foreground line-clamp-1">{room.title}</h4>
                    <p className="text-xs text-muted-foreground">{room.creator?.name || "Creator"}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── CREATE EVENT MODAL ────────────────────────── */}
      <CreateEventModal
        open={isCreateEventOpen}
        onClose={() => setIsCreateEventOpen(false)}
        onCreated={() => { fetchEvents(); fetchMyEvents(); }}
      />

      {/* ── KYC GATE MODAL ───────────────────────────── */}
      {showKycRequiredModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md">
          <div className="border border-border/80 rounded-3xl bg-card p-6 sm:p-7 max-w-md w-full shadow-2xl space-y-6 relative">
            <button
              onClick={() => setShowKycRequiredModal(false)}
              className="absolute top-5 right-5 p-2 rounded-full hover:bg-muted text-muted-foreground"
            >
              <X weight="bold" className="h-5 w-5" />
            </button>
            <div className="space-y-2 pr-6">
              <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-1">
                <ShieldCheck weight="fill" className="h-6 w-6" />
              </div>
              <h2 className="text-xl font-black text-foreground">You can't go live yet</h2>
              <p className="text-sm text-muted-foreground">To broadcast on MurihSpace, complete identity verification:</p>
            </div>
            <div className="space-y-3.5">
              <div className="flex items-start gap-3">
                <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0 mt-0.5">
                  <Check weight="bold" className="h-3.5 w-3.5" />
                </div>
                <div className="text-sm font-semibold text-foreground pt-0.5">Account status is active</div>
              </div>
              <div className="flex items-start gap-3">
                <div className="h-6 w-6 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 mt-0.5 border border-amber-500/20">
                  <WarningCircle weight="fill" className="h-4 w-4" />
                </div>
                <div className="text-sm font-semibold text-foreground pt-0.5">Identity Verification (KYC) required</div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setShowKycRequiredModal(false)} className="text-xs h-10 px-4 rounded-xl">Dismiss</Button>
              <Link to="/app/kyc" className="flex-1 sm:flex-none">
                <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs h-10 px-5 rounded-xl gap-2">
                  <ShieldCheck weight="fill" className="h-4 w-4" /> Verify KYC Now
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ── LIVE STUDIO MODAL ────────────────────────── */}
      {showLiveStudioModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md overflow-y-auto">
          <div className="border border-border/80 rounded-3xl bg-card max-w-4xl w-full shadow-2xl overflow-hidden my-6">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border/60 bg-muted/20">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <VideoCamera weight="fill" className="h-5 w-5 text-primary" /> Live Video Studio
              </h3>
              <button onClick={() => setShowLiveStudioModal(false)} className="p-2 rounded-full hover:bg-muted text-muted-foreground">
                <X weight="bold" className="h-5 w-5" />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border/60">
              <div className="p-5 space-y-5 bg-muted/10">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border/60">
                  <div className="h-10 w-10 rounded-full bg-primary text-primary-foreground font-bold flex items-center justify-center shrink-0 overflow-hidden">
                    {user?.avatar_url ? <img src={user.avatar_url} alt="" className="w-full h-full object-cover" /> : user?.name?.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-xs font-bold text-foreground truncate">{user?.name}</h4>
                    <p className="text-[11px] text-muted-foreground">Host</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Destination</label>
                  <select
                    value={liveDestination}
                    onChange={(e) => setLiveDestination(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-card border border-border/70 text-foreground outline-none focus:ring-1 focus:ring-primary font-semibold"
                  >
                    <option value="profile">Your Profile &amp; Followers</option>
                    <option value="community">Community Feed</option>
                  </select>
                </div>
                <div className="space-y-2 pt-2 border-t border-border/40">
                  <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Stream Title</label>
                  <Input
                    value={liveTitle}
                    onChange={(e) => setLiveTitle(e.target.value)}
                    placeholder="e.g. Creator Q&amp;A session"
                    className="text-xs rounded-xl h-9"
                  />
                </div>
              </div>
              <div className="md:col-span-2 p-5 sm:p-6 space-y-6">
                <div>
                  <h2 className="text-xl font-black text-foreground">Welcome back, {user?.name?.split(" ")[0] ?? "Creator"}!</h2>
                  <p className="text-xs text-muted-foreground mt-1">Choose how you want to go live.</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="rounded-2xl border border-border/70 bg-card p-5 flex flex-col justify-between space-y-4 hover:border-primary/50 transition-all">
                    <div className="space-y-3">
                      <div className="h-12 w-12 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center">
                        <VideoCamera weight="fill" className="h-6 w-6" />
                      </div>
                      <h3 className="text-sm font-bold text-foreground">Start Live Broadcast</h3>
                      <ul className="space-y-2 text-xs text-muted-foreground">
                        <li className="flex items-start gap-2">
                          <Users weight="fill" className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                          <span>Stream live video directly to your followers</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <Globe weight="fill" className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                          <span>Choose where to publish your broadcast</span>
                        </li>
                      </ul>
                    </div>
                    <Button
                      onClick={handleStartLiveNow}
                      disabled={isSubmittingLive}
                      className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs h-10 rounded-xl gap-2"
                    >
                      {isSubmittingLive ? <Spinner weight="bold" className="h-4 w-4 animate-spin" /> : <Radio weight="fill" className="h-4 w-4" />}
                      Start Live Stream
                    </Button>
                  </div>
                  <div className="rounded-2xl border border-border/70 bg-card p-5 flex flex-col justify-between space-y-4 hover:border-primary/50 transition-all">
                    <div className="space-y-3">
                      <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                        <Calendar weight="fill" className="h-6 w-6" />
                      </div>
                      <h3 className="text-sm font-bold text-foreground">Schedule Live Session</h3>
                      <ul className="space-y-2 text-xs text-muted-foreground">
                        <li className="flex items-start gap-2">
                          <Calendar weight="fill" className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                          <span>Announce your broadcast date and time</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <Check weight="bold" className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                          <span>Collect RSVPs and send reminders</span>
                        </li>
                      </ul>
                    </div>
                    <Button
                      onClick={() => { setShowLiveStudioModal(false); setShowScheduleLiveModal(true); }}
                      variant="outline"
                      className="w-full font-bold text-xs h-10 rounded-xl"
                    >
                      Schedule Session
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── SCHEDULE LIVE MODAL ──────────────────────── */}
      {showScheduleLiveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md">
          <div className="border border-border/80 rounded-3xl bg-card p-6 sm:p-7 max-w-lg w-full shadow-2xl space-y-5 relative">
            <button
              onClick={() => setShowScheduleLiveModal(false)}
              className="absolute top-5 right-5 p-2 rounded-full hover:bg-muted text-muted-foreground"
            >
              <X weight="bold" className="h-5 w-5" />
            </button>
            <div className="space-y-1 pr-6">
              <h3 className="text-lg font-bold text-foreground">Schedule Live Video Session</h3>
              <p className="text-xs text-muted-foreground">Set a date and time to broadcast to your community.</p>
            </div>
            <form onSubmit={handleScheduleLiveSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-foreground uppercase tracking-wider">Session Title *</label>
                <Input value={schedTitle} onChange={(e) => setSchedTitle(e.target.value)} required placeholder="e.g. Creator Q&A &amp; Community Chat" className="text-xs h-10 rounded-xl" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-foreground uppercase tracking-wider">Description</label>
                <textarea
                  value={schedDesc}
                  onChange={(e) => setSchedDesc(e.target.value)}
                  rows={3}
                  placeholder="What will you discuss?"
                  className="w-full p-3 text-xs rounded-xl bg-card border border-border/70 outline-none focus:ring-1 focus:ring-primary resize-none"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-foreground uppercase tracking-wider">Date &amp; Time *</label>
                  <Input type="datetime-local" value={schedDateTime} onChange={(e) => setSchedDateTime(e.target.value)} required className="text-xs h-10 rounded-xl" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-foreground uppercase tracking-wider">Participant Limit</label>
                  <Input type="number" value={schedMaxParticipants} onChange={(e) => setSchedMaxParticipants(e.target.value)} placeholder="Unlimited" className="text-xs h-10 rounded-xl" />
                </div>
              </div>
              <div className="flex justify-end gap-2.5 pt-2">
                <Button type="button" variant="outline" onClick={() => setShowScheduleLiveModal(false)} className="text-xs h-9 px-4 rounded-xl">Cancel</Button>
                <Button type="submit" disabled={isSubmittingLive} className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs h-9 rounded-xl px-5">
                  {isSubmittingLive ? <Spinner weight="bold" className="h-4 w-4 animate-spin" /> : "Schedule Session"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default EventsPage;
