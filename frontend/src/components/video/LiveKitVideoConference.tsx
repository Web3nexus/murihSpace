import { useEffect, useRef, useState } from 'react';
import {
  Mic,
  MicOff,
  Video as VideoIcon,
  VideoOff,
  Monitor,
  PhoneOff,
  Users,
  Loader2,
  Gift,
  Shield,
  Sparkles,
} from 'lucide-react';
import {
  Room,
  RoomEvent,
  LocalParticipant,
  Track,
  Participant,
} from 'livekit-client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getAuthToken } from '@/lib/auth/token';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL) ?? 'http://localhost:8000/api/v1';

function getAuthHeaders() {
  const token = getAuthToken();
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

interface Props {
  roomId: number;
  roomTitle?: string;
  isHost?: boolean;
  onLeave?: () => void;
  onError?: (msg: string) => void;
}

interface ParticipantTrackState {
  participant: Participant;
  videoTrack?: Track;
  audioTrack?: Track;
}

export function LiveKitVideoConference({ roomId, roomTitle = 'Video Conference', isHost = false, onLeave, onError }: Props) {
  const [stage, setStage] = useState<'prejoin' | 'connecting' | 'connected'>('prejoin');
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCamOn, setIsCamOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [participants, setParticipants] = useState<ParticipantTrackState[]>([]);
  const [activeSpeaker, setActiveSpeaker] = useState<string | null>(null);
  const [giftMsg, setGiftMsg] = useState<string | null>(null);

  const roomRef = useRef<Room | null>(null);

  // Connect to LiveKit Room
  const joinConference = async () => {
    setStage('connecting');
    try {
      const res = await fetch(`${API_BASE}/audio-rooms/${roomId}/livekit-token`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.message ?? 'Failed to issue LiveKit token.');
      }
      const { token, host } = await res.json();

      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
        videoCaptureDefaults: {
          resolution: { width: 1280, height: 720, frameRate: 30 },
        },
      });

      const updateParticipantsState = () => {
        const list: ParticipantTrackState[] = [];
        // Add Local
        if (room.localParticipant) {
          const localPubs = Array.from(room.localParticipant.trackPublications.values());
          const vTrack = localPubs.find((p) => p.kind === Track.Kind.Video)?.track;
          const aTrack = localPubs.find((p) => p.kind === Track.Kind.Audio)?.track;
          list.push({
            participant: room.localParticipant,
            videoTrack: vTrack,
            audioTrack: aTrack,
          });
        }
        // Add Remotes
        room.remoteParticipants.forEach((remote) => {
          const remotePubs = Array.from(remote.trackPublications.values());
          const vTrack = remotePubs.find((p) => p.kind === Track.Kind.Video)?.track;
          const aTrack = remotePubs.find((p) => p.kind === Track.Kind.Audio)?.track;
          list.push({
            participant: remote,
            videoTrack: vTrack,
            audioTrack: aTrack,
          });
        });
        setParticipants(list);
      };

      room.on(RoomEvent.ParticipantConnected, updateParticipantsState);
      room.on(RoomEvent.ParticipantDisconnected, updateParticipantsState);
      room.on(RoomEvent.TrackSubscribed, updateParticipantsState);
      room.on(RoomEvent.TrackUnsubscribed, updateParticipantsState);
      room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
        if (speakers.length > 0) setActiveSpeaker(speakers[0].identity);
        else setActiveSpeaker(null);
      });

      await room.connect(host, token);
      roomRef.current = room;

      // Enable Mic & Camera based on user prejoin choices
      await room.localParticipant.setMicrophoneEnabled(isMicOn);
      await room.localParticipant.setCameraEnabled(isCamOn);

      setStage('connected');
      updateParticipantsState();
    } catch (err: unknown) {
      const m = err instanceof Error ? err.message : 'Connection error';
      onError?.(m);
      setStage('prejoin');
    }
  };

  const leaveConference = () => {
    if (roomRef.current) {
      roomRef.current.disconnect();
      roomRef.current = null;
    }
    setStage('prejoin');
    if (onLeave) onLeave();
  };

  const toggleMic = async () => {
    if (!roomRef.current?.localParticipant) return;
    const nextState = !isMicOn;
    await roomRef.current.localParticipant.setMicrophoneEnabled(nextState);
    setIsMicOn(nextState);
  };

  const toggleCam = async () => {
    if (!roomRef.current?.localParticipant) return;
    const nextState = !isCamOn;
    await roomRef.current.localParticipant.setCameraEnabled(nextState);
    setIsCamOn(nextState);
  };

  const toggleScreenShare = async () => {
    if (!roomRef.current?.localParticipant) return;
    const nextState = !isScreenSharing;
    try {
      await roomRef.current.localParticipant.setScreenShareEnabled(nextState);
      setIsScreenSharing(nextState);
    } catch (e) {
      console.error('Screen share error', e);
    }
  };

  const sendInCallGift = async (giftId: number, name: string) => {
    try {
      const res = await fetch(`${API_BASE}/gifts/send`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ gift_id: giftId, receiver_id: roomId }),
      });
      if (res.ok) {
        setGiftMsg(`✨ Sent ${name} to the conference!`);
        setTimeout(() => setGiftMsg(null), 3500);
      }
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    return () => {
      if (roomRef.current) {
        roomRef.current.disconnect();
      }
    };
  }, []);

  // Pre-join preview screen
  if (stage === 'prejoin') {
    return (
      <div className="w-full max-w-2xl mx-auto p-6 bg-slate-900 text-white rounded-2xl shadow-2xl border border-slate-800 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-xl font-bold">{roomTitle}</h2>
            <p className="text-xs text-slate-400">LiveKit Native Video Conference</p>
          </div>
          <Badge className="bg-[#2164b6]/20 text-[#2164b6] dark:text-[#7ab0ff] border-[#2164b6]/30">LiveKit SFU</Badge>
        </div>

        <div className="relative aspect-video bg-slate-950 rounded-xl overflow-hidden flex items-center justify-center border border-slate-800">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
              <VideoIcon className="w-8 h-8" />
            </div>
            <p className="text-xs text-slate-400">Camera & Microphone Preview Ready</p>
          </div>

          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-slate-900/80 backdrop-blur px-4 py-2 rounded-full border border-slate-700/50">
            <Button
              variant={isMicOn ? 'secondary' : 'destructive'}
              size="icon"
              className="rounded-full h-10 w-10"
              onClick={() => setIsMicOn(!isMicOn)}
            >
              {isMicOn ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
            </Button>
            <Button
              variant={isCamOn ? 'secondary' : 'destructive'}
              size="icon"
              className="rounded-full h-10 w-10"
              onClick={() => setIsCamOn(!isCamOn)}
            >
              {isCamOn ? <VideoIcon className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          {onLeave && (
            <Button variant="ghost" onClick={onLeave} className="text-slate-400 hover:text-white">
              Cancel
            </Button>
          )}
          <Button onClick={joinConference} className="bg-[#2164b6] hover:bg-[#2164b6]/90 text-white px-8 font-semibold">
            Join Meeting Now
          </Button>
        </div>
      </div>
    );
  }

  // Connecting screen
  if (stage === 'connecting') {
    return (
      <div className="w-full h-80 bg-slate-900 text-white rounded-2xl flex flex-col items-center justify-center space-y-3 border border-slate-800">
        <Loader2 className="w-8 h-8 animate-spin text-[#2164b6] dark:text-[#7ab0ff]" />
        <p className="text-sm font-medium">Connecting to LiveKit SFU Media Server...</p>
      </div>
    );
  }

  // Connected Video Conference View
  return (
    <div className="relative w-full h-[650px] bg-slate-950 text-white rounded-2xl overflow-hidden border border-slate-800 flex flex-col shadow-2xl">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-6 py-4 bg-slate-900/90 border-b border-slate-800/80 backdrop-blur z-10">
        <div className="flex items-center gap-3">
          <Badge className="bg-red-500/20 text-red-400 border-red-500/30 animate-pulse">● LIVE</Badge>
          <h3 className="font-bold text-base">{roomTitle}</h3>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-slate-300 border-slate-700">
            <Users className="w-3.5 h-3.5 mr-1" />
            {participants.length} Participant{participants.length !== 1 ? 's' : ''}
          </Badge>
          {isHost && (
            <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30">
              <Shield className="w-3.5 h-3.5 mr-1" /> Host Controls
            </Badge>
          )}
        </div>
      </div>

      {/* Gift Floating Notice */}
      {giftMsg && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 bg-amber-500 text-slate-950 font-bold px-4 py-2 rounded-full shadow-lg z-30 animate-bounce flex items-center gap-2 text-xs">
          <Sparkles className="w-4 h-4" />
          {giftMsg}
        </div>
      )}

      {/* Video Grid */}
      <div className="flex-1 p-4 grid gap-4 auto-rows-fr overflow-y-auto" style={{
        gridTemplateColumns: participants.length > 2 ? 'repeat(auto-fit, minmax(280px, 1fr))' : 'repeat(auto-fit, minmax(360px, 1fr))'
      }}>
        {participants.map((pState, idx) => {
          const isSpeaking = activeSpeaker === pState.participant.identity;
          const isLocal = pState.participant instanceof LocalParticipant;

          return (
            <div
              key={pState.participant.identity || idx}
              className={`relative bg-slate-900 rounded-xl overflow-hidden border transition-all flex items-center justify-center ${
                isSpeaking ? 'border-emerald-500 ring-2 ring-emerald-500/50' : 'border-slate-800'
              }`}
            >
              {pState.videoTrack ? (
                <ParticipantVideoElement track={pState.videoTrack} />
              ) : (
                <div className="flex flex-col items-center gap-2 text-slate-400">
                  <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center font-bold text-lg text-slate-200">
                    {pState.participant.identity.substring(0, 2).toUpperCase()}
                  </div>
                  <span className="text-xs">Camera Off</span>
                </div>
              )}

              {/* Participant Name Badge */}
              <div className="absolute bottom-3 left-3 bg-slate-900/80 backdrop-blur px-3 py-1 rounded-md border border-slate-700/60 text-xs font-medium flex items-center gap-2">
                <span>{isLocal ? 'You' : `User #${pState.participant.identity}`}</span>
                {isSpeaking && <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />}
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom Control Bar */}
      <div className="flex items-center justify-between px-6 py-4 bg-slate-900/90 border-t border-slate-800/80 backdrop-blur z-10">
        <div className="flex items-center gap-2">
          <Button
            variant={isMicOn ? 'secondary' : 'destructive'}
            size="icon"
            className="rounded-full h-11 w-11"
            onClick={toggleMic}
            title={isMicOn ? 'Mute Mic' : 'Unmute Mic'}
          >
            {isMicOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
          </Button>

          <Button
            variant={isCamOn ? 'secondary' : 'destructive'}
            size="icon"
            className="rounded-full h-11 w-11"
            onClick={toggleCam}
            title={isCamOn ? 'Turn Off Camera' : 'Turn On Camera'}
          >
            {isCamOn ? <VideoIcon className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
          </Button>

          <Button
            variant={isScreenSharing ? 'default' : 'outline'}
            size="icon"
            className={`rounded-full h-11 w-11 ${isScreenSharing ? 'bg-[#2164b6] text-white' : 'border-slate-700 text-slate-300'}`}
            onClick={toggleScreenShare}
            title="Share Screen"
          >
            <Monitor className="w-5 h-5" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="border-amber-500/40 text-amber-400 hover:bg-amber-500/10 rounded-full"
            onClick={() => sendInCallGift(1, 'Rose')}
          >
            <Gift className="w-4 h-4 mr-1.5" /> Send Gift
          </Button>

          <Button
            variant="destructive"
            className="rounded-full px-6 font-semibold bg-red-600 hover:bg-red-700"
            onClick={leaveConference}
          >
            <PhoneOff className="w-4 h-4 mr-2" /> Leave Call
          </Button>
        </div>
      </div>
    </div>
  );
}

// Subcomponent to attach HTMLMediaElement
function ParticipantVideoElement({ track }: { track: Track }) {
  const ref = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (el && track) {
      track.attach(el);
      return () => {
        track.detach(el);
      };
    }
  }, [track]);

  return <video ref={ref} className="w-full h-full object-cover" autoPlay playsInline muted />;
}

export default LiveKitVideoConference;
