function getEnv(key: string, fallback: string): string {
  return import.meta.env[key] ?? fallback;
}

function getEnvNum(key: string, fallback: number): number {
  const raw = import.meta.env[key];
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

export const env = {
  VITE_APP_NAME: getEnv("VITE_APP_NAME", "MurihSpace"),
  VITE_API_BASE_URL: getEnv("VITE_API_BASE_URL", "http://localhost:8000/api/v1"),
  VITE_API_URL: getEnv("VITE_API_URL", "http://localhost:8000/api/v1"),
  VITE_GRAPH_API_URL: getEnv("VITE_GRAPH_API_URL", "http://localhost:8090/v1"),
  VITE_MARKETING_URL: getEnv("VITE_MARKETING_URL", "http://localhost:3000"),
  VITE_ADS_API_URL: getEnv("VITE_ADS_API_URL", "https://ads.murihspace.com/api"),
  VITE_REVERB_APP_KEY: getEnv("VITE_REVERB_APP_KEY", ""),
  VITE_REVERB_HOST: getEnv("VITE_REVERB_HOST", "127.0.0.1"),
  VITE_REVERB_PORT: getEnvNum("VITE_REVERB_PORT", 8080),
  VITE_REVERB_SCHEME: getEnv("VITE_REVERB_SCHEME", "http"),
} as const;

export type Env = typeof env;
