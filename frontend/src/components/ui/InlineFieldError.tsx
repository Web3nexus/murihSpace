import React from "react";
import { AlertCircleIcon } from "lucide-react";

interface InlineFieldErrorProps {
  id?: string;
  error?: string | null;
  className?: string;
}

export const InlineFieldError: React.FC<InlineFieldErrorProps> = ({
  id,
  error,
  className = "",
}) => {
  if (!error) return null;

  return (
    <div
      id={id}
      role="alert"
      aria-live="polite"
      className={`flex items-center gap-1.5 text-xs text-rose-500 font-medium mt-1 animate-in fade-in slide-in-from-top-1 ${className}`}
    >
      <AlertCircleIcon className="h-3.5 w-3.5 shrink-0" />
      <span>{error}</span>
    </div>
  );
};
