import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Welcome } from "./welcome";

describe("Welcome smoke test", () => {
  it("renders the welcome headers and links", () => {
    render(<Welcome />);
    
    // Check if the React Router Docs link is rendered
    const link = screen.getByRole("link", { name: /react router docs/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "https://reactrouter.com/docs");
  });
});
