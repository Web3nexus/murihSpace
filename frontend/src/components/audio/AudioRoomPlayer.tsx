import { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Headphones, Loader2 } from 'lucide-react';
import { Room, LocalTrackPublication } from 'livekit-client';
import { getAuthToken } from "@/lib/auth/token";

const API_BASE = (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL) ?? 'http://localhost:8000/api/v1';

function getAuthHeaders() {
  const token = getAuthToken();
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

interface Props {
  roomId: number;
  onError?: (msg: string) => void;
}

export default function AudioRoomPlayer({ roomId, onError }: Props) {
  const [state, setState] = useState<'idle' | 'connecting' | 'connected'>('idle');
  const [isMuted, setIsMuted] = useState(false);
  const [participants, setParticipants] = useState<number>(0);
  const roomRef = useRef<Room | null>(null);

  useEffect(() => {
    let room: Room;

    async function connect() {
      setState('connecting');
      try {
        const res = await fetch(`${API_BASE}/audio-rooms/${roomId}/livekit-token`, {
          headers: getAuthHeaders(),
        });
        if (!res.ok) {
          const err = await res.json();
          onError?.(err.message ?? 'Failed to get stream token.');
          setState('idle');
          return;
        }
        const { token, host } = await res.json();

        room = new Room({
          adaptiveStream: true,
          dynacast: true,
        });

        room.on('participantConnected', () => {
          setParticipants(room.numParticipants);
        });
        room.on('participantDisconnected', () => {
          setParticipants(room.numParticipants);
        });

        await room.connect(host, token);
        roomRef.current = room;
        setState('connected');
        setParticipants(room.numParticipants);
      } catch {
        onError?.('Could not connect to audio stream.');
        setState('idle');
      }
    }

    connect();

    return () => {
      if (room) {
        room.disconnect();
        roomRef.current = null;
      }
    };
  }, [roomId, onError]);

  async function toggleMute() {
    if (!roomRef.current) return;
    const local = roomRef.current.localParticipant;
    const audioTracks = local.getTrackPublications();
    const nextMuted = !isMuted;
    for (const pub of audioTracks) {
      if (pub.kind === 'audio') {
        const track = (pub as LocalTrackPublication).track;
        if (track) {
          if (nextMuted) await track.mute();
          else await track.unmute();
        }
        setIsMuted(nextMuted);
        return;
      }
    }
  }

  if (state === 'connecting') {
    return (
      <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-muted/50 text-xs text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Connecting to audio stream...
      </div>
    );
  }

  if (state === 'idle') return null;

  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3 rounded-xl bg-muted/30 border border-border">
      <div className="flex items-center gap-3">
        <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
        <span className="text-xs font-semibold text-foreground">Connected</span>
        <span className="text-[10px] text-muted-foreground">{participants} participant{participants !== 1 ? 's' : ''}</span>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={toggleMute}
          className={`p-2 rounded-lg transition-colors ${isMuted ? 'bg-destructive/10 text-destructive' : 'bg-muted text-foreground hover:bg-muted/80'}`}
          title={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        </button>
        <div className="p-2 rounded-lg bg-muted text-muted-foreground">
          <Headphones className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}
