function getEnv(key: string, fallback: string): string {
  return import.meta.env[key] ?? fallback;
}

function getEnvNum(key: string, fallback: number): number {
  const raw = import.meta.env[key];
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function getRuntimeApiUrl(): string {
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host === "localhost" || host === "127.0.0.1") {
      return import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/v1";
    }
  }
  // Without a configured API address, use the same origin. A missing value
  // then fails visibly instead of silently calling another environment.
  return import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || "/api/v1";
}

/** Origin (scheme + host + port) of an absolute URL, or "" when it cannot be parsed. */
function originOf(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return "";
  }
}

function getRuntimeReverbHost(): string {
  const configured = import.meta.env.VITE_REVERB_HOST;
  if (configured) return configured;
  if (typeof window !== "undefined") {
    if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
      return "127.0.0.1";
    }
    // Same host as the page, so the realtime server is only reached where it is deployed.
    return window.location.hostname;
  }
  return "";
}

export const env = {
  VITE_APP_NAME: getEnv("VITE_APP_NAME", "MurihSpace"),
  VITE_API_BASE_URL: getRuntimeApiUrl(),
  VITE_API_URL: getRuntimeApiUrl(),
  /** Scheme + host of the API, used for Sanctum routes such as /sanctum/csrf-cookie. */
  API_ORIGIN: originOf(getRuntimeApiUrl()),
  VITE_GRAPH_API_URL: getEnv("VITE_GRAPH_API_URL", "http://localhost:8090/v1"),
  VITE_MARKETING_URL: getEnv("VITE_MARKETING_URL", ""),
  /** Ads Manager web app. Empty hides the sidebar and header entries. */
  VITE_ADS_MANAGER_URL: getEnv("VITE_ADS_MANAGER_URL", ""),
  VITE_ADS_API_URL: getEnv("VITE_ADS_API_URL", ""),
  /** LiveKit server for calls and live rooms. Empty means no media server is configured. */
  VITE_LIVEKIT_URL: getEnv("VITE_LIVEKIT_URL", ""),
  VITE_REVERB_APP_KEY: getEnv("VITE_REVERB_APP_KEY", "rw7h5bb6otwudl0ch8xx"),
  VITE_REVERB_HOST: getRuntimeReverbHost(),
  VITE_REVERB_PORT: getEnvNum("VITE_REVERB_PORT", 443),
  VITE_REVERB_SCHEME: getEnv("VITE_REVERB_SCHEME", "https"),
} as const;

export type Env = typeof env;
