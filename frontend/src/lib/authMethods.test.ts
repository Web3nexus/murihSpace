import { describe, expect, it } from "vitest";
import {
  enabledLoginMethods,
  enabledRegistrationMethods,
  isLoginOpen,
  isRegistrationOpen,
} from "./authMethods";
import type { AuthMethodsPublic } from "@/hooks/usePlatformConfig";

type Methods = AuthMethodsPublic["methods"];

function methods(overrides: Partial<Record<keyof Methods, { login: boolean; registration: boolean }>> = {}): Methods {
  const base: Methods = {
    phone_otp: { login: true, registration: true },
    email_password: { login: true, registration: true },
    google: { login: false, registration: false },
    apple: { login: false, registration: false },
    passkey: { login: false, registration: false },
  };
  for (const [key, value] of Object.entries(overrides)) {
    base[key as keyof Methods] = { ...base[key as keyof Methods], ...value };
  }
  return base;
}

describe("auth method gating", () => {
  it("hides a login method the admin disabled", () => {
    const m = methods({ email_password: { login: false, registration: true } });
    expect(enabledLoginMethods(m)).toEqual(["phone_otp"]);
    expect(m.email_password.login).toBe(false);
  });

  it("keeps login open while one method remains", () => {
    expect(isLoginOpen(methods({ email_password: { login: false, registration: true } }))).toBe(true);
  });

  it("reports login closed only when every method is off", () => {
    const m = methods({
      phone_otp: { login: false, registration: false },
      email_password: { login: false, registration: false },
      google: { login: false, registration: false },
      apple: { login: false, registration: false },
      passkey: { login: false, registration: false },
    });
    expect(isLoginOpen(m)).toBe(false);
  });

  it("treats registration as closed when no registration method is enabled", () => {
    const m = methods({
      phone_otp: { login: true, registration: false },
      google: { login: false, registration: false },
      apple: { login: false, registration: false },
    });
    expect(enabledRegistrationMethods(m)).toEqual([]);
    expect(isRegistrationOpen(m)).toBe(false);
  });

  it("keeps registration open via a social provider when phone OTP is off", () => {
    const m = methods({
      phone_otp: { login: true, registration: false },
      google: { login: false, registration: true },
    });
    expect(enabledRegistrationMethods(m)).toEqual(["google"]);
    expect(isRegistrationOpen(m)).toBe(true);
  });

  it("does not count email/password as a registration method on its own", () => {
    const m = methods({ phone_otp: { login: true, registration: false } });
    expect(enabledRegistrationMethods(m)).not.toContain("email_password");
  });

  it("survives a malformed methods object without throwing", () => {
    const sparse = {} as Methods;
    expect(enabledLoginMethods(sparse)).toEqual([]);
    expect(isLoginOpen(sparse)).toBe(false);
  });
});
