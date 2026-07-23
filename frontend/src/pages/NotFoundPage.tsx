import { Link } from "react-router";
import { AnimatedPage } from "@/components/common/AnimatedPage";

export function NotFoundPage() {
  return (
    <AnimatedPage className="flex flex-col items-center justify-center min-h-[60vh] px-4 py-8">
      <h1 className="text-6xl font-extrabold text-blue-600">404</h1>
      <h2 className="text-3xl font-bold tracking-tight text-gray-950 dark:text-white mt-4">
        Page not found
      </h2>
      <p className="mt-2 text-base text-gray-600 dark:text-gray-400">
        Sorry, we couldn’t find the page you’re looking for.
      </p>
      <div className="mt-6 text-center">
        <Link
          to="/"
          className="text-sm font-semibold leading-6 text-blue-600 hover:text-blue-500"
        >
          ← Go back home
        </Link>
      </div>
    </AnimatedPage>
  );
}
