import { Link } from "react-router";
import { Mic, Shield, Sparkles, Radio, Users, Lock, MessageSquare, Video, ArrowRight, Zap, Award } from "lucide-react";
import { getRegisterUrl } from "~/lib/env";

export function meta() {
  return [
    { title: "MurihSpace Features | Creators, Storefronts, Communities & AI" },
    {
      name: "description",
      content:
        "Explore everything you can do on MurihSpace: Creator Studio, Communities & Cohorts, Digital Storefronts, Audio Rooms, and KYC Escrow.",
    },
  ];
}

export default function FeaturesPage() {
  return (
    <>
      {/* ================= FEATURES HERO ================= */}
      <section className="privacy-hero" id="creators">
        <div className="container-landing">
          <div className="privacy-hero-inner">
            <span className="feature-tag justify-center">
              Platform Features
            </span>
            <h1 className="title-hero">Built for creators, cohorts &amp; commerce</h1>
            <p className="subtitle-hero">
              Equipped with structured student cohorts, digital &amp; physical storefronts, interactive live audio stages, and default Signal protocol encryption.
            </p>
          </div>
        </div>
      </section>

      {/* ================= AUDIO ROOMS & STAGES ================= */}
      <section className="feature-section bg-white" id="calling">
        <div className="container-landing">
          <div className="feature-grid">
            <div className="feature-info">
              <span className="feature-tag">Audio &amp; Video Stages</span>
              <h2 className="title-section">Interactive audio rooms &amp; HD live stages</h2>
              <p className="subtitle-hero">
                Host live cohort masterclasses, community discussions, or 1-on-1 coaching sessions with crystal-clear audio, noise suppression, and speaker queue moderation.
              </p>
              <ul className="flex flex-col gap-2.5 mt-4 text-[#5A7184] text-[15px] font-medium list-none p-0">
                <li className="flex items-center gap-2.5">
                  <Mic className="size-4 text-[#2164B6] shrink-0" />
                  <span>Moderated stage with speaker queues and listener hand-raise controls</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Video className="size-4 text-[#2164B6] shrink-0" />
                  <span>HD video calling and screen sharing for interactive workshops</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Lock className="size-4 text-[#2164B6] shrink-0" />
                  <span>Encrypted 1-on-1 private coaching calls with zero platform eavesdropping</span>
                </li>
              </ul>
            </div>

            <div className="feature-visual">
              <div className="feature-card-frame bg-[#102840] text-white p-6 rounded-3xl border border-white/10 shadow-xl">
                <div className="flex items-center justify-between pb-3 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <span className="size-2 rounded-full bg-red-400 animate-ping" />
                    <span className="text-xs font-bold uppercase tracking-wider text-red-300">Live Stage</span>
                  </div>
                  <span className="text-xs text-[#B7C6D1]">182 Participants</span>
                </div>

                <div className="grid grid-cols-2 gap-3 my-4">
                  <div className="bg-white/5 rounded-2xl p-4 border border-white/10 flex flex-col items-center text-center">
                    <div className="w-12 h-12 rounded-full bg-[#2164B6] text-white font-bold flex items-center justify-center mb-2 ring-2 ring-[#38A8D8]">
                      SJ
                    </div>
                    <span className="text-xs font-bold text-white">Sarah Jenkins</span>
                    <span className="text-[10px] text-[#38A8D8] mt-0.5">Speaker • Mic Active</span>
                  </div>
                  <div className="bg-white/5 rounded-2xl p-4 border border-white/10 flex flex-col items-center text-center">
                    <div className="w-12 h-12 rounded-full bg-[#5A7184] text-white font-bold flex items-center justify-center mb-2">
                      DA
                    </div>
                    <span className="text-xs font-bold text-white">David Adeleke</span>
                    <span className="text-[10px] text-[#8696A0] mt-0.5">Co-host</span>
                  </div>
                </div>

                <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs text-[#8696A0]">
                  <span className="font-mono">Adaptive Bitrate • 48kHz Stereo</span>
                  <span className="px-2.5 py-1 rounded-full bg-white/10 text-white font-medium">Stage Mute</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= MESSAGING ================= */}
      <section className="feature-section bg-cream" id="messaging">
        <div className="container-landing">
          <div className="feature-grid reverse">
            <div className="feature-info">
              <span className="feature-tag">Cryptographic Messaging</span>
              <h2 className="title-section">Expressive, safe &amp; secure chats</h2>
              <p className="subtitle-hero">
                Send rich direct messages, high-resolution media, interactive polls, and audio waveforms with default Signal protocol cryptographic encryption.
              </p>
              <ul className="flex flex-col gap-2.5 mt-4 text-[#5A7184] text-[15px] font-medium list-none p-0">
                <li className="flex items-center gap-2.5">
                  <MessageSquare className="size-4 text-[#2164B6] shrink-0" />
                  <span>Message editing, reply threads, and custom emoji reactions</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Zap className="size-4 text-[#2164B6] shrink-0" />
                  <span>High-fidelity voice notes with variable playback speeds (1.5x, 2x)</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Shield className="size-4 text-[#2164B6] shrink-0" />
                  <span>Biometric lock protects sensitive direct conversations on device</span>
                </li>
              </ul>
            </div>

            <div className="feature-visual">
              <div className="feature-card-frame bg-white p-6 rounded-3xl border border-[#D6E0E8] shadow-lg">
                <div className="flex items-center justify-between pb-3 border-b border-[#D6E0E8]">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-[#E8F8FF] text-[#2164B6] font-bold flex items-center justify-center text-xs">
                      MK
                    </div>
                    <div>
                      <span className="text-xs font-bold text-[#102840]">Marcus King</span>
                      <span className="text-[10px] text-emerald-600 font-semibold block">● Online</span>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-[#8696A0] bg-[#FAF9F5] px-2 py-0.5 rounded border border-[#D6E0E8]">
                    🔒 E2E Encrypted
                  </span>
                </div>

                <div className="flex flex-col gap-2.5 my-4">
                  <div className="self-start max-w-[80%] rounded-2xl rounded-bl-xs bg-[#FAF9F5] p-3 text-xs text-[#102840] border border-[#D6E0E8]">
                    Just reviewed module 4! The breakdown of state management was super clear. 🙌
                  </div>
                  <div className="self-end max-w-[80%] rounded-2xl rounded-br-xs bg-[#2164B6] p-3 text-xs text-white">
                    Glad it helped! The next assignment unlocks tonight. Let me know if you need feedback! 🚀
                  </div>
                </div>

                <div className="pt-2 border-t border-[#D6E0E8] flex items-center justify-between text-xs text-[#8696A0]">
                  <span>Delivered &amp; Read</span>
                  <span>10:48 AM</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= COMMUNITIES & COHORTS ================= */}
      <section className="feature-section bg-white" id="groups">
        <div className="container-landing">
          <div className="feature-grid">
            <div className="feature-info">
              <span className="feature-tag">Communities &amp; Cohorts</span>
              <h2 className="title-section">Organize student cohorts, paid memberships &amp; fans</h2>
              <p className="subtitle-hero">
                MurihSpace communities bring related channels under one roof with member feeds, tiered access, announcements, and structured group discussions.
              </p>
              <ul className="flex flex-col gap-2.5 mt-4 text-[#5A7184] text-[15px] font-medium list-none p-0">
                <li className="flex items-center gap-2.5">
                  <Users className="size-4 text-[#2164B6] shrink-0" />
                  <span>Unlimited members with granular moderator privileges and roles</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Radio className="size-4 text-[#2164B6] shrink-0" />
                  <span>Broadcast channels reaching all enrolled students instantly without algorithm throttling</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Award className="size-4 text-[#2164B6] shrink-0" />
                  <span>Custom badges and reputation tiers for top community contributors</span>
                </li>
              </ul>
            </div>

            <div className="feature-visual">
              <div className="feature-card-frame bg-[#FAF9F5] p-6 rounded-3xl border border-[#D6E0E8] shadow-md">
                <div className="flex items-center justify-between pb-3 border-b border-[#D6E0E8]">
                  <span className="text-xs font-bold text-[#102840]">Design Leadership Cohort</span>
                  <span className="text-xs font-bold text-[#2164B6] bg-[#E8F8FF] px-2.5 py-0.5 rounded-full">
                    Cohort #3
                  </span>
                </div>

                <div className="my-4 flex flex-col gap-2 text-xs">
                  <div className="p-3 rounded-xl bg-white border border-[#D6E0E8]">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-[#102840]">📢 Announcement: Live Q&amp;A Tomorrow</span>
                      <span className="text-[10px] text-[#8696A0]">Pinned</span>
                    </div>
                    <p className="text-[#5A7184]">Join us at 3 PM UTC for live portfolio critiques. Submit links in the channel thread!</p>
                  </div>
                  <div className="p-3 rounded-xl bg-white border border-[#D6E0E8] flex items-center justify-between">
                    <span className="text-[#102840] font-medium">📁 Module 4 Resource Assets.zip (42 MB)</span>
                    <button type="button" className="text-xs text-[#2164B6] font-bold">Download</button>
                  </div>
                </div>

                <div className="pt-2 border-t border-[#D6E0E8] flex items-center justify-between text-xs text-[#8696A0]">
                  <span>Channel: #general-discussions</span>
                  <span>142 Active Members</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= CREATOR STUDIO & AI ================= */}
      <section className="feature-section bg-dark-navy" id="creator-studio">
        <div className="container-landing">
          <div className="feature-grid reverse">
            <div className="feature-info">
              <span className="feature-tag" style={{ color: "#38A8D8" }}>
                Murih AI &amp; Creator Studio
              </span>
              <h2 className="title-section" style={{ color: "#FFFFFF" }}>
                Draft, brainstorm &amp; publish with Murih AI
              </h2>
              <p className="subtitle-hero" style={{ color: "#D1D7DB" }}>
                Murih AI is your smart creator assistant built right into MurihSpace. Draft community broadcasts, summarize discussions, outline courses, and automate community responses seamlessly.
              </p>
              <div className="mt-4 p-4 rounded-2xl bg-white/5 border border-white/10 text-white text-xs italic">
                &ldquo;Hey Murih AI, draft an announcement for this Friday&apos;s live coaching masterclass.&rdquo;
              </div>
            </div>

            <div className="feature-visual">
              <div className="feature-card-frame bg-white/5 border border-white/10 p-6 rounded-3xl backdrop-blur-sm text-white">
                <div className="flex items-center gap-2 pb-3 border-b border-white/10">
                  <Sparkles className="size-4 text-[#38A8D8]" />
                  <span className="text-xs font-bold uppercase tracking-wider text-[#38A8D8]">Murih AI Response</span>
                </div>
                <div className="my-4 text-xs leading-relaxed text-[#D1D7DB] bg-white/5 p-4 rounded-xl border border-white/10">
                  &ldquo;🎓 Masterclass Alert: This Friday, we dive deep into <strong>Monetization &amp; Cohort Retaining</strong>. Bring your questions for our live audit session! RSVP via the cohort calendar.&rdquo;
                </div>
                <div className="flex gap-2">
                  <button type="button" className="px-3 py-1.5 rounded-lg bg-[#38A8D8] text-[#102840] font-bold text-xs">
                    Publish Draft
                  </button>
                  <button type="button" className="px-3 py-1.5 rounded-lg bg-white/10 text-white text-xs">
                    Regenerate
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= BOTTOM CTA ================= */}
      <section className="cta-banner">
        <div className="container-landing">
          <div className="cta-content">
            <h2 className="cta-title">Everything you need to grow your community</h2>
            <p className="cta-subtitle">
              Join thousands of educators, creators, and merchants building on MurihSpace.
            </p>
            <div className="cta-buttons">
              <a href={getRegisterUrl()} className="btn-wa-primary">
                <span>Get Started Free</span>
                <ArrowRight className="size-4 ml-1 inline" />
              </a>
              <Link to="/business" className="btn-wa-outline" style={{ color: "#FFFFFF", borderColor: "#FFFFFF" }}>
                Explore Business Storefronts
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
