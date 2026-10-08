import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { getEcho } from '@/lib/echo';
import { getAuthToken } from '@/lib/auth/token';
import { toast } from 'sonner';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL) ?? 'https://api-staging.murihspace.com/api/v1';

function getAuthHeaders() {
  const token = getAuthToken();
  return {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export type WebCallStatus =
  | 'idle'
  | 'outgoing'
  | 'ringing'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'ending'
  | 'ended'
  | 'connection_failed';

export interface WebCallSession {
  callId?: number;
  type: 'audio' | 'video';
  status: WebCallStatus;
  contactName: string;
  contactAvatar?: string;
  recipientId?: number;
  conversationId?: number;
  roomName?: string;
  livekitToken?: string;
  livekitHost?: string;
  isIncoming: boolean;
  isMinimized: boolean;
}

interface CallContextType {
  call: WebCallSession | null;
  startCall: (params: {
    recipientId: number;
    contactName: string;
    contactAvatar?: string;
    type: 'audio' | 'video';
    conversationId?: number;
  }) => Promise<void>;
  acceptCall: () => Promise<void>;
  declineCall: () => void;
  endCall: () => void;
  minimizeCall: () => void;
  restoreCall: () => void;
  setCallStatus: (status: WebCallStatus) => void;
}

const CallContext = createContext<CallContextType | null>(null);

export const useCall = () => {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error('useCall must be used within CallProvider');
  return ctx;
};

export const CallProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [call, setCall] = useState<WebCallSession | null>(null);
  const callRef = useRef<WebCallSession | null>(null);
  callRef.current = call;

  // Listen to incoming call events via Echo
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

      // Don't ring if we placed the call
      if (callerId === user.id) return;
      // Don't interrupt if already in active call
      if (callRef.current && callRef.current.status !== 'idle' && callRef.current.status !== 'ended') return;

      // Acknowledge receipt to backend immediately
      if (id > 0) {
        fetch(`${API_BASE}/calls/${id}/ringing`, {
          method: 'POST',
          headers: getAuthHeaders(),
        }).catch(() => {});
      }

      setCall({
        callId: id,
        type: (data.type || raw.type) === 'video' ? 'video' : 'audio',
        status: 'ringing',
        contactName: caller?.name || caller?.username || 'Incoming Caller',
        contactAvatar: caller?.avatar_url || caller?.avatar,
        recipientId: user.id,
        conversationId: data.conversation_id,
        roomName: data.room_name || raw.room_name,
        livekitHost: data.livekit_host || raw.livekit_host,
        livekitToken: data.livekit_token || raw.livekit_token,
        isIncoming: true,
        isMinimized: false,
      });
    };

    const onCallEnded = (raw: any) => {
      const data = raw?.data ?? raw;
      const id = Number(data?.id || raw?.id || 0);
      if (callRef.current && callRef.current.callId === id) {
        setCall((prev) => prev ? { ...prev, status: 'ended' } : null);
        setTimeout(() => setCall(null), 1200);
      }
    };

    const onCallDeclined = (raw: any) => {
      const data = raw?.data ?? raw;
      const id = Number(data?.id || raw?.id || 0);
      if (callRef.current && callRef.current.callId === id) {
        setCall((prev) => prev ? { ...prev, status: 'ended' } : null);
        setTimeout(() => setCall(null), 1200);
      }
    };

    [userChannel, appUserChannel].forEach((ch) => {
      ch.listen('.call.incoming', onCallIncoming);
      ch.listen('.call.ended', onCallEnded);
      ch.listen('.call.declined', onCallDeclined);
      ch.listen('CallIncoming', onCallIncoming);
      ch.listen('CallEnded', onCallEnded);
      ch.listen('CallDeclined', onCallDeclined);
    });

    // Heartbeat fallback polling for incoming calls
    const pollInterval = setInterval(() => {
      if (callRef.current && callRef.current.status !== 'idle' && callRef.current.status !== 'ended') return;

      fetch(`${API_BASE}/calls/incoming/active`, { headers: getAuthHeaders() })
        .then((res) => (res.ok ? res.json() : null))
        .then((raw) => {
          if (!raw || (callRef.current && callRef.current.status !== 'idle' && callRef.current.status !== 'ended')) return;
          const data = raw?.data ?? raw;
          const activeCall = data.call || (data.id ? data : null);

          if (activeCall && (activeCall.status === 'ringing' || activeCall.status === 'connecting')) {
            onCallIncoming({
              id: activeCall.id,
              caller_id: activeCall.caller_id,
              caller: activeCall.caller || data.caller,
              type: activeCall.type,
              room_name: activeCall.room_name || data.room_name,
              livekit_host: activeCall.livekit_host || data.livekit_host,
              livekit_token: activeCall.livekit_token || data.livekit_token,
            });
          }
        })
        .catch(() => {});
    }, 3000);

    return () => {
      clearInterval(pollInterval);
      [userChannel, appUserChannel].forEach((ch) => {
        ch.stopListening('.call.incoming', onCallIncoming);
        ch.stopListening('.call.ended', onCallEnded);
        ch.stopListening('.call.declined', onCallDeclined);
        ch.stopListening('CallIncoming', onCallIncoming);
        ch.stopListening('CallEnded', onCallEnded);
        ch.stopListening('CallDeclined', onCallDeclined);
      });
    };
  }, [user?.id]);

  const startCall = useCallback(
    async ({
      recipientId,
      contactName,
      contactAvatar,
      type,
      conversationId,
    }: {
      recipientId: number;
      contactName: string;
      contactAvatar?: string;
      type: 'audio' | 'video';
      conversationId?: number;
    }) => {
      try {
        setCall({
          type,
          status: 'outgoing',
          contactName,
          contactAvatar,
          recipientId,
          conversationId,
          isIncoming: false,
          isMinimized: false,
        });

        const res = await fetch(`${API_BASE}/calls/initiate`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({
            recipient_id: recipientId,
            type,
            conversation_id: conversationId,
          }),
        });

        const raw = await res.json();
        if (!res.ok) {
          throw new Error(raw?.message || 'Failed to initiate call');
        }

        const data = raw?.data ?? raw;
        const c = data?.call || (data?.id ? data : null);

        setCall((prev) =>
          prev
            ? {
                ...prev,
                callId: c?.id ?? data?.id,
                roomName: data.room_name || c?.room_name,
                livekitToken: data.livekit_token || c?.livekit_token,
                livekitHost: data.livekit_host || c?.livekit_host,
              }
            : null
        );
      } catch (err: any) {
        toast.error(err.message || 'Failed to initiate call');
        setCall(null);
      }
    },
    []
  );

  const acceptCall = useCallback(async () => {
    const current = callRef.current;
    if (!current?.callId) return;

    setCall((prev) => (prev ? { ...prev, status: 'connecting' } : null));

    try {
      const res = await fetch(`${API_BASE}/calls/${current.callId}/accept`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      const raw = await res.json();
      const data = raw?.data ?? raw;
      setCall((prev) =>
        prev
          ? {
              ...prev,
              livekitToken: data.livekit_token || prev.livekitToken,
              livekitHost: data.livekit_host || prev.livekitHost,
            }
          : null
      );
    } catch (_) {}
  }, []);

  const declineCall = useCallback(() => {
    const current = callRef.current;
    if (current?.callId) {
      fetch(`${API_BASE}/calls/${current.callId}/decline`, {
        method: 'POST',
        headers: getAuthHeaders(),
      }).catch(() => {});
    }
    setCall((prev) => (prev ? { ...prev, status: 'ended' } : null));
    setTimeout(() => setCall(null), 800);
  }, []);

  const endCall = useCallback(() => {
    const current = callRef.current;
    if (current?.callId) {
      fetch(`${API_BASE}/calls/${current.callId}/end`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ duration_seconds: 0 }),
      }).catch(() => {});
    }
    setCall((prev) => (prev ? { ...prev, status: 'ended' } : null));
    setTimeout(() => setCall(null), 600);
  }, []);

  const minimizeCall = useCallback(() => {
    setCall((prev) => (prev ? { ...prev, isMinimized: true } : null));
  }, []);

  const restoreCall = useCallback(() => {
    setCall((prev) => (prev ? { ...prev, isMinimized: false } : null));
  }, []);

  const setCallStatus = useCallback((status: WebCallStatus) => {
    setCall((prev) => (prev ? { ...prev, status } : null));
  }, []);

  return (
    <CallContext.Provider
      value={{
        call,
        startCall,
        acceptCall,
        declineCall,
        endCall,
        minimizeCall,
        restoreCall,
        setCallStatus,
      }}
    >
      {children}
    </CallContext.Provider>
  );
};

