import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdsApiError, adsRequest } from "../app/lib/ads-api";
import { sendToStaffSignIn } from "../app/lib/staff-session";

vi.mock("../app/lib/staff-session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../app/lib/staff-session")>();
  return { ...actual, sendToStaffSignIn: vi.fn() };
});

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function lastHeaders(fetchMock: ReturnType<typeof vi.fn>): Record<string, string> {
  const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
  return init.headers as Record<string, string>;
}

describe("adsRequest", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_ADS_API_URL", "https://ads.test");
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("sends the staff token as a Bearer header on admin calls", async () => {
    window.localStorage.setItem("ads_token", "staff-token");
    const fetchMock = vi.fn(async () => jsonResponse({ data: [] }, 200));
    vi.stubGlobal("fetch", fetchMock);

    await adsRequest("/admin/advertisers/pending");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0] as unknown as [string];
    expect(url).toBe("https://ads.test/api/admin/advertisers/pending");
    expect(lastHeaders(fetchMock).Authorization).toBe("Bearer staff-token");
  });

  it("sends the user to staff sign-in on a 401 from an admin call", async () => {
    window.localStorage.setItem("ads_token", "expired-token");
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ message: "Unauthenticated." }, 401)));

    await expect(adsRequest("/admin/advertisers/pending")).rejects.toMatchObject({
      status: 401,
      message: "Unauthenticated.",
    });
    expect(sendToStaffSignIn).toHaveBeenCalledTimes(1);
  });

  it("sends the user to staff sign-in on a 403 from an admin call", async () => {
    window.localStorage.setItem("ads_token", "advertiser-token");
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ message: "Forbidden." }, 403)));

    await expect(adsRequest("/admin/advertisers/1/verify", { method: "POST", body: {} })).rejects.toBeInstanceOf(
      AdsApiError
    );
    expect(sendToStaffSignIn).toHaveBeenCalledTimes(1);
  });

  it("does not redirect on a 401 from an advertiser call", async () => {
    window.localStorage.setItem("ads_token", "advertiser-token");
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ message: "Unauthenticated." }, 401)));

    await expect(adsRequest("/campaigns")).rejects.toMatchObject({ status: 401 });
    expect(sendToStaffSignIn).not.toHaveBeenCalled();
  });

  it("does not call the API on an admin path without a staff token", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(adsRequest("/admin/advertisers/pending")).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(sendToStaffSignIn).toHaveBeenCalledTimes(1);
  });
});
