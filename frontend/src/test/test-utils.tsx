/* eslint-disable react-refresh/only-export-components */
import React from "react";
import type { ReactElement } from "react";
import { render } from "@testing-library/react";
import type { RenderOptions } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { QueryProvider } from "@/app/providers/QueryProvider";
import { ThemeProvider } from "@/app/providers/ThemeProvider";
import { MotionProvider } from "@/app/providers/MotionProvider";

interface AllProvidersProps {
  children: React.ReactNode;
  initialEntries?: string[];
}

function AllProviders({ children, initialEntries = ["/"] }: AllProvidersProps) {
  return (
    <QueryProvider>
      <ThemeProvider defaultTheme="light">
        <MotionProvider>
          <MemoryRouter initialEntries={initialEntries}>
            {children}
          </MemoryRouter>
        </MotionProvider>
      </ThemeProvider>
    </QueryProvider>
  );
}

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, "wrapper"> & { initialEntries?: string[] }
) =>
  render(ui, {
    wrapper: (props) => <AllProviders {...props} initialEntries={options?.initialEntries} />,
    ...options,
  });

export * from "@testing-library/react";
export { customRender as render };
