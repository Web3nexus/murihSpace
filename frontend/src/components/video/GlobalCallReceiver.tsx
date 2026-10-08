import { useCall } from '@/context/CallContext';
import { CallOverlayModal } from '@/components/video/CallOverlayModal';

export function GlobalCallReceiver() {
  const { call, endCall, acceptCall, minimizeCall, restoreCall } = useCall();

  if (!call || call.status === 'idle') return null;

  return (
    <CallOverlayModal
      isOpen={true}
      isMinimized={call.isMinimized}
      onMinimize={call.isMinimized ? restoreCall : minimizeCall}
      callId={call.callId}
      callType={call.type}
      callMode={call.isIncoming ? (call.status === 'ringing' ? 'incoming' : 'outgoing') : 'outgoing'}
      contactName={call.contactName}
      contactAvatar={call.contactAvatar}
      roomName={call.roomName}
      livekitHost={call.livekitHost}
      livekitToken={call.livekitToken}
      onClose={endCall}
      onAnswer={acceptCall}
      onOpenChat={minimizeCall}
    />
  );
}
