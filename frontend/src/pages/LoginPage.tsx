import React, { useState } from "react";
import { Link, useNavigate } from "react-router";
import { useAuth } from "@/hooks/useAuth";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { login, loading, error, fieldErrors } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await login(email, password);
    if (success) navigate("/app");
  };

  return (
    /* Matches login-05 block: full-screen center, white/muted bg */
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">

        {/* Logo — matches the brand mark at top of login-05 */}
        <Link
          to="/"
          className="flex items-center gap-2 self-center font-medium text-foreground"
        >
          <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground text-base font-bold shadow-sm">
            M
          </div>
          <span className="text-sm font-semibold tracking-tight">MurihSpace</span>
        </Link>

        {/* Card — matches login-05 white card */}
        <div className="rounded-2xl bg-card text-card-foreground shadow-sm p-8 flex flex-col gap-6">
          {/* Header */}
          <div className="flex flex-col gap-1.5 text-center">
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              Welcome back
            </h1>
            <p className="text-sm text-muted-foreground">
              Don&apos;t have an account?{" "}
              <Link to="/register" className="text-primary font-medium hover:underline underline-offset-4">
                Sign up
              </Link>
            </p>
          </div>

          {/* Server error */}
          {error && (
            <div id="login-error" className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive text-center">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="login-email">Email</FieldLabel>
                <Input
                  id="login-email"
                  type="email"
                  placeholder="m@example.com"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                  disabled={loading}
                  className={cn(fieldErrors.email && "border-destructive focus-visible:ring-destructive")}
                />
                {fieldErrors.email && (
                  <p className="text-xs text-destructive">{fieldErrors.email[0]}</p>
                )}
              </Field>

              <Field>
                <div className="flex items-center justify-between">
                  <FieldLabel htmlFor="login-password">Password</FieldLabel>
                  <Link
                    to="/forgot-password"
                    className="text-xs text-muted-foreground hover:text-primary underline-offset-4 hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>
                <Input
                  id="login-password"
                  type="password"
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                  disabled={loading}
                  className={cn(fieldErrors.password && "border-destructive focus-visible:ring-destructive")}
                />
                {fieldErrors.password && (
                  <p className="text-xs text-destructive">{fieldErrors.password[0]}</p>
                )}
              </Field>

              <Field>
                <Button
                  id="login-submit"
                  type="submit"
                  className="w-full"
                  disabled={loading || !email || !password}
                >
                  {loading ? (
                    <><Loader2 className="mr-2 size-4 animate-spin" />Signing in…</>
                  ) : (
                    "Login"
                  )}
                </Button>
              </Field>
            </FieldGroup>
          </form>
        </div>

        {/* Legal footnote */}
        <p className="text-center text-xs text-muted-foreground text-balance px-4">
          By continuing, you agree to our{" "}
          <Link to="/terms" className="underline underline-offset-4 hover:text-primary">Terms of Service</Link>{" "}
          and{" "}
          <Link to="/privacy" className="underline underline-offset-4 hover:text-primary">Privacy Policy</Link>.
        </p>
      </div>
    </div>
  );
}
