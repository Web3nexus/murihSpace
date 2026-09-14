/**
 * Zero-dependency Web Audio API Sound Synthesizer for MurihSpace.
 * Synthesizes crisp, modern iOS/Telegram-style UI chimes & notification pops
 * without requiring external sound files to download.
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    if (!audioCtx) {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtxClass) {
        audioCtx = new AudioCtxClass();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  } catch {
    return null;
  }
}

/**
 * Check if chat sounds are enabled in localStorage or user preferences.
 */
export function isChatSoundEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('murihspace_chat_sounds') !== 'false';
}

export function setChatSoundEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('murihspace_chat_sounds', enabled ? 'true' : 'false');
}

/**
 * Plays a pleasant double-chime when a new chat message is received.
 * Tone: C6 (1046.5Hz) -> E6 (1318.5Hz) harmonic chime.
 */
export function playMessageReceivedSound(): void {
  if (!isChatSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;

    // Note 1: 1046.5 Hz (C6)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(1046.5, now);
    gain1.gain.setValueAtTime(0.12, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.15);

    // Note 2: 1318.5 Hz (E6) slightly delayed
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1318.5, now + 0.08);
    gain2.gain.setValueAtTime(0.15, now + 0.08);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.08);
    osc2.stop(now + 0.28);
  } catch {
    // Ignore audio errors silently (e.g. user hasn't interacted with page yet)
  }
}

/**
 * Plays an upbeat pop/ping for general notifications.
 */
export function playNotificationSound(): void {
  if (!isChatSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(880, now); // A5
    osc.frequency.exponentialRampToValueAtTime(1760, now + 0.12); // A6 sweep
    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.2);
  } catch {
    // Ignore
  }
}

/**
 * Plays a light, subtle click/pop for sent messages.
 */
export function playMessageSentSound(): void {
  if (!isChatSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(700, now);
    osc.frequency.exponentialRampToValueAtTime(1200, now + 0.06);
    gain.gain.setValueAtTime(0.07, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.08);
  } catch {
    // Ignore
  }
}
