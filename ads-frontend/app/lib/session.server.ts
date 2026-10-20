import { randomBytes } from "node:crypto";
import { createCookieSessionStorage } from "react-router";

/**
 * Cookie signing secret. There is no fallback value in source.
 *
 * - production: SESSION_SECRET must be set. Startup fails without it.
 * - development: a random secret is generated when the server starts. Nothing
 *   is written to disk, and sessions become invalid after a restart.
 */
function resolveSessionSecret(): string {
  const configured = process.env.SESSION_SECRET?.trim();
  if (configured) return configured;

  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET must be set in production. Refusing to start without it.");
  }

  return randomBytes(32).toString("hex");
}

export const adminSessionStorage = createCookieSessionStorage({
  cookie: {
    name: "admin_session",
    secure: process.env.NODE_ENV === "production",
    secrets: [resolveSessionSecret()],
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24, // 1 day
    httpOnly: true,
  },
});

export const { getSession, commitSession, destroySession } = adminSessionStorage;
