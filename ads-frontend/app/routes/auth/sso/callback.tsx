import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { adsApiRoot } from "../../../lib/ads-api";
import { takeExpectedSsoState } from "../../../lib/murihspace-sso";

/**
 * Redirect target for "Continue with MurihSpace" (MURIHSPACE_SSO_REDIRECT_URI on
 * ads-backend; ADS_SSO_REDIRECT_URI on the main backend). Receives ?code & ?state
 * from the main app, verifies the state, and posts only the code to ads-backend.
 */
export default function SsoCallback() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<"processing" | "success" | "error">("processing");
  const [errorMessage, setErrorMessage] = useState("");
  // The code is single use. Guard against React StrictMode running the effect twice.
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const code = searchParams.get("code") ?? "";
    const state = searchParams.get("state") ?? "";
    const expectedState = takeExpectedSsoState();

    if (!code) {
      setStatus("error");
      setErrorMessage("No sign-in code was provided.");
      return;
    }
    if (!expectedState || state !== expectedState) {
      setStatus("error");
      setErrorMessage("This sign-in link is invalid or has expired. Please try again.");
      return;
    }

    fetch(`${adsApiRoot()}/auth/murihspace/complete`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ code }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.status !== "success" || !data.token) {
          throw new Error(data.message || "MurihSpace sign-in failed.");
        }

        // Drop the previous session's keys first, so a response without an
        // advertiser cannot leave another account's X-Advertiser-ID behind.
        for (const key of ["ads_token", "ads_user", "advertiser_id", "ads_advertiser"]) {
          localStorage.removeItem(key);
        }
        localStorage.setItem("ads_token", data.token);
        if (data.user) localStorage.setItem("ads_user", JSON.stringify(data.user));
        if (data.advertiser) {
          localStorage.setItem("advertiser_id", String(data.advertiser.id));
          localStorage.setItem("ads_advertiser", JSON.stringify(data.advertiser));
        }

        setStatus("success");
        window.setTimeout(() => window.location.replace("/"), 800);
      })
      .catch((err: Error) => {
        setStatus("error");
        setErrorMessage(err.message || "Failed to sign in with MurihSpace.");
      });
  }, [searchParams]);

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
      <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-8 text-center space-y-5">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-brand/10 text-brand flex items-center justify-center font-bold text-xl">
          M
        </div>

        {status === "processing" && (
          <div className="space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-brand mx-auto" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Connecting to MurihSpace Ads Studio
            </h2>
          </div>
        )}

        {status === "success" && (
          <div className="space-y-3">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Welcome to Ads Manager!
            </h2>
            <p className="text-xs text-slate-500">Launching your dashboard...</p>
          </div>
        )}

        {status === "error" && (
          <div className="space-y-3">
            <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Sign-in failed
            </h2>
            <p className="text-xs text-rose-500">{errorMessage}</p>
            <div className="pt-2">
              <a
                href="/login"
                className="inline-block px-4 py-2 text-xs font-semibold rounded-lg bg-brand text-white hover:bg-brand-hover transition-colors"
              >
                Return to Login
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
