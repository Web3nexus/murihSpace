import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AxiosError, type AxiosAdapter, type AxiosResponse, type InternalAxiosRequestConfig } from "axios";
import { env } from "@/config/env";
import { authFetch } from "@/lib/api/authFetch";
import { apiClient } from "@/lib/api/client";
import { readXsrfToken } from "@/lib/api/csrf";

const CSRF_URL = `${env.API_ORIGIN}/sanctum/csrf-cookie`;

function setXsrfCookie(value: string | null) {
  document.cookie = value === null
    ? "XSRF-TOKEN=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/"
    : `XSRF-TOKEN=${encodeURIComponent(value)}; path=/`;
}

function headerOf(init: RequestInit | undefined, name: string): string | null {
  return new Headers(init?.headers).get(name);
}

beforeEach(() => {
  setXsrfCookie(null);
});

afterEach(() => {
  vi.unstubAllGlobals();
  setXsrfCookie(null);
});

describe("readXsrfToken", () => {
  it("returns the XSRF-TOKEN cookie decoded", () => {
    setXsrfCookie("abc/def==");
    expect(readXsrfToken()).toBe("abc/def==");
  });

  it("returns null when the cookie is absent", () => {
    expect(readXsrfToken()).toBeNull();
  });
});

describe("authFetch", () => {
  it("sends the decoded XSRF token and credentials on unsafe methods", async () => {
    setXsrfCookie("tok/en==");
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await authFetch("/orders", { method: "POST", body: "{}" });

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`${env.VITE_API_BASE_URL}/orders`);
    expect(init.credentials).toBe("include");
    expect(headerOf(init, "X-XSRF-TOKEN")).toBe("tok/en==");
  });

  it("includes credentials but no CSRF header on safe methods", async () => {
    setXsrfCookie("tok");
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await authFetch("/feed");

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.credentials).toBe("include");
    expect(headerOf(init, "X-XSRF-TOKEN")).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("fetches the CSRF cookie from the API origin when it is missing", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === CSRF_URL) {
        setXsrfCookie("fresh");
        return new Response(null, { status: 204 });
      }
      return new Response("{}", { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    await authFetch("/likes", { method: "PUT" });

    const [csrfUrl, csrfInit] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(csrfUrl).toBe(CSRF_URL);
    expect(csrfInit.credentials).toBe("include");
    const [, init] = fetchMock.mock.calls[1] as unknown as [string, RequestInit];
    expect(headerOf(init, "X-XSRF-TOKEN")).toBe("fresh");
  });

  it("refreshes the CSRF cookie and retries once after a 419", async () => {
    setXsrfCookie("stale");
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === CSRF_URL) {
        setXsrfCookie("renewed");
        return new Response(null, { status: 204 });
      }
      return headerOf(init, "X-XSRF-TOKEN") === "renewed"
        ? new Response("{}", { status: 200 })
        : new Response("{}", { status: 419 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const res = await authFetch("/orders", { method: "DELETE" });

    expect(res.status).toBe(200);
    const sent = fetchMock.mock.calls.filter(([u]) => u !== CSRF_URL);
    expect(sent).toHaveLength(2);
    expect(headerOf(sent[0]![1] as RequestInit, "X-XSRF-TOKEN")).toBe("stale");
    expect(headerOf(sent[1]![1] as RequestInit, "X-XSRF-TOKEN")).toBe("renewed");
  });

  it("does not send a bearer token for a regular session", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    localStorage.setItem("murihspace-token", "should-not-be-sent");

    await authFetch("/user");

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(headerOf(init, "Authorization")).toBeNull();
    localStorage.removeItem("murihspace-token");
  });
});

describe("apiClient", () => {
  it("is configured to send credentials", () => {
    expect(apiClient.defaults.withCredentials).toBe(true);
  });

  it("adds the XSRF header to unsafe requests", async () => {
    setXsrfCookie("axios/token");
    let seen: InternalAxiosRequestConfig | undefined;
    const adapter: AxiosAdapter = async (config) => {
      seen = config;
      return { data: {}, status: 200, statusText: "OK", headers: {}, config } as AxiosResponse;
    };

    await apiClient.post("/auth/logout", {}, { adapter });

    expect(seen?.headers.get("X-XSRF-TOKEN")).toBe("axios/token");
  });

  it("retries a 419 once with a refreshed CSRF token", async () => {
    setXsrfCookie("old");
    const fetchMock = vi.fn(async (url: string) => {
      if (url === CSRF_URL) {
        setXsrfCookie("new");
        return new Response(null, { status: 204 });
      }
      return new Response("{}", { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    let calls = 0;
    const tokens: unknown[] = [];
    const adapter: AxiosAdapter = async (config) => {
      calls += 1;
      tokens.push(config.headers.get("X-XSRF-TOKEN"));
      if (calls === 1) {
        throw new AxiosError("Request failed", "ERR_BAD_REQUEST", config, null, {
          status: 419,
          statusText: "Page Expired",
          headers: {},
          data: {},
          config,
        } as AxiosResponse);
      }
      return { data: { ok: true }, status: 200, statusText: "OK", headers: {}, config } as AxiosResponse;
    };

    const res = await apiClient.post("/profile", {}, { adapter });

    expect(res.status).toBe(200);
    expect(calls).toBe(2);
    expect(tokens).toEqual(["old", "new"]);
  });

  it("stops after one 419 retry when the 419 persists", async () => {
    setXsrfCookie("old");
    const fetchMock = vi.fn(async (url: string) => {
      if (url === CSRF_URL) {
        setXsrfCookie("new");
        return new Response(null, { status: 204 });
      }
      return new Response("{}", { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    let calls = 0;
    const adapter: AxiosAdapter = async (config) => {
      calls += 1;
      throw new AxiosError("Request failed", "ERR_BAD_REQUEST", config, null, {
        status: 419,
        statusText: "Page Expired",
        headers: {},
        data: {},
        config,
      } as AxiosResponse);
    };

    await expect(apiClient.post("/profile", {}, { adapter })).rejects.toMatchObject({ status: 419 });
    expect(calls).toBe(2);
  });
});
