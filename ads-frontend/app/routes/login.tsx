import { useState } from "react";
import { ArrowRight, ShieldCheck, Sparkles } from "lucide-react";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);

  const handleMurihSpaceLogin = () => {
    setLoading(true);
    const murihAppUrl = import.meta.env.VITE_MURIHSPACE_APP_URL || "http://localhost:5173";
    // Direct redirect to MurihSpace Ads SSO launchpad
    window.location.href = `${murihAppUrl}/app/ads?launch_studio=true`;
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
      <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-8 space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 mx-auto rounded-3xl bg-gradient-to-tr from-[#2164b6] to-blue-500 text-white flex items-center justify-center font-black text-2xl shadow-lg shadow-blue-500/20">
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
            <Sparkles className="w-4 h-4 text-[#2164b6]" />
            <span>Automatic Creator & Vendor Account Sync</span>
          </div>
          <p className="text-[11px] text-blue-800/80 dark:text-blue-300/70 leading-relaxed">
            Your products, creator profile, and ad budget sync seamlessly with your MurihSpace account.
          </p>
        </div>

        {/* Primary CTA: Login with MurihSpace */}
        <div className="space-y-3 pt-2">
          <button
            type="button"
            disabled={loading}
            onClick={handleMurihSpaceLogin}
            className="w-full h-12 rounded-xl bg-[#2164b6] hover:bg-[#1a5091] text-white font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2.5 active:scale-[0.98] disabled:opacity-50 cursor-pointer"
          >
            <span>Log in with MurihSpace</span>
            <ArrowRight className="w-4 h-4" />
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
              href="http://localhost:5173/register"
              className="text-[#2164b6] font-semibold hover:underline"
            >
              Sign up on MurihSpace
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

