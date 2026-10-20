/** Party on a call signal (caller or callee). */
export interface CallParty {
  id?: number | string;
  name?: string;
  username?: string;
  avatar?: string;
  avatar_url?: string;
}

/**
 * Realtime call signal as broadcast by the API. Fields are optional because the
 * same shape arrives wrapped (`{ call }`, `{ data: { call } }`) or flat.
 */
export interface CallSignal {
  id?: number | string;
  type?: string;
  room_name?: string;
  livekit_token?: string;
  livekit_host?: string;
  started_at?: string;
  message?: string;
  emoji?: string;
  conversation_id?: number;
  caller_id?: number;
  caller?: CallParty;
  caller_user?: CallParty;
  call?: CallSignal;
  data?: CallSignal;
}
