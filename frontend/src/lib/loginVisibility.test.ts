import { describe, it, expect } from "vitest";
import {
  anyLoginMethodEnabled,
  defaultLoginTab,
  loginVisibility,
  resolveLoginTab,
  showLoginTabSwitcher,
  type LoginVisibility,
} from "@/lib/loginVisibility";

const allOn = { phone_otp: { login: true }, email_password: { login: true }, google: { login: true }, apple: { login: true } };
const emailOff = { phone_otp: { login: true }, email_password: { login: false }, google: { login: false }, apple: { login: false } };
const phoneOff = { phone_otp: { login: false }, email_password: { login: true }, google: { login: false }, apple: { login: false } };
const allOff = { phone_otp: { login: false }, email_password: { login: false }, google: { login: false }, apple: { login: false } };

describe("loginVisibility", () => {
  it("treats a missing method as disabled", () => {
    const v = loginVisibility({ email_password: { login: true } });
    expect(v.phoneEnabled).toBe(false);
    expect(v.emailEnabled).toBe(true);
    expect(v.socialEnabled).toEqual([]);
  });

  it("keeps an explicit false disabled", () => {
    const v = loginVisibility({ ...allOn, email_password: { login: false } });
    expect(v.emailEnabled).toBe(false);
  });
});

describe("email_password disabled (members must not see it)", () => {
  it("reports email as disabled", () => {
    const v = loginVisibility(emailOff);
    expect(v.emailEnabled).toBe(false);
  });

  it("redirects a user sitting on the email tab to phone", () => {
    const v = loginVisibility(emailOff);
    expect(resolveLoginTab(v, "email")).toBe("phone");
  });

  it("leaves the phone tab alone (no redirect loop)", () => {
    expect(resolveLoginTab(loginVisibility(emailOff), "phone")).toBe("phone");
  });

  it("hides the tab switcher", () => {
    expect(showLoginTabSwitcher(loginVisibility(emailOff))).toBe(false);
  });

  it("still counts as an available method via phone", () => {
    expect(anyLoginMethodEnabled(loginVisibility(emailOff))).toBe(true);
  });
});

describe("phone_otp disabled", () => {
  it("redirects a user on the phone tab to email", () => {
    expect(resolveLoginTab(loginVisibility(phoneOff), "phone")).toBe("email");
  });

  it("email alone still counts as available", () => {
    const v = loginVisibility(phoneOff);
    expect(anyLoginMethodEnabled(v)).toBe(true);
    expect(v.emailEnabled).toBe(true);
  });
});

describe("everything disabled", () => {
  it("reports no available method so the UI can show a notice", () => {
    const v = loginVisibility(allOff);
    expect(anyLoginMethodEnabled(v)).toBe(false);
    expect(showLoginTabSwitcher(v)).toBe(false);
  });

  it("does not flip tabs back and forth", () => {
    const v = loginVisibility(allOff);
    expect(resolveLoginTab(v, "phone")).toBe("phone");
    expect(resolveLoginTab(v, "email")).toBe("email");
  });
});

describe("social-only login", () => {
  const socialOnly = { phone_otp: { login: false }, email_password: { login: false }, google: { login: true }, apple: { login: false } };

  it("is still considered open", () => {
    expect(anyLoginMethodEnabled(loginVisibility(socialOnly))).toBe(true);
  });

  it("keeps the social button", () => {
    expect(loginVisibility(socialOnly).socialEnabled).toEqual(["google"]);
  });

  it("does not resurrect a disabled email form", () => {
    const v: LoginVisibility = loginVisibility(socialOnly);
    expect(v.emailEnabled).toBe(false);
    expect(showLoginTabSwitcher(v)).toBe(false);
  });
});

describe("defaultLoginTab", () => {
  it("prefers phone when both are enabled", () => {
    expect(defaultLoginTab(loginVisibility(allOn))).toBe("phone");
  });

  it("falls back to email when phone is off", () => {
    expect(defaultLoginTab(loginVisibility(phoneOff))).toBe("email");
  });
});
