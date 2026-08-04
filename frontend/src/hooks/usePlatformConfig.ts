import { useCallback, useEffect, useState } from "react";
import { apiClient } from "@/lib/api/client";

export interface AuthMethodFlags {
  login: boolean;
  registration: boolean;
}

export interface AuthMethodsPublic {
  primary: string;
  methods: Record<
    "phone_otp" | "email_password" | "google" | "apple" | "passkey",
    AuthMethodFlags
  >;
}

export interface PlatformConfig {
  platform_name: string;
  web_disabled_roles: Array<"member" | "creator" | "vendor">;
  app_download_url: string;
  app_qr_content: string;
  auth_methods: AuthMethodsPublic;
  loading: boolean;
}

const DEFAULT_METHODS: AuthMethodsPublic = {
  primary: "phone_otp",
  methods: {
    phone_otp: { login: true, registration: true },
    email_password: { login: true, registration: true },
    google: { login: false, registration: false },
    apple: { login: false, registration: false },
    passkey: { login: false, registration: false },
  },
};

const EMPTY: Omit<PlatformConfig, "loading"> = {
  platform_name: "MurihSpace",
  web_disabled_roles: [],
  app_download_url: "https://apps.apple.com/app/murihspace",
  app_qr_content: "https://apps.apple.com/app/murihspace",
  auth_methods: DEFAULT_METHODS,
};

function normalizeMethods(value: unknown): AuthMethodsPublic {
  // Clone DEFAULT_METHODS to avoid mutating the shared object
  const methods: AuthMethodsPublic["methods"] = {
    phone_otp: { ...DEFAULT_METHODS.methods.phone_otp },
    email_password: { ...DEFAULT_METHODS.methods.email_password },
    google: { ...DEFAULT_METHODS.methods.google },
    apple: { ...DEFAULT_METHODS.methods.apple },
    passkey: { ...DEFAULT_METHODS.methods.passkey },
  };
  if (!value || typeof value !== "object") return { primary: DEFAULT_METHODS.primary, methods };
  const v = value as Partial<AuthMethodsPublic>;
  const incoming = v.methods && typeof v.methods === "object" ? (v.methods as Record<string, AuthMethodFlags>) : {};
  (Object.keys(methods) as Array<keyof typeof methods>).forEach((key) => {
    const m = incoming[key];
    if (m && typeof m === "object") {
      methods[key] = {
        login: Boolean(m.login),
        registration: Boolean(m.registration),
      };
    }
  });
  const primary = v.primary && Object.prototype.hasOwnProperty.call(methods, v.primary) ? v.primary : DEFAULT_METHODS.primary;
  return { primary, methods };
}

export function usePlatformConfig(): PlatformConfig {
  const [cfg, setCfg] = useState<Omit<PlatformConfig, "loading">>(EMPTY);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get("/platform");
      const j = res.data;
      const d = j?.success ? (j?.data?.data ?? j?.data) : j;
      if (d) {
        setCfg({
          platform_name: d.platform_name || EMPTY.platform_name,
          web_disabled_roles: Array.isArray(d.web_disabled_roles) ? d.web_disabled_roles : [],
          app_download_url: d.app_download_url || EMPTY.app_download_url,
          app_qr_content: d.app_qr_content || d.app_download_url || EMPTY.app_qr_content,
          auth_methods: normalizeMethods(d.auth_methods),
        });
      }
    } catch {
      // keep defaults on network failure
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { ...cfg, loading };
}
