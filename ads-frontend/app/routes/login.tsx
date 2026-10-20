import { useState } from "react";
import { ArrowRight, ShieldCheck, Sparkles } from "lucide-react";
import { mainAppUrl } from "../lib/ads-api";
import { SSO_AUTHORIZE_PATH, createSsoState } from "../lib/murihspace-sso";

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
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
      <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-8 space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 mx-auto rounded-3xl bg-gradient-to-tr from-brand to-blue-500 text-white flex items-center justify-center font-black text-2xl shadow-lg shadow-blue-500/20">
            M
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-slate-100">
            MurihSpace Ads Manager
          </h1>
          <p className="text-xs text-slate-500">
            Grow your creator brand, store products, and communities with precision targeting.
          </p>
        </div>

        {/* Feature Highlights */}
        <div className="p-4 rounded-2xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40 space-y-2 text-left">
          <div className="flex items-center gap-2 text-xs font-semibold text-blue-950 dark:text-blue-200">
            <Sparkles className="w-4 h-4 text-brand" />
            <span>Automatic Creator & Vendor Account Sync</span>
          </div>
          <p className="text-[11px] text-blue-800/80 dark:text-blue-300/70 leading-relaxed">
            Your products, creator profile, and ad budget sync seamlessly with your MurihSpace account.
          </p>
        </div>

        {/* Primary CTA: Continue with MurihSpace */}
        <div className="space-y-3 pt-2">
          <button
            type="button"
            disabled={loading}
            onClick={handleContinueWithMurihSpace}
            className="w-full h-12 rounded-xl bg-brand hover:bg-brand-hover text-white font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2.5 active:scale-[0.98] disabled:opacity-50 cursor-pointer"
          >
            <span>Continue with MurihSpace</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={handleLaunchFromMurihSpace}
            className="w-full h-10 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50 cursor-pointer"
          >
            Open from the MurihSpace app
          </button>

          <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>Encrypted Single Sign-On</span>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 text-center">
          <p className="text-[11px] text-slate-400">
            Need an account?{" "}
            <a
              href={`${mainAppUrl()}/register`}
              className="text-brand dark:text-ads-accent-text font-semibold hover:underline"
            >
              Sign up on MurihSpace
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
