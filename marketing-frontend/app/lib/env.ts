/**
 * Application environment configuration
 * Reads the web-client URL from VITE_WEB_CLIENT_URL or VITE_APP_URL (.env).
 *
 * VITE_MAIN_SITE_URL is intentionally NOT a fallback: it is the marketing site
 * URL, and using it here would point sign-in/app links at the marketing domain
 * instead of the web app.
 */

export function getAppUrl(): string {
  // Check Vite client-side env first
  if (typeof import.meta !== "undefined" && import.meta.env) {
    const envVal =
      import.meta.env.VITE_WEB_CLIENT_URL ||
      import.meta.env.VITE_APP_URL;
    if (envVal) {
      return String(envVal).replace(/\/+$/, "");
    }
  }

  // Check Node/SSR process.env
  if (typeof process !== "undefined" && process.env) {
    const envVal =
      process.env.VITE_WEB_CLIENT_URL ||
      process.env.VITE_APP_URL;
    if (envVal) {
      return String(envVal).replace(/\/+$/, "");
    }
  }

  return "https://web.murihspace.com";
}

export function getLoginUrl(): string {
  return `${getAppUrl()}/login`;
}

// Account creation happens in the MurihSpace mobile app only. Web CTAs that
// formerly pointed at the /register page now route to sign-in.
export function getRegisterUrl(): string {
  return `${getAppUrl()}/login`;
}

export function getWebClientUrl(): string {
  return getAppUrl();
}
