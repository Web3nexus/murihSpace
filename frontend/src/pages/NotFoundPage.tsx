import { Link } from "react-router";
import { AnimatedPage } from "@/components/common/AnimatedPage";
import { SEOHead } from "@/components/common/SEOHead";

export function NotFoundPage() {
  return (
    <>
      <SEOHead
        title="Page Not Found"
        description="The page you are looking for does not exist or has been moved."
      />
      <AnimatedPage className="flex flex-col items-center justify-center min-h-[60vh] px-4 py-8">
      <h1 className="text-6xl font-extrabold text-[var(--shell-accent)]">404</h1>
      <h2 className="text-xl font-bold tracking-tight text-[var(--shell-text)] dark:text-white mt-4">
        Page not found
      </h2>
      <p className="mt-2 text-base text-[var(--shell-muted)] dark:text-[var(--shell-muted)]">
        Sorry, we couldn’t find the page you’re looking for.
      </p>
      <div className="mt-6 text-center">
        <Link
          to="/"
          className="text-sm font-semibold leading-6 text-[var(--shell-accent)] hover:text-[var(--shell-accent)]"
        >
          ← Go back home
        </Link>
      </div>
      </AnimatedPage>
    </>
  );
}
