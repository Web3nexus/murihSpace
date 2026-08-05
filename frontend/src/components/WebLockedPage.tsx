import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Download, Smartphone, LogOut, Loader2, QrCode } from "lucide-react";
import { usePlatformConfig } from "@/hooks/usePlatformConfig";
import { useAuth } from "@/hooks/useAuth";

const ROLE_LABELS: Record<string, string> = {
  member: "Member dashboard",
  creator: "Creator dashboard",
  vendor: "Vendor dashboard",
};

export function AppDownloadQR({ content, size = 176 }: { content: string; size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!canvasRef.current || !content) return;
    QRCode.toCanvas(canvasRef.current, content, {
      width: size,
      margin: 2,
      color: { dark: "#102840", light: "#ffffff" },
    }).catch(() => setFailed(true));
  }, [content, size]);

  if (failed) {
    return (
      <div className="flex items-center justify-center" style={{ width: size, height: size }}>
        <QrCode className="h-10 w-10 text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white p-3 shadow-md border border-border inline-block">
      <canvas ref={canvasRef} width={size} height={size} className="block" />
    </div>
  );
}

interface WebLockedPageProps {
  role?: string;
  embedded?: boolean;
}

export function WebLockedPage({ role, embedded = false }: WebLockedPageProps) {
  const { user, logout, loading } = useAuth();
  const cfg = usePlatformConfig();
  const effectiveRole = role ?? user?.role ?? "member";
  const label = ROLE_LABELS[effectiveRole] ?? "dashboard";

  const content = (
    <div className="w-full max-w-sm mx-auto text-center space-y-5">
      <div className="mx-auto h-16 w-16 rounded-2xl bg-[#2164b6]/10 flex items-center justify-center">
        <Smartphone className="h-8 w-8 text-[#2164b6] dark:text-[#7ab0ff]" />
      </div>

      <div className="space-y-1.5">
        <h1 className="text-lg font-black tracking-tight text-foreground">
          {label} is mobile-only
        </h1>
        <p className="text-xs text-muted-foreground leading-relaxed">
          The {label.toLowerCase()} is only available in the MurihSpace app right now.
          Scan the QR code to download the app, then sign in to continue.
        </p>
      </div>

      {cfg.loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-[#2164b6] dark:text-[#7ab0ff]" />
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex justify-center">
            <AppDownloadQR content={cfg.app_qr_content} />
          </div>
          <a
            href={cfg.app_download_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#2164b6] hover:bg-[#1a5091] text-white text-xs font-bold transition-colors shadow-xs"
          >
            <Download className="h-4 w-4" /> Download the app
          </a>
          <p className="text-[10px] text-muted-foreground">
            Already have the app? Just sign in with the same account.
          </p>
        </div>
      )}
    </div>
  );

  if (embedded) {
    return content;
  }

  return (
    <div className="min-h-screen w-full bg-slate-50/60 dark:bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-card border border-border rounded-3xl shadow-sm p-8">
        {content}
        <div className="mt-6 pt-6 border-t border-border/60 text-center">
          <button
            onClick={() => logout()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogOut className="h-3.5 w-3.5" />}
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
