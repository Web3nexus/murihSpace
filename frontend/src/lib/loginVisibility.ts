/**
 * Pure visibility rules for the web login screen.
 *
 * Mirrors the mobile `LoginMethodVisibility` helper so both clients agree on
 * what a disabled method looks like. The backend rejects a disabled method
 * regardless of what the client renders, so these predicates exist to keep the
 * UI honest rather than to enforce access control.
 */

export type LoginVisibility = {
  phoneEnabled: boolean;
  emailEnabled: boolean;
  /** Social providers the platform reports as enabled. */
  socialEnabled: string[];
};

export function loginVisibility(
  methods: Record<string, { login?: boolean }>,
  socialKeys: string[] = ["google", "apple"],
): LoginVisibility {
  return {
    phoneEnabled: Boolean(methods.phone_otp?.login),
    emailEnabled: Boolean(methods.email_password?.login),
    socialEnabled: socialKeys.filter((key) => Boolean(methods[key]?.login)),
  };
}

export type LoginTab = "phone" | "email";

/** True when at least one sign-in method is usable. */
export function anyLoginMethodEnabled(v: LoginVisibility): boolean {
  return v.phoneEnabled || v.emailEnabled || v.socialEnabled.length > 0;
}

/** The phone/email tab switcher is pointless with a single method. */
export function showLoginTabSwitcher(v: LoginVisibility): boolean {
  return v.phoneEnabled && v.emailEnabled;
}

/**
 * Resolves the tab to render, redirecting off a method that is disabled.
 *
 * Falls back to the first enabled method so a disabled tab can never be
 * displayed. When nothing is enabled the current tab is returned unchanged and
 * `anyLoginMethodEnabled` reports false.
 */
export function resolveLoginTab(v: LoginVisibility, current: LoginTab): LoginTab {
  if (current === "phone" && !v.phoneEnabled) return v.emailEnabled ? "email" : "phone";
  if (current === "email" && !v.emailEnabled) return v.phoneEnabled ? "phone" : "email";
  return current;
}

/** The initial tab to select once the platform config has loaded. */
export function defaultLoginTab(v: LoginVisibility): LoginTab {
  return v.phoneEnabled ? "phone" : "email";
}
