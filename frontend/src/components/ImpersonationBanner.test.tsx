import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  current: {
    user: null as null | { name: string; impersonating?: boolean },
    stopImpersonation: vi.fn(async () => true),
  },
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => auth.current,
}));

import { ImpersonationBanner } from "@/components/ImpersonationBanner";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  auth.current.stopImpersonation.mockClear();
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

describe("ImpersonationBanner", () => {
  it("shows the viewed account when the server flag is set", async () => {
    auth.current.user = { name: "Ada Member", impersonating: true };
    await act(async () => root.render(<ImpersonationBanner />));

    expect(container.textContent).toContain("You are viewing as Ada Member");
    expect(container.querySelector("button")?.textContent).toContain("Stop impersonating");
  });

  it("is hidden when the flag is not set", async () => {
    auth.current.user = { name: "Site Admin", impersonating: false };
    await act(async () => root.render(<ImpersonationBanner />));

    expect(container.textContent).toBe("");
  });

  it("ends impersonation through the auth context when stopped", async () => {
    auth.current.user = { name: "Ada Member", impersonating: true };
    await act(async () => root.render(<ImpersonationBanner />));

    // Navigation is a full page load in the real app; stub it so jsdom does not attempt it.
    const assign = vi.fn();
    const original = window.location;
    Object.defineProperty(window, "location", { configurable: true, value: { ...original, assign } });
    try {
      await act(async () => {
        container.querySelector("button")!.click();
      });
    } finally {
      Object.defineProperty(window, "location", { configurable: true, value: original });
    }

    expect(auth.current.stopImpersonation).toHaveBeenCalledTimes(1);
    expect(assign).toHaveBeenCalledWith("/app/securegate/users");
  });

  it("stays on the page and re-enables the button when stopping fails", async () => {
    auth.current.user = { name: "Ada Member", impersonating: true };
    auth.current.stopImpersonation.mockResolvedValueOnce(false);
    await act(async () => root.render(<ImpersonationBanner />));

    const assign = vi.fn();
    const original = window.location;
    Object.defineProperty(window, "location", { configurable: true, value: { ...original, assign } });
    try {
      await act(async () => {
        container.querySelector("button")!.click();
      });
    } finally {
      Object.defineProperty(window, "location", { configurable: true, value: original });
    }

    expect(assign).not.toHaveBeenCalled();
    expect(container.querySelector("button")!.disabled).toBe(false);
  });

  it("re-enables the button and does not navigate when stopping throws", async () => {
    auth.current.user = { name: "Ada Member", impersonating: true };
    auth.current.stopImpersonation.mockRejectedValueOnce(new Error("network"));
    await act(async () => root.render(<ImpersonationBanner />));

    const assign = vi.fn();
    const original = window.location;
    Object.defineProperty(window, "location", { configurable: true, value: { ...original, assign } });
    try {
      await act(async () => {
        container.querySelector("button")!.click();
      });
    } finally {
      Object.defineProperty(window, "location", { configurable: true, value: original });
    }

    expect(assign).not.toHaveBeenCalled();
    expect(container.querySelector("button")!.disabled).toBe(false);
  });
});
