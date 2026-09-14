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
}

export function GlobalCallReceiver() {
  const { user } = useAuth();
  const [incomingCall, setIncomingCall] = useState<IncomingCallData | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

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

    const onCallIncoming = (data: any) => {
      // Don't ring if we are the caller
      if (data.caller_id === user.id) return;

      setIncomingCall({
        id: data.id,
        caller_id: data.caller_id,
        caller: data.caller,
        type: data.type === 'video' ? 'video' : 'audio',
        room_name: data.room_name,
        livekit_host: data.livekit_host,
      });
      setIsModalOpen(true);
    };

    const onCallEnded = (data: any) => {
      const current = incomingCallRef.current;
      // Dismiss if: no current call, no id in data, or ids match
      if (!current || !data?.id || String(current.id) === String(data.id)) {
        setIsModalOpen(false);
        setIncomingCall(null);
      }
    };

    const onCallDeclined = (data: any) => {
      const current = incomingCallRef.current;
      if (!current || !data?.id || String(current.id) === String(data.id)) {
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

    // ── Resilient Polling Heartbeat (Fallback for dropped/delayed WS events) ──
    const pollInterval = setInterval(() => {
      const current = incomingCallRef.current;
      fetch(`${API_BASE}/calls/incoming/active`, { headers: getAuthHeaders() })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (!data) return;

          if (data.call && data.call.status === 'ringing') {
            // New incoming call detected via polling
            if (!current || current.id !== data.call.id) {
              onCallIncoming({
                id: data.call.id,
                caller_id: data.call.caller_id,
                caller: data.caller || data.call.caller,
                type: data.call.type,
                room_name: data.room_name || data.call.room_name,
                livekit_host: data.livekit_host,
              });
            }
          } else if (current && (!data.call || data.call.id !== current.id)) {
            // Caller cancelled or call ended while ringing
            setIsModalOpen(false);
            setIncomingCall(null);
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
      onClose={handleClose}
    />
  );
}
