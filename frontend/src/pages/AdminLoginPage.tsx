import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router";
import { useAuth } from "@/hooks/useAuth";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, ShieldAlert } from "lucide-react";

export function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { login, loading, error, fieldErrors, user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated && user?.role === "admin") {
      navigate("/app/securegate", { replace: true });
    }
  }, [isAuthenticated, user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const user = await login(email, password);
    if (!user) return;
    if (user.role !== "admin") {
      navigate("/login");
      return;
    }
    navigate("/app/securegate");
  };

  return (
    <div className="min-h-screen w-full bg-slate-950 flex flex-col">
      <header className="w-full px-6 py-4 flex items-center justify-between max-w-7xl mx-auto">
        <Link to="/" className="flex items-center gap-2">
          <img src="/logo_white.png" alt="MurihSpace" className="h-7 w-auto object-contain" />
        </Link>
        <Link
          to="/login"
          className="text-xs font-medium text-slate-400 hover:text-white transition-colors"
        >
          User login
        </Link>
      </header>

      <main className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 mb-4">
              <ShieldAlert className="h-7 w-7 text-amber-400" />
            </div>
            <h1 className="text-2xl font-bold text-white">Securegate</h1>
            <p className="text-sm text-slate-400 mt-1">Platform administration portal</p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            {error && (
              <div className="mb-4 rounded-xl bg-rose-500/10 border border-rose-500/20 p-3 text-xs text-rose-400 text-center font-medium">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <FieldGroup className="space-y-4">
                <Field>
                  <FieldLabel htmlFor="admin-email" className="text-xs font-semibold text-slate-300">
                    Admin email
                  </FieldLabel>
                  <Input
                    id="admin-email"
                    type="email"
                    placeholder="admin@murihspace.com"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                    className="h-11 px-4 rounded-xl text-sm bg-slate-800/60 border-slate-700 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 text-slate-100 placeholder:text-slate-500"
                  />
                  {fieldErrors.email && (
                    <p className="text-xs text-rose-400 mt-1">{fieldErrors.email[0]}</p>
                  )}
                </Field>

                <Field>
                  <FieldLabel htmlFor="admin-password" className="text-xs font-semibold text-slate-300">
                    Password
                  </FieldLabel>
                  <Input
                    id="admin-password"
                    type="password"
                    placeholder="••••••••"
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    className="h-11 px-4 rounded-xl text-sm bg-slate-800/60 border-slate-700 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 text-slate-100 placeholder:text-slate-500"
                  />
                  {fieldErrors.password && (
                    <p className="text-xs text-rose-400 mt-1">{fieldErrors.password[0]}</p>
                  )}
                </Field>

                <Field className="pt-1">
                  <Button
                    type="submit"
                    disabled={loading || !email || !password}
                    className="w-full h-11 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-bold transition-all duration-200 active:scale-[0.99] disabled:opacity-50"
                  >
                    {loading ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Authenticating…</>
                    ) : (
                      "Access Securegate"
                    )}
                  </Button>
                </Field>
              </FieldGroup>
            </form>
          </div>

          <p className="text-center text-xs text-slate-500 mt-6">
            &copy; {new Date().getFullYear()} MurihSpace Ecosystem
          </p>
        </div>
      </main>
    </div>
  );
}
