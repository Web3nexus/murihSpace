import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Loader2, ShieldAlert } from "lucide-react";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { Link } from "react-router";

const API_BASE = (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL) ?? "http://localhost:8000/api/v1";

interface CallbackUser {
  id: number;
  name: string;
  email: string;
  username?: string;
  role: string;
  email_verified: boolean;
  [key: string]: unknown;
}

export function SocialAuthCallbackPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "error" | "done">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    const finish = (token: string, _user: CallbackUser) => {
      localStorage.setItem("murihspace-token", token);
      // Let the auth provider re-hydrate from /user on the next screen.
      window.location.replace("/app");
    };

    const finishWithError = (msg: string) => {
      if (cancelled) return;
      setMessage(msg);
      setStatus("error");
    };

    const parseHash = (): { token?: string; user?: CallbackUser; error?: string } => {
      const raw = window.location.hash.replace(/^#/, "");
      const params = new URLSearchParams(raw);
      const token = params.get("token") ?? undefined;
      const error = params.get("error") ?? undefined;
      let user: CallbackUser | undefined;
      const userEnc = params.get("user");
      if (userEnc) {
        try {
          user = JSON.parse(atob(userEnc)) as CallbackUser;
        } catch {
          user = undefined;
        }
      }
      return { token, user, error };
    };

    (async () => {
      const hash = parseHash();

      if (hash.error) {
        finishWithError(decodeURIComponent(hash.error));
        return;
      }

      if (hash.token) {
        finish(hash.token, hash.user ?? ({} as CallbackUser));
        return;
      }

      const params = new URLSearchParams(window.location.search);
      const provider = params.get("provider");
      const code = params.get("code");

      if (!provider || !code) {
        finishWithError("This sign-in link is incomplete or has expired. Please try again.");
        return;
      }

      try {
        const res = await fetch(`${API_BASE}/auth/social/${provider}/callback?code=${encodeURIComponent(code)}`, {
          method: "POST",
          headers: { Accept: "application/json", "Content-Type": "application/json" },
          body: JSON.stringify({ code, state: params.get("state") }),
        });
        const j = await res.json();
        if (!res.ok) {
          finishWithError(j?.message ?? "Sign-in could not be completed. Please try again.");
          return;
        }
        const d = j?.success ? j?.data : j;
        if (!d?.token || !d?.user) {
          finishWithError("Invalid response from sign-in. Please try again.");
          return;
        }
        finish(d.token, d.user as CallbackUser);
      } catch {
        finishWithError("Network error during sign-in. Please try again.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <AuthLayout headlineText="Almost" accentText="there." subText="Completing your sign-in.">
      <div className="flex flex-col items-center gap-5 py-8 text-center">
        {status === "loading" && (
          <>
            <Loader2 className="h-10 w-10 animate-spin text-[#2164b6] dark:text-[#7ab0ff]" />
            <p className="text-sm text-slate-500 dark:text-slate-400">Signing you in…</p>
          </>
        )}
        {status === "error" && (
          <div className="w-full flex flex-col items-center gap-4">
            <div className="rounded-xl bg-rose-500/10 border border-rose-500/20 p-4 flex items-start gap-3 w-full">
              <ShieldAlert className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
              <p className="text-xs sm:text-sm text-rose-600 dark:text-rose-400 text-left font-medium">{message}</p>
            </div>
            <Link
              to="/login"
              className="text-xs font-bold text-[#2164b6] dark:text-[#7ab0ff] hover:underline underline-offset-2"
            >
              Back to login
            </Link>
          </div>
        )}
      </div>
    </AuthLayout>
  );
}
