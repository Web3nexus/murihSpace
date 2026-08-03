import React from "react";
import { CheckCircle2Icon, InfoIcon, XIcon } from "lucide-react";

interface SuccessBannerProps {
  title?: string;
  message: string;
  onClose?: () => void;
  className?: string;
}

export const SuccessBanner: React.FC<SuccessBannerProps> = ({
  title,
  message,
  onClose,
  className = "",
}) => {
  return (
    <div
      role="status"
      className={`p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 flex items-start justify-between gap-3 ${className}`}
    >
      <div className="flex items-start gap-3">
        <CheckCircle2Icon className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
        <div>
          {title && <h4 className="font-semibold text-sm">{title}</h4>}
          <p className="text-xs mt-0.5">{message}</p>
        </div>
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className="text-emerald-600 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-200"
        >
          <XIcon className="h-4 w-4" />
        </button>
      )}
    </div>
  );
};

interface SystemNoticeProps {
  title?: string;
  message: string;
  type?: "info" | "warning";
  className?: string;
}

export const SystemNotice: React.FC<SystemNoticeProps> = ({
  title,
  message,
  type = "info",
  className = "",
}) => {
  const isWarning = type === "warning";

  return (
    <div
      role="region"
      className={`p-4 rounded-xl border flex items-start gap-3 ${
        isWarning
          ? "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300"
          : "border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-300"
      } ${className}`}
    >
      <InfoIcon
        className={`h-5 w-5 shrink-0 mt-0.5 ${
          isWarning ? "text-amber-500" : "text-sky-500"
        }`}
      />
      <div>
        {title && <h4 className="font-semibold text-sm">{title}</h4>}
        <p className="text-xs mt-0.5">{message}</p>
      </div>
    </div>
  );
};
