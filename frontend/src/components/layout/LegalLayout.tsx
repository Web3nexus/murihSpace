import React from "react";
import { Link } from "react-router";
import { ArrowLeft } from "@/components/icons";
import { ArrowSquareOut as ExternalLink } from "@/components/icons/rounded";;

interface LegalSection {
  heading: string;
  paragraphs: string[];
}

interface LegalLayoutProps {
  icon: React.ReactNode;
  eyebrow: string;
  title: string;
  updated: string;
  intro: string;
  sections: LegalSection[];
  footerNote?: string;
}

export const LegalLayout: React.FC<LegalLayoutProps> = ({
  icon,
  eyebrow,
  title,
  updated,
  intro,
  sections,
  footerNote,
}) => {
  return (
    <div className="min-h-screen w-full bg-slate-50 dark:bg-slate-950 text-[var(--shell-text)] dark:text-slate-100">
      {/* Top nav */}
      <header className="sticky top-0 z-40 w-full border-b border-[var(--shell-border)]/80 dark:border-[var(--shell-border)]/80 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md">
        <div className="max-w-4xl mx-auto px-5 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 group">
            <img src="/logos/member-logo-light.png" alt="MurihSpace" className="h-6 w-auto object-contain dark:hidden" />
            <img src="/logos/member-logo-dark.png" alt="MurihSpace" className="h-6 w-auto object-contain hidden dark:block" />
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--shell-muted)] hover:text-[var(--shell-text)] dark:hover:text-white transition-colors"
          >
            <ArrowLeft weight="fill" className="h-3.5 w-3.5" /> Back to home
          </Link>
        </div>
      </header>

      {/* Body */}
      <main className="max-w-4xl mx-auto px-5 py-10 sm:py-14">
        {/* Header card */}
        <div className="rounded-3xl border border-[var(--shell-border)]/80 dark:border-[var(--shell-border)] bg-white dark:bg-slate-900 p-4 sm:p-10 ">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 shrink-0 rounded-lg bg-[var(--shell-accent-solid)]/10 text-[var(--shell-accent)] dark:text-[var(--shell-accent)] flex items-center justify-center">
              {icon}
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-[var(--shell-accent)] dark:text-[var(--shell-accent)]">{eyebrow}</p>
              <h1 className="mt-1 text-xl sm:text-xl font-black tracking-tight">{title}</h1>
              <p className="mt-1.5 text-xs text-[var(--shell-muted)] dark:text-[var(--shell-muted)]">Last updated: {updated}</p>
            </div>
          </div>
          <p className="mt-6 text-sm sm:text-base leading-relaxed text-[var(--shell-muted)] dark:text-[var(--shell-muted)]">{intro}</p>
        </div>

        {/* Sections */}
        <div className="mt-6 space-y-6">
          {sections.map((s, i) => (
            <section
              key={i}
              className="rounded-3xl border border-[var(--shell-border)]/80 dark:border-[var(--shell-border)] bg-white dark:bg-slate-900 p-4 sm:p-5 "
            >
              <div className="flex items-center gap-3">
                <span className="h-7 w-7 shrink-0 rounded-lg bg-[var(--shell-accent-solid)]/10 text-[var(--shell-accent)] dark:text-[var(--shell-accent)] flex items-center justify-center text-xs font-black">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h2 className="text-base sm:text-lg font-bold tracking-tight">{s.heading}</h2>
              </div>
              <div className="mt-4 space-y-3">
                {s.paragraphs.map((p, j) => (
                  <p key={j} className="text-sm leading-relaxed text-[var(--shell-muted)] dark:text-[var(--shell-muted)]">
                    {p}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>

        {/* Footer note */}
        {footerNote && (
          <div className="mt-6 flex items-start gap-3 rounded-3xl border border-[var(--shell-accent)]/20 bg-[var(--shell-accent-solid)]/5 p-5 text-sm text-[var(--shell-muted)] dark:text-[var(--shell-muted)]">
            <ExternalLink weight="fill" className="h-4 w-4 mt-0.5 text-[var(--shell-accent)] dark:text-[var(--shell-accent)] shrink-0" />
            <p>{footerNote}</p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--shell-border)] dark:border-[var(--shell-border)] py-6">
        <div className="max-w-4xl mx-auto px-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[var(--shell-muted)] dark:text-[var(--shell-muted)]">
          <div className="flex items-center gap-4">
            <Link to="/help" className="hover:underline">Help Center</Link>
            <Link to="/privacy" className="hover:underline">Privacy Policy</Link>
            <Link to="/terms" className="hover:underline">Terms of Service</Link>
            <Link to="/cookies" className="hover:underline">Cookies</Link>
          </div>
          <span>© {new Date().getFullYear()} MurihSpace Ecosystem</span>
        </div>
      </footer>
    </div>
  );
};
