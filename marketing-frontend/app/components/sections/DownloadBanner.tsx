import { getWebClientUrl } from "~/lib/env";

// Store links are deployment config. Only show a badge when its real URL is
// set, mirroring the /download route instead of linking to a store homepage.
const APP_STORE_URL = import.meta.env.VITE_APP_STORE_URL as string | undefined;
const PLAY_STORE_URL = import.meta.env.VITE_PLAY_STORE_URL as string | undefined;

export function DownloadBanner() {
  return (
    <section className="cta-banner" id="download">
      <div className="container-landing">
        <div className="cta-banner-content">
          <h2 className="cta-banner-title">Download MurihSpace</h2>
          <p className="cta-banner-text">
            Create your account in the mobile app, then sign in on web, tablet, or desktop.
          </p>
          <div className="device-badges-row">
            {APP_STORE_URL && (
              <a href={APP_STORE_URL} className="device-badge-btn" target="_blank" rel="noopener noreferrer">
                <img src="/icons/apple-logo.svg" alt="Apple" width="18" height="18" />
                <span>iPhone</span>
              </a>
            )}
            {PLAY_STORE_URL && (
              <a href={PLAY_STORE_URL} className="device-badge-btn" target="_blank" rel="noopener noreferrer">
                <img src="/icons/playstore-logo.svg" alt="Android" width="18" height="18" />
                <span>Android</span>
              </a>
            )}
            <a
              href={getWebClientUrl()}
              className="device-badge-btn device-badge-btn-primary"
              target="_blank"
              rel="noopener noreferrer"
            >
              <span className="device-badge-btn-icon">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M1.33334 3.33334L6.66667 4.23334V7.66667H1.33334V3.33334Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
                  <path d="M8 4.33334L14.6667 2.66667V7.66667H8V4.33334Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
                  <path d="M1.33334 8.33334H6.66667V11.7667L1.33334 12.6667V8.33334Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
                  <path d="M8 8.33334H14.6667V13.3333L8 11.6667V8.33334Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
                </svg>
              </span>
              <span>Web</span>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

