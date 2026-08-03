import { useState, useEffect, useCallback, useRef } from "react";
import {
  ShieldCheck,
  Upload,
  Check,
  X,
  AlertCircle,
  Loader2,
  FileText,
  IdCard,
  CreditCard,
  Building2,
  RefreshCw,
  BadgeCheck,
  Coins,
} from "lucide-react";
import { apiClient } from "@/lib/api/client";

type KycStatus = "unsubmitted" | "pending" | "verified" | "rejected" | "expired";

interface KycState {
  kyc_status: KycStatus;
  kyc_provider: string;
  sumsub_applicant_id?: string | null;
  kyc_rejection_reason?: string | null;
  sumsub_enabled: boolean;
  provider_enabled: boolean;
  verification_id?: number | null;
  required_for_sellers?: boolean;
}

interface BadgeState {
  status: string;
  expires_at: string | null;
  purchased_at: string | null;
  auto_renew: boolean;
  kyc_verified: boolean;
  monthly_fee: number;
  wallet_balance: number;
}

const DOCUMENT_TYPES = [
  { value: "passport", label: "Passport", icon: IdCard },
  { value: "drivers_license", label: "Driver's License", icon: CreditCard },
  { value: "national_id", label: "National ID", icon: Building2 },
];

const SUMSUB_SDK_URL = "https://static.sumsub.com/idensic/static/sns-websdk-builder.js";

declare global {
  interface Window {
    snsWebSdk?: {
      init: (
        accessToken: string,
        expirationHandler?: () => Promise<string>
      ) => SumsubSdkBuilder;
    };
  }
}

interface SumsubSdkBuilder {
  withConf: (conf: Record<string, unknown>) => SumsubSdkBuilder;
  withOptions: (options: Record<string, unknown>) => SumsubSdkBuilder;
  on: (event: string, handler: (payload: unknown) => void) => SumsubSdkBuilder;
  build: () => { launch: (containerId: string) => void };
}

function StatusBanner({ status, reason }: { status: KycStatus; reason?: string | null }) {
  const config: Record<KycStatus, { icon: typeof ShieldCheck; bg: string; text: string; border: string; label: string; msg: string }> = {
    verified: { icon: Check, bg: "bg-emerald-500/10", text: "text-emerald-600", border: "border-emerald-500/20", label: "Verified", msg: "Your identity has been verified. All features are unlocked." },
    pending: { icon: Loader2, bg: "bg-amber-500/10", text: "text-amber-600", border: "border-amber-500/20", label: "In Review", msg: "Your verification is being processed by our provider. This usually takes a few minutes." },
    rejected: { icon: X, bg: "bg-red-500/10", text: "text-red-600", border: "border-red-500/20", label: "Rejected", msg: reason || "Your submission was not approved. Please re-verify with valid documents." },
    expired: { icon: AlertCircle, bg: "bg-orange-500/10", text: "text-orange-600", border: "border-orange-500/20", label: "Expired", msg: "Your verification session expired. Please start a new one." },
    unsubmitted: { icon: AlertCircle, bg: "bg-muted", text: "text-muted-foreground", border: "border-border", label: "Not Verified", msg: "Complete identity verification to unlock payouts, escrow, and full platform access." },
  };
  const c = config[status];
  const Icon = c.icon;
  return (
    <div className={`flex items-start gap-3 p-4 rounded-xl border ${c.bg} ${c.border}`}>
      <Icon className={`h-5 w-5 shrink-0 mt-0.5 ${status === "pending" ? "animate-spin" : ""} ${c.text}`} />
      <div>
        <p className={`text-xs font-bold ${c.text}`}>{c.label}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">{c.msg}</p>
      </div>
    </div>
  );
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    if (existing) {
      if (existing.dataset.loaded === "true") return resolve();
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Failed to load verification SDK.")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => { script.dataset.loaded = "true"; resolve(); };
    script.onerror = () => reject(new Error("Failed to load verification SDK."));
    document.body.appendChild(script);
  });
}

export default function KycSettingsPage() {
  const [state, setState] = useState<KycState | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [sdkToken, setSdkToken] = useState<string | null>(null);
  const [sdkError, setSdkError] = useState<string | null>(null);
  const [documentType, setDocumentType] = useState("passport");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [badge, setBadge] = useState<BadgeState | null>(null);
  const [badgeLoading, setBadgeLoading] = useState(false);
  const [badgeBusy, setBadgeBusy] = useState<string | null>(null);
  const [badgeMsg, setBadgeMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get("/kyc/status");
      const data = res.data?.data ?? res.data;
      setState(data ?? { kyc_status: "unsubmitted", kyc_provider: "manual", sumsub_enabled: false, provider_enabled: false });
    } catch {
      setState({ kyc_status: "unsubmitted", kyc_provider: "manual", sumsub_enabled: false, provider_enabled: false });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  // Poll while verification is in review (hosted session providers resolve via webhook).
  useEffect(() => {
    if (state?.kyc_status !== "pending") return;
    const timer = window.setInterval(() => { fetchStatus(); }, 8000);
    return () => window.clearInterval(timer);
  }, [state?.kyc_status, fetchStatus]);

  const fetchBadge = useCallback(async () => {
    setBadgeLoading(true);
    try {
      const res = await apiClient.get("/verification-badge/status");
      const data = res.data?.data?.data ?? res.data?.data ?? res.data;
      if (data && typeof data === "object") {
        const raw = data as Partial<BadgeState>;
        setBadge({
          status: raw.status ?? "none",
          expires_at: raw.expires_at ?? null,
          purchased_at: raw.purchased_at ?? null,
          auto_renew: raw.auto_renew ?? false,
          kyc_verified: raw.kyc_verified ?? true,
          monthly_fee: Number(raw.monthly_fee ?? 0),
          wallet_balance: Number(raw.wallet_balance ?? 0),
        });
      }
    } catch {
      setBadge(null);
    } finally {
      setBadgeLoading(false);
    }
  }, []);

  useEffect(() => {
    if (state?.kyc_status === "verified") fetchBadge();
  }, [state?.kyc_status, fetchBadge]);

  const badgeAction = async (path: string, busyKey: string) => {
    setBadgeBusy(busyKey);
    setBadgeMsg(null);
    try {
      const res = await apiClient.post(path);
      const data = res.data?.data?.data ?? res.data?.data ?? res.data;
      setBadgeMsg({ ok: true, text: res.data?.message ?? "Done." });
      if (data && typeof data === "object") {
        setBadge((prev) => ({ ...(prev ?? { status: "none", expires_at: null, purchased_at: null, auto_renew: false, kyc_verified: true, monthly_fee: 100, wallet_balance: 0 }), ...(data as Partial<BadgeState>) }));
      }
      fetchBadge();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setBadgeMsg({ ok: false, text: err.response?.data?.message ?? "Something went wrong. Please try again." });
    } finally {
      setBadgeBusy(null);
    }
  };

  const launchSumsub = useCallback(async () => {
    setSdkError(null);
    setStarting(true);
    try {
      const res = await apiClient.post("/kyc/start");
      const data = res.data?.data ?? res.data;

      // Hosted-session providers (e.g. Didit) return a session_url we open.
      if (data?.session_url) {
        window.location.assign(data.session_url as string);
        return;
      }

      if (!data?.access_token) {
        setSdkError(data?.message || "Verification is unavailable right now.");
        setStarting(false);
        return;
      }
      setState((prev) => ({ ...(prev ?? { kyc_status: "unsubmitted", kyc_provider: "manual", sumsub_enabled: true, provider_enabled: true }), sumsub_enabled: true }));
      setSdkToken(data.access_token);
    } catch {
      setSdkError("Could not start verification. Please try again.");
    } finally {
      setStarting(false);
    }
  }, []);

  useEffect(() => {
    if (!sdkToken || !containerRef.current) return;

    let disposed = false;
    loadScript(SUMSUB_SDK_URL)
      .then(() => {
        if (disposed || !window.snsWebSdk || !containerRef.current) return;

        const refreshToken = () => apiClient.post("/kyc/start").then((r) => {
          const d = r.data?.data ?? r.data;
          if (!d?.access_token) throw new Error("Token refresh failed");
          return d.access_token as string;
        });

        window.snsWebSdk
          .init(sdkToken, () => refreshToken())
          .withConf({ lang: "en" })
          .withOptions({ addViewportTag: false, adaptIframeHeight: true })
          .on("idCheck.onStepCompleted", (payload) => {
            console.log("Sumsub step completed", payload);
          })
          .on("idCheck.onError", (error) => {
            console.error("Sumsub SDK error", error);
          })
          .build()
          .launch("#sumsub-websdk-container");
      })
      .catch((e) => {
        if (!disposed) setSdkError(e instanceof Error ? e.message : "Could not load verification SDK.");
      });

    return () => { disposed = true; };
  }, [sdkToken]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setUploadMsg({ ok: false, text: "Please select a document file to upload." });
      return;
    }
    setUploading(true);
    setUploadMsg(null);
    const formData = new FormData();
    formData.append("document_type", documentType);
    formData.append("document", file);
    try {
      const res = await apiClient.post("/kyc/submit", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      void res;
      setState((prev) => ({ ...(prev ?? { kyc_status: "unsubmitted", kyc_provider: "manual", sumsub_enabled: false, provider_enabled: false }), kyc_status: "pending" }));
      setUploadMsg({ ok: true, text: "Verification submitted successfully! We'll review it shortly." });
      setFile(null);
    } catch {
      setUploadMsg({ ok: false, text: "Upload failed. Please try again or contact support." });
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="h-8 w-8 animate-spin text-secondary" />
      </div>
    );
  }

  const status = state?.kyc_status ?? "unsubmitted";
  const providerEnabled = state?.provider_enabled ?? state?.sumsub_enabled ?? false;

  return (
    <div className="space-y-6 w-full max-w-3xl mx-auto">
      <div>
        <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-secondary" />
          Identity Verification (KYC)
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Verify your identity to unlock payouts, escrow, and full platform access.
        </p>
      </div>

      <StatusBanner status={status} reason={state?.kyc_rejection_reason} />

      {/* Verified badge (available once KYC is verified) */}
      {status === "verified" && (
        <section className="rounded-2xl border border-border bg-card p-5 shadow-2xs space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
                <BadgeCheck className="h-5 w-5 text-sky-500" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  Verified Badge
                  {badge?.status === "active" && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-600 text-[10px] font-bold">
                      <BadgeCheck className="h-3 w-3" /> Active
                    </span>
                  )}
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  Get a blue checkmark next to your name across Murihspace.
                </p>
              </div>
            </div>
          </div>

          {badgeLoading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Checking badge status…
            </div>
          ) : badge ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-muted/40 border border-border">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Monthly Fee</p>
                  <p className="text-sm font-bold text-foreground mt-0.5 flex items-center gap-1">
                    <Coins className="h-4 w-4 text-secondary" /> {badge.monthly_fee} tokens
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-muted/40 border border-border">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Wallet Balance</p>
                  <p className="text-sm font-bold text-foreground mt-0.5 flex items-center gap-1">
                    <Coins className="h-4 w-4 text-secondary" /> {badge.wallet_balance.toLocaleString()} tokens
                  </p>
                </div>
              </div>

              {badge.expires_at && badge.status === "active" && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <BadgeCheck className="h-4 w-4 text-sky-500" />
                  Expires {new Date(badge.expires_at).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}
                  {badge.auto_renew ? (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 text-[10px] font-bold">Auto-renew on</span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 text-[10px] font-bold">Auto-renew off</span>
                  )}
                </div>
              )}

              {badgeMsg && (
                <div className={`flex items-start gap-2 p-3 rounded-xl text-xs ${
                  badgeMsg.ok ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-600"
                }`}>
                  {badgeMsg.ok ? <Check className="h-4 w-4 shrink-0 mt-0.5" /> : <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />}
                  {badgeMsg.text}
                </div>
              )}

              <div className="flex flex-wrap gap-3">
                {(badge.status !== "active") && (
                  <button
                    onClick={() => badgeAction("/verification-badge/activate", "activate")}
                    disabled={badgeBusy !== null}
                    className="px-5 py-2.5 rounded-xl bg-secondary text-secondary-foreground text-xs font-bold hover:bg-secondary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-xs flex items-center gap-2"
                  >
                    {badgeBusy === "activate" ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Activating…</>
                    ) : (
                      <><BadgeCheck className="h-4 w-4" /> Activate Badge ({badge.monthly_fee}/mo)</>
                    )}
                  </button>
                )}
                {badge.status === "active" && (
                  <button
                    onClick={() => badgeAction("/verification-badge/renew", "renew")}
                    disabled={badgeBusy !== null}
                    className="px-5 py-2.5 rounded-xl bg-secondary text-secondary-foreground text-xs font-bold hover:bg-secondary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-xs flex items-center gap-2"
                  >
                    {badgeBusy === "renew" ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Renewing…</>
                    ) : (
                      <><RefreshCw className="h-4 w-4" /> Renew for {badge.monthly_fee} tokens</>
                    )}
                  </button>
                )}
                {badge.status === "active" && badge.auto_renew && (
                  <button
                    onClick={() => badgeAction("/verification-badge/cancel-auto-renew", "cancel")}
                    disabled={badgeBusy !== null}
                    className="px-5 py-2.5 rounded-xl border border-border text-muted-foreground text-xs font-bold hover:text-foreground hover:border-muted-foreground/40 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {badgeBusy === "cancel" ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Turning off…</>
                    ) : (
                      "Turn off auto-renew"
                    )}
                  </button>
                )}
              </div>
            </div>
          ) : null}
        </section>
      )}

      {/* Provider-powered verification (Didit hosted session / Sumsub SDK) */}
      {providerEnabled ? (
        status === "unsubmitted" || status === "rejected" || sdkToken ? (
          <div className="rounded-2xl border border-border bg-card p-6 shadow-2xs space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-[#00C0FF]/10 border border-[#00C0FF]/20 flex items-center justify-center">
                <ShieldCheck className="h-5 w-5 text-[#00C0FF]" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">
                  {state?.kyc_provider === "didit" ? "Verify with Didit" : "Verify with Sumsub"}
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  Secure identity checks — passport, ID, or driver's license, plus a quick selfie.
                </p>
              </div>
            </div>

            {!sdkToken && !sdkError && (
              <button
                onClick={launchSumsub}
                disabled={starting}
                className="w-full px-6 py-3 rounded-xl bg-secondary text-secondary-foreground text-xs font-bold hover:bg-secondary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-xs flex items-center justify-center gap-2"
              >
                {starting ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Starting verification…</>
                ) : (
                  <><ShieldCheck className="h-4 w-4" /> Start verification</>
                )}
              </button>
            )}

            {sdkError && (
              <div className="flex flex-col gap-3">
                <div className="flex items-start gap-2 p-3 rounded-xl text-xs bg-red-500/10 text-red-600">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  {sdkError}
                </div>
                <button onClick={() => setSdkError(null)} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 justify-center">
                  <RefreshCw className="h-3.5 w-3.5" /> Try again
                </button>
              </div>
            )}

            <div
              ref={containerRef}
              id="sumsub-websdk-container"
              className={sdkToken ? "rounded-xl overflow-hidden min-h-[420px]" : "hidden"}
            />
          </div>
        ) : null
      ) : (
        /* Fallback: manual document upload (provider not configured) */
        <div className="rounded-2xl border border-border bg-card p-5 shadow-2xs space-y-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-amber-500" />
            <p className="text-xs font-bold text-foreground">Manual verification</p>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Automated verification is temporarily unavailable. Please upload a document for manual review.
          </p>
        </div>
      )}

      {(status === "unsubmitted" || status === "rejected") && !providerEnabled && (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Document Type */}
          <section className="rounded-2xl border border-border bg-card p-5 shadow-2xs space-y-4">
            <h3 className="font-bold text-foreground text-xs flex items-center gap-2">
              <FileText className="h-3.5 w-3.5 text-secondary" /> Document Type
            </h3>
            <div className="grid grid-cols-3 gap-3">
              {DOCUMENT_TYPES.map((dt) => {
                const active = documentType === dt.value;
                const Icon = dt.icon;
                return (
                  <button
                    key={dt.value}
                    type="button"
                    onClick={() => setDocumentType(dt.value)}
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all ${
                      active ? "border-secondary bg-secondary/5" : "border-border bg-muted/30 hover:border-muted-foreground/30"
                    }`}
                  >
                    <Icon className={`h-6 w-6 ${active ? "text-secondary" : "text-muted-foreground"}`} />
                    <span className="text-[11px] font-bold text-foreground text-center leading-tight">{dt.label}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* File Upload */}
          <section className="rounded-2xl border border-border bg-card p-5 shadow-2xs space-y-4">
            <h3 className="font-bold text-foreground text-xs flex items-center gap-2">
              <Upload className="h-3.5 w-3.5 text-secondary" /> Upload Document
            </h3>
            <label className="flex flex-col items-center justify-center gap-2 p-8 rounded-xl border-2 border-dashed border-border bg-muted/20 cursor-pointer hover:border-secondary/50 transition-all">
              <Upload className="h-8 w-8 text-muted-foreground" />
              <div className="text-center">
                <p className="text-xs font-bold text-foreground">
                  {file ? file.name : "Click to upload a document"}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {file
                    ? `${(file.size / 1024 / 1024).toFixed(1)} MB`
                    : "PNG, JPG, or PDF (max 10MB)"}
                </p>
              </div>
              <input
                type="file"
                accept=".png,.jpg,.jpeg,.pdf"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="hidden"
              />
            </label>
            {file && (
              <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-muted/30">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-secondary" />
                  <span className="text-xs font-medium text-foreground">{file.name}</span>
                </div>
                <button type="button" onClick={() => setFile(null)} className="text-[11px] text-muted-foreground hover:text-red-500">
                  Remove
                </button>
              </div>
            )}
          </section>

          {uploadMsg && (
            <div className={`flex items-start gap-2 p-3 rounded-xl text-xs ${
              uploadMsg.ok ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-600"
            }`}>
              {uploadMsg.ok ? <Check className="h-4 w-4 shrink-0 mt-0.5" /> : <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />}
              {uploadMsg.text}
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={uploading || !file}
              className="px-6 py-2.5 rounded-xl bg-secondary text-secondary-foreground text-xs font-bold hover:bg-secondary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-xs flex items-center gap-2"
            >
              {uploading ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Uploading...</>
              ) : (
                <><Upload className="h-4 w-4" /> Submit Verification</>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
