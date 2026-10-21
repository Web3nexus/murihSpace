import { useState } from "react";
import { ArrowRight, BarChart3, Megaphone, ShieldCheck, ShoppingBag, Users, Wallet } from "lucide-react";
import { mainAppUrl } from "../lib/ads-api";
import { SSO_AUTHORIZE_PATH, createSsoState } from "../lib/murihspace-sso";

const FEATURES = [
  { icon: Megaphone, text: "Run ads across MurihSpace feeds, stores and communities" },
  { icon: Users, text: "Define your audience for smarter ad targeting" },
  { icon: Wallet, text: "Set up and manage your ad budgets" },
  { icon: BarChart3, text: "Get real-time insights" },
];

const BARS = [46, 72, 58, 88, 64, 96];

export default function LoginPage() {
  const [loading, setLoading] = useState(false);

  // The browser goes to the main app, which issues the single-use code and
  // returns it to /auth/sso/callback. The ads API is not involved until then.
  const handleContinueWithMurihSpace = () => {
    setLoading(true);
    const state = createSsoState();
    window.location.href = `${mainAppUrl()}${SSO_AUTHORIZE_PATH}?state=${encodeURIComponent(state)}`;
  };

  const handleLaunchFromMurihSpace = () => {
    setLoading(true);
    window.location.href = `${mainAppUrl()}/app/ads?launch_studio=true`;
  };

  return (
    <div className="min-h-screen w-full bg-white dark:bg-slate-950 lg:grid lg:grid-cols-[1fr_minmax(0,460px)] lg:bg-gradient-to-br lg:from-sky-50 lg:via-blue-50/60 lg:to-white dark:lg:from-slate-950 dark:lg:via-slate-900 dark:lg:to-slate-950">
      {/* Left: pitch and illustration */}
      <section className="hidden lg:flex flex-col justify-center px-16 xl:px-24 py-16 overflow-hidden">
        <div className="max-w-xl space-y-8">
          <div className="login-rise space-y-4" style={{ animationDelay: "0ms" }}>
            <div className="w-12 h-12 rounded-2xl bg-brand text-white flex items-center justify-center font-black text-xl shadow-lg shadow-blue-500/20">
              M
            </div>
            <h1 className="text-5xl font-semibold leading-tight tracking-tight text-slate-900 dark:text-slate-100">
              Get started with
              <br />
              Ads Manager
            </h1>
          </div>

          <ul className="space-y-3">
            {FEATURES.map(({ icon: Icon, text }, index) => (
              <li
                key={text}
                className="login-rise flex items-center gap-3 text-[15px] text-slate-700 dark:text-slate-300"
                style={{ animationDelay: `${150 + index * 90}ms` }}
              >
                <span className="w-8 h-8 rounded-full bg-white shadow-sm border border-blue-100 flex items-center justify-center text-brand">
                  <Icon className="w-4 h-4" />
                </span>
                {text}
              </li>
            ))}
          </ul>

          <p className="login-rise text-sm text-slate-500 leading-relaxed" style={{ animationDelay: "550ms" }}>
            From Ads Manager you can reach your storefront, creator profile and community tools in one place, so you
            connect with your customers and get better results.
          </p>
        </div>

        {/* Animated illustration */}
        <div className="login-rise relative mt-12 h-64 max-w-xl" style={{ animationDelay: "400ms" }} aria-hidden="true">
          {/* Stats card */}
          <div className="login-float absolute left-0 top-6 w-72 rounded-2xl bg-white shadow-xl border border-slate-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="h-2.5 w-20 rounded-full bg-slate-200" />
              <span className="login-pulse w-2.5 h-2.5 rounded-full bg-emerald-500" />
            </div>
            <div className="flex items-end gap-2.5 h-28">
              {BARS.map((height, index) => (
                <div key={index} className="flex-1 h-full flex items-end">
                  <div
                    className="login-bar w-full rounded-t-md bg-gradient-to-t from-brand to-blue-400"
                    style={{ height: `${height}%`, animationDelay: `${600 + index * 90}ms` }}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Audience chip */}
          <div
            className="login-float absolute right-0 top-0 flex items-center gap-3 rounded-2xl bg-white shadow-lg border border-slate-100 px-4 py-3"
            style={{ animationDelay: "-2s" }}
          >
            <span className="w-9 h-9 rounded-full bg-blue-100 text-brand flex items-center justify-center">
              <Users className="w-4 h-4" />
            </span>
            <div>
              <p className="text-xs font-semibold text-slate-900">Audience reached</p>
              <p className="text-[11px] text-slate-500">+24% this week</p>
            </div>
          </div>

          {/* Storefront chip */}
          <div
            className="login-float absolute right-8 bottom-0 flex items-center gap-3 rounded-2xl bg-white shadow-lg border border-slate-100 px-4 py-3"
            style={{ animationDelay: "-4s" }}
          >
            <span className="w-9 h-9 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center">
              <ShoppingBag className="w-4 h-4" />
            </span>
            <div>
              <p className="text-xs font-semibold text-slate-900">New product ad</p>
              <p className="text-[11px] text-slate-500">Ready to publish</p>
            </div>
          </div>

          {/* Decorative orbit and cursor */}
          <div className="absolute -left-6 -bottom-8 w-28 h-28 rounded-full border-[14px] border-blue-200/70 login-orbit">
            <span className="absolute -top-2 left-1/2 w-4 h-4 -translate-x-1/2 rounded-full bg-brand" />
          </div>
          <svg
            className="login-cursor absolute left-[19rem] top-28 w-6 h-6 text-slate-900 drop-shadow"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M4 2l15 9.5-6.5 1.2L16 21l-3 1.3-3.5-7.6L4 18z" />
          </svg>
        </div>
      </section>

      {/* Right: sign-in card */}
      <section className="flex items-center justify-center px-6 py-12 min-h-screen lg:min-h-0 lg:border-l lg:border-slate-100 lg:bg-white lg:dark:bg-slate-950">
        <div className="login-rise w-full max-w-sm space-y-6" style={{ animationDelay: "120ms" }}>
          {/* Compact brand for small screens */}
          <div className="lg:hidden flex flex-col items-center gap-3 text-center">
            <div className="w-12 h-12 rounded-2xl bg-brand text-white flex items-center justify-center font-black text-xl shadow-lg shadow-blue-500/20">
              M
            </div>
            <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Get started with Ads Manager</h1>
          </div>

          <div className="text-center space-y-1">
            <h2 className="hidden lg:block text-xl font-semibold text-slate-900 dark:text-slate-100">
              Log in to Ads Manager
            </h2>
            <p className="text-sm text-slate-500">Sign in with your MurihSpace account.</p>
          </div>

          <div className="space-y-3">
            <button
              type="button"
              disabled={loading}
              onClick={handleContinueWithMurihSpace}
              className="group w-full h-12 rounded-full bg-brand hover:bg-brand-hover text-white font-semibold text-sm shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50 cursor-pointer"
            >
              <span>Continue with MurihSpace</span>
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            </button>

            <button
              type="button"
              disabled={loading}
              onClick={handleLaunchFromMurihSpace}
              className="w-full h-12 rounded-full border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50 cursor-pointer"
            >
              Open from the MurihSpace app
            </button>
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span className="flex-1 h-px bg-slate-200" />
            <span>New here?</span>
            <span className="flex-1 h-px bg-slate-200" />
          </div>

          <a
            href={`${mainAppUrl()}/register`}
            className="block w-full h-12 leading-[3rem] text-center rounded-full border border-brand text-brand dark:text-ads-accent-text font-semibold text-sm hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors"
          >
            Create new account
          </a>

          <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>Encrypted Single Sign-On</span>
          </div>

          <p className="text-center text-[11px] text-slate-400">
            Ads Manager is part of MurihSpace.
          </p>
        </div>
      </section>
    </div>
  );
}
