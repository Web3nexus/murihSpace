import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { AppProviders } from "@/app/providers/AppProviders";

describe("App smoke test", () => {
  it("renders providers without crashing", () => {
    // App uses createBrowserRouter which conflicts with MemoryRouter in test-utils.
    // We test providers independently to confirm the application infrastructure mounts.
    const { container } = render(
      <AppProviders>
        <div data-testid="smoke-content">MurihSpace</div>
      </AppProviders>
    );
    expect(container).toBeInTheDocument();
  });
});
