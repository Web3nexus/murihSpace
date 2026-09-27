import { createBrowserRouter, RouterProvider, Outlet } from "react-router";
import { routes } from "./routes";
import { RootErrorBoundary } from "@/components/common/RootErrorBoundary";
import { RouteTitleSync } from "@/components/common/RouteTitleSync";

const router = createBrowserRouter([
  {
    errorElement: <RootErrorBoundary />,
    element: (
      <>
        <RouteTitleSync />
        <Outlet />
      </>
    ),
    children: routes,
  },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
