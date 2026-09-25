const LIVE_SESSION_STORAGE_KEY = "murihspace_live_session_id";
const LIVE_SESSION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;

function isValidLiveSessionId(value: string): boolean {
  return LIVE_SESSION_PATTERN.test(value);
}

function createLiveSessionId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  const bytes = new Uint8Array(32);
  if (typeof globalThis.crypto?.getRandomValues === "function") {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }

  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}

export function isLiveRequest(path: string): boolean {
  const normalized = path.toLowerCase();
  return normalized.includes("/live") || normalized.startsWith("live/");
}

export function getLiveSessionId(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const stored = window.localStorage.getItem(LIVE_SESSION_STORAGE_KEY);
    if (stored && isValidLiveSessionId(stored)) {
      return stored;
    }

    const sessionId = createLiveSessionId();
    window.localStorage.setItem(LIVE_SESSION_STORAGE_KEY, sessionId);
    return sessionId;
  } catch {
    return null;
  }
}

export { LIVE_SESSION_STORAGE_KEY };
