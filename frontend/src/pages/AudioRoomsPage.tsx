import { getAuthToken } from "@/lib/auth/token";
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Link } from 'react-router';
import {
  Video,
  Radio,
  Calendar,
  Clock,
  Users,
  Loader2,
  Play,
  LogIn,
  ShieldCheck,
  AlertCircle,
  X,
  Check,
  UserCheck,
  Globe,
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LiveKitVideoConference } from "@/components/video/LiveKitVideoConference";
import { authFetch } from "@/lib/api/authFetch";
import { safeArray } from "@/lib/api/cacheStore";
import { PageHeader } from "@/components/ui/PageHeader";
import { ActionTooltip } from "@/components/ui/action-tooltip";

function formatDateTime(iso: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

interface User {
  id: number; name: string; username: string; avatar_url: string | null;
}

interface Participant {
  id: number; user_id: number; role: string; is_muted: boolean; is_hand_raised: boolean;
  joined_at: string; user?: User;
}

interface AudioRoom {
  id: number; community_id: number | null; creator_id: number;
  title: string; description: string | null; cover_url: string | null;
  status: string; scheduled_at: string | null; started_at: string | null;
  ended_at: string | null; max_participants: number | null;
  is_recorded: boolean; recording_url: string | null;
  creator?: User; community?: { id: number; name: string; slug: string };
  active_participants_count?: number;
  participants?: Participant[];
}

type Tab = 'upcoming' | 'live' | 'past' | 'my-rooms';

const STATUS_BADGE: Record<string, { color: string; label: string }> = {
  live: { color: 'bg-destructive/10 text-destructive border-destructive/20', label: 'LIVE' },
  scheduled: { color: 'bg-secondary/10 text-secondary border-secondary/20', label: 'Scheduled' },
  ended: { color: 'bg-muted text-muted-foreground border-border', label: 'Ended' },
  cancelled: { color: 'bg-destructive/10 text-destructive border-destructive/20', label: 'Cancelled' },
};

function RoomCard({ room, onAction, currentUserId }: { room: AudioRoom; onAction: (action: string, room: AudioRoom) => void; currentUserId: number | null }) {
  const badge = STATUS_BADGE[room.status] ?? STATUS_BADGE.ended;

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-xs hover:shadow-md hover:border-[#1877f2]/30 transition-all duration-200 p-5 flex flex-col justify-between">
      <div>
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            {room.status === 'live' && <span className="h-2.5 w-2.5 rounded-full bg-destructive animate-pulse shrink-0" />}
            <h3 className="text-sm font-bold text-foreground truncate">{room.title}</h3>
          </div>
          <span className={`shrink-0 text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${badge.color}`}>
            {badge.label}
          </span>
        </div>

        {room.description && <p className="text-xs text-muted-foreground line-clamp-2 mb-3 leading-relaxed">{room.description}</p>}

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground mb-3 font-medium">
          {room.community && (
            <span className="flex items-center gap-1"><Radio className="h-3 w-3 text-[#1877f2]" />{room.community.name}</span>
          )}
          {room.scheduled_at && room.status !== 'live' && (
            <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{formatDateTime(room.scheduled_at)}</span>
          )}
          {room.started_at && (
            <span className="flex items-center gap-1"><Clock className="h-3 w-3" />Started {timeAgo(room.started_at)}</span>
          )}
          <span className="flex items-center gap-1"><Users className="h-3 w-3" />{room.active_participants_count ?? 0}{room.max_participants ? `/${room.max_participants}` : ''}</span>
        </div>
      </div>

      <div>
        {room.creator && (
          <div className="flex items-center gap-2 mb-3 pt-2 border-t border-border/50">
            <div className="h-6 w-6 rounded-full bg-[#1877f2] text-white text-[9px] font-black flex items-center justify-center shrink-0 overflow-hidden">
              {room.creator.avatar_url ? <img src={room.creator.avatar_url} alt="" className="w-full h-full object-cover" /> : room.creator.name.charAt(0)}
            </div>
            <span className="text-[11px] font-bold text-foreground">by {room.creator.name}</span>
          </div>
        )}

        <div className="flex items-center gap-2">
          {room.status === 'scheduled' && (
            <Button onClick={() => onAction('join', room)} variant="outline" size="sm" className="flex-1 gap-1.5 text-xs font-bold rounded-xl">
              <LogIn className="h-3.5 w-3.5" /> Join When Live
            </Button>
          )}
          {room.status === 'live' && (
            <Button onClick={() => onAction('join', room)} size="sm" className="flex-1 gap-1.5 text-xs font-bold rounded-xl bg-destructive text-white hover:bg-destructive/90 animate-pulse">
              <Video className="h-3.5 w-3.5" /> Join Live Video
            </Button>
          )}
          {room.status === 'scheduled' && room.creator_id === currentUserId && (
            <Button onClick={() => onAction('start', room)} variant="ghost" size="sm" className="p-2 rounded-xl">
              <Play className="h-4 w-4 text-[#1877f2]" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export function AudioRoomsPage() {
  const { user } = useAuth();
  const isKycVerified = user?.kyc_status === 'verified';

  const [tab, setTab] = useState<Tab>('upcoming');
  const [rooms, setRooms] = useState<AudioRoom[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  // Modals state
  const [showKycRequiredModal, setShowKycRequiredModal] = useState(false);
  const [showLiveStudioModal, setShowLiveStudioModal] = useState(false);
  const [showEventForm, setShowEventForm] = useState(false);

  // Live Studio & Event Form State
  const [destination, setDestination] = useState('profile');
  const [fTitle, setFTitle] = useState('');
  const [fDesc, setFDesc] = useState('');
  const [fScheduledAt, setFScheduledAt] = useState('');
  const [fMaxParticipants, setFMaxParticipants] = useState('');
  const [fCoverUrl, setFCoverUrl] = useState('');

  // Active Stream Detail
  const [selectedRoom, setSelectedRoom] = useState<AudioRoom | null>(null);
  const [isVideoMode, setIsVideoMode] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchRooms = useCallback(async (activeTab: Tab) => {
    setIsLoading(true);
    const token = getAuthToken();
    try {
      let url = `/audio-rooms`;
      if (activeTab === 'my-rooms') {
        url = `/audio-rooms/my-rooms`;
      } else if (activeTab === 'live') {
        url = `/audio-rooms?status=live`;
      } else if (activeTab === 'upcoming') {
        url = `/audio-rooms?status=scheduled`;
      } else if (activeTab === 'past') {
        url = `/audio-rooms?status=ended`;
      }

      const res = await authFetch(url, {
        headers: { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });

      if (res.ok) {
        const json = await res.json();
        const items = safeArray<AudioRoom>(json);
        setRooms(items);
      } else {
        setRooms([]);
      }
    } catch {
      setRooms([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRooms(tab);
  }, [tab, fetchRooms]);

  const handleOpenGoLive = () => {
    if (!isKycVerified) {
      setShowKycRequiredModal(true);
    } else {
      setShowLiveStudioModal(true);
    }
  };

  const handleOpenScheduleEvent = () => {
    if (!isKycVerified) {
      setShowKycRequiredModal(true);
    } else {
      setShowEventForm(true);
    }
  };

  const handleStartLiveNow = async () => {
    if (!isKycVerified) return;
    setIsSubmitting(true);
    setErrorNotice(null);
    const token = getAuthToken();
    try {
      const body = {
        title: fTitle.trim() || `${user?.name ?? 'Creator'}'s Live Video Stream`,
        description: fDesc || null,
        scheduled_at: null,
      };

      const res = await authFetch('/audio-rooms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? 'Failed to start live stream.');

      const roomData = json.data ?? json;
      await authFetch(`/audio-rooms/${roomData.id}/start`, {
        method: 'POST',
        headers: { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });

      setShowLiveStudioModal(false);
      setSelectedRoom({ ...roomData, status: 'live' });
      setIsVideoMode(true);
      fetchRooms(tab);
    } catch (err: any) {
      setErrorNotice(err instanceof Error ? err.message : 'Could not launch live video broadcast.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateEventSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isKycVerified) return;
    setIsSubmitting(true);
    setErrorNotice(null);
    const token = getAuthToken();
    try {
      const body = {
        title: fTitle.trim(),
        description: fDesc || null,
        scheduled_at: fScheduledAt || null,
        max_participants: fMaxParticipants ? parseInt(fMaxParticipants) : null,
        cover_url: fCoverUrl || null,
      };

      const res = await authFetch('/audio-rooms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? 'Failed to schedule event.');

      setShowEventForm(false);
      setFTitle(''); setFDesc(''); setFScheduledAt(''); setFMaxParticipants(''); setFCoverUrl('');
      fetchRooms(tab);
    } catch (err: any) {
      setErrorNotice(err instanceof Error ? err.message : 'Could not schedule event.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRoomAction = (action: string, room: AudioRoom) => {
    if (action === 'join' || action === 'start') {
      setSelectedRoom(room);
      setIsVideoMode(true);
    }
  };

  return (
    <div className="space-y-6 w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <PageHeader 
        title="Go Live & Video Events"
        description="Broadcast live video, interact with your audience in real-time, or schedule upcoming video events."
        icon={<Video className="h-6 w-6 text-[#1877f2]" />}
        action={
          <div className="flex items-center gap-2 shrink-0">
            <ActionTooltip content={!isKycVerified ? "Identity verification (KYC) is required to go live." : "Schedule a future video event"}>
              <Button
                onClick={handleOpenScheduleEvent}
                variant="outline"
                className="font-bold h-10 px-4 rounded-xl text-xs gap-1.5"
              >
                <Calendar className="h-4 w-4 text-[#1877f2]" /> Schedule Event
              </Button>
            </ActionTooltip>

            <ActionTooltip content={!isKycVerified ? "Identity verification (KYC) is required to go live." : "Start a live video stream right now"}>
              <Button
                onClick={handleOpenGoLive}
                className="bg-destructive hover:bg-destructive/90 text-white font-bold h-10 px-4 rounded-xl text-xs gap-1.5 shadow-xs animate-pulse"
              >
                <Radio className="h-4 w-4" /> Go Live Now
              </Button>
            </ActionTooltip>
          </div>
        }
      />

      {errorNotice && (
        <div className="p-4 rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive text-xs font-bold flex items-center justify-between">
          <span>{errorNotice}</span>
          <button onClick={() => setErrorNotice(null)} className="text-foreground hover:opacity-80">Close</button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none border-b border-border">
        {(['upcoming', 'live', 'past', 'my-rooms'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all capitalize whitespace-nowrap ${
              tab === t
                ? 'border-[#1877f2] text-[#1877f2]'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t === 'my-rooms' ? 'My Streams & Events' : t}
          </button>
        ))}
      </div>

      {/* Live Conference View if active */}
      {selectedRoom && isVideoMode && (
        <div className="p-4 rounded-2xl bg-card border border-border space-y-4 shadow-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-destructive animate-ping" />
              <h2 className="text-base font-bold text-foreground">{selectedRoom.title}</h2>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setIsVideoMode(false)} className="rounded-xl text-xs font-bold">
              Leave Studio
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

      {/* Grid or Empty State */}
      {isLoading ? (
        <div className="py-20 text-center space-y-2">
          <Loader2 className="h-8 w-8 animate-spin text-[#1877f2] mx-auto" />
          <p className="text-xs text-muted-foreground font-medium">Loading live video streams…</p>
        </div>
      ) : safeArray(rooms).length === 0 ? (
        <div className="p-16 text-center border border-dashed border-border rounded-3xl bg-card space-y-3 flex flex-col items-center justify-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Radio className="h-6 w-6 text-[#1877f2]" />
          </div>
          <h3 className="text-sm font-bold text-foreground text-center">No live streams right now</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto text-center">
            Start a live video broadcast or check back later for scheduled community video events.
          </p>
          <div className="pt-2 flex justify-center gap-3">
            <Button
              onClick={handleOpenGoLive}
              className="bg-[#1877f2] hover:bg-[#166fe5] text-white font-bold text-xs rounded-xl h-9 px-4"
            >
              Start Live Video
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {safeArray<AudioRoom>(rooms).map((r) => (
            <RoomCard key={r.id} room={r} onAction={handleRoomAction} currentUserId={user?.id ?? null} />
          ))}
        </div>
      )}

      {/* ── KYC Requirement Modal ("You can't go live yet") - Facebook / TikTok style ── */}
      {showKycRequiredModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md">
          <div className="border border-border rounded-3xl bg-card p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-6 animate-in zoom-in-95 duration-200 relative">
            {/* Top-right close button */}
            <button
              onClick={() => setShowKycRequiredModal(false)}
              className="absolute top-5 right-5 p-2 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Close modal"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="space-y-2 pr-6">
              <h2 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">You can't go live yet</h2>
              <p className="text-xs sm:text-sm text-muted-foreground font-medium">
                To start a live video stream, you need to meet these requirements:
              </p>
            </div>

            <div className="space-y-4 py-1">
              {/* Req 1: Account status active */}
              <div className="flex items-start gap-3">
                <div className="h-6 w-6 rounded-full bg-[#1877f2] text-white flex items-center justify-center shrink-0 mt-0.5">
                  <Check className="h-3.5 w-3.5 stroke-[3]" />
                </div>
                <div className="text-xs font-semibold text-foreground pt-0.5">
                  Your account status is active
                </div>
              </div>

              {/* Req 2: KYC Identity Verification */}
              <div className="flex items-start gap-3">
                <div className="h-6 w-6 rounded-full bg-muted border border-border text-foreground flex items-center justify-center shrink-0 mt-0.5">
                  <AlertCircle className="h-4 w-4 text-amber-500" />
                </div>
                <div className="text-xs font-semibold text-foreground pt-0.5">
                  Your account must be Identity Verified (KYC)
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setShowKycRequiredModal(false)}
                className="text-xs font-bold h-10 px-5 rounded-xl flex-1 sm:flex-none"
              >
                Learn more
              </Button>
              <Link to="/app/kyc" className="flex-1 sm:flex-none">
                <Button
                  className="w-full bg-[#1877f2] hover:bg-[#166fe5] text-white font-bold text-xs h-10 px-6 rounded-xl gap-2"
                >
                  <ShieldCheck className="h-4 w-4" /> Verify KYC Now
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ── Facebook Style Live Video Setup Studio Modal ── */}
      {showLiveStudioModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md overflow-y-auto">
          <div className="border border-border rounded-3xl bg-card max-w-4xl w-full shadow-2xl overflow-hidden my-6">
            {/* Header bar */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/20">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <Video className="h-5 w-5 text-[#1877f2]" /> Create Live Video
              </h3>
              <button
                onClick={() => setShowLiveStudioModal(false)}
                className="p-2 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border">
              {/* Left sidebar: Host profile & Destination */}
              <div className="p-6 space-y-6 bg-muted/10">
                <div className="flex items-center gap-3 p-3 rounded-2xl bg-card border border-border shadow-xs">
                  <div className="h-10 w-10 rounded-full bg-[#1877f2] text-white font-bold flex items-center justify-center shrink-0 overflow-hidden">
                    {user?.avatar_url ? <img src={user.avatar_url} alt="" className="w-full h-full object-cover" /> : user?.name?.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-xs font-bold text-foreground truncate">{user?.name}</h4>
                    <p className="text-[10px] text-muted-foreground">Host — Your profile</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                    Choose where live video should be posted
                  </label>
                  <select
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-card border border-border outline-none focus:ring-1 focus:ring-[#1877f2] font-semibold"
                  >
                    <option value="profile">Post on profile</option>
                    <option value="community">Post to community feed</option>
                  </select>
                </div>

                <div className="space-y-2 pt-4 border-t border-border">
                  <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                    Stream Title (Optional)
                  </label>
                  <Input
                    value={fTitle}
                    onChange={(e) => setFTitle(e.target.value)}
                    placeholder="What is your live stream about?"
                    className="text-xs rounded-xl h-9"
                  />
                </div>
              </div>

              {/* Main right area: Choose Broadcast option */}
              <div className="md:col-span-2 p-6 sm:p-8 space-y-6">
                <div className="space-y-1">
                  <h2 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
                    Welcome back, {user?.name?.split(' ')[0] ?? 'Creator'}!
                  </h2>
                  <p className="text-xs text-muted-foreground">Choose how you want to go live.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  {/* Option 1: Start Live Broadcast */}
                  <div className="border border-border rounded-2xl bg-card p-6 flex flex-col justify-between space-y-4 hover:border-[#1877f2]/50 transition-all shadow-xs">
                    <div className="space-y-3">
                      <div className="h-12 w-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
                        <Video className="h-6 w-6" />
                      </div>
                      <h3 className="text-sm font-bold text-foreground">Start live broadcast</h3>
                      <ul className="space-y-2 text-xs text-muted-foreground">
                        <li className="flex items-start gap-2">
                          <Users className="h-3.5 w-3.5 text-[#1877f2] shrink-0 mt-0.5" />
                          <span>Going live alone or together with guests</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <Globe className="h-3.5 w-3.5 text-[#1877f2] shrink-0 mt-0.5" />
                          <span>Choose where you want to publish your live video</span>
                        </li>
                      </ul>
                    </div>

                    <Button
                      onClick={handleStartLiveNow}
                      disabled={isSubmitting}
                      className="w-full bg-[#1877f2] hover:bg-[#166fe5] text-white font-bold text-xs h-10 rounded-xl gap-2"
                    >
                      {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Radio className="h-4 w-4" />}
                      Setting up live video
                    </Button>
                  </div>

                  {/* Option 2: Create Live Event */}
                  <div className="border border-border rounded-2xl bg-card p-6 flex flex-col justify-between space-y-4 hover:border-[#1877f2]/50 transition-all shadow-xs">
                    <div className="space-y-3">
                      <div className="h-12 w-12 rounded-full bg-[#1877f2]/10 text-[#1877f2] flex items-center justify-center">
                        <Calendar className="h-6 w-6" />
                      </div>
                      <h3 className="text-sm font-bold text-foreground">Create a live video event</h3>
                      <ul className="space-y-2 text-xs text-muted-foreground">
                        <li className="flex items-start gap-2">
                          <Calendar className="h-3.5 w-3.5 text-[#1877f2] shrink-0 mt-0.5" />
                          <span>Schedule an event to share with your audience in advance</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <UserCheck className="h-3.5 w-3.5 text-[#1877f2] shrink-0 mt-0.5" />
                          <span>Viewers can RSVP to receive instant reminders</span>
                        </li>
                      </ul>
                    </div>

                    <Button
                      onClick={() => { setShowLiveStudioModal(false); setShowEventForm(true); }}
                      variant="outline"
                      className="w-full font-bold text-xs h-10 rounded-xl"
                    >
                      Create Event
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Schedule Event Modal ── */}
      {showEventForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md">
          <div className="border border-border rounded-3xl bg-card p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-foreground">Schedule Live Video Event</h3>
            <form onSubmit={handleCreateEventSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-foreground uppercase tracking-wider">Event Title *</label>
                <Input value={fTitle} onChange={(e) => setFTitle(e.target.value)} required placeholder="e.g. Creator Q&A & Product Launch" className="text-xs h-10 rounded-xl" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-foreground uppercase tracking-wider">Description</label>
                <textarea value={fDesc} onChange={(e) => setFDesc(e.target.value)} rows={3} placeholder="What will be discussed during this live video?" className="w-full p-3 text-xs rounded-xl bg-muted border-0 outline-none focus:ring-1 focus:ring-[#1877f2] resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-foreground uppercase tracking-wider">Date & Time *</label>
                  <Input type="datetime-local" value={fScheduledAt} onChange={(e) => setFScheduledAt(e.target.value)} required className="text-xs h-10 rounded-xl" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-foreground uppercase tracking-wider">Max Participants</label>
                  <Input type="number" value={fMaxParticipants} onChange={(e) => setFMaxParticipants(e.target.value)} placeholder="Unlimited" className="text-xs h-10 rounded-xl" />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setShowEventForm(false)} className="text-xs">Cancel</Button>
                <Button type="submit" disabled={isSubmitting} className="bg-[#1877f2] hover:bg-[#166fe5] text-white font-bold text-xs h-10 rounded-xl px-5">
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Schedule Event'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
export default AudioRoomsPage;
