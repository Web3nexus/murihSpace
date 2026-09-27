import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ChatPatternSurface } from "@/components/layout/ChatPatternSurface";

/**
 * Guards the desktop chat backdrop contract.
 *
 * The visual result lives in `styles/chat.css` (an alpha-masked ink over the
 * artwork, gated to large screens). jsdom does not evaluate media queries or
 * `mask-image`, so these tests assert the two things that *are* observable from
 * the DOM: that the surface publishes the pattern image as a CSS variable, and
 * that it stays a non-scrolling wrapper so the pattern does not scroll away
 * with the messages.
 */
describe("ChatPatternSurface", () => {
  it("publishes the pattern image as a CSS variable", () => {
    const { container } = render(
      <ChatPatternSurface>
        <p>messages</p>
      </ChatPatternSurface>
    );

    const surface = container.firstElementChild as HTMLElement;
    const image = surface.style.getPropertyValue("--chat-pattern-image");

    expect(image).toMatch(/^url\(.+\.png\)$/);
  });

  it("carries the chat-pattern class used by the stylesheet", () => {
    const { container } = render(
      <ChatPatternSurface>
        <p>messages</p>
      </ChatPatternSurface>
    );

    const surface = container.firstElementChild as HTMLElement;
    expect(surface.classList.contains("chat-pattern")).toBe(true);
  });

  it("does not scroll itself, so the pattern stays pinned behind messages", () => {
    const { container } = render(
      <ChatPatternSurface>
        <p>messages</p>
      </ChatPatternSurface>
    );

    const surface = container.firstElementChild as HTMLElement;
    // `min-h-0` + `flex-1` let the wrapper size to the flex parent without
    // growing, and nothing on it sets overflow, so only the child scrolls.
    expect(surface.classList.contains("overflow-y-auto")).toBe(false);
    expect(surface.classList.contains("min-h-0")).toBe(true);
    expect(surface.classList.contains("flex-1")).toBe(true);
  });

  it("renders its children", () => {
    render(
      <ChatPatternSurface>
        <p>message content</p>
      </ChatPatternSurface>
    );

    expect(screen.getByText("message content")).toBeInTheDocument();
  });

  it("lets callers add classes and override styles without losing the pattern", () => {
    const { container } = render(
      <ChatPatternSurface className="custom" style={{ outline: "1px solid red" }}>
        <p>messages</p>
      </ChatPatternSurface>
    );

    const surface = container.firstElementChild as HTMLElement;
    expect(surface.classList.contains("custom")).toBe(true);
    expect(surface.classList.contains("chat-pattern")).toBe(true);
    expect(surface.style.getPropertyValue("--chat-pattern-image")).not.toBe("");
    expect(surface.style.outline).toBe("1px solid red");
  });
});
