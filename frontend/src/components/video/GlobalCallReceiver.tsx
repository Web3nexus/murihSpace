import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { getEcho } from '@/lib/echo';
import { getAuthToken } from '@/lib/auth/token';
import { CallOverlayModal, type CallType } from '@/components/video/CallOverlayModal';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL) ?? 'https://api-staging.murihspace.com/api/v1';

function getAuthHeaders() {
  const token = getAuthToken();
  return {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

interface IncomingCallData {
  id: number;
  caller_id: number;
  caller?: {
    id: number;
    name: string;
    username?: string;
    avatar?: string;
    avatar_url?: string;
  };
  type: CallType;
  room_name: string;
  livekit_host?: string;
  livekit_token?: string;
}

export function GlobalCallReceiver() {
  const { user } = useAuth();
  const [incomingCall, setIncomingCall] = useState<IncomingCallData | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const isAnsweredRef = useRef(false);

  // Use a ref so event-listener callbacks always see the latest incomingCall
  // without needing to re-subscribe on every state change (stale closure fix).
  const incomingCallRef = useRef<IncomingCallData | null>(null);
  incomingCallRef.current = incomingCall;

  useEffect(() => {
    if (!user?.id) return;

    let echo: any;
    try {
      echo = getEcho();
    } catch {
      return;
    }

    const userChannel = echo.private(`user.${user.id}`);
    const appUserChannel = echo.private(`App.Models.User.${user.id}`);

    const onCallIncoming = (raw: any) => {
      const data = raw?.call || raw?.data?.call || raw?.data || raw;
      const caller = data.caller || raw.caller || data.caller_user;
      const id = Number(data.id || raw.id || 0);
      const callerId = Number(data.caller_id || raw.caller_id || 0);

      // Don't ring if we are the caller
      if (callerId === user.id) return;

      // Reset answered state for new incoming call
      isAnsweredRef.current = false;

      // Acknowledge receipt to backend immediately so the caller knows the recipient device is alive and actively ringing
      if (id > 0) {
        fetch(`${API_BASE}/calls/${id}/ringing`, {
          method: 'POST',
          headers: getAuthHeaders(),
        }).catch(() => {});
      }

      setIncomingCall({
        id,
        caller_id: callerId,
        caller,
        type: (data.type || raw.type) === 'video' ? 'video' : 'audio',
        room_name: data.room_name || raw.room_name,
        livekit_host: data.livekit_host || raw.livekit_host,
        livekit_token: data.livekit_token || raw.livekit_token,
      });
      setIsModalOpen(true);
    };

    const onCallEnded = (raw: any) => {
      const current = incomingCallRef.current;
      const data = raw?.data ?? raw;
      const id = Number(data?.id || raw?.id || 0);
      if (current && id > 0 && Number(current.id) === id) {
        isAnsweredRef.current = false;
        setIsModalOpen(false);
        setIncomingCall(null);
      }
    };

    const onCallDeclined = (raw: any) => {
      const current = incomingCallRef.current;
      const data = raw?.data ?? raw;
      const id = Number(data?.id || raw?.id || 0);
      if (current && id > 0 && Number(current.id) === id) {
        isAnsweredRef.current = false;
        setIsModalOpen(false);
        setIncomingCall(null);
      }
    };

    // Listen on both user.{id} and App.Models.User.{id}
    [userChannel, appUserChannel].forEach((channel) => {
      channel.listen('.call.incoming', onCallIncoming);
      channel.listen('.call.ended', onCallEnded);
      channel.listen('.call.declined', onCallDeclined);
      channel.listen('CallIncoming', onCallIncoming);
      channel.listen('CallEnded', onCallEnded);
      channel.listen('CallDeclined', onCallDeclined);
    });

    // ── Resilient Polling Heartbeat (Fallback for detecting missed incoming calls) ──
    const pollInterval = setInterval(() => {
      // Only poll when no call is currently active/ringing to avoid race conditions
      if (isAnsweredRef.current || incomingCallRef.current) return;

      fetch(`${API_BASE}/calls/incoming/active`, { headers: getAuthHeaders() })
        .then((res) => (res.ok ? res.json() : null))
        .then((raw) => {
          if (!raw || isAnsweredRef.current || incomingCallRef.current) return;
          const data = raw?.data ?? raw;
          const call = data.call || (data.id ? data : null);

          if (call && (call.status === 'ringing' || call.status === 'connecting')) {
            onCallIncoming({
              id: call.id,
              caller_id: call.caller_id,
              caller: call.caller || data.caller,
              type: call.type,
              room_name: call.room_name || data.room_name,
              livekit_host: call.livekit_host || data.livekit_host,
              livekit_token: call.livekit_token || data.livekit_token,
            });
          }
        })
        .catch(() => {});
    }, 2500);

    return () => {
      clearInterval(pollInterval);
      [userChannel, appUserChannel].forEach((channel) => {
        channel.stopListening('.call.incoming', onCallIncoming);
        channel.stopListening('.call.ended', onCallEnded);
        channel.stopListening('.call.declined', onCallDeclined);
        channel.stopListening('CallIncoming', onCallIncoming);
        channel.stopListening('CallEnded', onCallEnded);
        channel.stopListening('CallDeclined', onCallDeclined);
      });
    };
  }, [user?.id]);

  const handleClose = useCallback(() => {
    isAnsweredRef.current = false;
    setIsModalOpen(false);
    setIncomingCall(null);
  }, []);

  if (!incomingCall || !isModalOpen) return null;

  return (
    <CallOverlayModal
      isOpen={isModalOpen}
      callId={incomingCall.id}
      callType={incomingCall.type}
      callMode="incoming"
      contactName={incomingCall.caller?.name || 'Incoming Caller'}
      contactAvatar={incomingCall.caller?.avatar_url || incomingCall.caller?.avatar}
      roomName={incomingCall.room_name}
      livekitHost={incomingCall.livekit_host}
      livekitToken={incomingCall.livekit_token}
      onClose={handleClose}
      onAnswer={() => {
        isAnsweredRef.current = true;
      }}
    />
  );
}
