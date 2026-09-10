import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";

export default function SsoCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"processing" | "success" | "error">("processing");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const token = searchParams.get("token");
    if (!token) {
      setStatus("error");
      setErrorMessage("No SSO token was provided.");
      return;
    }

    const apiUrl = (import.meta.env.VITE_ADS_API_URL || "http://localhost:8001").replace(/\/+$/, "");

    fetch(`${apiUrl}/api/auth/murihspace-sso`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok || data.status !== "success") {
          throw new Error(data.message || "SSO Authentication failed.");
        }

        // Store auth tokens and advertiser details
        if (data.token) {
          localStorage.setItem("ads_token", data.token);
        }
        if (data.user) {
          localStorage.setItem("ads_user", JSON.stringify(data.user));
        }
        if (data.advertiser) {
          localStorage.setItem("advertiser_id", String(data.advertiser.id));
          localStorage.setItem("ads_advertiser", JSON.stringify(data.advertiser));
        }

        setStatus("success");
        setTimeout(() => {
          navigate("/");
        }, 800);
      })
      .catch((err) => {
        console.error("SSO Login Error:", err);
        setStatus("error");
        setErrorMessage(err.message || "Failed to authenticate with MurihSpace.");
      });
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
      <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-8 text-center space-y-5">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-[#2164b6]/10 text-[#2164b6] flex items-center justify-center font-bold text-xl">
          M
        </div>

        {status === "processing" && (
          <div className="space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-[#2164b6] mx-auto" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Connecting to MurihSpace Ads Studio
            </h2>
            <p className="text-xs text-slate-500">
              Authenticating your creator & vendor credentials...
            </p>
          </div>
        )}

        {status === "success" && (
          <div className="space-y-3">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Welcome to Ads Manager!
            </h2>
            <p className="text-xs text-slate-500">
              Your account is synced. Launching your dashboard...
            </p>
          </div>
        )}

        {status === "error" && (
          <div className="space-y-3">
            <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              SSO Login Failed
            </h2>
            <p className="text-xs text-rose-500">{errorMessage}</p>
            <div className="pt-2">
              <a
                href="/login"
                className="inline-block px-4 py-2 text-xs font-semibold rounded-lg bg-[#2164b6] text-white hover:bg-[#1a5091] transition-colors"
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

