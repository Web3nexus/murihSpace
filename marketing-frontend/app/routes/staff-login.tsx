import { data, Form, useActionData, useNavigation } from "react-router";
import type { Route } from "./+types/staff-login";

// One message for every failure (unknown email, wrong password, lockout,
// disabled account, rate limit, outage) so the page does not reveal which.
const GENERIC_ERROR = "We could not sign you in with those details.";

const STAFF_SESSION_COOKIE = "staff_session";
const FALLBACK_MAX_AGE_SECONDS = 8 * 60 * 60;

export const meta: Route.MetaFunction = () => [
  { title: "Staff sign in | MurihSpace" },
  { name: "robots", content: "noindex, nofollow" },
];

interface StaffLoginApiResponse {
  success?: boolean;
  data?: { token?: string; expires_at?: string } | null;
}

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");

  if (!email || !password) {
    return data({ error: GENERIC_ERROR }, { status: 400 });
  }

  const apiBase = process.env.STAFF_API_URL?.replace(/\/+$/, "");
  if (!apiBase) {
    console.error("STAFF_API_URL is not set; staff sign-in is unavailable.");
    return data({ error: GENERIC_ERROR }, { status: 503 });
  }

  let response: Response;
  try {
    response = await fetch(`${apiBase}/api/staff/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ email, password }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return data({ error: GENERIC_ERROR }, { status: 502 });
  }

  if (!response.ok) {
    return data({ error: GENERIC_ERROR }, { status: 401 });
  }

  let body: StaffLoginApiResponse;
  try {
    body = (await response.json()) as StaffLoginApiResponse;
  } catch {
    return data({ error: GENERIC_ERROR }, { status: 502 });
  }

  const token = body.data?.token;
  if (!body.success || typeof token !== "string" || token === "") {
    return data({ error: GENERIC_ERROR }, { status: 401 });
  }

  const expiresAt = Date.parse(body.data?.expires_at ?? "");
  const maxAge = Number.isNaN(expiresAt)
    ? FALLBACK_MAX_AGE_SECONDS
    : Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));

  const cookie = [
    `${STAFF_SESSION_COOKIE}=${encodeURIComponent(token)}`,
    "Path=/",
    `Max-Age=${maxAge}`,
    "HttpOnly",
    "Secure",
    "SameSite=Strict",
  ].join("; ");

  return data({ ok: true as const }, { headers: { "Set-Cookie": cookie } });
}

export default function StaffLogin() {
  const result = useActionData<typeof action>();
  const navigation = useNavigation();
  const submitting = navigation.state === "submitting";
  const error = result && "error" in result ? result.error : null;
  const signedIn = result && "ok" in result && result.ok;

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F7FAFC] px-4 py-12 text-[#102840]">
      <div className="w-full max-w-sm rounded-2xl border border-[#D6E0E8] bg-white p-8 shadow-sm">
        <h1 className="text-xl font-bold tracking-tight">Staff sign in</h1>

        {error && (
          <p role="alert" className="mt-4 rounded-lg border border-[#DC2626]/20 bg-[#DC2626]/5 p-3 text-sm font-medium text-[#DC2626]">
            {error}
          </p>
        )}

        {signedIn && (
          <p role="status" className="mt-4 rounded-lg border border-[#16A34A]/20 bg-[#16A34A]/5 p-3 text-sm font-medium text-[#166534]">
            You are signed in.
          </p>
        )}

        <Form method="post" className="mt-6 space-y-4">
          <div>
            <label htmlFor="staff-email" className="block text-sm font-semibold">
              Email address
            </label>
            <input
              id="staff-email"
              name="email"
              type="email"
              required
              autoComplete="username"
              className="mt-1.5 w-full rounded-lg border border-[#D6E0E8] px-3.5 py-2.5 text-sm outline-none focus:border-[#38A8D8] focus:ring-2 focus:ring-[#38A8D8]/20"
            />
          </div>

          <div>
            <label htmlFor="staff-password" className="block text-sm font-semibold">
              Password
            </label>
            <input
              id="staff-password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="mt-1.5 w-full rounded-lg border border-[#D6E0E8] px-3.5 py-2.5 text-sm outline-none focus:border-[#38A8D8] focus:ring-2 focus:ring-[#38A8D8]/20"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-[#102840] px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#0C2034] disabled:opacity-60"
          >
            {submitting ? "Signing in..." : "Sign in"}
          </button>
        </Form>
      </div>
    </main>
  );
}
