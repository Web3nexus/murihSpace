import { cn } from "@/lib/utils";

export interface BrandPreloaderProps {
  fullScreen?: boolean;
  size?: "sm" | "md" | "lg";
  message?: string;
  showBar?: boolean;
  className?: string;
}

export function BrandPreloader({
  fullScreen = false,
  size = "md",
  message,
  showBar = true,
  className,
}: BrandPreloaderProps) {
  const sizeMap = {
    sm: { img: "w-10 h-10", bar: "w-20 h-1" },
    md: { img: "w-16 h-16 sm:w-18 sm:h-18", bar: "w-28 h-1" },
    lg: { img: "w-20 h-20 sm:w-24 sm:h-24", bar: "w-36 h-1.5" },
  };

  const selectedSize = sizeMap[size];

  const content = (
    <div className="flex flex-col items-center justify-center gap-4 select-none">
      {/* Brand Icon with glowing pulse animation */}
      <div className="relative flex items-center justify-center">
        {/* Soft background aura glow */}
        <div className="absolute inset-0 rounded-full bg-[#2164b6]/20 blur-xl animate-pulse" />

        {/* Light Mode Icon */}
        <img
          src="/logos/member-icon-light.png"
          alt="MurihSpace"
          className={cn(
            "object-contain relative z-10 dark:hidden animate-murih-breathe drop-shadow-sm",
            selectedSize.img
          )}
          draggable={false}
        />

        {/* Dark Mode Icon */}
        <img
          src="/logos/member-icon-dark.png"
          alt="MurihSpace"
          className={cn(
            "object-contain relative z-10 hidden dark:block animate-murih-breathe drop-shadow-sm",
            selectedSize.img
          )}
          draggable={false}
        />
      </div>

      {/* Shimmering Progress Bar */}
      {showBar && (
        <div
          className={cn(
            "rounded-full bg-black/10 dark:bg-white/15 overflow-hidden relative",
            selectedSize.bar
          )}
        >
          <div className="absolute inset-y-0 left-0 w-1/2 bg-[#2164b6] rounded-full animate-murih-shimmer" />
        </div>
      )}

      {/* Optional subtle message */}
      {message && (
        <p className="text-xs font-semibold text-muted-foreground animate-pulse tracking-wide">
          {message}
        </p>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div
        className={cn(
          "fixed inset-0 z-[99999] flex items-center justify-center bg-background/95 backdrop-blur-sm transition-opacity duration-300",
          className
        )}
        role="status"
        aria-label="Loading MurihSpace"
      >
        {content}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center justify-center w-full py-16 min-h-[30vh]",
        className
      )}
      role="status"
      aria-label="Loading"
    >
      {content}
    </div>
  );
}

