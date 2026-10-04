import type { Room } from "livekit-client";

/**
 * Registry of live media sessions (calls, meetings, live broadcasts) that
 * outlive the React component that created them.
 *
 * The bug this exists to prevent: each surface used to own its LiveKit `Room`
 * and tore it down in an unmount cleanup. Opening another route, opening the
 * mobile nav drawer, or a React strict-mode double effect therefore ended the
 * call for everyone else — the roster emptied and a host lost the room just
 * because they clicked a link.
 *
 * The rules enforced here:
 *  - a session ends on an *explicit* user action, a genuine media failure, or
 *    expiry — never because a view stopped rendering;
 *  - the media `Room` is owned by this module, so the mini-player and the full
 *    screen view can both attach to it;
 *  - the backend is told about a leave exactly once, and only when the user
 *    actually left.
 */

export type LiveSessionKind = "call" | "meeting" | "live";

export type LiveSessionStatus = "connecting" | "connected" | "reconnecting" | "ended";

export type LiveSessionEndReason =
  | "left"
  | "host-ended"
  | "replaced"
  | "error"
  | "signed-out";

export interface LiveSessionRecord {
  id: string;
  kind: LiveSessionKind;
  title: string;
  subtitle: string | null;
  avatarUrl: string | null;
  status: LiveSessionStatus;
  isMuted: boolean;
  isCameraOn: boolean;
  isSpeaking: boolean;
  participantCount: number;
  startedAt: number;
  /** Route that re-opens the full-screen view for this session. */
  returnTo: string | null;
  /** True while a page is rendering the full-screen view for this session. */
  isExpanded: boolean;
}

interface SessionEntry {
  record: LiveSessionRecord;
  room: Room | null;
  /** Sends the authoritative "I left" signal to the API, at most once. */
  notifyLeave: (() => Promise<unknown> | unknown) | null;
  /** Fires when the session ends for any reason (broadcast ended, etc.). */
  onEnded: ((reason: LiveSessionEndReason) => void) | null;
  /** Audio elements LiveKit appended to <body> for this session. */
  ownedAudio: Set<HTMLAudioElement>;
  leaveSent: boolean;
}

export interface StartLiveSessionInput {
  id: string;
  kind: LiveSessionKind;
  title: string;
  subtitle?: string | null;
  avatarUrl?: string | null;
  returnTo?: string | null;
  notifyLeave?: (() => Promise<unknown> | unknown) | null;
  onEnded?: ((reason: LiveSessionEndReason) => void) | null;
  isMuted?: boolean;
  isCameraOn?: boolean;
}

export interface LiveSessionHandle {
  readonly id: string;
  getRoom(): Room | null;
  setRoom(room: Room | null): void;
  patch(patch: Partial<Omit<LiveSessionRecord, "id">>): void;
  /** Mark the full-screen surface as mounted/unmounted; never ends the session. */
  setExpanded(expanded: boolean): void;
  setMuted(muted: boolean): void;
  setCameraOn(on: boolean): void;
  /** Explicit user action: tells the server and tears the media down. */
  end(reason?: LiveSessionEndReason): Promise<void>;
  /** Ends the session without contacting the server (host already did). */
  close(reason: LiveSessionEndReason): void;
}

type Listener = () => void;

const sessions = new Map<string, SessionEntry>();
const listeners = new Set<Listener>();
let snapshot: LiveSessionRecord[] = [];

function emit(): void {
  snapshot = Array.from(sessions.values()).map((entry) => entry.record);
  listeners.forEach((listener) => listener());
}

function entry(id: string): SessionEntry | undefined {
  return sessions.get(id);
}

function patchRecord(id: string, patch: Partial<Omit<LiveSessionRecord, "id">>): void {
  const current = entry(id);
  if (!current) return;

  current.record = { ...current.record, ...patch };
  emit();
}

/**
 * Applies a mute to every audio element this session owns.
 *
 * LiveKit attaches remote audio to a caller-supplied element when there is one,
 * but otherwise creates its own and appends it to `<body>`. Tracking the
 * fallbacks here means muting from the mini-player works even while the full
 * screen player is unmounted, and never touches another session's audio.
 */
function applyAudioMute(target: SessionEntry, muted: boolean, resumePlayback = false): void {
  target.ownedAudio.forEach((element) => {
    element.muted = muted;
  });

  if (!muted && resumePlayback) {
    target.ownedAudio.forEach((element) => {
      void element.play().catch(() => {
        // Autoplay policy can still refuse; the UI surfaces an unmute affordance.
      });
    });
  }
}

function trackOwnsAudio(target: SessionEntry, element: HTMLAudioElement | null | undefined): void {
  if (element) {
    element.muted = target.record.isMuted;
    target.ownedAudio.add(element);
  }
}

function releaseRoom(target: SessionEntry): void {
  const room = target.room;
  target.room = null;

  if (room) {
    void room.disconnect().catch(() => undefined);
  }

  // Remove fallback audio elements so a finished session cannot keep playing.
  target.ownedAudio.forEach((element) => {
    element.pause();
    element.remove();
  });
  target.ownedAudio.clear();
}

function finish(id: string, reason: LiveSessionEndReason): void {
  const target = entry(id);
  if (!target) return;

  const shouldNotify = reason === "left" && !target.leaveSent;
  if (shouldNotify && target.notifyLeave) {
    target.leaveSent = true;
  }

  releaseRoom(target);

  target.record = { ...target.record, status: "ended" };
  emit();

  try {
    target.onEnded?.(reason);
  } catch {
    // A consumer's teardown callback must not block the store from cleaning up.
  }

  if (shouldNotify && target.notifyLeave) {
    void Promise.resolve(target.notifyLeave()).catch(() => undefined);
  }

  sessions.delete(id);
  emit();
}

export const liveSessionStore = {
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  getSnapshot(): LiveSessionRecord[] {
    return snapshot;
  },

  list(): LiveSessionRecord[] {
    return snapshot;
  },

  find(id: string): LiveSessionRecord | undefined {
    return entry(id)?.record;
  },

  getRoom(id: string): Room | null {
    return entry(id)?.room ?? null;
  },

  /**
   * Starts (or re-attaches to) a session. Calling this twice for the same id is
   * a no-op, so a re-render can never spawn a second room.
   */
  start(input: StartLiveSessionInput): LiveSessionHandle {
    const existing = entry(input.id);

    if (existing) {
      existing.record = {
        ...existing.record,
        title: input.title ?? existing.record.title,
        subtitle: input.subtitle ?? existing.record.subtitle,
        avatarUrl: input.avatarUrl ?? existing.record.avatarUrl,
        returnTo: input.returnTo ?? existing.record.returnTo,
      };
      // A re-attach must not make the session "left" twice.
      existing.leaveSent = false;
      if (input.notifyLeave) existing.notifyLeave = input.notifyLeave;
      if (input.onEnded) existing.onEnded = input.onEnded;
      emit();

      return handleFor(input.id);
    }

    sessions.set(input.id, {
      record: {
        id: input.id,
        kind: input.kind,
        title: input.title,
        subtitle: input.subtitle ?? null,
        avatarUrl: input.avatarUrl ?? null,
        status: "connecting",
        isMuted: input.isMuted ?? true,
        isCameraOn: input.isCameraOn ?? false,
        isSpeaking: false,
        participantCount: 1,
        startedAt: Date.now(),
        returnTo: input.returnTo ?? null,
        isExpanded: false,
      },
      room: null,
      notifyLeave: input.notifyLeave ?? null,
      onEnded: input.onEnded ?? null,
      ownedAudio: new Set(),
      leaveSent: false,
    });

    emit();

    return handleFor(input.id);
  },

  setRoom(id: string, room: Room | null): void {
    const target = entry(id);
    if (!target) return;

    target.room = room;
    patchRecord(id, { status: room ? "connected" : "connecting" });
  },

  patch(id: string, patch: Partial<Omit<LiveSessionRecord, "id">>): void {
    const target = entry(id);
    if (!target) return;

    if (patch.isMuted !== undefined && patch.isMuted !== target.record.isMuted) {
      applyAudioMute(target, patch.isMuted, !patch.isMuted);
    }

    patchRecord(id, patch);
  },

  /** Adopts an audio element LiveKit created and appended to `<body>`. */
  adoptAudioElement(id: string, element: HTMLAudioElement | null): void {
    const target = entry(id);
    if (target) trackOwnsAudio(target, element);
  },

  setExpanded(id: string, expanded: boolean): void {
    patchRecord(id, { isExpanded: expanded });
  },

  /** Reports a genuine media failure so the session can be torn down. */
  reportFailure(id: string): void {
    finish(id, "error");
  },

  /** Ends without a server call, used when the host already ended it for all. */
  close(id: string, reason: LiveSessionEndReason = "host-ended"): void {
    finish(id, reason);
  },

  async end(id: string, reason: LiveSessionEndReason = "left"): Promise<void> {
    finish(id, reason);
  },

  /** Ends every session, e.g. on sign-out, so nothing keeps publishing. */
  endAll(reason: LiveSessionEndReason = "signed-out"): void {
    Array.from(sessions.keys()).forEach((id) => finish(id, reason));
  },
};

function handleFor(id: string): LiveSessionHandle {
  return {
    id,

    getRoom() {
      return liveSessionStore.getRoom(id);
    },

    setRoom(room) {
      liveSessionStore.setRoom(id, room);
    },

    patch(patch) {
      liveSessionStore.patch(id, patch);
    },

    setExpanded(expanded) {
      liveSessionStore.setExpanded(id, expanded);
    },

    setMuted(muted) {
      const room = liveSessionStore.getRoom(id);
      void room?.localParticipant.setMicrophoneEnabled(!muted).catch(() => undefined);
      liveSessionStore.patch(id, { isMuted: muted });
    },

    setCameraOn(on) {
      const room = liveSessionStore.getRoom(id);
      void room?.localParticipant.setCameraEnabled(on).catch(() => undefined);
      liveSessionStore.patch(id, { isCameraOn: on });
    },

    async end(reason = "left") {
      await liveSessionStore.end(id, reason);
    },

    close(reason = "host-ended") {
      liveSessionStore.close(id, reason);
    },
  };
}