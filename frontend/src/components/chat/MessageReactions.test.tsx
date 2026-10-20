import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MessageReactions } from "@/components/chat/MessageReactions";

vi.mock("@/lib/api/authFetch", () => ({
  authFetch: vi.fn(),
}));

describe("MessageReactions", () => {
  it("keeps clicks on the picker from reaching the message", () => {
    const onMessageClick = vi.fn();
    render(
      <div role="presentation" onClick={onMessageClick}>
        <MessageReactions messageId={1} reactions={[]} onReactionToggle={vi.fn()} />
      </div>,
    );

    fireEvent.click(screen.getByTitle("React"));
    fireEvent.click(screen.getByRole("dialog"));

    expect(onMessageClick).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeTruthy();
  });
});
