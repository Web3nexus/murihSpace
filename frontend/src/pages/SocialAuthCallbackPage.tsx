import { authFetch } from "@/lib/api/authFetch";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { ShieldFail as ShieldWarning } from "@/components/icons";
import { Spinner as Loader2 } from "@/components/icons/rounded";;
import { AuthLayout } from "@/components/layout/AuthLayout";
import { sanitiseReturnTo } from "@/lib/deepLinks";
import { takeSocialReturn } from "@/lib/usePostAuthRedirect";
import { setSessionHint } from "@/lib/auth/sessionHint";
import { Link } from "react-router";



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

    const finish = () => {
      setSessionHint(true);
      // The session cookie is already set. The full page load below lets the
      // auth provider re-hydrate from /user on the next screen.
      // Honour the shared link the visitor arrived with, so a Google or Apple
      // sign-in started from /m/abc or /e/12 still lands on that meeting or
      // event instead of the dashboard.
      // The provider never echoes `next` back, so the login screen stashed the
      // destination in this tab before leaving. An explicit `?next=` still wins
      // for the flows that can carry one.
      const stashed = takeSocialReturn();
      const fromQuery = new URLSearchParams(window.location.search).get("next");
      const next = sanitiseReturnTo(fromQuery) ?? sanitiseReturnTo(stashed);
      window.location.replace(next ?? "/app");
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
        // The server puts a token in the fragment only when it did not bind a web
        // session, so no session cookie came with it. Browsers never hold the
        // token, so this sign-in cannot complete here.
        finishWithError("This sign-in link is incomplete or has expired. Please try again.");
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
        const res = await authFetch(`/auth/social/${provider}/callback?code=${encodeURIComponent(code)}`, {
          method: "POST",
          headers: { Accept: "application/json", "Content-Type": "application/json" },
          body: JSON.stringify({ code, state: params.get("state") }),
        });
        if (!res.ok) {
          // The server answers this POST with HTML, so the body may not be JSON.
          let message: string | undefined;
          try {
            message = (await res.json())?.message;
          } catch {
            message = undefined;
          }
          finishWithError(message ?? "Sign-in could not be completed. Please try again.");
          return;
        }
        // The session cookie carries the sign-in. Confirm it arrived before going on,
        // so a response without a cookie is reported instead of a signed-out /app.
        const me = await authFetch("/user", { headers: { Accept: "application/json" } });
        if (!me.ok) {
          finishWithError("Sign-in could not be completed. Please try again.");
          return;
        }
        finish();
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
            <Loader2 weight="fill" className="h-10 w-10 animate-spin text-[var(--shell-accent)] dark:text-[var(--shell-accent)]" />
            <p className="text-sm text-[var(--shell-muted)] dark:text-[var(--shell-muted)]">Signing you in…</p>
          </>
        )}
        {status === "error" && (
          <div className="w-full flex flex-col items-center gap-4">
            <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 p-4 flex items-start gap-3 w-full">
              <ShieldWarning weight="fill" className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
              <p className="text-xs sm:text-sm text-rose-600 dark:text-rose-400 text-left font-medium">{message}</p>
            </div>
            <Link
              to="/login"
              className="text-xs font-bold text-[var(--shell-accent)] dark:text-[var(--shell-accent)] hover:underline underline-offset-2"
            >
              Back to login
            </Link>
          </div>
        )}
      </div>
    </AuthLayout>
  );
}
