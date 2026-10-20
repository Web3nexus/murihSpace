import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import SecureAdsLogin from "../app/routes/secureads/login";

const API = "https://ads.test";

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/secureads/login" element={<SecureAdsLogin />} />
        <Route path="/secureads/advertisers/verification" element={<p>verification page</p>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("staff sign-in", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_ADS_API_URL", API);
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("posts the hub token from the query string and stores the staff token", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          status: "success",
          token: "staff-token-123",
          token_type: "Bearer",
          expires_at: "2026-10-19T12:00:00Z",
          staff: { id: 7, role: "admin" },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    renderAt("/secureads/login?token=hub-token-abc");

    await waitFor(() => expect(window.localStorage.getItem("ads_token")).toBe("staff-token-123"));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`${API}/api/auth/staff/hub-session`);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ token: "hub-token-abc" });
    expect(await screen.findByText("verification page")).toBeTruthy();
  });

  it("removes advertiser keys before storing the staff token", async () => {
    window.localStorage.setItem("advertiser_id", "42");
    window.localStorage.setItem("ads_advertiser", "{\"id\":42}");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ status: "success", token: "staff-token" }), { status: 200 }))
    );

    renderAt("/secureads/login?token=hub-token");

    await waitFor(() => expect(window.localStorage.getItem("ads_token")).toBe("staff-token"));
    expect(window.localStorage.getItem("advertiser_id")).toBeNull();
    expect(window.localStorage.getItem("ads_advertiser")).toBeNull();
  });

  it("shows a clear message and does not call the API when the token is missing", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    renderAt("/secureads/login");
    fireEvent.click(screen.getByRole("button", { name: "Authenticate" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("No hub sign-in token was provided");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(window.localStorage.getItem("ads_token")).toBeNull();
  });

  it("uses a pasted token and has no password field", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ status: "success", token: "pasted-staff" }), { status: 200 }))
    );

    const { container } = renderAt("/secureads/login");
    expect(container.querySelector("input[type=password]")).toBeNull();

    fireEvent.change(screen.getByLabelText("Hub sign-in token"), { target: { value: "  pasted-hub  " } });
    fireEvent.click(screen.getByRole("button", { name: "Authenticate" }));

    await waitFor(() => expect(window.localStorage.getItem("ads_token")).toBe("pasted-staff"));
  });

  it("shows the backend message and stores nothing when the hub token is rejected", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ status: "error", message: "Token expired." }), { status: 401 })
      )
    );

    renderAt("/secureads/login?token=old-token");

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("Token expired.");
    expect(window.localStorage.getItem("ads_token")).toBeNull();
  });
});
