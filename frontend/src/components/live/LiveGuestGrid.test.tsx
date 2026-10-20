import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { LiveGuestGrid } from "./LiveGuestGrid";

function renderGrid(overrides: Partial<Parameters<typeof LiveGuestGrid>[0]> = {}) {
  const props = {
    room: null,
    hostIdentity: "user_1",
    hostId: 1,
    hostName: "Ada",
    hostVideoRef: createRef<HTMLVideoElement>(),
    isHostView: false,
    canRequest: true,
    requestSent: false,
    onRequestSlot: vi.fn(),
    onOpenProfile: vi.fn(),
    ...overrides,
  };
  render(<LiveGuestGrid {...props} />);
  return props;
}

describe("LiveGuestGrid", () => {
  it("shows the host and a request slot to a viewer with no guests", () => {
    const props = renderGrid();
    expect(screen.getByText("Host")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Request/ }));
    expect(props.onRequestSlot).toHaveBeenCalledTimes(1);
  });

  it("hides the request slot from the host", () => {
    renderGrid({ canRequest: false, isHostView: true });
    expect(screen.queryByRole("button", { name: /Request/ })).not.toBeInTheDocument();
  });

  it("marks the slot as requested and keeps it disabled after a request", () => {
    renderGrid({ requestSent: true });
    expect(screen.getByRole("button", { name: "Requested" })).toBeDisabled();
  });

  it("opens the host profile from the host name", () => {
    const props = renderGrid();
    fireEvent.click(screen.getByRole("button", { name: "Ada" }));
    expect(props.onOpenProfile).toHaveBeenCalledWith(expect.objectContaining({ id: 1, name: "Ada" }));
  });
});
