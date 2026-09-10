import * as React from "react";
import {
  X as X,
  DeviceMobile as Smartphone
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";

interface OpenInAppBannerProps {
  scheme: string;
  title?: string;
  subtitle?: string;
}

export function OpenInAppBanner({
  scheme,
  title = "Open in MurihSpace App",
  subtitle = "Experience full features, live chat, and audio rooms in the app",
}: OpenInAppBannerProps) {
  const [isMobile, setIsMobile] = React.useState(false);
  const [isDismissed, setIsDismissed] = React.useState(true);

  React.useEffect(() => {
    // Only show on actual mobile devices (iOS / Android)
    const ua = navigator.userAgent || "";
    const mobileMatch = /Android|iPhone|iPad|iPod/i.test(ua);
    const dismissed = sessionStorage.getItem("murihspace_dismiss_app_banner") === "1";

    setIsMobile(mobileMatch);
    setIsDismissed(dismissed);
  }, []);

  if (!isMobile || isDismissed) {
    return null;
  }

  const handleOpenApp = () => {
    // Attempt to open deep link scheme
    window.location.href = scheme;
  };

  const handleDismiss = () => {
    sessionStorage.setItem("murihspace_dismiss_app_banner", "1");
    setIsDismissed(true);
  };

  return (
    <div className="relative z-50 bg-gradient-to-r from-[#102840] via-[#173852] to-[#2164b6] text-white px-4 py-2.5  flex items-center justify-between gap-3 border-b border-white/10">
      <div className="flex items-center gap-3 min-w-0">
        <div className="h-9 w-9 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center shrink-0 shadow-inner">
          <Smartphone weight="fill" className="h-5 w-5 text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-bold text-white truncate leading-tight">{title}</p>
          <p className="text-[11px] text-white/75 truncate leading-tight mt-0.5">{subtitle}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <Button
          size="sm"
          onClick={handleOpenApp}
          className="h-7 px-3 text-xs font-bold bg-white text-[#102840] hover:bg-white/90  rounded-lg"
        >
          Open App
        </Button>
        <button
          onClick={handleDismiss}
          className="p-1 rounded-md text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          aria-label="Dismiss banner"
        >
          <X weight="fill" className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
