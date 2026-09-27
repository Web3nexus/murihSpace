import type { AuthMethodsPublic } from "@/hooks/usePlatformConfig";

export type MethodKey = keyof AuthMethodsPublic["methods"];

const LOGIN_METHODS: MethodKey[] = ["phone_otp", "email_password", "google", "apple", "passkey"];
const REGISTRATION_METHODS: MethodKey[] = ["phone_otp", "google", "apple"];

function enabled(methods: AuthMethodsPublic["methods"], keys: MethodKey[], field: "login" | "registration"): MethodKey[] {
  return keys.filter((key) => Boolean(methods[key]?.[field]));
}

export function enabledLoginMethods(methods: AuthMethodsPublic["methods"]): MethodKey[] {
  return enabled(methods, LOGIN_METHODS, "login");
}

export function enabledRegistrationMethods(methods: AuthMethodsPublic["methods"]): MethodKey[] {
  return enabled(methods, REGISTRATION_METHODS, "registration");
}

export function isLoginOpen(methods: AuthMethodsPublic["methods"]): boolean {
  return enabledLoginMethods(methods).length > 0;
}

/**
 * The backend only guards that at least one *login* method stays on, so
 * registration can legitimately be switched off entirely. When it is, the
 * signup flow must not be offered at all.
 */
export function isRegistrationOpen(methods: AuthMethodsPublic["methods"]): boolean {
  return enabledRegistrationMethods(methods).length > 0;
}
