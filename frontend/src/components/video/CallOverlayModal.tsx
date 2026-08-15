import React, { useState } from 'react';
import {
  Phone, PhoneOff, Mic, MicOff, Video, VideoOff, MessageSquare,
  Volume2, Bell, ArrowLeft
} from 'lucide-react';

export type CallMode = 'incoming' | 'video' | 'group';

export interface CallParticipant {
  id: number | string;
  name: string;
  avatar_url?: string;
  isMuted?: boolean;
  isVideoOn?: boolean;
  statusText?: string;
}

interface CallOverlayModalProps {
  isOpen: boolean;
  callMode: CallMode;
  callerName?: string;
  callerAvatar?: string;
  participants?: CallParticipant[];
  onClose: () => void;
  onAnswer?: () => void;
  onOpenChat?: () => void;
}

export const CallOverlayModal: React.FC<CallOverlayModalProps> = ({
  isOpen,
  callMode: initialMode = 'video',
  callerName = 'Borsha Akther',
  callerAvatar = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&auto=format&fit=crop&q=80',
  participants = [
    { id: '1', name: 'Dean Renload', statusText: 'Sounds reasonable', isMuted: true, avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80' },
    { id: '2', name: 'Annei Ellison', statusText: 'What about our profit?', isMuted: false, avatar_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80' },
    { id: '3', name: 'John Borino', statusText: 'What led you to this thought?', isMuted: true, avatar_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80' },
  ],
  onClose,
  onAnswer,
  onOpenChat,
}) => {
  const [mode, setMode] = useState<CallMode>(initialMode);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [volume, setVolume] = useState(75);
  const [slideProgress, setSlideProgress] = useState(0);

  if (!isOpen) return null;

  const handleSlideAnswer = () => {
    setSlideProgress(100);
    setTimeout(() => {
      setMode('video');
      if (onAnswer) onAnswer();
    }, 300);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 text-white overflow-hidden animate-in fade-in duration-300">
      {/* ── Mode 1: INCOMING CALL ───────────────────────────────────────────── */}
      {mode === 'incoming' && (
        <div className="relative w-full h-full max-w-md flex flex-col justify-between p-6 overflow-hidden">
          {/* Blurred Background Image */}
          <div className="absolute inset-0 z-0">
            <img
              src={callerAvatar}
              alt=""
              className="w-full h-full object-cover blur-2xl opacity-40 scale-110"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/90" />
          </div>

          {/* Header */}
          <div className="relative z-10 text-center pt-12 space-y-2">
            <p className="text-xs uppercase tracking-widest font-semibold text-slate-300">Incoming call</p>
            <div className="h-28 w-28 rounded-full overflow-hidden mx-auto border-4 border-white/20 shadow-2xl">
              <img src={callerAvatar} alt={callerName} className="w-full h-full object-cover" />
            </div>
            <h2 className="text-2xl font-black text-white tracking-tight">{callerName}</h2>
          </div>

          {/* Quick Actions */}
          <div className="relative z-10 space-y-8 pb-8">
            <div className="flex items-center justify-around px-8">
              <button
                type="button"
                onClick={() => alert('Reminder set for this call')}
                className="flex flex-col items-center gap-2 text-slate-300 hover:text-white transition-colors"
              >
                <div className="p-3.5 rounded-full bg-white/10 backdrop-blur-md hover:bg-white/20">
                  <Bell className="h-5 w-5" />
                </div>
                <span className="text-xs font-semibold">Remind me</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (onOpenChat) onOpenChat();
                  onClose();
                }}
                className="flex flex-col items-center gap-2 text-slate-300 hover:text-white transition-colors"
              >
                <div className="p-3.5 rounded-full bg-white/10 backdrop-blur-md hover:bg-white/20">
                  <MessageSquare className="h-5 w-5" />
                </div>
                <span className="text-xs font-semibold">Message</span>
              </button>
            </div>

            {/* Slide to Answer Bar */}
            <div className="relative h-16 w-full rounded-full bg-white/15 backdrop-blur-md p-1.5 border border-white/20 flex items-center justify-between">
              <button
                type="button"
                onClick={handleSlideAnswer}
                style={{ transform: `translateX(${slideProgress}%)` }}
                className="h-13 w-13 rounded-full bg-emerald-500 hover:bg-emerald-400 text-white flex items-center justify-center shadow-lg transition-transform duration-200 cursor-pointer shrink-0"
              >
                <Phone className="h-6 w-6 animate-pulse" />
              </button>

              <span className="text-xs font-bold text-white/80 uppercase tracking-wider mx-auto pr-6 pointer-events-none">
                slide to answer
              </span>

              <button
                type="button"
                onClick={onClose}
                className="h-13 w-13 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center shadow-lg shrink-0"
              >
                <PhoneOff className="h-6 w-6" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Mode 2: ACTIVE VIDEO CALL ─────────────────────────────────────── */}
      {mode === 'video' && (
        <div className="relative w-full h-full max-w-lg flex flex-col justify-between p-4 overflow-hidden bg-slate-950 border border-slate-800 rounded-3xl shadow-2xl">
          {/* Main Remote Camera View */}
          <div className="absolute inset-0 z-0">
            <img
              src={callerAvatar}
              alt=""
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/80" />
          </div>

          {/* Top Bar with Back & Inset Self Video Preview */}
          <div className="relative z-10 flex items-start justify-between pt-2 px-2">
            <button
              type="button"
              onClick={onClose}
              className="p-2.5 rounded-full bg-black/40 backdrop-blur-md text-white hover:bg-black/60 transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>

            {/* Inset Self Video Preview */}
            <div className="h-28 w-20 rounded-2xl overflow-hidden border-2 border-white/30 shadow-2xl bg-black relative">
              {isVideoOn ? (
                <img
                  src="https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80"
                  alt="Self"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-slate-900 flex items-center justify-center text-xs font-bold text-slate-400">
                  Camera Off
                </div>
              )}
            </div>
          </div>

          {/* Vertical Sound Volume Control Slider Overlay */}
          <div className="relative z-10 self-start ml-2 mb-20 flex flex-col items-center gap-2 p-2 rounded-2xl bg-black/40 backdrop-blur-md border border-white/10">
            <Volume2 className="h-4 w-4 text-emerald-400" />
            <input
              type="range"
              min="0"
              max="100"
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              className="h-24 w-1.5 accent-emerald-400 bg-white/20 rounded-lg appearance-none cursor-pointer [writing-mode:vertical-lr] [direction:rtl]"
            />
          </div>

          {/* Bottom Floating Pill Action Controls */}
          <div className="relative z-10 w-full pb-4">
            <div className="flex items-center justify-center gap-3 p-3 rounded-full bg-black/60 backdrop-blur-xl border border-white/20 shadow-2xl max-w-sm mx-auto">
              <button
                type="button"
                onClick={() => setIsMuted(!isMuted)}
                className={`p-3.5 rounded-full transition-all ${
                  isMuted ? 'bg-red-500/80 text-white' : 'bg-white/15 text-white hover:bg-white/25'
                }`}
              >
                {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              </button>

              <button
                type="button"
                onClick={() => setIsSpeakerOn(!isSpeakerOn)}
                className={`p-3.5 rounded-full transition-all ${
                  isSpeakerOn ? 'bg-white/25 text-white' : 'bg-white/10 text-white/60'
                }`}
              >
                <Volume2 className="h-5 w-5" />
              </button>

              <button
                type="button"
                onClick={() => setIsVideoOn(!isVideoOn)}
                className={`p-3.5 rounded-full transition-all ${
                  !isVideoOn ? 'bg-red-500/80 text-white' : 'bg-white/15 text-white hover:bg-white/25'
                }`}
              >
                {isVideoOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
              </button>

              <button
                type="button"
                onClick={() => {
                  if (onOpenChat) onOpenChat();
                  onClose();
                }}
                className="p-3.5 rounded-full bg-emerald-500 text-white hover:bg-emerald-400 transition-colors shadow-lg"
              >
                <MessageSquare className="h-5 w-5" />
              </button>

              <button
                type="button"
                onClick={onClose}
                className="p-3.5 rounded-full bg-red-600 text-white hover:bg-red-500 transition-colors shadow-lg"
              >
                <PhoneOff className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Mode 3: GROUP CALL ─────────────────────────────────────────────── */}
      {mode === 'group' && (
        <div className="relative w-full h-full max-w-lg flex flex-col justify-between p-6 bg-slate-950 border border-slate-800 rounded-3xl shadow-2xl overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-white/10">
            <div>
              <h2 className="text-xl font-black text-white">Meeting with Lora Adom</h2>
              <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                Lora Adom (Meeting organizer)
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white"
            >
              <PhoneOff className="h-5 w-5 text-red-500" />
            </button>
          </div>

          {/* Speaker Comments / Live Transcript Feed */}
          <div className="my-6 space-y-3">
            {participants.map((p) => (
              <div key={p.id} className="flex items-center gap-3 p-3 rounded-2xl bg-white/5 border border-white/10">
                <div className="h-10 w-10 rounded-full overflow-hidden border border-white/20 shrink-0">
                  <img src={p.avatar_url} alt={p.name} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-white">{p.name}</p>
                  <p className="text-[11px] text-slate-300 truncate">{p.statusText}</p>
                </div>
                <div className="p-1.5 rounded-full bg-white/10 text-slate-400 shrink-0">
                  {p.isMuted ? <MicOff className="h-3.5 w-3.5 text-red-400" /> : <Mic className="h-3.5 w-3.5 text-emerald-400" />}
                </div>
              </div>
            ))}
          </div>

          {/* Participant Avatars Row */}
          <div className="flex items-center gap-2 overflow-x-auto pb-4">
            {participants.map((p) => (
              <div key={p.id} className="relative h-12 w-12 rounded-full overflow-hidden border-2 border-white/20 shrink-0">
                <img src={p.avatar_url} alt="" className="w-full h-full object-cover" />
                {p.isMuted && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                    <MicOff className="h-3.5 w-3.5 text-red-400" />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Group Call Controls */}
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => setIsMuted(!isMuted)}
              className={`p-3.5 rounded-full ${isMuted ? 'bg-red-500' : 'bg-white/15'}`}
            >
              {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </button>
            <button type="button" className="p-3.5 rounded-full bg-white/15"><Volume2 className="h-5 w-5" /></button>
            <button type="button" className="p-3.5 rounded-full bg-white/15"><Video className="h-5 w-5" /></button>
            <button type="button" onClick={onOpenChat} className="p-3.5 rounded-full bg-emerald-500"><MessageSquare className="h-5 w-5" /></button>
            <button type="button" onClick={onClose} className="p-3.5 rounded-full bg-red-600"><PhoneOff className="h-5 w-5" /></button>
          </div>
        </div>
      )}
    </div>
  );
};
