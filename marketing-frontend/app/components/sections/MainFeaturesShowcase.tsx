import { Link } from "react-router";
import { Mic, Shield, Sparkles, CheckCircle2, ShoppingBag, ArrowRight, Radio, Share2, Users, Hand, Lock } from "lucide-react";
import { useCmsSingle } from "../../hooks/useCms";

export interface CmsMainFeatures {
  calls_headline?: string;
  calls_subcopy?: string;
  security_headline?: string;
  security_subcopy?: string;
  groups_headline?: string;
  groups_subcopy?: string;
  status_headline?: string;
  status_subcopy?: string;
  business_headline?: string;
  business_subcopy?: string;
}

const defaultFeatures: CmsMainFeatures = {
  calls_headline: "Host interactive audio rooms and live masterclasses",
  calls_subcopy:
    "Bring your cohorts and followers together in real-time stage sessions with crystal-clear audio, noise suppression, speaker moderation, and zero latency.",
  security_headline: "Default end-to-end encryption & zero ad profiling",
  security_subcopy:
    "Your private conversations, 1-on-1 audio rooms, and sensitive files are cryptographically locked using the Signal protocol. Only you and your chosen recipients hold the keys.",
  groups_headline: "Organize student cohorts, channels & discussion feeds",
  groups_subcopy:
    "Run structured student cohorts and private community channels with interactive polls, pinned resources, member moderation, and broadcast announcements that reach all members.",
  status_headline: "Accelerate curriculum & broadcasts with Murih AI",
  status_subcopy:
    "Murih AI is your integrated creator assistant. Outline lessons, draft community announcements, generate discussion prompts, and automate member support responses in seconds.",
  business_headline: "Monetize digital downloads, physical goods & coaching",
  business_subcopy:
    "Launch your storefront in minutes. Sell digital templates, physical apparel, and 1-on-1 coaching packages directly within your community feed with automated milestone escrow.",
};

export function MainFeaturesShowcase() {
  const { data: cmsFeatures } = useCmsSingle<CmsMainFeatures>("homepage", defaultFeatures);
  const features = cmsFeatures ?? defaultFeatures;

  return (
    <>
      {/* ================= FEATURE 1: AUDIO ROOMS & LIVE STAGES ================= */}
      <section className="feature-section bg-white" id="calling">
        <div className="container-landing">
          <div className="feature-grid">
            <div className="feature-info">
              <span className="feature-tag">Audio &amp; Video Stages</span>
              <h2 className="title-section">{features.calls_headline ?? defaultFeatures.calls_headline}</h2>
              <p className="subtitle-hero">
                {features.calls_subcopy ?? defaultFeatures.calls_subcopy}
              </p>
              <div className="mt-4 flex flex-col gap-2.5 text-sm text-[#5A7184] font-medium">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-[#2164B6]" />
                  <span>Moderated speaker stage with audience hand-raise queues</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-[#2164B6]" />
                  <span>High-definition screen sharing for masterclasses and reviews</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-[#2164B6]" />
                  <span>Private 1-on-1 coaching calls with calendar integration</span>
                </div>
              </div>
              <Link to="/features#calling" className="feature-link mt-6 inline-flex">
                <span>Explore Audio &amp; Video Stages</span>
                <span>&rarr;</span>
              </Link>
            </div>

            <div className="feature-visual">
              <div className="feature-card-frame bg-gradient-to-br from-[#102840] to-[#0A1929] text-white p-6 rounded-3xl border border-[#D6E0E8]/20 shadow-xl">
                {/* Stage Header */}
                <div className="flex items-center justify-between pb-4 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/20 text-red-400 text-xs font-bold animate-pulse">
                      <Radio className="size-3" />
                      <span>LIVE STAGE</span>
                    </span>
                    <span className="text-sm font-semibold text-[#D1D7DB]">UI/UX Design Masterclass</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-[#8696A0]">
                    <Users className="size-3.5" />
                    <span>248 listening</span>
                  </div>
                </div>

                {/* Speaker Tiles Grid */}
                <div className="grid grid-cols-2 gap-3 my-5">
                  <div className="rounded-2xl bg-white/5 p-4 border border-white/10 flex flex-col items-center text-center relative overflow-hidden">
                    <div className="relative mb-2">
                      <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-[#2164B6] to-[#38A8D8] flex items-center justify-center font-bold text-white text-lg ring-4 ring-[#38A8D8]/30">
                        SJ
                      </div>
                      <span className="absolute bottom-0 right-0 size-4 rounded-full bg-[#38A8D8] border-2 border-[#102840] flex items-center justify-center">
                        <Mic className="size-2 text-[#102840]" />
                      </span>
                    </div>
                    <span className="text-xs font-bold text-white">Sarah Jenkins</span>
                    <span className="text-[11px] text-[#38A8D8]">Lead Creator</span>
                  </div>

                  <div className="rounded-2xl bg-white/5 p-4 border border-white/10 flex flex-col items-center text-center">
                    <div className="relative mb-2">
                      <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-[#5A7184] to-[#8696A0] flex items-center justify-center font-bold text-white text-lg">
                        MK
                      </div>
                      <span className="absolute bottom-0 right-0 size-4 rounded-full bg-[#2164B6] border-2 border-[#102840] flex items-center justify-center">
                        <Mic className="size-2 text-white" />
                      </span>
                    </div>
                    <span className="text-xs font-bold text-white">Marcus King</span>
                    <span className="text-[11px] text-[#8696A0]">Guest Speaker</span>
                  </div>
                </div>

                {/* Live Audio Waves and Controls */}
                <div className="flex items-center justify-between pt-4 border-t border-white/10">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1 h-3 bg-[#38A8D8] rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-1 h-5 bg-[#38A8D8] rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-1 h-2 bg-[#38A8D8] rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    <span className="w-1 h-6 bg-[#38A8D8] rounded-full animate-bounce" style={{ animationDelay: "75ms" }} />
                    <span className="w-1 h-4 bg-[#38A8D8] rounded-full animate-bounce" style={{ animationDelay: "200ms" }} />
                    <span className="text-xs text-[#8696A0] ml-2 font-mono">HD Stereo • 48kHz</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" className="p-2 rounded-xl bg-white/10 text-white text-xs hover:bg-white/20 transition-colors">
                      <Hand className="size-3.5" />
                    </button>
                    <button type="button" className="p-2 rounded-xl bg-white/10 text-white text-xs hover:bg-white/20 transition-colors">
                      <Share2 className="size-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= FEATURE 2: SECURITY & ENCRYPTION ================= */}
      <section className="feature-section bg-dark-navy" id="security">
        <div className="container-landing">
          <div className="feature-grid reverse">
            <div className="feature-info">
              <span className="feature-tag">Security &amp; Encryption</span>
              <h2 className="title-section" style={{ color: "#FFFFFF" }}>
                {features.security_headline ?? defaultFeatures.security_headline}
              </h2>
              <p className="subtitle-hero" style={{ color: "#D1D7DB" }}>
                {features.security_subcopy ?? defaultFeatures.security_subcopy}
              </p>
              <div className="mt-4 flex flex-col gap-2.5 text-sm text-[#B7C6D1] font-medium">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-[#38A8D8]" />
                  <span>No behavioral data harvesting or targeted advertising tracking</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-[#38A8D8]" />
                  <span>Biometric Chat Lock (Face ID, Touch ID, or Passcode)</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-[#38A8D8]" />
                  <span>Government-vetted KYC badge protects member trust</span>
                </div>
              </div>
              <Link to="/privacy" className="feature-link mt-6 inline-flex" style={{ color: "#38A8D8" }}>
                <span>Explore Privacy Safeguards</span>
                <span>&rarr;</span>
              </Link>
            </div>

            <div className="feature-visual">
              <div className="feature-card-frame bg-white/5 border border-white/10 p-8 rounded-3xl backdrop-blur-sm">
                <div className="flex flex-col items-center text-center gap-4">
                  <div className="w-20 h-20 rounded-3xl bg-[#2164B6]/20 border border-[#38A8D8]/30 flex items-center justify-center text-[#38A8D8] shadow-inner">
                    <Shield className="size-10" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">Cryptographic Vault</h3>
                    <p className="text-xs text-[#8696A0] mt-1 font-mono">Signal Protocol • Double Ratchet Algorithm</p>
                  </div>
                  <div className="w-full bg-white/5 rounded-2xl p-4 border border-white/10 flex flex-col gap-2 text-left text-xs text-[#D1D7DB]">
                    <div className="flex items-center justify-between pb-2 border-b border-white/10">
                      <span className="text-[#8696A0]">Message Payload:</span>
                      <span className="font-mono text-[#38A8D8]">256-bit AES Encrypted</span>
                    </div>
                    <div className="flex items-center justify-between pb-2 border-b border-white/10">
                      <span className="text-[#8696A0]">Key Exchange:</span>
                      <span className="font-mono text-emerald-400">Curve25519 Verified</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[#8696A0]">Ad Profiling:</span>
                      <span className="font-bold text-white">Strictly Disabled</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= FEATURE 3: COMMUNITIES & COHORTS ================= */}
      <section className="feature-section bg-cream" id="groups">
        <div className="container-landing">
          <div className="feature-grid">
            <div className="feature-info">
              <span className="feature-tag">Communities &amp; Cohorts</span>
              <h2 className="title-section">{features.groups_headline ?? defaultFeatures.groups_headline}</h2>
              <p className="subtitle-hero">
                {features.groups_subcopy ?? defaultFeatures.groups_subcopy}
              </p>
              <div className="mt-4 flex flex-col gap-2.5 text-sm text-[#5A7184] font-medium">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-[#2164B6]" />
                  <span>Interactive polls with real-time voting analytics</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-[#2164B6]" />
                  <span>Granular moderator roles, access levels, and invite links</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-[#2164B6]" />
                  <span>Broadcast channels with 100% direct feed delivery</span>
                </div>
              </div>
              <Link to="/features#groups" className="feature-link mt-6 inline-flex">
                <span>Explore Communities &amp; Cohorts</span>
                <span>&rarr;</span>
              </Link>
            </div>

            <div className="feature-visual">
              <div className="feature-card-frame bg-white p-6 rounded-3xl border border-[#D6E0E8] shadow-lg">
                {/* Community Feed Mockup */}
                <div className="flex items-center justify-between pb-4 border-b border-[#D6E0E8]">
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-xl bg-[#2164B6] flex items-center justify-center text-white font-bold text-sm">
                      MS
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-[#102840]">Fullstack Cohort Spring &apos;26</h4>
                      <p className="text-xs text-[#5A7184]">1,420 enrolled students • 38 online</p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-[#E8F8FF] text-[#2164B6] text-xs font-semibold">
                    Active Cohort
                  </span>
                </div>

                {/* Live Poll Widget */}
                <div className="my-5 rounded-2xl bg-[#F7FAFC] p-4 border border-[#D6E0E8]">
                  <p className="text-xs font-bold text-[#102840] mb-3">
                    📊 Live Poll: What project are you building for module 3?
                  </p>
                  <div className="flex flex-col gap-2">
                    <div>
                      <div className="flex justify-between text-xs font-medium mb-1">
                        <span className="text-[#102840]">SaaS Subscription Dashboard</span>
                        <span className="font-bold text-[#2164B6]">68%</span>
                      </div>
                      <div className="h-2 w-full bg-[#D6E0E8] rounded-full overflow-hidden">
                        <div className="h-full bg-[#2164B6] rounded-full" style={{ width: "68%" }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs font-medium mb-1">
                        <span className="text-[#102840]">Escrow Marketplace Web App</span>
                        <span className="font-bold text-[#5A7184]">32%</span>
                      </div>
                      <div className="h-2 w-full bg-[#D6E0E8] rounded-full overflow-hidden">
                        <div className="h-full bg-[#5A7184]" style={{ width: "32%" }} />
                      </div>
                    </div>
                  </div>
                  <span className="text-[11px] text-[#8696A0] mt-3 block">186 students voted • Closes in 4 hours</span>
                </div>

                {/* Reactions Pill */}
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-full bg-white border border-[#D6E0E8] text-xs shadow-xs">
                    🔥 42
                  </span>
                  <span className="px-3 py-1 rounded-full bg-white border border-[#D6E0E8] text-xs shadow-xs">
                    🚀 29
                  </span>
                  <span className="px-3 py-1 rounded-full bg-white border border-[#D6E0E8] text-xs shadow-xs">
                    💡 16
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= FEATURE 4: MURIH AI & CREATOR STUDIO ================= */}
      <section className="feature-section bg-white" id="status">
        <div className="container-landing">
          <div className="feature-grid reverse">
            <div className="feature-info">
              <span className="feature-tag">Murih AI Assistant</span>
              <h2 className="title-section">{features.status_headline ?? defaultFeatures.status_headline}</h2>
              <p className="subtitle-hero">
                {features.status_subcopy ?? defaultFeatures.status_subcopy}
              </p>
              <div className="mt-4 flex flex-col gap-2.5 text-sm text-[#5A7184] font-medium">
                <div className="flex items-center gap-2">
                  <Sparkles className="size-4 text-[#2164B6]" />
                  <span>Instant curriculum outlines, summaries, and lecture notes</span>
                </div>
                <div className="flex items-center gap-2">
                  <Sparkles className="size-4 text-[#2164B6]" />
                  <span>Automated broadcast drafts tailored to your community tone</span>
                </div>
                <div className="flex items-center gap-2">
                  <Sparkles className="size-4 text-[#2164B6]" />
                  <span>Context-aware memory helps handle frequent member inquiries</span>
                </div>
              </div>
              <Link to="/features#creator-studio" className="feature-link mt-6 inline-flex">
                <span>Discover Creator Studio &amp; AI</span>
                <span>&rarr;</span>
              </Link>
            </div>

            <div className="feature-visual">
              <div className="feature-card-frame bg-[#FAF9F5] p-6 rounded-3xl border border-[#D6E0E8] shadow-md">
                <div className="flex items-center gap-2.5 pb-4 border-b border-[#D6E0E8]">
                  <div className="w-8 h-8 rounded-lg bg-[#2164B6] flex items-center justify-center text-white">
                    <Sparkles className="size-4" />
                  </div>
                  <div>
                    <span className="text-sm font-bold text-[#102840]">Murih AI Creator Copilot</span>
                    <span className="text-[11px] text-[#5A7184] block">Trained on community workflows</span>
                  </div>
                </div>

                <div className="flex flex-col gap-3 my-4">
                  {/* User Prompt */}
                  <div className="self-end max-w-[85%] rounded-2xl rounded-br-xs bg-[#2164B6] text-white p-3 text-xs">
                    Draft a Friday live masterclass announcement with homework reminder for the Design Cohort.
                  </div>

                  {/* AI Response */}
                  <div className="self-start max-w-[90%] rounded-2xl rounded-bl-xs bg-white border border-[#D6E0E8] p-3 text-xs text-[#102840] shadow-xs">
                    <p className="font-semibold text-[#2164B6] mb-1">✨ Announcement Ready:</p>
                    <p className="leading-relaxed">
                      &ldquo;Hey team! Our live masterclass on <strong>Design Systems Architecture</strong> kicks off this Friday at 4 PM UTC. Bring your assignment drafts for live teardowns! 🎨&rdquo;
                    </p>
                    <div className="mt-2 pt-2 border-t border-[#D6E0E8] flex gap-2">
                      <button type="button" className="px-2 py-1 rounded bg-[#E8F8FF] text-[#2164B6] font-bold text-[10px]">
                        Post to Cohort
                      </button>
                      <button type="button" className="px-2 py-1 rounded bg-[#F0F4F8] text-[#5A7184] text-[10px]">
                        Edit
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= FEATURE 5: MURIHSPACE BUSINESS & ESCROW ================= */}
      <section className="feature-section bg-cream" id="business">
        <div className="container-landing">
          <div className="feature-grid">
            <div className="feature-info">
              <span className="feature-tag">Commerce &amp; Escrow</span>
              <h2 className="title-section">{features.business_headline ?? defaultFeatures.business_headline}</h2>
              <p className="subtitle-hero">
                {features.business_subcopy ?? defaultFeatures.business_subcopy}
              </p>
              <div className="mt-4 flex flex-col gap-2.5 text-sm text-[#5A7184] font-medium">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-[#2164B6]" />
                  <span>Milestone escrow prevents payment fraud and eliminates chargebacks</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-[#2164B6]" />
                  <span>Instant in-chat checkout with local payment rails and mobile money</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-[#2164B6]" />
                  <span>Multi-warehouse inventory, waybill generation &amp; automated tracking</span>
                </div>
              </div>
              <Link to="/business" className="feature-link mt-6 inline-flex">
                <span>Discover MurihSpace for Business</span>
                <span>&rarr;</span>
              </Link>
            </div>

            <div className="feature-visual">
              <div className="feature-card-frame bg-white p-6 rounded-3xl border border-[#D6E0E8] shadow-lg">
                <div className="flex items-center justify-between pb-4 border-b border-[#D6E0E8]">
                  <div className="flex items-center gap-2">
                    <ShoppingBag className="size-4 text-[#2164B6]" />
                    <span className="text-xs font-bold uppercase tracking-wider text-[#102840]">Creator Storefront</span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold flex items-center gap-1 border border-emerald-200">
                    <Shield className="size-3" /> Escrow Protected
                  </span>
                </div>

                <div className="my-5 flex gap-4 items-center">
                  <div className="size-20 rounded-2xl bg-gradient-to-br from-[#2164B6] to-[#102840] flex items-center justify-center text-white shrink-0 shadow-md">
                    <Sparkles className="size-8" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-[#102840]">Masterclass UI Design Kit (Figma)</h4>
                    <p className="text-xs text-[#5A7184] mt-0.5">250+ Components • Commercial License</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-lg font-extrabold text-[#102840]">$49.00</span>
                      <span className="text-xs text-[#8696A0] line-through">$89.00</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl bg-[#F7FAFC] p-3 border border-[#D6E0E8] flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-[#5A7184]">
                    <CheckCircle2 className="size-4 text-[#2164B6]" />
                    <span>Instant Digital Delivery</span>
                  </div>
                  <span className="font-semibold text-[#102840]">⭐ 4.9 (84 reviews)</span>
                </div>

                <div className="mt-4 pt-3 border-t border-[#D6E0E8]">
                  <Link
                    to="/business"
                    className="w-full btn-wa-primary text-xs py-3 rounded-xl flex items-center justify-center gap-2 font-bold"
                  >
                    <span>View Storefront Features</span>
                    <ArrowRight className="size-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
