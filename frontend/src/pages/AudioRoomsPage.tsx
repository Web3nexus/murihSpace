import { useState, useEffect, useCallback } from 'react';
import { Mic, Radio, Calendar, Clock, Users, Loader2, Plus, Play, StopCircle, LogIn, LogOut, Hand, MicOff, Speaker, Star, AlertCircle, X, Check, Trash2 } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1';

function getAuthHeaders() {
  const token = localStorage.getItem('murihspace-token');
  return {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

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
  live: { color: 'bg-red-500/15 text-red-600 border-red-500/30', label: 'LIVE' },
  scheduled: { color: 'bg-blue-500/15 text-blue-600 border-blue-500/30', label: 'Scheduled' },
  ended: { color: 'bg-muted text-muted-foreground border-border', label: 'Ended' },
  cancelled: { color: 'bg-destructive/10 text-destructive border-destructive/20', label: 'Cancelled' },
};

function RoomCard({ room, onAction }: { room: AudioRoom; onAction: (action: string, room: AudioRoom) => void }) {
  const badge = STATUS_BADGE[room.status] ?? STATUS_BADGE.ended;

  return (
    <div className="rounded-2xl border border-border bg-card p-5 flex flex-col">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          {room.status === 'live' && <span className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse shrink-0" />}
          <h3 className="text-sm font-extrabold text-foreground truncate">{room.title}</h3>
        </div>
        <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border ${badge.color}`}>
          {badge.label}
        </span>
      </div>

      {room.description && <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{room.description}</p>}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground mb-3">
        {room.community && (
          <span className="flex items-center gap-1"><Radio className="h-3 w-3" />{room.community.name}</span>
        )}
        {room.scheduled_at && room.status !== 'live' && (
          <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{formatDateTime(room.scheduled_at)}</span>
        )}
        {room.started_at && (
          <span className="flex items-center gap-1"><Clock className="h-3 w-3" />Started {timeAgo(room.started_at)}</span>
        )}
        <span className="flex items-center gap-1"><Users className="h-3 w-3" />{room.active_participants_count ?? 0}{room.max_participants ? `/${room.max_participants}` : ''}</span>
      </div>

      {room.creator && (
        <div className="flex items-center gap-2 mb-3">
          <div className="h-6 w-6 rounded-full bg-gradient-to-br from-primary to-secondary text-white text-[8px] font-bold flex items-center justify-center shrink-0">
            {room.creator.name.charAt(0)}
          </div>
          <span className="text-[11px] font-medium text-muted-foreground">by {room.creator.name}</span>
        </div>
      )}

      <div className="flex items-center gap-2 mt-auto">
        {room.status === 'scheduled' && (
          <button onClick={() => onAction('join', room)} className="flex-1 py-2 rounded-xl bg-secondary text-secondary-foreground font-bold text-xs hover:bg-secondary/90 transition-all flex items-center justify-center gap-1.5">
            <LogIn className="h-3 w-3" /> Join When Live
          </button>
        )}
        {room.status === 'live' && (
          <button onClick={() => onAction('join', room)} className="flex-1 py-2 rounded-xl bg-red-500 text-white font-bold text-xs hover:bg-red-600 transition-all flex items-center justify-center gap-1.5 animate-pulse">
            <Mic className="h-3 w-3" /> Join Live
          </button>
        )}
        {room.status === 'scheduled' && room.creator_id === 0 && (
          <button onClick={() => onAction('start', room)} className="p-2 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground">
            <Play className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

export function AudioRoomsPage() {
  const [tab, setTab] = useState<Tab>('upcoming');
  const [rooms, setRooms] = useState<AudioRoom[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form
  const [showForm, setShowForm] = useState(false);
  const [fTitle, setFTitle] = useState('');
  const [fDesc, setFDesc] = useState('');
  const [fScheduledAt, setFScheduledAt] = useState('');
  const [fMaxParticipants, setFMaxParticipants] = useState('');
  const [fCoverUrl, setFCoverUrl] = useState('');

  // Detail
  const [selectedRoom, setSelectedRoom] = useState<AudioRoom | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchRooms = useCallback(async (activeTab: Tab) => {
    setIsLoading(true);
    try {
      let url = `${API_BASE}/audio-rooms`;
      if (activeTab === 'my-rooms') {
        url = `${API_BASE}/audio-rooms/my-rooms`;
      } else {
        const statusMap: Record<string, string> = { upcoming: 'scheduled', live: 'live', past: 'ended' };
        url += `?status=${statusMap[activeTab] ?? 'scheduled'}`;
      }
      const res = await fetch(url, { headers: getAuthHeaders() });
      if (res.ok) {
        const json = await res.json();
        setRooms(json.data ?? []);
      }
    } catch { /* silent */ }
    setIsLoading(false);
  }, []);

  useEffect(() => { fetchRooms(tab); }, [tab, fetchRooms]);

  const resetForm = () => {
    setFTitle(''); setFDesc(''); setFScheduledAt(''); setFMaxParticipants(''); setFCoverUrl('');
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage(null);
    try {
      const res = await fetch(`${API_BASE}/audio-rooms`, {
        method: 'POST', headers: getAuthHeaders(),
        body: JSON.stringify({
          title: fTitle,
          description: fDesc || null,
          scheduled_at: fScheduledAt || null,
          max_participants: fMaxParticipants ? parseInt(fMaxParticipants) : null,
          cover_url: fCoverUrl || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? 'Failed to create room.');
      setShowForm(false);
      resetForm();
      setMessage({ type: 'success', text: 'Audio room created!' });
      fetchRooms(tab);
    } catch (err: unknown) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'An error occurred.' });
    }
    setIsSubmitting(false);
  };

  const handleAction = async (action: string, room: AudioRoom) => {
    setMessage(null);
    try {
      const actions: Record<string, { url: string; method: string }> = {
        start: { url: `${API_BASE}/audio-rooms/${room.id}/start`, method: 'POST' },
        end: { url: `${API_BASE}/audio-rooms/${room.id}/end`, method: 'POST' },
        join: { url: `${API_BASE}/audio-rooms/${room.id}/join`, method: 'POST' },
        leave: { url: `${API_BASE}/audio-rooms/${room.id}/leave`, method: 'POST' },
        delete: { url: `${API_BASE}/audio-rooms/${room.id}`, method: 'DELETE' },
      };
      const act = actions[action];
      if (!act) return;

      if (action === 'delete' && !confirm('Delete this room?')) return;

      const res = await fetch(act.url, { method: act.method, headers: getAuthHeaders() });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? 'Action failed.');
      setMessage({ type: 'success', text: json.message ?? 'Done.' });
      fetchRooms(tab);
      if (action === 'join') {
        setSelectedRoom(room);
        fetchRoomDetail(room.id);
      }
    } catch (err: unknown) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Action failed.' });
    }
  };

  const fetchRoomDetail = async (id: number) => {
    try {
      const res = await fetch(`${API_BASE}/audio-rooms/${id}`, { headers: getAuthHeaders() });
      if (res.ok) {
        const json = await res.json();
        setSelectedRoom(json.data);
      }
    } catch { /* silent */ }
  };

  const handleRoleChange = async (roomId: number, userId: number, role: string) => {
    try {
      const res = await fetch(`${API_BASE}/audio-rooms/${roomId}/users/${userId}/role`, {
        method: 'POST', headers: getAuthHeaders(),
        body: JSON.stringify({ role }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? 'Failed.');
      setMessage({ type: 'success', text: json.message });
      fetchRoomDetail(roomId);
    } catch (err: unknown) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed.' });
    }
  };

  const handleMuteToggle = async (roomId: number, userId: number) => {
    try {
      const res = await fetch(`${API_BASE}/audio-rooms/${roomId}/users/${userId}/mute`, {
        method: 'POST', headers: getAuthHeaders(),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? 'Failed.');
      setMessage({ type: 'success', text: json.message });
      fetchRoomDetail(roomId);
    } catch (err: unknown) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed.' });
    }
  };

  const handleRaiseHand = async (roomId: number) => {
    try {
      const res = await fetch(`${API_BASE}/audio-rooms/${roomId}/raise-hand`, {
        method: 'POST', headers: getAuthHeaders(),
      });
      const json = await res.json();
      setMessage({ type: 'success', text: json.message });
      fetchRoomDetail(roomId);
    } catch (err: unknown) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed.' });
    }
  };

  const currentUser = (() => {
    try {
      const token = localStorage.getItem('murihspace-token');
      if (!token) return null;
      const payload = JSON.parse(atob(token.split('.')[1]));
      return { id: payload.sub ?? payload.id ?? 0, name: payload.name ?? '' };
    } catch { return null; }
  })();

  const ROLE_ICONS: Record<string, React.ReactNode> = {
    host: <Star className="h-3 w-3 text-amber-500" />,
    co_host: <Star className="h-3 w-3 text-blue-400" />,
    speaker: <Speaker className="h-3 w-3 text-secondary" />,
    listener: <Users className="h-3 w-3 text-muted-foreground" />,
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: 'upcoming', label: 'Upcoming' },
    { key: 'live', label: 'Live Now' },
    { key: 'past', label: 'Past Rooms' },
    { key: 'my-rooms', label: 'My Rooms' },
  ];

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-foreground tracking-tight flex items-center gap-2.5">
            <Radio className="h-6 w-6 text-secondary" />
            Audio Rooms
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Live audio conversations — start a room, invite speakers, and engage your audience in real time.
          </p>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-secondary text-secondary-foreground font-bold text-xs hover:bg-secondary/90 transition-all shrink-0"
        >
          <Plus className="h-3.5 w-3.5" /> Schedule Room
        </button>
      </div>

      {/* Message */}
      {message && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-xs font-medium ${message.type === 'success' ? 'bg-green-500/10 text-green-600' : 'bg-destructive/10 text-destructive'}`}>
          {message.type === 'success' ? <Check className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          <span className="flex-1">{message.text}</span>
          <button onClick={() => setMessage(null)} className="p-0.5 hover:opacity-70"><X className="h-3.5 w-3.5" /></button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setSelectedRoom(null); }}
            className={`px-4 py-2 text-xs font-bold whitespace-nowrap border-b-2 transition-all ${
              tab === t.key ? 'border-secondary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Room List */}
      {!selectedRoom && (
        <div className="space-y-4">
          {isLoading ? (
            <div className="py-20 text-center"><Loader2 className="h-6 w-6 animate-spin text-secondary mx-auto" /></div>
          ) : rooms.length === 0 ? (
            <div className="p-12 text-center border border-dashed border-border rounded-3xl bg-card space-y-3">
              <Radio className="h-10 w-10 text-muted-foreground/30 mx-auto" />
              <h3 className="text-sm font-bold text-foreground">
                {tab === 'live' ? 'No live rooms right now' :
                 tab === 'upcoming' ? 'No upcoming rooms' :
                 tab === 'past' ? 'No past rooms' :
                 'You haven\'t created any rooms yet'}
              </h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                {tab === 'my-rooms' ? 'Schedule your first audio room to connect with your community live.' :
                 tab === 'live' ? 'Check back later or browse upcoming scheduled rooms.' :
                 'Scheduled rooms will appear here.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {rooms.map((r) => (
                <RoomCard key={r.id} room={r} onAction={(action, room) => {
                  if (action === 'join' && room.status === 'live') {
                    setSelectedRoom(room);
                    fetchRoomDetail(room.id);
                  } else {
                    handleAction(action, room);
                  }
                }} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Room Detail (Live Room Experience) */}
      {selectedRoom && (
        <div className="space-y-4">
          <button onClick={() => setSelectedRoom(null)} className="text-xs font-semibold text-muted-foreground hover:text-foreground flex items-center gap-1">
            ← Back to rooms
          </button>

          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            {selectedRoom.cover_url && (
              <div className="h-40 bg-gradient-to-r from-primary to-secondary overflow-hidden">
                <img src={selectedRoom.cover_url} alt="" className="w-full h-full object-cover" />
              </div>
            )}
            <div className="p-6 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    {selectedRoom.status === 'live' && <span className="h-3 w-3 rounded-full bg-red-500 animate-pulse" />}
                    <h2 className="text-xl font-black text-foreground">{selectedRoom.title}</h2>
                  </div>
                  <span className={`inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${(STATUS_BADGE[selectedRoom.status] ?? STATUS_BADGE.ended).color}`}>
                    {(STATUS_BADGE[selectedRoom.status] ?? STATUS_BADGE.ended).label}
                  </span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {selectedRoom.creator_id === currentUser?.id && selectedRoom.status === 'scheduled' && (
                    <>
                      <button onClick={() => handleAction('start', selectedRoom)} className="px-4 py-2 rounded-xl bg-emerald-500 text-white font-bold text-xs hover:bg-emerald-600 flex items-center gap-1.5">
                        <Play className="h-3.5 w-3.5" /> Start Room
                      </button>
                      <button onClick={() => handleAction('delete', selectedRoom)} className="p-2 rounded-xl hover:bg-destructive/10 text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </>
                  )}
                  {selectedRoom.creator_id === currentUser?.id && selectedRoom.status === 'live' && (
                    <button onClick={() => handleAction('end', selectedRoom)} className="px-4 py-2 rounded-xl bg-red-500 text-white font-bold text-xs hover:bg-red-600 flex items-center gap-1.5">
                      <StopCircle className="h-3.5 w-3.5" /> End Room
                    </button>
                  )}
                  {currentUser && selectedRoom.status === 'live' && (
                    <button onClick={() => handleAction('leave', selectedRoom)} className="px-4 py-2 rounded-xl border border-border text-xs font-semibold hover:bg-muted flex items-center gap-1.5">
                      <LogOut className="h-3.5 w-3.5" /> Leave
                    </button>
                  )}
                </div>
              </div>

              {selectedRoom.description && (
                <p className="text-sm text-muted-foreground">{selectedRoom.description}</p>
              )}

              <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {selectedRoom.active_participants_count ?? 0} participant{(selectedRoom.active_participants_count ?? 0) !== 1 ? 's' : ''}</span>
                {selectedRoom.scheduled_at && <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> Scheduled: {formatDateTime(selectedRoom.scheduled_at)}</span>}
                {selectedRoom.started_at && <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> Started: {formatDateTime(selectedRoom.started_at)}</span>}
                {selectedRoom.is_recorded && <span className="text-blue-400">🔴 Recording</span>}
              </div>

              {/* Participants */}
              {selectedRoom.participants && selectedRoom.participants.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-foreground uppercase tracking-wider mb-2">Participants</h4>
                  <div className="space-y-1.5">
                    {selectedRoom.participants.map((p) => (
                      <div key={p.id} className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-muted/30">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary to-secondary text-white text-[9px] font-bold flex items-center justify-center shrink-0">
                            {p.user?.name?.charAt(0) ?? '?'}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-foreground truncate">{p.user?.name ?? 'Unknown'}</p>
                            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                              {ROLE_ICONS[p.role] ?? null}
                              {p.role.replace('_', ' ')}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {p.is_hand_raised && <Hand className="h-3.5 w-3.5 text-amber-500" />}
                          {p.is_muted && p.role !== 'listener' && <MicOff className="h-3.5 w-3.5 text-destructive" />}

                          {/* Host/co-host controls for non-host participants */}
                          {(selectedRoom.creator_id === currentUser?.id || selectedRoom.participants?.some(
                            (me) => me.user_id === currentUser?.id && me.role === 'co_host'
                          )) && p.role !== 'host' && (
                            <>
                              <button onClick={() => handleMuteToggle(selectedRoom.id, p.user_id)} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground" title="Toggle mute">
                                <MicOff className="h-3 w-3" />
                              </button>
                              <select
                                value={p.role}
                                onChange={(e) => handleRoleChange(selectedRoom.id, p.user_id, e.target.value)}
                                className="text-[10px] bg-muted rounded-lg px-1.5 py-0.5 border-0 outline-none"
                              >
                                <option value="co_host">Co-Host</option>
                                <option value="speaker">Speaker</option>
                                <option value="listener">Listener</option>
                              </select>
                            </>
                          )}

                          {p.user_id === currentUser?.id && p.role === 'listener' && selectedRoom.status === 'live' && (
                            <button onClick={() => handleRaiseHand(selectedRoom.id)} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground" title="Raise hand">
                              <Hand className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Join button for scheduled rooms */}
              {selectedRoom.status === 'scheduled' && (
                <button onClick={() => handleAction('join', selectedRoom)} className="w-full py-2.5 rounded-xl bg-secondary text-secondary-foreground font-bold text-xs hover:bg-secondary/90 transition-all">
                  Join When Live
                </button>
              )}
              {selectedRoom.status === 'live' && !selectedRoom.participants?.some((p) => p.user_id === currentUser?.id) && (
                <button onClick={() => handleAction('join', selectedRoom)} className="w-full py-2.5 rounded-xl bg-red-500 text-white font-bold text-xs hover:bg-red-600 transition-all animate-pulse">
                  Join This Room
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Room Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="border border-border rounded-2xl bg-card p-6 max-w-lg w-full shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-foreground">Schedule Audio Room</h3>
            <form onSubmit={handleCreateRoom} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-foreground uppercase tracking-wider">Room Title</label>
                <input type="text" value={fTitle} onChange={(e) => setFTitle(e.target.value)} required placeholder="e.g. Weekly Creator AMA" className="w-full px-3 py-2 text-xs rounded-xl bg-muted border-0 outline-none focus:ring-1 focus:ring-secondary" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-foreground uppercase tracking-wider">Description</label>
                <textarea value={fDesc} onChange={(e) => setFDesc(e.target.value)} placeholder="What's this room about?" rows={3} className="w-full px-3 py-2 text-xs rounded-xl bg-muted border-0 outline-none focus:ring-1 focus:ring-secondary resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-foreground uppercase tracking-wider">Schedule</label>
                  <input type="datetime-local" value={fScheduledAt} onChange={(e) => setFScheduledAt(e.target.value)} className="w-full px-3 py-2 text-xs rounded-xl bg-muted border-0 outline-none focus:ring-1 focus:ring-secondary" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-foreground uppercase tracking-wider">Max participants</label>
                  <input type="number" value={fMaxParticipants} onChange={(e) => setFMaxParticipants(e.target.value)} min={1} max={10000} placeholder="Unlimited" className="w-full px-3 py-2 text-xs rounded-xl bg-muted border-0 outline-none focus:ring-1 focus:ring-secondary" />
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-xs font-semibold rounded-xl hover:bg-muted transition-colors">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="px-4 py-2 text-xs font-bold rounded-xl bg-secondary text-secondary-foreground hover:bg-secondary/90 disabled:opacity-50 transition-all flex items-center gap-1.5">
                  {isSubmitting ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                  Schedule Room
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
