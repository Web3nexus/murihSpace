import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router";
import { useAuth } from "@/hooks/useAuth";
import { env } from "@/config/env";
import { Button } from "@/components/ui/button";
import { AuthLayout } from "@/components/layout/AuthLayout";
import {
  ADS_SSO_AUTHORIZE_PATH,
  ADS_UPGRADE_PATH,
  buildAdsCallbackUrl,
  isValidSsoState,
  parseAllowedAdsRedirect,
  requestAdsSsoCode,
} from "@/lib/adsSso";

type Status =
  | { kind: "loading" }
  | { kind: "redirecting" }
  | { kind: "upgrade_required" }
  | { kind: "error"; message: string };

/**
 * Hand-off page the Ads Manager sends signed-in users through. It exchanges the
 * session for a one-time code and sends the browser back to the Ads Manager
 * callback with `code` and `state`.
 */
export function AdsSsoAuthorizePage() {
  const [searchParams] = useSearchParams();
  const state = searchParams.get("state");
  const { isAuthenticated, loading } = useAuth();

  const [status, setStatus] = useState<Status>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const startedAttempt = useRef<number | null>(null);
  // Drops results only after unmount. Effect cleanups run on every dependency change
  // and under StrictMode, and a cleanup must not discard a code that was already issued.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const stateValid = isValidSsoState(state);

  useEffect(() => {
    if (loading || !isAuthenticated || !stateValid || !state) return;
    // StrictMode runs effects twice; only one code is requested per attempt.
    if (startedAttempt.current === attempt) return;
    startedAttempt.current = attempt;

    setStatus({ kind: "loading" });

    (async () => {
      const result = await requestAdsSsoCode();
      if (!mountedRef.current) return;

      if (result.kind === "upgrade_required") {
        setStatus({ kind: "upgrade_required" });
        return;
      }
      if (result.kind === "error") {
        setStatus({ kind: "error", message: result.message });
        return;
      }

      const target = parseAllowedAdsRedirect(result.grant.redirect_uri, env.VITE_ADS_MANAGER_URL);
      if (!target) {
        setStatus({
          kind: "error",
          message: "The Ads Manager address is not recognised, so the sign-in was stopped.",
        });
        return;
      }

      setStatus({ kind: "redirecting" });
      window.location.assign(buildAdsCallbackUrl(target, result.grant.code, state));
    })();
  }, [loading, isAuthenticated, stateValid, state, attempt]);

  if (!stateValid) {
    return (
      <Shell>
        <Message
          title="This sign-in link is incomplete"
          body="The link is missing a valid state value. Return to the Ads Manager and start the sign-in again."
        />
      </Shell>
    );
  }

  if (loading) {
    return (
      <Shell>
        <Message title="Checking your session" body="One moment while we confirm your sign-in." />
      </Shell>
    );
  }

  if (!isAuthenticated) {
    const returnTo = `${ADS_SSO_AUTHORIZE_PATH}?state=${encodeURIComponent(state ?? "")}`;
    return <Navigate to={`/login?next=${encodeURIComponent(returnTo)}`} replace />;
  }

  if (status.kind === "upgrade_required") {
    return (
      <Shell>
        <Message
          title="An upgrade is needed for Ads"
          body="This account does not include access to the Ads Manager yet. Upgrade your account, then sign in to Ads again."
        >
          <Button asChild>
            <Link to={ADS_UPGRADE_PATH}>View upgrade options</Link>
          </Button>
        </Message>
      </Shell>
    );
  }

  if (status.kind === "error") {
    return (
      <Shell>
        <Message title="Sign-in to Ads failed" body={status.message}>
          <Button onClick={() => setAttempt((n) => n + 1)}>Try again</Button>
        </Message>
      </Shell>
    );
  }

  return (
    <Shell>
      <Message
        title={status.kind === "redirecting" ? "Taking you to Ads" : "Signing you in to Ads"}
        body="Please keep this tab open."
      />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <AuthLayout>{children}</AuthLayout>;
}

function Message({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 p-6 text-center">
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="text-sm text-muted-foreground">{body}</p>
      {children ? <div className="flex justify-center">{children}</div> : null}
    </div>
  );
}
