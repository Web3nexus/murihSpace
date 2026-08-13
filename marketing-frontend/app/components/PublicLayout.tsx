import { useState } from "react";
import { Link, Outlet } from "react-router";
import { Menu, X } from "lucide-react";
import { useCmsCollection } from "../hooks/useCms";

interface CmsNavLink {
  label: string;
  href: string;
}

const defaultNavLinks: CmsNavLink[] = [
  { label: "Features", href: "/features" },
  { label: "Pricing", href: "/pricing" },
  { label: "Creators", href: "/creators" },
  { label: "Blog", href: "/blog" },
  { label: "Help", href: "/help" },
];

const defaultFooterLinks: CmsNavLink[] = [
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
];

export function PublicLayout() {
  const { data: navLinks } = useCmsCollection<CmsNavLink>("navigation", defaultNavLinks);
  const { data: footerLinks } = useCmsCollection<CmsNavLink>("footer", defaultFooterLinks);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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
            {navLinks.map((link) => (
              <Link
                key={`${link.label}-${link.href}`}
                to={link.href}
                id={`nav-${link.label.toLowerCase()}`}
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* CTA Buttons */}
          <div className="hidden md:flex items-center gap-3">
            <a
              href={`${import.meta.env.VITE_APP_URL}/login`}
              id="nav-signin-btn"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Sign in
            </a>
            <a
              href={`${import.meta.env.VITE_APP_URL}/register`}
              id="nav-get-started-btn"
              className="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors"
            >
              Get Started
            </a>
          </div>

          {/* Mobile Menu Toggle */}
          <button
            className="md:hidden p-2 text-foreground"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle mobile menu"
            aria-expanded={isMobileMenuOpen}
          >
            {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {/* Mobile Navigation */}
        {isMobileMenuOpen && (
          <nav className="md:hidden border-t border-border/50 bg-background/95 backdrop-blur-md px-6 py-4 flex flex-col gap-4">
            {navLinks.map((link) => (
              <Link
                key={`mobile-${link.label}-${link.href}`}
                to={link.href}
                id={`mobile-nav-${link.label.toLowerCase()}`}
                className="text-sm font-medium text-foreground hover:text-primary transition-colors"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <div className="flex flex-col gap-3 mt-2 pt-4 border-t border-border/50">
              <a
                href={`${import.meta.env.VITE_APP_URL}/login`}
                className="text-sm font-medium text-foreground hover:text-primary transition-colors"
              >
                Sign in
              </a>
              <a
                href={`${import.meta.env.VITE_APP_URL}/register`}
                className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors"
              >
                Get Started
              </a>
            </div>
          </nav>
        )}
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
              {footerLinks.map((link) => (
                <Link
                  key={`${link.label}-${link.href}`}
                  to={link.href}
                  id={`footer-${link.label.toLowerCase()}`}
                  className="hover:text-foreground transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default PublicLayout;
