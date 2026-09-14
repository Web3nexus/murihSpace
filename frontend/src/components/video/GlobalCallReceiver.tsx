import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { getEcho } from '@/lib/echo';
import { CallOverlayModal, type CallType } from '@/components/video/CallOverlayModal';

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
      // Dismiss if: no current call (shouldn't happen), no id in data, or ids match
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

    userChannel.listen('.call.incoming', onCallIncoming);
    userChannel.listen('.call.ended', onCallEnded);
    userChannel.listen('.call.declined', onCallDeclined);
    userChannel.listen('CallIncoming', onCallIncoming);
    userChannel.listen('CallEnded', onCallEnded);
    userChannel.listen('CallDeclined', onCallDeclined);

    return () => {
      userChannel.stopListening('.call.incoming', onCallIncoming);
      userChannel.stopListening('.call.ended', onCallEnded);
      userChannel.stopListening('.call.declined', onCallDeclined);
      userChannel.stopListening('CallIncoming', onCallIncoming);
      userChannel.stopListening('CallEnded', onCallEnded);
      userChannel.stopListening('CallDeclined', onCallDeclined);
    };
    // Only re-subscribe when user id changes — the ref handles the live state
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
