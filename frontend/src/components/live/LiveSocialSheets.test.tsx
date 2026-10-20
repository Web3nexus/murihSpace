import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { LiveJoinGuestSheet } from "./LiveSocialSheets";

function renderSheet(overrides: Partial<Parameters<typeof LiveJoinGuestSheet>[0]> = {}) {
  const props = {
    open: true,
    onClose: vi.fn(),
    hostName: "Ada",
    requestSent: false,
    sending: false,
    onJoin: vi.fn(),
    ...overrides,
  };
  render(<LiveJoinGuestSheet {...props} />);
  return props;
}

describe("LiveJoinGuestSheet", () => {
  it("renders nothing while closed", () => {
    renderSheet({ open: false });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("sends a request through onJoin and reports the sent state", () => {
    const props = renderSheet();
    fireEvent.click(screen.getByRole("button", { name: "Request to join" }));
    expect(props.onJoin).toHaveBeenCalledTimes(1);
  });

  it("disables the request button once a request has been sent", () => {
    renderSheet({ requestSent: true });
    expect(screen.getByRole("button", { name: "Request sent" })).toBeDisabled();
    expect(screen.getByText(/will review it/)).toBeInTheDocument();
  });

  it("closes when the backdrop itself is clicked", () => {
    const props = renderSheet();
    fireEvent.click(screen.getByRole("presentation"));
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it("does not close when a click lands inside the panel", () => {
    const props = renderSheet();
    fireEvent.click(screen.getByRole("dialog"));
    expect(props.onClose).not.toHaveBeenCalled();
  });

  it("closes on Escape", () => {
    const props = renderSheet();
    fireEvent.keyDown(screen.getByRole("presentation"), { key: "Escape" });
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });
});
