import { Link } from "react-router";
import { Lock, EyeOff, CheckCircle2, ShieldCheck, ArrowRight, Key, Award, Database, UserX } from "lucide-react";

export function meta() {
  return [
    { title: "Privacy & Security | End-to-End Encryption & KYC Verification" },
    {
      name: "description",
      content:
        "Discover how MurihSpace protects your conversations and commerce with default Signal protocol end-to-end encryption, KYC identity verification, and escrow safeguards.",
    },
  ];
}

export default function PrivacyPage() {
  const securityFeatures = [
    {
      icon: Lock,
      title: "Chat Lock & Biometrics",
      desc: "Keep sensitive cohort or 1-on-1 conversations password-protected in a dedicated vault. Unlock only with Face ID, fingerprint, or your secret passcode.",
      badge: "On-Device Biometrics",
      color: "from-blue-600/10 to-indigo-600/10 text-[#2164B6]",
    },
    {
      icon: Award,
      title: "KYC Identity Verification",
      desc: "Build instant trust with community members and buyers. Verified creators and merchants receive vetted badges upon confirming government identity.",
      badge: "Anti-Impersonation",
      color: "from-emerald-600/10 to-teal-600/10 text-emerald-700",
    },
    {
      icon: ShieldCheck,
      title: "Escrow Payment Safeguards",
      desc: "Prevent payment fraud and dispute delays. Customer payments for physical merchandise and milestones are held securely in escrow until order delivery is verified.",
      badge: "100% Fund Protection",
      color: "from-sky-600/10 to-blue-600/10 text-[#38A8D8]",
    },
    {
      icon: Database,
      title: "Encrypted Cloud Backups",
      desc: "Extend Signal protocol protection to your cloud backups. Your stored chat records and media are secured with a 64-digit encryption key known only to you.",
      badge: "Zero-Knowledge Storage",
      color: "from-purple-600/10 to-blue-600/10 text-purple-700",
    },
    {
      icon: EyeOff,
      title: "Granular Online Presence",
      desc: "Choose who can see when you are active. Customize your status visibility to Cohort Members, Mutual Contacts, or Nobody for undisturbed focus.",
      badge: "Custom Privacy Scope",
      color: "from-amber-600/10 to-orange-600/10 text-amber-700",
    },
    {
      icon: UserX,
      title: "Block, Report & Moderator Tools",
      desc: "Easily block unwanted accounts or report spam directly to community moderators. Automated moderation rules help filter abusive content before members see it.",
      badge: "Community Safety",
      color: "from-rose-600/10 to-red-600/10 text-rose-700",
    },
  ];

  return (
    <div className="bg-[#FAF9F5] text-[#102840]">
      {/* ================= PRIVACY HERO ================= */}
      <section className="privacy-hero">
        <div className="container-landing">
          <div className="privacy-hero-inner">
            <span className="feature-tag justify-center">Privacy on MurihSpace</span>
            <h1 className="title-hero">Better connection with safety &amp; trust.</h1>
            <p className="subtitle-hero">
              Whether it’s private 1-on-1 coaching, cohort masterclasses, or digital commerce checkout, MurihSpace privacy keeps your identity and conversations protected.
            </p>
          </div>
        </div>
      </section>

      {/* ================= FOUNDATION: END-TO-END ENCRYPTION ================= */}
      <section className="feature-section bg-[#102840] text-white" id="encryption">
        <div className="container-landing">
          <div className="feature-grid reverse">
            <div className="feature-info">
              <div className="w-14 h-14 rounded-full bg-[#2164B6]/20 flex items-center justify-center text-[#38A8D8] mb-6">
                <Lock className="size-7" />
              </div>
              <h2 className="title-section text-white">Default Signal protocol encryption</h2>
              <p className="subtitle-hero text-[#D1D7DB]">
                Your direct messages, audio calls, voice notes, and media stay strictly between you and the recipients you select. Not even MurihSpace can decrypt or listen to them.
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-4 text-sm text-[#38A8D8] font-semibold">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="size-4" /> Signal Protocol Core
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="size-4" /> Zero Backdoors
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="size-4" /> No Ad Profiling
                </span>
              </div>
            </div>

            {/* Cryptographic Vault Card */}
            <div className="feature-visual">
              <div className="feature-card-frame bg-white/5 border border-white/10 p-8 rounded-3xl backdrop-blur-sm text-center">
                <div className="w-20 h-20 rounded-3xl bg-[#2164B6]/30 border border-[#38A8D8]/40 flex items-center justify-center text-[#38A8D8] mx-auto mb-4">
                  <Key className="size-10" />
                </div>
                <h3 className="text-xl font-bold text-white">End-to-End Key Pair</h3>
                <p className="text-xs text-[#8696A0] mt-1 font-mono">Curve25519 &amp; 256-bit AES GCM</p>

                <div className="mt-6 bg-white/5 rounded-2xl p-4 border border-white/10 flex flex-col gap-2.5 text-left text-xs text-[#D1D7DB]">
                  <div className="flex items-center justify-between pb-2 border-b border-white/10">
                    <span className="text-[#8696A0]">Direct Chat Encryption:</span>
                    <span className="font-bold text-emerald-400">Always Enabled</span>
                  </div>
                  <div className="flex items-center justify-between pb-2 border-b border-white/10">
                    <span className="text-[#8696A0]">Stage Audio Streams:</span>
                    <span className="font-mono text-[#38A8D8]">Encrypted WebRTC</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#8696A0]">Data Monetization:</span>
                    <span className="font-bold text-white">Zero Third-Party Sharing</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= ADDITIONAL LAYERS OF PRIVACY & KYC ================= */}
      <section className="feature-section bg-white" id="security">
        <div className="container-landing">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="feature-tag justify-center">Built-in Controls</span>
            <h2 className="title-section">Additional layers of trust &amp; privacy</h2>
            <p className="subtitle-hero mt-3">
              Explore advanced privacy and identity security tools designed to give creators, members, and vendors absolute peace of mind.
            </p>
          </div>

          <div className="privacy-grid">
            {securityFeatures.map((item, idx) => {
              const Icon = item.icon;
              return (
                <div key={idx} className="privacy-feature-card">
                  <div className={`p-8 bg-gradient-to-br ${item.color} flex items-center justify-between border-b border-black/5`}>
                    <div className="size-12 rounded-2xl bg-white shadow-sm flex items-center justify-center">
                      <Icon className="size-6" />
                    </div>
                    <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-white/80 shadow-2xs">
                      {item.badge}
                    </span>
                  </div>
                  <div className="privacy-card-body">
                    <h3 className="privacy-card-title">{item.title}</h3>
                    <p className="privacy-card-text">{item.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ================= FORMAL PRIVACY POLICY DETAILS ================= */}
      <section className="feature-section bg-[#FAF9F5] border-t border-[#D6E0E8]">
        <div className="container-landing max-w-4xl mx-auto">
          <div className="rounded-3xl border border-[#D6E0E8] bg-white p-8 md:p-12 shadow-sm space-y-8 text-sm md:text-base text-[#5A7184] leading-relaxed">
            <h2 className="text-2xl font-bold text-[#102840] mb-6 border-b border-[#D6E0E8] pb-4">
              MurihSpace Privacy Statement &amp; Commitments
            </h2>
            <section>
              <h3 className="text-lg font-bold text-[#102840] mb-2">1. Data Ownership &amp; Encryption</h3>
              <p>
                MurihSpace is designed to minimize personal data collection. Direct peer-to-peer messages, calls, media, and voice notes are end-to-end encrypted using the Signal protocol. Neither MurihSpace nor third parties can decrypt or intercept your encrypted transmissions.
              </p>
            </section>

            <section>
              <h3 className="text-lg font-bold text-[#102840] mb-2">2. Identity Verification &amp; Compliance</h3>
              <p>
                To maintain a trusted marketplace and enable creator payouts, vendors and creators may undergo Know-Your-Customer (KYC) identity verification. Verification documents are processed securely in accordance with international financial standards and are never sold or shared for marketing purposes.
              </p>
            </section>

            <section>
              <h3 className="text-lg font-bold text-[#102840] mb-2">3. Zero Behavioral Advertising Tracking</h3>
              <p>
                We do not sell your personal data or track your conversations to serve targeted advertisements. MurihSpace is funded through verified subscription features, creator monetization tools, and payment processing rather than user surveillance.
              </p>
            </section>

            <section>
              <h3 className="text-lg font-bold text-[#102840] mb-2">4. Data Deletion and Account Portability</h3>
              <p>
                You retain full control over your data. At any time, you may export your community data, delete individual chat histories, or request permanent deletion of your MurihSpace account directly from your settings.
              </p>
            </section>
          </div>
        </div>
      </section>

      {/* ================= CTA BANNER ================= */}
      <section className="cta-banner">
        <div className="container-landing">
          <div className="cta-content">
            <h2 className="cta-title">Your privacy is not negotiable</h2>
            <p className="cta-subtitle">
              Join millions communicating and trading with end-to-end encryption and full identity trust on MurihSpace.
            </p>
            <div className="cta-buttons">
              <Link to="/download" className="btn-wa-primary">
                <span>Download the app</span>
                <ArrowRight className="size-4 ml-1 inline" />
              </Link>
              <Link to="/features" className="btn-wa-outline" style={{ color: "#FFFFFF", borderColor: "#FFFFFF" }}>
                Explore All Features
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
