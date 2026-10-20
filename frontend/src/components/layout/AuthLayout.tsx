import React from "react";
import { Link } from "react-router";

interface AuthLayoutProps {
  children: React.ReactNode;
  headlineText?: string;
  accentText?: string;
  subText?: string;
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({
  children,
  headlineText = "Better connection",
  accentText = "with safety.",
  subText = "Connect with communities, sell digital & physical products, host live audio rooms, and grow your audience.",
}) => {
  return (
    <div className="min-h-screen w-full bg-slate-50 dark:bg-slate-950 text-[var(--shell-text)] dark:text-slate-100 flex flex-col justify-between selection:bg-[#2164b6]/20 selection:text-[#2164b6] dark:text-[var(--shell-accent)]">
      {/* Main Two-Sided Section (Facebook Login Style) */}
      <main className="w-full max-w-7xl mx-auto px-6 py-6 lg:py-10 grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-16 items-center flex-1">
        {/* LEFT COLUMN: Brand Hero & Visual Showcase */}
        <div className="lg:col-span-6 xl:col-span-7 flex flex-col justify-center space-y-6 lg:space-y-8 pr-0 lg:pr-4">
          {/* Logo Brand Mark */}
          <Link to="/" className="inline-block group w-fit">
            <img
              src="/logos/member-logo-light.png"
              alt="MurihSpace"
              className="h-10 sm:h-12 w-auto object-contain dark:hidden transition-transform group-hover:scale-105"
            />
            <img
              src="/logos/member-logo-dark.png"
              alt="MurihSpace"
              className="h-10 sm:h-12 w-auto object-contain hidden dark:block transition-transform group-hover:scale-105"
            />
          </Link>

          {/* Facebook-style Impactful Headline */}
          <h1 className="text-xl sm:text-5xl lg:text-6xl font-black tracking-tight text-[var(--shell-text)] dark:text-white leading-[1.1]">
            {headlineText}{" "}
            <span className="text-[var(--shell-accent)] dark:text-[var(--shell-accent)] relative inline-block">
              {accentText}
              <svg className="absolute -bottom-2 left-0 w-full h-3 text-[var(--shell-accent)] dark:text-[var(--shell-accent)]/30 fill-current" viewBox="0 0 100 20">
                <path d="M0,15 Q50,5 100,15" stroke="currentColor" strokeWidth="4" fill="none" strokeLinecap="round" />
              </svg>
            </span>
          </h1>

          {/* Hero Image Collage */}
          {/* Hero collage: shown on tablet (iPad, md) and up; hidden on phones. */}
          <div className="relative mt-2 pt-2 hidden md:flex items-center justify-center lg:justify-start">
            <img
              src="/creatorEve.webp"
              alt="MurihSpace Creator Ecosystem"
              className="w-full max-w-lg h-auto object-contain drop-shadow-xl hover:scale-[1.02] transition-transform duration-300"
            />
          </div>

          {/* Subtext under the image */}
          <p className="text-base sm:text-lg text-[var(--shell-muted)] dark:text-[var(--shell-muted)] max-w-xl font-medium leading-relaxed">
            {subText}
          </p>
        </div>

        {/* RIGHT COLUMN: Two-Sided Form Container */}
        <div className="lg:col-span-6 xl:col-span-5 flex flex-col items-center lg:items-end justify-center">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-[var(--shell-border)]/90 dark:border-[var(--shell-border)] rounded-3xl p-4 sm:p-5 shadow-xl shadow-slate-200/60 dark:shadow-none transition-all">
            {children}
          </div>
        </div>
      </main>

      {/* Facebook-style Footer */}
      <footer className="w-full border-t border-[var(--shell-border)] dark:border-[var(--shell-border)] py-5 px-6 bg-white/50 dark:bg-slate-900/50 backdrop-blur-xs text-xs text-[var(--shell-muted)] dark:text-[var(--shell-muted)]">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-x-4 gap-y-1">
            <span className="text-slate-800 dark:text-slate-200 font-semibold">English (UK)</span>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <Link to="/help" className="hover:underline">Help Center</Link>
            <Link to="/privacy" className="hover:underline">Privacy Policy</Link>
            <Link to="/terms" className="hover:underline">Terms of Service</Link>
            <Link to="/cookies" className="hover:underline">Cookies</Link>
            <Link to="/gdpr" className="hover:underline">GDPR Compliance</Link>
            <span>© {new Date().getFullYear()} MurihSpace Ecosystem</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
