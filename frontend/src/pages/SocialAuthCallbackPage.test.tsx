import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { SocialAuthCallbackPage } from "@/pages/SocialAuthCallbackPage";

const fetchMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api/authFetch", () => ({
  authFetch: fetchMock,
}));

const SESSION_HINT_KEY = "murihspace-session-hint";
const originalLocation = window.location;
const replace = vi.fn();

function setLocation(search: string, hash = "") {
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { ...originalLocation, search, hash, replace, assign: vi.fn() },
  });
}

function renderPage() {
  return render(
    <MemoryRouter>
      <SocialAuthCallbackPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  fetchMock.mockReset();
  replace.mockReset();
  localStorage.removeItem(SESSION_HINT_KEY);
  sessionStorage.clear();
});

afterEach(() => {
  Object.defineProperty(window, "location", { configurable: true, value: originalLocation });
});

describe("SocialAuthCallbackPage", () => {
  it("does not treat a fragment token as a session", async () => {
    setLocation("", "#token=bearer-secret");
    renderPage();

    expect(await screen.findByText(/incomplete or has expired/i)).toBeTruthy();
    expect(replace).not.toHaveBeenCalled();
    expect(localStorage.getItem(SESSION_HINT_KEY)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("completes the POST sign-in when the server sets the session cookie", async () => {
    setLocation("?provider=google&code=abc&state=xyz");
    fetchMock.mockImplementation(async (path: string) =>
      path.startsWith("/auth/social/")
        ? new Response("<!doctype html><html></html>", { status: 200, headers: { "Content-Type": "text/html" } })
        : new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } }),
    );
    renderPage();

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/app"));
    expect(fetchMock).toHaveBeenCalledWith("/user", expect.anything());
    expect(localStorage.getItem(SESSION_HINT_KEY)).toBe("1");
  });

  it("reports a failed session instead of marking the visitor signed in", async () => {
    setLocation("?provider=apple&code=abc");
    fetchMock.mockImplementation(async (path: string) =>
      path.startsWith("/auth/social/")
        ? new Response("<!doctype html><html></html>", { status: 200, headers: { "Content-Type": "text/html" } })
        : new Response("{}", { status: 401, headers: { "Content-Type": "application/json" } }),
    );
    renderPage();

    expect(await screen.findByText(/could not be completed/i)).toBeTruthy();
    expect(replace).not.toHaveBeenCalled();
    expect(localStorage.getItem(SESSION_HINT_KEY)).toBeNull();
  });
});
