import { createCookieSessionStorage } from "react-router";

export const adminSessionStorage = createCookieSessionStorage({
  cookie: {
    name: "admin_session",
    secure: process.env.NODE_ENV === "production",
    secrets: [process.env.SESSION_SECRET || "default_secret_key_change_me"],
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24, // 1 day
    httpOnly: true,
  },
});

export const { getSession, commitSession, destroySession } = adminSessionStorage;
