import { useEffect, useRef, useState, type FormEvent } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router";
import { Button } from "../../components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Shield } from "lucide-react";
import { adsApiRoot } from "../../lib/ads-api";
import { STAFF_HOME_PATH, storeStaffToken } from "../../lib/staff-session";

const MISSING_TOKEN_MESSAGE =
  "No hub sign-in token was provided. Open this page from the marketing hub sign-in link, or paste the token the hub issued you.";

interface HubSessionResponse {
  status?: string;
  token?: string;
  message?: string;
}

/**
 * Staff sign-in. Staff sign in only through the MurihSpace marketing hub. The
 * hub token arrives as ?token=... or is pasted here. It is posted once to
 * ads-backend, which returns an ads admin token. There is no password.
 */
export default function SecureAdsLogin() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const queryToken = (searchParams.get("token") ?? "").trim();

  const [pastedToken, setPastedToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const autoSignedIn = useRef(false);

  const signIn = async (hubToken: string) => {
    const value = hubToken.trim();
    if (!value) {
      setError(MISSING_TOKEN_MESSAGE);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${adsApiRoot()}/auth/staff/hub-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ token: value }),
      });
      const data = (await res.json().catch(() => ({}))) as HubSessionResponse;
      if (!res.ok || data.status !== "success" || !data.token) {
        setError(data.message || "Staff sign-in failed. The hub token may have expired. Request a new one from the marketing hub.");
        return;
      }
      storeStaffToken(data.token);
      navigate(STAFF_HOME_PATH, { replace: true });
    } catch {
      setError("Staff sign-in is not available right now. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  };

  // A token in the URL is posted once, then removed from the address bar and history.
  useEffect(() => {
    if (!queryToken || autoSignedIn.current) return;
    autoSignedIn.current = true;
    navigate(location.pathname, { replace: true });
    void signIn(queryToken);
  }, [queryToken]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void signIn(pastedToken);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <Card className="w-[400px] shadow-lg border-t-4 border-t-red-600">
        <form onSubmit={handleSubmit}>
          <CardHeader className="text-center pb-2">
            <div className="mx-auto bg-red-100 p-3 rounded-full w-12 h-12 flex items-center justify-center mb-4">
              <Shield className="h-6 w-6 text-red-600" />
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight">Staff Authentication</CardTitle>
            <CardDescription>Restricted access for MurihSpace operations. Sign in through the marketing hub.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 mt-4">
            {error && (
              <div role="alert" className="p-3 text-sm font-medium text-red-800 bg-red-100 rounded-md">
                {error}
              </div>
            )}
            <div className="grid gap-2">
              <Label htmlFor="token">Hub sign-in token</Label>
              <Input
                id="token"
                name="token"
                type="text"
                value={pastedToken}
                onChange={(event) => setPastedToken(event.target.value)}
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                disabled={busy}
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full bg-red-600 hover:bg-red-700" disabled={busy}>
              {busy ? "Signing in..." : "Authenticate"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
