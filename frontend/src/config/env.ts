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
    if (host.includes("staging.murihspace.com") || host.includes("api-staging")) {
      return "https://api-staging.murihspace.com/api/v1";
    }
    if (host === "localhost" || host === "127.0.0.1") {
      return import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/v1";
    }
  }
  return import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || "https://api-staging.murihspace.com/api/v1";
}

function getRuntimeReverbHost(): string {
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host.includes("staging.murihspace.com") || host.includes("api-staging")) {
      return "api-staging.murihspace.com";
    }
    if (host === "localhost" || host === "127.0.0.1") {
      return import.meta.env.VITE_REVERB_HOST || "127.0.0.1";
    }
  }
  return import.meta.env.VITE_REVERB_HOST || "api-staging.murihspace.com";
}

export const env = {
  VITE_APP_NAME: getEnv("VITE_APP_NAME", "MurihSpace"),
  VITE_API_BASE_URL: getRuntimeApiUrl(),
  VITE_API_URL: getRuntimeApiUrl(),
  VITE_GRAPH_API_URL: getEnv("VITE_GRAPH_API_URL", "http://localhost:8090/v1"),
  VITE_MARKETING_URL: getEnv("VITE_MARKETING_URL", "http://localhost:3000"),
  VITE_ADS_API_URL: getEnv("VITE_ADS_API_URL", "https://ads.murihspace.com/api"),
  VITE_REVERB_APP_KEY: getEnv("VITE_REVERB_APP_KEY", "rw7h5bb6otwudl0ch8xx"),
  VITE_REVERB_HOST: getRuntimeReverbHost(),
  VITE_REVERB_PORT: getEnvNum("VITE_REVERB_PORT", 443),
  VITE_REVERB_SCHEME: getEnv("VITE_REVERB_SCHEME", "https"),
} as const;

export type Env = typeof env;
