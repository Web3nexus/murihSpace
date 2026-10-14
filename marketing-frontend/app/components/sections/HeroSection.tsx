import { useState } from "react";
import { ExternalLink, Play, Pause, Lock, ArrowRight } from "lucide-react";
import { useCmsSingle } from "../../hooks/useCms";
import { getRegisterUrl, getWebClientUrl } from "~/lib/env";

export interface CmsHomepage {
  headline?: string;
  headline_accent?: string;
  subcopy?: string;
  hero_image_url?: string;
  notice?: string;
}

const defaultHero: CmsHomepage = {
  headline: "Better connection",
  headline_accent: "with safety.",
  subcopy:
    "Connect with communities, sell digital & physical products, host live audio rooms, and grow your audience.",
  hero_image_url: "/images/hero-woman.webp",
  notice:
    "* Data charges may apply. Contact your provider for details. End-to-end encrypted by default.",
};

export function HeroSection() {
  const { data: cmsHero } = useCmsSingle<CmsHomepage>("homepage", defaultHero);
  const hero = cmsHero ?? defaultHero;
  const [isPlaying, setIsPlaying] = useState(false);

  return (
    <section className="hero-section">
      <div className="container-landing-wide">
        <div className="hero-grid">
          {/* Left Content */}
          <div className="hero-content">
            <h1 className="title-hero">
              {hero.headline ?? defaultHero.headline}{" "}
              <span className="text-[#38A8D8]">
                {hero.headline_accent ?? defaultHero.headline_accent}
              </span>
            </h1>
            <p className="subtitle-hero">
              {hero.subcopy ?? defaultHero.subcopy}
            </p>
            <div className="hero-actions">
              <a
                href={getRegisterUrl()}
                className="btn-wa-primary"
                id="hero-download-btn"
              >
                <span>Sign In</span>
                <ArrowRight className="size-4" />
              </a>
              <a
                href={getWebClientUrl()}
                className="btn-wa-outline"
                id="hero-web-btn"
              >
                <span>Open MurihSpace Web</span>
                <ExternalLink className="size-4" />
              </a>
            </div>
            <p className="hero-notice">
              {hero.notice ?? defaultHero.notice}
            </p>
          </div>

          {/* Right Visual with Floating Chat Badges */}
          <div className="hero-visual-wrapper">
            <div className="hero-photo-frame">
              <img
                src={hero.hero_image_url ?? defaultHero.hero_image_url}
                alt="MurihSpace creator engaging with members"
              />
            </div>

            {/* Floating Badge 1: Question / Study */}
            <div className="floating-badge badge-top-left">
              <div className="chat-bubble-content">
                <span className="chat-bubble-text">
                  Still on for studying later today? 📚
                </span>
                <div className="chat-bubble-meta">
                  <span>10:42 AM</span>
                  <img
                    src="/icons/check-double.svg"
                    alt="Read"
                    className="w-3.5 h-3.5"
                  />
                </div>
              </div>
              <div className="reaction-pill">👍 ❤️</div>
            </div>

            {/* Floating Badge 2: Voice Note */}
            <div className="floating-badge badge-mid-right audio-bubble">
              <button
                type="button"
                className="play-button"
                aria-label={isPlaying ? "Pause voice message" : "Play voice message"}
                onClick={() => setIsPlaying(!isPlaying)}
              >
                {isPlaying ? (
                  <Pause className="size-3.5 fill-current" />
                ) : (
                  <Play className="size-3.5 fill-current ml-0.5" />
                )}
              </button>
              <div className="waveform">
                <span />
                <span />
                <span />
                <span />
                <span />
                <span />
                <span />
                <span />
              </div>
              <span className="text-xs font-semibold text-[#102840]">0:24</span>
              <div className="reaction-pill">🎉</div>
            </div>

            {/* Floating Badge 3: E2E Encryption Pill */}
            <div className="floating-badge badge-bottom-right">
              <Lock className="size-4 text-[#38A8D8]" />
              <span className="text-xs font-bold tracking-wide">
                End-to-end encrypted
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
