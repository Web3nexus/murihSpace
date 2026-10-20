import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { env } from "@/config/env";
import { createBroadcastAuthorizer } from "@/lib/broadcastAuth";

const AUTH_URL = `${env.API_ORIGIN}/broadcasting/auth`;

function setXsrfCookie(value: string | null) {
  document.cookie = value === null
    ? "XSRF-TOKEN=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/"
    : `XSRF-TOKEN=${encodeURIComponent(value)}; path=/`;
}

function headerOf(init: RequestInit | undefined, name: string): string | null {
  return new Headers(init?.headers).get(name);
}

function bodyOf(init: RequestInit | undefined): URLSearchParams {
  return new URLSearchParams(init?.body as string);
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  setXsrfCookie("csrf/token==");
});

afterEach(() => {
  vi.unstubAllGlobals();
  setXsrfCookie(null);
});

describe("createBroadcastAuthorizer", () => {
  it("POSTs socket_id and channel_name to the API origin with cookies included", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ auth: "key:sig" }));
    vi.stubGlobal("fetch", fetchMock);
    const authorize = createBroadcastAuthorizer();

    await new Promise<void>((resolve) => {
      authorize({ socketId: "123.456", channelName: "private-chat.1" }, () => resolve());
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(AUTH_URL);
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("include");
    expect(headerOf(init, "Accept")).toBe("application/json");
    expect(headerOf(init, "Content-Type")).toBe("application/x-www-form-urlencoded");
    expect(bodyOf(init).get("socket_id")).toBe("123.456");
    expect(bodyOf(init).get("channel_name")).toBe("private-chat.1");
  });

  it("sends the decoded XSRF-TOKEN cookie as X-XSRF-TOKEN", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ auth: "key:sig" }));
    vi.stubGlobal("fetch", fetchMock);

    await new Promise<void>((resolve) => {
      createBroadcastAuthorizer()({ socketId: "1.2", channelName: "private-x" }, () => resolve());
    });

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(headerOf(init, "X-XSRF-TOKEN")).toBe("csrf/token==");
  });

  it("sends no Authorization header for a cookie session", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ auth: "key:sig" }));
    vi.stubGlobal("fetch", fetchMock);

    await new Promise<void>((resolve) => {
      createBroadcastAuthorizer()({ socketId: "1.2", channelName: "private-x" }, () => resolve());
    });

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(headerOf(init, "Authorization")).toBeNull();
  });

  it("passes the auth payload to the callback on success", async () => {
    const payload = { auth: "key:sig", channel_data: '{"user_id":1}' };
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(payload)));
    const callback = vi.fn();

    await createBroadcastAuthorizer()({ socketId: "1.2", channelName: "private-x" }, callback);

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(null, payload);
  });

  it("reports a non-OK response to the callback as an error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ message: "Unauthenticated." }, 401)));
    const callback = vi.fn();

    await createBroadcastAuthorizer()({ socketId: "1.2", channelName: "private-x" }, callback);

    expect(callback).toHaveBeenCalledTimes(1);
    const [error, data] = callback.mock.calls[0];
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toContain("401");
    expect(data).toBeNull();
  });

  it("reports a network failure to the callback as an error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    }));
    const callback = vi.fn();

    await createBroadcastAuthorizer()({ socketId: "1.2", channelName: "private-x" }, callback);

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback.mock.calls[0][0]).toBeInstanceOf(TypeError);
    expect(callback.mock.calls[0][1]).toBeNull();
  });
});
