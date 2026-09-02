import { useState, useEffect, useCallback, useRef } from "react";
import QRCode from "qrcode";
import {
  ShieldCheck,
  Check,
  X,
  AlertCircle,
  Loader2,
  RefreshCw,
  BadgeCheck,
  Coins,
  Smartphone,
  QrCode,
  Copy,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api/client";
import { useAuth } from "@/hooks/useAuth";

type KycStatus =
  | "not_required"
  | "not_started"
  | "unsubmitted"
  | "pending"
  | "in_review"
  | "verified"
  | "rejected"
  | "expired"
  | "resubmission_required";

interface KycState {
  kyc_status: KycStatus;
  kyc_provider: string;
  kyc_rejection_reason?: string | null;
  kyc_document?: string | null;
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

function StatusBanner({
  status,
  reason,
}: {
  status: KycStatus;
  reason?: string | null;
}) {
  const config: Record<
    string,
    {
      icon: typeof ShieldCheck;
      bg: string;
      text: string;
      border: string;
      label: string;
      msg: string;
    }
  > = {
    verified: {
      icon: Check,
      bg: "bg-emerald-500/10",
      text: "text-emerald-600 dark:text-emerald-400",
      border: "border-emerald-500/20",
      label: "Identity Verified",
      msg: "Your identity has been verified. Creator payouts, withdrawal tools, escrow storefronts, and trusted features are active.",
    },
    pending: {
      icon: Loader2,
      bg: "bg-amber-500/10",
      text: "text-amber-600 dark:text-amber-400",
      border: "border-amber-500/20",
      label: "Verification In Review",
      msg: "Your document submission is currently being reviewed by our compliance team. This usually completes within a few hours.",
    },
    in_review: {
      icon: Loader2,
      bg: "bg-amber-500/10",
      text: "text-amber-600 dark:text-amber-400",
      border: "border-amber-500/20",
      label: "Under Review",
      msg: "Your identity documents are undergoing verification review.",
    },
    rejected: {
      icon: X,
      bg: "bg-red-500/10",
      text: "text-red-600 dark:text-red-400",
      border: "border-red-500/20",
      label: "Verification Rejected",
      msg:
        reason ||
        "Your submission was not approved. Please scan the QR code to re-submit clear documents via the mobile app.",
    },
    expired: {
      icon: AlertCircle,
      bg: "bg-orange-500/10",
      text: "text-orange-600 dark:text-orange-400",
      border: "border-orange-500/20",
      label: "Verification Expired",
      msg: "Your verification request expired. Please open the mobile app to verify.",
    },
    resubmission_required: {
      icon: AlertCircle,
      bg: "bg-orange-500/10",
      text: "text-orange-600 dark:text-orange-400",
      border: "border-orange-500/20",
      label: "Resubmission Required",
      msg: "Additional document details or a clearer photo are required. Please re-submit via the mobile app.",
    },
    not_required: {
      icon: ShieldCheck,
      bg: "bg-primary/10",
      text: "text-primary",
      border: "border-primary/20",
      label: "Standard Account",
      msg: "Basic membership is active. KYC is required when applying for Creator/Vendor roles or withdrawing earnings.",
    },
    not_started: {
      icon: AlertCircle,
      bg: "bg-amber-500/10",
      text: "text-amber-600 dark:text-amber-400",
      border: "border-amber-500/20",
      label: "Action Required: Complete KYC",
      msg: "You have triggered a role upgrade or withdrawal requiring identity verification. Please scan the QR code to complete KYC on the app.",
    },
    unsubmitted: {
      icon: AlertCircle,
      bg: "bg-muted",
      text: "text-muted-foreground",
      border: "border-border",
      label: "Not Verified",
      msg: "Identity verification is conducted on the MurihSpace Mobile App for secure live camera capture.",
    },
  };
  const c = config[status] || config.unsubmitted;
  const Icon = c.icon;
  return (
    <div
      className={`flex items-start gap-3.5 p-4 sm:p-5 rounded-2xl border ${c.bg} ${c.border}`}
    >
      <Icon
        className={`h-5 w-5 shrink-0 mt-0.5 ${
          status === "pending" || status === "in_review" ? "animate-spin" : ""
        } ${c.text}`}
      />
      <div>
        <p className={`text-sm font-bold ${c.text}`}>{c.label}</p>
        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
          {c.msg}
        </p>
      </div>
    </div>
  );
}

function KycQrCode({ content, size = 200 }: { content: string; size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!canvasRef.current || !content) return;
    QRCode.toCanvas(canvasRef.current, content, {
      width: size,
      margin: 2,
      color: { dark: "#0F172A", light: "#ffffff" },
    }).catch(() => setFailed(true));
  }, [content, size]);

  if (failed) {
    return (
      <div
        className="flex items-center justify-center rounded-2xl bg-muted"
        style={{ width: size, height: size }}
      >
        <QrCode className="h-10 w-10 text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white p-3 shadow-md border border-border inline-block">
      <canvas ref={canvasRef} width={size} height={size} className="block" />
    </div>
  );
}

export default function KycSettingsPage() {
  const { user } = useAuth();
  const [state, setState] = useState<KycState | null>(null);
  const [loading, setLoading] = useState(true);
  const [badge, setBadge] = useState<BadgeState | null>(null);
  const [badgeLoading, setBadgeLoading] = useState(false);
  const [badgeBusy, setBadgeBusy] = useState<string | null>(null);
  const [badgeMsg, setBadgeMsg] = useState<{ ok: boolean; text: string } | null>(
    null
  );

  const fetchStatus = useCallback(async () => {
    try {
      const res = await apiClient.get("/kyc/status");
      const data = res.data?.data ?? res.data;
      setState(
        data ?? {
          kyc_status: (user?.kyc_status as KycStatus) ?? "unsubmitted",
          kyc_provider: "manual",
        }
      );
    } catch {
      setState({
        kyc_status: (user?.kyc_status as KycStatus) ?? "unsubmitted",
        kyc_provider: "manual",
      });
    } finally {
      setLoading(false);
    }
  }, [user?.kyc_status]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Live polling every 5s while waiting for user to complete verification on mobile or while pending
  useEffect(() => {
    const isUnfinished =
      state?.kyc_status !== "verified" && state?.kyc_status !== "not_required";
    if (!isUnfinished) return;

    const timer = window.setInterval(() => {
      fetchStatus();
    }, 5000);
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
        setBadge((prev) => ({
          ...(prev ?? {
            status: "none",
            expires_at: null,
            purchased_at: null,
            auto_renew: false,
            kyc_verified: true,
            monthly_fee: 100,
            wallet_balance: 0,
          }),
          ...(data as Partial<BadgeState>),
        }));
      }
      fetchBadge();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setBadgeMsg({
        ok: false,
        text:
          err.response?.data?.message ??
          "Something went wrong. Please try again.",
      });
    } finally {
      setBadgeBusy(null);
    }
  };

  const copyMobileLink = () => {
    const kycDeepLink = "https://murihspace.com/app/kyc";
    navigator.clipboard.writeText(kycDeepLink);
    toast.success("Mobile KYC link copied to clipboard!");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-secondary" />
      </div>
    );
  }

  const status = state?.kyc_status ?? (user?.kyc_status as KycStatus) ?? "unsubmitted";
  const isVerified = status === "verified";
  const isPending = status === "pending" || status === "in_review";

  // Universal deep-link QR content for mobile app handoff
  const kycQrUrl = "https://murihspace.com/app/kyc";

  return (
    <div className="space-y-6 w-full max-w-3xl mx-auto py-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-extrabold text-foreground flex items-center gap-2.5">
            <ShieldCheck className="h-6 w-6 text-primary" />
            Identity Verification (KYC)
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Government ID & Biometric Verification required for Creator hubs, Vendor stores, and Escrow payouts.
          </p>
        </div>
        <button
          onClick={() => fetchStatus()}
          title="Refresh Status"
          className="p-2.5 rounded-xl border border-border text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* Live Status Banner */}
      <StatusBanner status={status} reason={state?.kyc_rejection_reason} />

      {/* Verified Badge Section (when KYC is approved) */}
      {isVerified && (
        <section className="rounded-3xl border border-border bg-card p-6 shadow-sm space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="h-12 w-12 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
                <BadgeCheck className="h-6 w-6 text-sky-500" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                  Official Blue Checkmark Badge
                  {badge?.status === "active" && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 text-[11px] font-bold">
                      <BadgeCheck className="h-3.5 w-3.5" /> Active
                    </span>
                  )}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Display the verified blue badge on your profile, messages, and listings across MurihSpace.
                </p>
              </div>
            </div>
          </div>

          {badgeLoading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Checking badge status…
            </div>
          ) : badge ? (
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3.5 rounded-2xl bg-muted/40 border border-border">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
                    Monthly Fee
                  </p>
                  <p className="text-base font-extrabold text-foreground mt-0.5 flex items-center gap-1.5">
                    <Coins className="h-4 w-4 text-primary" /> {badge.monthly_fee} tokens
                  </p>
                </div>
                <div className="p-3.5 rounded-2xl bg-muted/40 border border-border">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
                    Wallet Balance
                  </p>
                  <p className="text-base font-extrabold text-foreground mt-0.5 flex items-center gap-1.5">
                    <Coins className="h-4 w-4 text-primary" /> {badge.wallet_balance.toLocaleString()} tokens
                  </p>
                </div>
              </div>

              {badge.expires_at && badge.status === "active" && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <BadgeCheck className="h-4 w-4 text-sky-500" />
                  Expires{" "}
                  {new Date(badge.expires_at).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                  {badge.auto_renew ? (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 text-[10px] font-bold">
                      Auto-renew on
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 text-[10px] font-bold">
                      Auto-renew off
                    </span>
                  )}
                </div>
              )}

              {badgeMsg && (
                <div
                  className={`flex items-start gap-2 p-3.5 rounded-2xl text-xs ${
                    badgeMsg.ok
                      ? "bg-emerald-500/10 text-emerald-600"
                      : "bg-red-500/10 text-red-600"
                  }`}
                >
                  {badgeMsg.ok ? (
                    <Check className="h-4 w-4 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  )}
                  {badgeMsg.text}
                </div>
              )}

              <div className="flex flex-wrap gap-3">
                {badge.status !== "active" && (
                  <button
                    onClick={() =>
                      badgeAction("/verification-badge/activate", "activate")
                    }
                    disabled={badgeBusy !== null}
                    className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm flex items-center gap-2"
                  >
                    {badgeBusy === "activate" ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Activating…
                      </>
                    ) : (
                      <>
                        <BadgeCheck className="h-4 w-4" /> Activate Badge (
                        {badge.monthly_fee}/mo)
                      </>
                    )}
                  </button>
                )}
                {badge.status === "active" && (
                  <button
                    onClick={() =>
                      badgeAction("/verification-badge/renew", "renew")
                    }
                    disabled={badgeBusy !== null}
                    className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm flex items-center gap-2"
                  >
                    {badgeBusy === "renew" ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Renewing…
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4" /> Renew for{" "}
                        {badge.monthly_fee} tokens
                      </>
                    )}
                  </button>
                )}
                {badge.status === "active" && badge.auto_renew && (
                  <button
                    onClick={() =>
                      badgeAction(
                        "/verification-badge/cancel-auto-renew",
                        "cancel"
                      )
                    }
                    disabled={badgeBusy !== null}
                    className="px-5 py-2.5 rounded-xl border border-border text-muted-foreground text-xs font-bold hover:text-foreground hover:border-muted-foreground/40 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {badgeBusy === "cancel" ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Turning off…
                      </>
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

      {/* Non-verified PC state: QR Code Mobile Handoff */}
      {!isVerified && (
        <div className="rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-sm space-y-6">
          <div className="text-center max-w-md mx-auto space-y-2">
            <div className="inline-flex p-3 rounded-2xl bg-primary/10 text-primary mb-1">
              <Smartphone className="h-7 w-7" />
            </div>
            <h3 className="text-lg font-black text-foreground">
              Verify on the MurihSpace App
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              To protect the community, identity verification requires high-resolution document scanning and a live biometric selfie using your mobile device's camera.
            </p>
          </div>

          {/* QR Code & Scan Instructions */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-8 py-2">
            <div className="flex flex-col items-center">
              <KycQrCode content={kycQrUrl} size={190} />
              <p className="text-[11px] font-bold text-muted-foreground mt-2.5 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-primary" /> Scan with your phone camera
              </p>
            </div>

            <div className="space-y-4 max-w-sm">
              <div className="flex items-start gap-3">
                <div className="h-7 w-7 rounded-xl bg-primary/10 text-primary text-xs font-black flex items-center justify-center shrink-0">
                  1
                </div>
                <div>
                  <h4 className="text-xs font-bold text-foreground">Scan the QR Code</h4>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Open your iPhone or Android camera and point it at the code to launch the MurihSpace app.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="h-7 w-7 rounded-xl bg-primary/10 text-primary text-xs font-black flex items-center justify-center shrink-0">
                  2
                </div>
                <div>
                  <h4 className="text-xs font-bold text-foreground">Capture Government ID</h4>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Snap crisp front & back photos of your Passport, National ID, or Driver's License.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="h-7 w-7 rounded-xl bg-primary/10 text-primary text-xs font-black flex items-center justify-center shrink-0">
                  3
                </div>
                <div>
                  <h4 className="text-xs font-bold text-foreground">Take a Quick Selfie</h4>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Position your face in the oval frame for instant biometric liveness confirmation.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Action Footer */}
          <div className="pt-4 border-t border-border flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary"></span>
              </span>
              <p className="text-xs text-muted-foreground font-medium">
                {isPending
                  ? "Verification submitted — awaiting compliance review..."
                  : "Waiting for mobile app scan..."}
              </p>
            </div>

            <button
              onClick={copyMobileLink}
              className="px-4 py-2 rounded-xl border border-border text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors flex items-center gap-2"
            >
              <Copy className="h-3.5 w-3.5" /> Copy Mobile Link
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
