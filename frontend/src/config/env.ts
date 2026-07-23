import { z } from "zod";

const envSchema = z.object({
  VITE_APP_NAME: z.string().min(1, "VITE_APP_NAME is required"),
  VITE_API_BASE_URL: z.string().url("VITE_API_BASE_URL must be a valid URL"),
  VITE_REVERB_APP_KEY: z.string().optional().default(""),
  VITE_REVERB_HOST: z.string().min(1, "VITE_REVERB_HOST is required"),
  VITE_REVERB_PORT: z.coerce.number().int().positive("VITE_REVERB_PORT must be a positive integer"),
  VITE_REVERB_SCHEME: z.enum(["http", "https", "ws", "wss"]),
});

const rawEnv = {
  VITE_APP_NAME: import.meta.env.VITE_APP_NAME,
  VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL,
  VITE_REVERB_APP_KEY: import.meta.env.VITE_REVERB_APP_KEY,
  VITE_REVERB_HOST: import.meta.env.VITE_REVERB_HOST,
  VITE_REVERB_PORT: import.meta.env.VITE_REVERB_PORT,
  VITE_REVERB_SCHEME: import.meta.env.VITE_REVERB_SCHEME,
};

const parsed = envSchema.safeParse(rawEnv);

if (!parsed.success) {
  const issues = JSON.stringify(parsed.error.format(), null, 2);
  console.error("❌ Invalid environment variables:\n", issues);
  throw new Error(`Invalid environment configuration: ${issues}`);
}

export const env = parsed.data;
export type Env = z.infer<typeof envSchema>;
