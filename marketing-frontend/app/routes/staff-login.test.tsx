import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import StaffLogin, { meta } from "./staff-login";

describe("staff login page", () => {
  it("is marked noindex, nofollow", () => {
    const tags = meta({} as unknown as Parameters<typeof meta>[0]);
    expect(tags).toContainEqual({ name: "robots", content: "noindex, nofollow" });
  });

  it("renders an email and password form", () => {
    const Stub = createRoutesStub([{ path: "/", Component: StaffLogin }]);
    render(<Stub initialEntries={["/"]} />);

    expect(screen.getByLabelText(/email address/i)).toHaveAttribute("type", "email");
    expect(screen.getByLabelText(/password/i)).toHaveAttribute("type", "password");
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
  });
});
