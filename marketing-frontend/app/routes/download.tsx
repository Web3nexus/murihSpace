import { Link } from "react-router";
import { ArrowRight, Globe, Monitor, Smartphone, Shield, Radio, Sparkles } from "lucide-react";
import { getWebClientUrl } from "~/lib/env";

// Real store/installer URLs are deployment config. Only render a platform
// button when its URL is configured so the page never links a store button to
// the web client or to a build that does not exist yet.
const PLAY_STORE_URL = import.meta.env.VITE_PLAY_STORE_URL as string | undefined;
const APK_URL = import.meta.env.VITE_APK_URL as string | undefined;
const APP_STORE_URL = import.meta.env.VITE_APP_STORE_URL as string | undefined;
const MACOS_URL = import.meta.env.VITE_MACOS_URL as string | undefined;
const WINDOWS_URL = import.meta.env.VITE_WINDOWS_URL as string | undefined;

function ComingSoon({ label = "Coming soon" }: { label?: string }) {
  return (
    <span className="inline-flex w-full items-center justify-center rounded-full border border-dashed border-[#D6E0E8] px-4 py-3 text-xs font-semibold text-[#5A7184]">
      {label}
    </span>
  );
}

export function meta() {
  return [
    { title: "Download MurihSpace | Mobile, Desktop and Web" },
    {
      name: "description",
      content:
        "Download MurihSpace on Android, iPhone, Mac, Windows, or access directly via web client. End-to-end encrypted messaging, creator tools, and commerce.",
    },
  ];
}

export default function DownloadPage() {
  return (
    <div className="bg-[#FAF9F5] text-[#102840]">
      {/* ================= DOWNLOAD HERO ================= */}
      <section className="download-hero">
        <div className="container-landing">
          <div className="text-center max-w-3xl mx-auto">
            <span className="feature-tag justify-center">MurihSpace for all devices</span>
            <h1 className="title-hero mt-3">Download MurihSpace</h1>
            <p className="subtitle-hero mt-4">
              Connect with cohorts, manage your digital storefront, and communicate with end-to-end encryption anytime, anywhere.
            </p>
          </div>

          {/* Desktop Visual Showcase Mockup */}
          <div className="max-w-3xl mx-auto my-10">
            <div className="rounded-3xl border border-[#D6E0E8] bg-[#102840] shadow-2xl overflow-hidden text-white">
              {/* Desktop Window Title Bar */}
              <div className="bg-[#0A1929] px-4 py-3 flex items-center justify-between border-b border-white/10">
                <div className="flex items-center gap-2">
                  <span className="size-3 rounded-full bg-red-500/80" />
                  <span className="size-3 rounded-full bg-amber-500/80" />
                  <span className="size-3 rounded-full bg-green-500/80" />
                  <span className="text-xs font-mono text-[#8696A0] ml-2">MurihSpace Desktop — v2.4.0</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-[#38A8D8]">
                  <Shield className="size-3.5" />
                  <span className="font-semibold">E2E Encrypted</span>
                </div>
              </div>

              {/* Workspace Mockup Inner */}
              <div className="grid grid-cols-12 min-h-[260px] text-xs">
                {/* Left Mini Sidebar */}
                <div className="col-span-3 bg-white/5 border-r border-white/10 p-3 flex flex-col gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#8696A0]">Cohorts &amp; Chats</span>
                  <div className="p-2 rounded-xl bg-white/10 text-white font-medium flex items-center gap-2">
                    <span className="size-2 rounded-full bg-[#38A8D8]" />
                    <span className="truncate">Design Cohort &apos;26</span>
                  </div>
                  <div className="p-2 rounded-xl text-[#B7C6D1] hover:bg-white/5 transition-colors flex items-center gap-2">
                    <span className="size-2 rounded-full bg-transparent border border-white/30" />
                    <span className="truncate">Storefront Inquiries</span>
                  </div>
                  <div className="p-2 rounded-xl text-[#B7C6D1] hover:bg-white/5 transition-colors flex items-center gap-2">
                    <span className="size-2 rounded-full bg-transparent border border-white/30" />
                    <span className="truncate">Live Masterclass Stage</span>
                  </div>
                </div>

                {/* Main Content Feed Area */}
                <div className="col-span-9 p-4 flex flex-col justify-between bg-[#102840]">
                  <div className="flex items-center justify-between pb-2 border-b border-white/10">
                    <span className="font-bold text-white">#general-announcements</span>
                    <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-800">
                      ● Sync Active
                    </span>
                  </div>

                  <div className="flex flex-col gap-2 my-4">
                    <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                      <p className="font-bold text-[#38A8D8]">Sarah Jenkins (Instructor):</p>
                      <p className="text-[#D1D7DB] mt-0.5">
                        Module 4 curriculum and project templates have been published to your storefronts. Let&apos;s review in today&apos;s live audio stage! 🚀
                      </p>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[#8696A0] text-[11px]">
                    <span>Desktop notifications enabled</span>
                    <span className="text-[#38A8D8] font-bold">macOS &amp; Windows Ready</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Platforms Grid */}
          <div className="download-platforms-grid">
            {/* Mobile: Android */}
            <div className="platform-card" id="android">
              <div className="platform-icon-circle">
                <img src="/icons/playstore-logo.svg" alt="Google Play" className="w-9 h-9" />
              </div>
              <h3 className="platform-title">Android</h3>
              <p className="platform-desc">
                Requires Android OS 6.0 or newer. Download from Google Play Store or direct APK installer.
              </p>
              <div className="flex flex-col gap-2 w-full mt-auto">
                {PLAY_STORE_URL && (
                  <a href={PLAY_STORE_URL} target="_blank" rel="noopener noreferrer" className="btn-wa-primary w-full text-center text-sm py-3">
                    Get on Google Play
                  </a>
                )}
                {APK_URL && (
                  <a href={APK_URL} target="_blank" rel="noopener noreferrer" className="btn-wa-outline w-full text-center text-xs py-2">
                    Download APK
                  </a>
                )}
                {!PLAY_STORE_URL && !APK_URL && <ComingSoon />}
              </div>
            </div>

            {/* Mobile: iOS */}
            <div className="platform-card" id="ios">
              <div className="platform-icon-circle">
                <img src="/icons/apple-logo.svg" alt="Apple iOS" className="w-9 h-9" />
              </div>
              <h3 className="platform-title">iPhone</h3>
              <p className="platform-desc">
                Requires iOS 13.0 or newer. Available on the Apple App Store with push alerts and biometric security.
              </p>
              <div className="flex flex-col gap-2 w-full mt-auto">
                {APP_STORE_URL ? (
                  <a href={APP_STORE_URL} target="_blank" rel="noopener noreferrer" className="btn-wa-primary w-full text-center text-sm py-3">
                    Apple App Store
                  </a>
                ) : (
                  <ComingSoon />
                )}
              </div>
            </div>

            {/* Desktop: Mac */}
            <div className="platform-card" id="macos">
              <div className="platform-icon-circle">
                <img src="/icons/apple-logo.svg" alt="Apple macOS" className="w-9 h-9" />
              </div>
              <h3 className="platform-title">Mac</h3>
              <p className="platform-desc">
                Requires macOS 11 or newer. Native Apple Silicon (M1-M4) &amp; Intel with stage audio and video support.
              </p>
              <div className="flex flex-col gap-2 w-full mt-auto">
                {MACOS_URL ? (
                  <a href={MACOS_URL} target="_blank" rel="noopener noreferrer" className="btn-wa-primary w-full text-center text-sm py-3">
                    Download for Mac
                  </a>
                ) : (
                  <ComingSoon />
                )}
              </div>
            </div>

            {/* Desktop: Windows */}
            <div className="platform-card" id="windows">
              <div className="platform-icon-circle">
                <img src="/icons/windows-logo.svg" alt="Windows" className="w-9 h-9" />
              </div>
              <h3 className="platform-title">Windows</h3>
              <p className="platform-desc">
                Requires Windows 10/11 (64-bit). Complete multi-window support and instant desktop notifications.
              </p>
              <div className="flex flex-col gap-2 w-full mt-auto">
                {WINDOWS_URL ? (
                  <a href={WINDOWS_URL} target="_blank" rel="noopener noreferrer" className="btn-wa-primary w-full text-center text-sm py-3">
                    Get from Windows Store
                  </a>
                ) : (
                  <ComingSoon />
                )}
              </div>
            </div>
          </div>

          {/* Web Link Section */}
          <div className="bg-white rounded-3xl p-8 md:p-12 mt-12 text-center border border-[#D6E0E8] shadow-sm max-w-4xl mx-auto">
            <div className="w-12 h-12 rounded-full bg-[#E8F8FF] text-[#2164B6] flex items-center justify-center mx-auto mb-4">
              <Globe className="size-6" />
            </div>
            <h3 className="text-2xl font-bold mb-3 text-[#102840]">Don&apos;t want to install software?</h3>
            <p className="text-[#5A7184] mb-6 text-base max-w-xl mx-auto">
              You can use MurihSpace instantly in your web browser with zero installation needed. Keep chats and orders synced across all your tabs.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <a href={getWebClientUrl()} className="btn-wa-primary">
                <span>Launch MurihSpace Web Client</span>
                <ArrowRight className="size-4 ml-1 inline" />
              </a>
              <a
                href={getWebClientUrl()}
                className="btn-wa-outline"
              >
                Direct Web App Link
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
