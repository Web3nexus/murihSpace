import { Link, Outlet } from "react-router";

const NAV_LINKS = [
  { label: "Features", href: "/features" },
  { label: "Pricing", href: "/pricing" },
  { label: "Creators", href: "/creators" },
  { label: "Blog", href: "/blog" },
];

export function PublicLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* Sticky Header with Glassmorphism */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/75 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          {/* Brand Logo */}
          <Link
            to="/"
            className="flex items-center gap-2.5 group"
            id="nav-brand-logo"
            aria-label="MurihSpace home"
          >
            <img src="/logos/member-logo-light.png" alt="MurihSpace" className="h-8 w-auto object-contain dark:hidden transition-transform group-hover:scale-105" />
            <img src="/logos/member-logo-dark.png" alt="MurihSpace" className="h-8 w-auto object-contain hidden dark:block transition-transform group-hover:scale-105" />
          </Link>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-6" aria-label="Main navigation">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                id={`nav-${link.label.toLowerCase()}`}
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* CTA Buttons */}
          <div className="flex items-center gap-3">
            <Link
              to="/login"
              id="nav-signin-btn"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Sign in
            </Link>
            <Link
              to="/register"
              id="nav-get-started-btn"
              className="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1" id="main-content">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t border-border/50 bg-muted/30 py-10">
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            <div className="flex items-center gap-2">
              <img src="/logos/member-logo-light.png" alt="MurihSpace" className="h-6 w-auto object-contain dark:hidden" />
              <img src="/logos/member-logo-dark.png" alt="MurihSpace" className="h-6 w-auto object-contain hidden dark:block" />
            </div>
            <p className="text-xs text-muted-foreground text-center">
              © {new Date().getFullYear()} MurihSpace. All rights reserved.
            </p>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <Link to="/privacy" id="footer-privacy" className="hover:text-foreground transition-colors">Privacy</Link>
              <Link to="/terms" id="footer-terms" className="hover:text-foreground transition-colors">Terms</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
