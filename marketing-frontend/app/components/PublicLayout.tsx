import { useState } from "react";
import { Link, Outlet } from "react-router";
import { Menu, X, ChevronDown, Phone, MessageSquare, Users, Store, ShieldCheck, Sparkles, Download } from "lucide-react";
import { useCmsCollection } from "../hooks/useCms";
import { getLoginUrl, getRegisterUrl, getWebClientUrl } from "~/lib/env";

interface CmsNavLink {
  label: string;
  href: string;
}

const defaultNavLinks: CmsNavLink[] = [
  { label: "For Creators", href: "/creators" },
  { label: "For Business", href: "/business" },
  { label: "Features", href: "/features" },
  { label: "Privacy & Security", href: "/privacy" },
  { label: "Apps", href: "/download" },
  { label: "Web Client", href: getWebClientUrl() },
];

const defaultFooterLinks: CmsNavLink[] = [
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
  { label: "Security", href: "/privacy#security" },
  { label: "Cookies Settings", href: "#" },
];

export function PublicLayout() {
  const { data: navLinks } = useCmsCollection<CmsNavLink>("navigation", defaultNavLinks);
  const { data: footerLinks } = useCmsCollection<CmsNavLink>("footer", defaultFooterLinks);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isFeaturesOpen, setIsFeaturesOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col bg-[#F7FAFC] text-[#102840] antialiased">
      {/* Top Utility Bar for Business and Creators */}
      <div className="bg-[#102840] text-white text-xs border-b border-white/10 py-1.5 px-6">
        <div className="mx-auto max-w-7xl flex items-center justify-between">
          <div className="flex items-center gap-1 sm:gap-2">
            <span className="text-[#8696A0] hidden sm:inline text-[11px] uppercase tracking-wider font-bold">Solutions:</span>
            <Link
              to="/creators"
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-bold transition-all text-[#38A8D8] hover:bg-white/10"
            >
              <Sparkles className="size-3" />
              <span>For Creators</span>
            </Link>
            <span className="text-white/20">|</span>
            <Link
              to="/business"
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-bold transition-all text-white/80 hover:text-white hover:bg-white/10"
            >
              <Store className="size-3" />
              <span>For Business & Vendors</span>
            </Link>
          </div>

          <div className="flex items-center gap-4 text-[#B7C6D1]">
            <span className="hidden md:inline text-[11px] font-medium">
              🔒 End-to-End Encrypted • 0% Creator Platform Fee • KYC Verified
            </span>
            <a
              href={getWebClientUrl()}
              className="hover:text-white text-xs font-semibold text-[#38A8D8] transition-colors"
            >
              Web Client →
            </a>
          </div>
        </div>
      </div>

      {/* Sticky Header with MurihSpace Light Background & Glass Effect */}
      <header className="sticky top-0 z-50 border-b border-[#D6E0E8]/70 bg-[#F7FAFC]/95 backdrop-blur-md transition-all">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6">
          {/* Brand Logo */}
          <Link
            to="/"
            className="flex items-center gap-3 group"
            id="nav-brand-logo"
            aria-label="MurihSpace home"
          >
            <img
              src="/logos/member-logo-light.png"
              alt="MurihSpace"
              className="h-8 w-auto object-contain dark:hidden transition-transform duration-200 group-hover:scale-105"
            />
            <img
              src="/logos/member-logo-dark.png"
              alt="MurihSpace"
              className="h-8 w-auto object-contain hidden dark:block transition-transform duration-200 group-hover:scale-105"
            />
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-8" aria-label="Main navigation">
            {/* Features Dropdown Item */}
            <div
              className="relative"
              onMouseEnter={() => setIsFeaturesOpen(true)}
              onMouseLeave={() => setIsFeaturesOpen(false)}
              onFocus={() => setIsFeaturesOpen(true)}
              onBlur={(e) => {
                const currentTarget = e.currentTarget as HTMLElement;
                requestAnimationFrame(() => {
                  if (!currentTarget.contains(document.activeElement)) {
                    setIsFeaturesOpen(false);
                  }
                });
              }}
            >
              <Link
                to="/features"
                className="inline-flex items-center gap-1.5 text-[15px] font-semibold text-[#102840] hover:text-[#2164B6] transition-colors py-2"
                aria-haspopup="menu"
                aria-expanded={isFeaturesOpen}
              >
                <span>Features</span>
                <ChevronDown className={`size-4 text-[#5A7184] transition-transform duration-200 ${isFeaturesOpen ? 'rotate-180 text-[#2164B6]' : ''}`} />
              </Link>

              {/* Dropdown Menu */}
              {isFeaturesOpen && (
                <div
                  className="absolute top-full left-1/2 -translate-x-1/2 w-80 rounded-2xl bg-white p-3 shadow-2xl border border-[#D6E0E8] flex flex-col gap-1 z-50"
                  role="menu"
                >
                  <Link
                    to="/#groups"
                    role="menuitem"
                    className="flex items-center gap-3.5 p-2.5 rounded-xl hover:bg-[#E8F8FF] transition-colors group"
                  >
                    <div className="size-9 rounded-lg bg-[#E8F8FF] flex items-center justify-center text-[#2164B6] group-hover:bg-[#2164B6] group-hover:text-white transition-colors">
                      <Users className="size-4" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-[#102840]">Communities & Cohorts</div>
                      <div className="text-xs text-[#5A7184]">Paid cohorts, channels & discussion feeds</div>
                    </div>
                  </Link>

                  <Link
                    to="/#business"
                    className="flex items-center gap-3.5 p-2.5 rounded-xl hover:bg-[#E8F8FF] transition-colors group"
                  >
                    <div className="size-9 rounded-lg bg-[#E8F8FF] flex items-center justify-center text-[#2164B6] group-hover:bg-[#2164B6] group-hover:text-white transition-colors">
                      <Store className="size-4" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-[#102840]">Storefront & Products</div>
                      <div className="text-xs text-[#5A7184]">Sell digital downloads, courses & merch</div>
                    </div>
                  </Link>

                  <Link
                    to="/#messaging"
                    className="flex items-center gap-3.5 p-2.5 rounded-xl hover:bg-[#E8F8FF] transition-colors group"
                  >
                    <div className="size-9 rounded-lg bg-[#E8F8FF] flex items-center justify-center text-[#2164B6] group-hover:bg-[#2164B6] group-hover:text-white transition-colors">
                      <MessageSquare className="size-4" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-[#102840]">Private Chat & Audio</div>
                      <div className="text-xs text-[#5A7184]">Encrypted DMs, voice notes & stories</div>
                    </div>
                  </Link>

                  <Link
                    to="/#calling"
                    className="flex items-center gap-3.5 p-2.5 rounded-xl hover:bg-[#E8F8FF] transition-colors group"
                  >
                    <div className="size-9 rounded-lg bg-[#E8F8FF] flex items-center justify-center text-[#2164B6] group-hover:bg-[#2164B6] group-hover:text-white transition-colors">
                      <Phone className="size-4" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-[#102840]">HD Calling & Live Stages</div>
                      <div className="text-xs text-[#5A7184]">Group audio/video calls up to 32 people</div>
                    </div>
                  </Link>

                  <Link
                    to="/#security"
                    className="flex items-center gap-3.5 p-2.5 rounded-xl hover:bg-[#E8F8FF] transition-colors group"
                  >
                    <div className="size-9 rounded-lg bg-[#E8F8FF] flex items-center justify-center text-[#2164B6] group-hover:bg-[#2164B6] group-hover:text-white transition-colors">
                      <ShieldCheck className="size-4" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-[#102840]">KYC Trust & Escrow</div>
                      <div className="text-xs text-[#5A7184]">Verified badges & anti-fraud protection</div>
                    </div>
                  </Link>

                  <Link
                    to="/features"
                    className="flex items-center gap-3.5 p-2.5 rounded-xl hover:bg-[#E8F8FF] transition-colors group"
                  >
                    <div className="size-9 rounded-lg bg-[#E8F8FF] flex items-center justify-center text-[#2164B6] group-hover:bg-[#2164B6] group-hover:text-white transition-colors">
                      <Sparkles className="size-4" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-[#102840]">Creator Studio & Analytics</div>
                      <div className="text-xs text-[#5A7184]">Link-in-bio, broadcasts & insights</div>
                    </div>
                  </Link>
                </div>
              )}
            </div>

            {/* Other Nav Items from CMS */}
            {navLinks.filter(l => l.label.toLowerCase() !== 'features').map((link) => {
              const isExternal = link.href.startsWith("http://") || link.href.startsWith("https://");
              if (isExternal) {
                return (
                  <a
                    key={`${link.label}-${link.href}`}
                    href={link.href}
                    id={`nav-${link.label.toLowerCase().replace(/\s+/g, '-')}`}
                    className="text-[15px] font-semibold text-[#102840] hover:text-[#2164B6] transition-colors"
                  >
                    {link.label}
                  </a>
                );
              }
              return (
                <Link
                  key={`${link.label}-${link.href}`}
                  to={link.href}
                  id={`nav-${link.label.toLowerCase().replace(/\s+/g, '-')}`}
                  className="text-[15px] font-semibold text-[#102840] hover:text-[#2164B6] transition-colors"
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          {/* CTA Buttons */}
          <div className="hidden md:flex items-center gap-3">
            <a
              href={getLoginUrl()}
              id="nav-signin-btn"
              className="inline-flex h-10 items-center justify-center rounded-full border border-[#102840] px-5 text-sm font-semibold text-[#102840] hover:bg-[#102840]/5 transition-colors"
            >
              Log In
            </a>
            <Link
              to="/download"
              id="nav-get-started-btn"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-[#2164B6] px-5 text-sm font-bold text-white shadow-sm hover:bg-[#1b52a0] transition-all hover:-translate-y-0.5"
            >
              <span>Download</span>
              <Download className="size-4" />
            </Link>
          </div>

          {/* Mobile Menu Toggle */}
          <button
            className="md:hidden p-2 text-[#102840]"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle mobile menu"
            aria-expanded={isMobileMenuOpen}
          >
            {isMobileMenuOpen ? <X className="size-6" /> : <Menu className="size-6" />}
          </button>
        </div>

        {/* Mobile Navigation Drawer */}
        {isMobileMenuOpen && (
          <nav className="md:hidden border-t border-[#D6E0E8] bg-[#F7FAFC] px-6 py-5 flex flex-col gap-4 shadow-xl">
            {navLinks.map((link) => {
              const isExternal = link.href.startsWith("http://") || link.href.startsWith("https://");
              if (isExternal) {
                return (
                  <a
                    key={`mobile-${link.label}-${link.href}`}
                    href={link.href}
                    id={`mobile-nav-${link.label.toLowerCase().replace(/\s+/g, '-')}`}
                    className="text-base font-semibold text-[#102840] hover:text-[#2164B6] transition-colors"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    {link.label}
                  </a>
                );
              }
              return (
                <Link
                  key={`mobile-${link.label}-${link.href}`}
                  to={link.href}
                  id={`mobile-nav-${link.label.toLowerCase().replace(/\s+/g, '-')}`}
                  className="text-base font-semibold text-[#102840] hover:text-[#2164B6] transition-colors"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {link.label}
                </Link>
              );
            })}
            <div className="flex flex-col gap-3 mt-2 pt-4 border-t border-[#D6E0E8]">
              <a
                href={getLoginUrl()}
                className="inline-flex h-11 items-center justify-center rounded-full border border-[#102840] text-sm font-semibold text-[#102840]"
              >
                Log In
              </a>
              <Link
                to="/download"
                onClick={() => setIsMobileMenuOpen(false)}
                className="inline-flex h-11 items-center justify-center rounded-full bg-[#2164B6] text-sm font-bold text-white shadow-sm"
              >
                Download MurihSpace
              </Link>
            </div>
          </nav>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1" id="main-content">
        <Outlet />
      </main>

      {/* MurihSpace Dark Navy Footer */}
      <footer className="border-t border-[#102840] bg-[#081827] text-white py-16">
        <div className="mx-auto max-w-7xl px-6">
          {/* Top Logo & CTA Row */}
          <div className="flex flex-col md:flex-row items-center justify-between pb-12 border-b border-white/10 gap-6">
            <Link to="/" className="flex items-center gap-3">
              <img
                src="/logos/member-logo-dark.png"
                alt="MurihSpace"
                className="h-7 w-auto object-contain"
              />
            </Link>
            <div className="flex items-center gap-3">
              <a
                href={getRegisterUrl()}
                className="inline-flex h-10 items-center justify-center rounded-full bg-[#38A8D8] px-6 text-sm font-bold text-[#081827] hover:bg-[#2692c0] hover:text-white transition-colors"
              >
                Sign In
              </a>
            </div>
          </div>

          {/* 4 Multi-Column Link Section */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 py-12 border-b border-white/10 text-sm">
            <div>
              <h5 className="text-xs font-bold uppercase tracking-wider text-[#38A8D8] mb-4">For Creators</h5>
              <ul className="flex flex-col gap-3 text-[#B7C6D1]">
                <li><Link to="/#groups" className="hover:text-[#38A8D8] transition-colors">Communities & Cohorts</Link></li>
                <li><Link to="/features" className="hover:text-[#38A8D8] transition-colors">Creator Studio & AI</Link></li>
                <li><Link to="/features" className="hover:text-[#38A8D8] transition-colors">Courses & 1-on-1 Coaching</Link></li>
                <li><Link to="/#calling" className="hover:text-[#38A8D8] transition-colors">Live Audio & Video Stages</Link></li>
                <li><Link to="/creators" className="hover:text-[#38A8D8] transition-colors">Creator Success Stories</Link></li>
              </ul>
            </div>

            <div>
              <h5 className="text-xs font-bold uppercase tracking-wider text-[#38A8D8] mb-4">For Business & Vendors</h5>
              <ul className="flex flex-col gap-3 text-[#B7C6D1]">
                <li><Link to="/business" className="hover:text-[#38A8D8] transition-colors">Creator Storefronts</Link></li>
                <li><Link to="/business#solutions" className="hover:text-[#38A8D8] transition-colors">Digital & Physical Products</Link></li>
                <li><Link to="/business#solutions" className="hover:text-[#38A8D8] transition-colors">Inventory & Order Tracking</Link></li>
                <li><Link to="/business#escrow" className="hover:text-[#38A8D8] transition-colors">Escrow Merchant Wallet</Link></li>
                <li><Link to="/business#solutions" className="hover:text-[#38A8D8] transition-colors">Merchant Suite</Link></li>
              </ul>
            </div>

            <div>
              <h5 className="text-xs font-bold uppercase tracking-wider text-[#38A8D8] mb-4">Security & Trust</h5>
              <ul className="flex flex-col gap-3 text-[#B7C6D1]">
                <li><Link to="/privacy#encryption" className="hover:text-[#38A8D8] transition-colors">End-to-End Encryption</Link></li>
                <li><Link to="/privacy#kyc" className="hover:text-[#38A8D8] transition-colors">KYC Identity Verification</Link></li>
                <li><Link to="/privacy" className="hover:text-[#38A8D8] transition-colors">Privacy Principles</Link></li>
                <li><Link to="/terms" className="hover:text-[#38A8D8] transition-colors">Terms of Service</Link></li>
                <li><Link to="/help" className="hover:text-[#38A8D8] transition-colors">Support & Help Desk</Link></li>
              </ul>
            </div>

            <div>
              <h5 className="text-xs font-bold uppercase tracking-wider text-[#38A8D8] mb-4">Apps & Platform</h5>
              <ul className="flex flex-col gap-3 text-[#B7C6D1]">
                <li><Link to="/download#android" className="hover:text-[#38A8D8] transition-colors">Android Mobile App</Link></li>
                <li><Link to="/download#ios" className="hover:text-[#38A8D8] transition-colors">iOS iPhone App</Link></li>
                <li><Link to="/download#macos" className="hover:text-[#38A8D8] transition-colors">Mac & Windows Desktop</Link></li>
                <li><a href={getWebClientUrl()} className="hover:text-[#38A8D8] transition-colors">Web Client App</a></li>
                <li><Link to="/blog" className="hover:text-[#38A8D8] transition-colors">Official MurihSpace Blog</Link></li>
              </ul>
            </div>
          </div>

          {/* Bottom Legal & Copyright Bar */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-8 text-xs text-[#8696A0]">
            <p>© {new Date().getFullYear()} MurihSpace LLC. All rights reserved.</p>
            <div className="flex items-center gap-6">
              {footerLinks.map((link) => {
                const isExternal = link.href.startsWith("http://") || link.href.startsWith("https://");
                const linkId = `footer-${link.label.toLowerCase()}`;
                const linkKey = `${link.label}-${link.href}`;
                if (isExternal) {
                  return (
                    <a
                      key={linkKey}
                      href={link.href}
                      id={linkId}
                      className="hover:text-[#38A8D8] transition-colors"
                    >
                      {link.label}
                    </a>
                  );
                }
                return (
                  <Link
                    key={linkKey}
                    to={link.href}
                    id={linkId}
                    className="hover:text-[#38A8D8] transition-colors"
                  >
                    {link.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default PublicLayout;
