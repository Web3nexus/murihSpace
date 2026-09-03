import { createBrowserRouter, RouterProvider } from "react-router";
import { routes } from "./routes";
import { RootErrorBoundary } from "@/components/common/RootErrorBoundary";

const router = createBrowserRouter([
  {
    errorElement: <RootErrorBoundary />,
    children: routes,
  },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
