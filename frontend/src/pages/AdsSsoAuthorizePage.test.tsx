import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { AdsSsoAuthorizePage } from "@/pages/AdsSsoAuthorizePage";

const authState = vi.hoisted(() => ({ isAuthenticated: false, loading: false }));
const fetchMock = vi.hoisted(() => vi.fn());
const envState = vi.hoisted(() => ({ VITE_ADS_MANAGER_URL: "https://ads.example.test" }));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => authState,
}));
vi.mock("@/lib/api/authFetch", () => ({
  authFetch: fetchMock,
}));
vi.mock("@/config/env", () => ({
  env: envState,
}));

const STATE = "abcdefghijklmnop1234";
const originalLocation = window.location;
const assign = vi.fn();

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function renderPage(url = `/ads/sso/authorize?state=${STATE}`) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/ads/sso/authorize" element={<AdsSsoAuthorizePage />} />
        <Route path="/login" element={<p>login page</p>} />
        <Route path="/app/settings/upgrade" element={<p>upgrade page</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  authState.isAuthenticated = false;
  authState.loading = false;
  fetchMock.mockReset();
  assign.mockReset();
  envState.VITE_ADS_MANAGER_URL = "https://ads.example.test";
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { ...originalLocation, assign },
  });
});

afterEach(() => {
  Object.defineProperty(window, "location", { configurable: true, value: originalLocation });
});

describe("AdsSsoAuthorizePage", () => {
  it("sends signed-out users to login and returns them to this page", async () => {
    renderPage();
    expect(await screen.findByText("login page")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(assign).not.toHaveBeenCalled();
  });

  it("redirects to the Ads callback with exactly code and state after a successful call", async () => {
    authState.isAuthenticated = true;
    fetchMock.mockResolvedValue(
      jsonResponse(200, {
        success: true,
        data: {
          code: "one-time-code",
          redirect_uri: "https://ads.example.test/sso/callback?old=1",
          expires_in: 60,
        },
      }),
    );

    renderPage();

    await waitFor(() => expect(assign).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("/ads/sso/code");
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: "POST" });

    const target = new URL(assign.mock.calls[0][0] as string);
    expect(target.origin + target.pathname).toBe("https://ads.example.test/sso/callback");
    expect([...target.searchParams.keys()].sort()).toEqual(["code", "state"]);
    expect(target.searchParams.get("code")).toBe("one-time-code");
    expect(target.searchParams.get("state")).toBe(STATE);
  });

  it("shows an upgrade message and does not redirect on ads_upgrade_required", async () => {
    authState.isAuthenticated = true;
    fetchMock.mockResolvedValue(
      jsonResponse(403, { success: false, message: "Upgrade needed", errors: { code: "ads_upgrade_required" } }),
    );

    renderPage();

    expect(await screen.findByText("An upgrade is needed for Ads")).toBeInTheDocument();
    expect(assign).not.toHaveBeenCalled();
    const link = screen.getByRole("link", { name: "View upgrade options" });
    expect(link).toHaveAttribute("href", "/app/settings/upgrade");
  });

  it("also reads ads_upgrade_required from the top level of the body", async () => {
    authState.isAuthenticated = true;
    fetchMock.mockResolvedValue(jsonResponse(403, { code: "ads_upgrade_required", message: "Upgrade" }));

    renderPage();

    expect(await screen.findByText("An upgrade is needed for Ads")).toBeInTheDocument();
    expect(assign).not.toHaveBeenCalled();
  });

  it("does not redirect to a redirect_uri outside VITE_ADS_MANAGER_URL", async () => {
    authState.isAuthenticated = true;
    fetchMock.mockResolvedValue(
      jsonResponse(200, {
        success: true,
        data: { code: "c", redirect_uri: "https://evil.example.test/callback", expires_in: 60 },
      }),
    );

    renderPage();

    expect(await screen.findByText("Sign-in to Ads failed")).toBeInTheDocument();
    expect(assign).not.toHaveBeenCalled();
  });

  it("offers a retry on other errors and calls again when clicked", async () => {
    authState.isAuthenticated = true;
    fetchMock.mockResolvedValueOnce(jsonResponse(500, { message: "boom" }));
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        success: true,
        data: { code: "c2", redirect_uri: "https://ads.example.test/cb", expires_in: 60 },
      }),
    );

    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Try again" }));

    await waitFor(() => expect(assign).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("rejects a missing or too-short state without calling the API", async () => {
    authState.isAuthenticated = true;
    renderPage("/ads/sso/authorize?state=short");

    expect(await screen.findByText("This sign-in link is incomplete")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(assign).not.toHaveBeenCalled();
  });

  it("still redirects when StrictMode runs the effect twice", async () => {
    authState.isAuthenticated = true;
    fetchMock.mockResolvedValue(
      jsonResponse(200, {
        success: true,
        data: { code: "strict-code", redirect_uri: "https://ads.example.test/cb", expires_in: 60 },
      }),
    );

    render(
      <StrictMode>
        <MemoryRouter initialEntries={[`/ads/sso/authorize?state=${STATE}`]}>
          <Routes>
            <Route path="/ads/sso/authorize" element={<AdsSsoAuthorizePage />} />
          </Routes>
        </MemoryRouter>
      </StrictMode>,
    );

    await waitFor(() => expect(assign).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(new URL(assign.mock.calls[0][0] as string).searchParams.get("code")).toBe("strict-code");
  });
});
