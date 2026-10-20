import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/api/client", () => ({
  apiClient: { get: vi.fn(), post: vi.fn() },
}));

import { apiClient } from "@/lib/api/client";
import { AuthProvider, useAuth } from "@/hooks/useAuth";

const profile = {
  id: 7,
  name: "Ada Creator",
  email: "ada@example.com",
  username: "ada",
  role: "creator",
  email_verified: true,
};

const get = vi.mocked(apiClient.get);
const post = vi.mocked(apiClient.post);

let container: HTMLDivElement;
let root: Root;
const harness: { auth: ReturnType<typeof useAuth> | null } = { auth: null };

function Probe() {
  const value = useAuth();
  useEffect(() => {
    harness.auth = value;
  });
  return null;
}

async function mount() {
  await act(async () => {
    root.render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
  });
  // Let the initial /user check settle.
  await act(async () => {
    await Promise.resolve();
  });
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  harness.auth = null;
  get.mockReset();
  post.mockReset();
  // Guest on load: the cookie session does not exist yet.
  get.mockRejectedValue({ status: 401, message: "Unauthenticated." });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

describe("AuthProvider session handling", () => {
  it("stores no token after a password login", async () => {
    post.mockImplementation(async (url: string) => {
      if (url === "/auth/login") {
        // The server sets the session cookie and returns no token.
        return { status: 200, data: { success: true, data: { token: null, user: profile } } } as never;
      }
      return { status: 200, data: {} } as never;
    });
    get.mockImplementation(async () => {
      if (post.mock.calls.some(([u]) => u === "/auth/login")) {
        return { data: { success: true, data: profile } } as never;
      }
      throw { status: 401, message: "Unauthenticated." };
    });

    await mount();
    let result: unknown = null;
    await act(async () => {
      result = await harness.auth!.login("ada@example.com", "secret-password");
    });

    expect(result).toMatchObject({ id: 7, name: "Ada Creator" });
    expect(harness.auth!.user?.id).toBe(7);
    expect(localStorage.getItem("murihspace-token")).toBeNull();
    expect(localStorage.getItem("auth_token")).toBeNull();
    expect(sessionStorage.getItem("impersonation_token")).toBeNull();
    // The user is loaded from /user rather than from the login body.
    expect(get).toHaveBeenCalledWith("/user");
    // No stored value anywhere carries a token field or a bearer value.
    const saved = JSON.parse(localStorage.getItem("murihspace-saved-accounts") ?? "[]") as Record<string, unknown>[];
    expect(saved).toHaveLength(1);
    expect(saved[0]).not.toHaveProperty("token");
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)!;
      expect(localStorage.getItem(key)).not.toMatch(/bearer|eyJ/i);
    }
  });

  it("clears local state on logout and posts to the logout endpoint", async () => {
    post.mockImplementation(async (url: string) => {
      if (url === "/auth/login") {
        return { status: 200, data: { success: true, data: { token: null, user: profile } } } as never;
      }
      return { status: 200, data: {} } as never;
    });
    get.mockImplementation(async () => {
      if (post.mock.calls.some(([u]) => u === "/auth/login")) {
        return { data: { success: true, data: profile } } as never;
      }
      throw { status: 401, message: "Unauthenticated." };
    });

    await mount();
    await act(async () => {
      await harness.auth!.login("ada@example.com", "secret-password");
    });
    await act(async () => {
      await harness.auth!.logout();
    });

    expect(post).toHaveBeenCalledWith("/auth/logout");
    expect(harness.auth!.user).toBeNull();
    expect(localStorage.getItem("user_data")).toBeNull();
    const saved = JSON.parse(localStorage.getItem("murihspace-saved-accounts") ?? "[]") as unknown[];
    expect(saved).toHaveLength(0);
  });

  it("does not ask the API for a user when no sign-in is remembered", async () => {
    await mount();
    expect(get).not.toHaveBeenCalled();
    expect(harness.auth!.loading).toBe(false);
  });

  it("removes bearer tokens left in storage by an older build on load", async () => {
    localStorage.setItem("murihspace-token", "old-bearer");
    localStorage.setItem("auth_token", "older-bearer");
    await mount();
    expect(localStorage.getItem("murihspace-token")).toBeNull();
    expect(localStorage.getItem("auth_token")).toBeNull();
    expect(harness.auth!.user).toBeNull();
  });

  it("reports a failed session after a verified OTP login instead of returning a result", async () => {
    post.mockImplementation(async (url: string) => {
      if (url === "/auth/otp/verify") {
        return { status: 200, data: { success: true, data: { verified: true, account_exists: true, token: null } } } as never;
      }
      return { status: 200, data: {} } as never;
    });

    await mount();
    let result: unknown = "unset";
    await act(async () => {
      result = await harness.auth!.verifyOtp({ intent: "login", phoneE164: "+15550001234", code: "123456" });
    });

    expect(result).toBeNull();
    expect(harness.auth!.error).toBe("Could not load your account. Please try again.");
  });
});
