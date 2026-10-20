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

const admin = { id: 1, name: "Site Admin", email: "admin@example.com", role: "admin", email_verified: true };
const target = {
  id: 9,
  name: "Ada Member",
  email: "ada@example.com",
  username: "ada",
  role: "member",
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
}

/** The cookie session decides who /user returns, so the mock follows the server state. */
let serverUser: unknown = admin;

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  harness.auth = null;
  get.mockReset();
  post.mockReset();
  serverUser = admin;
  get.mockImplementation(async () => ({ data: { success: true, data: serverUser } }) as never);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

function expectNoStoredCredentials() {
  expect(sessionStorage.length).toBe(0);
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)!;
    expect(key).not.toMatch(/token|impersonat/i);
    expect(localStorage.getItem(key)).not.toMatch(/bearer|eyJ/i);
  }
}

describe("impersonation through the cookie session", () => {
  it("stores no token while impersonating and reloads the target from /user", async () => {
    post.mockImplementation(async (url: string) => {
      if (url === "/securegate/users/9/impersonate") {
        serverUser = { ...target, impersonating: true };
        return { status: 200, data: { success: true, data: { impersonating: true, user: target } } } as never;
      }
      return { status: 200, data: {} } as never;
    });

    await mount();
    let started = false;
    await act(async () => {
      started = await harness.auth!.startImpersonation(9);
    });

    expect(started).toBe(true);
    expect(post).toHaveBeenCalledWith("/securegate/users/9/impersonate");
    expect(get).toHaveBeenLastCalledWith("/user");
    expect(harness.auth!.user).toMatchObject({ id: 9, name: "Ada Member", impersonating: true });
    expectNoStoredCredentials();
  });

  it("keeps the administrator signed in when impersonation is refused", async () => {
    post.mockRejectedValue({ status: 403, message: "Forbidden." });

    await mount();
    await act(async () => {
      await harness.auth!.refreshUser();
    });
    let started = true;
    await act(async () => {
      started = await harness.auth!.startImpersonation(9);
    });

    expect(started).toBe(false);
    expect(harness.auth!.user).toMatchObject({ id: 1, role: "admin" });
    expect(harness.auth!.user?.impersonating).toBeUndefined();
    expectNoStoredCredentials();
  });

  it("stops impersonation with the stop endpoint and reloads the administrator", async () => {
    serverUser = { ...target, impersonating: true };
    post.mockImplementation(async (url: string) => {
      if (url === "/auth/stop-impersonate") {
        serverUser = admin;
        return { status: 200, data: { success: true } } as never;
      }
      return { status: 200, data: {} } as never;
    });

    await mount();
    await act(async () => {
      await harness.auth!.refreshUser();
    });
    expect(harness.auth!.user?.impersonating).toBe(true);

    let stopped = false;
    await act(async () => {
      stopped = await harness.auth!.stopImpersonation();
    });

    expect(stopped).toBe(true);
    expect(post).toHaveBeenCalledWith("/auth/stop-impersonate");
    expect(get).toHaveBeenLastCalledWith("/user");
    expect(harness.auth!.user).toMatchObject({ id: 1, role: "admin" });
    expect(harness.auth!.user?.impersonating).toBeUndefined();
    expectNoStoredCredentials();
  });

  it("still reloads the administrator when the stop request fails", async () => {
    serverUser = { ...target, impersonating: true };
    post.mockRejectedValue({ status: 500, message: "Server error." });

    await mount();
    await act(async () => {
      await harness.auth!.refreshUser();
    });
    serverUser = admin;
    get.mockClear();

    await act(async () => {
      await harness.auth!.stopImpersonation();
    });

    expect(get).toHaveBeenCalledWith("/user");
    expect(harness.auth!.user).toMatchObject({ id: 1, role: "admin" });
  });
});
