import React from "react";
import { AlertTriangleIcon } from "lucide-react";

interface FormErrorSummaryProps {
  title?: string;
  errors?: string[] | Record<string, string | string[]>;
  className?: string;
}

export const FormErrorSummary: React.FC<FormErrorSummaryProps> = ({
  title = "Please correct the errors below",
  errors,
  className = "",
}) => {
  if (!errors) return null;

  let errorList: string[] = [];

  if (Array.isArray(errors)) {
    errorList = errors;
  } else if (typeof errors === "object") {
    Object.values(errors).forEach((val) => {
      if (Array.isArray(val)) {
        errorList.push(...val);
      } else if (typeof val === "string") {
        errorList.push(val);
      }
    });
  }

  if (errorList.length === 0) return null;

  return (
    <div
      role="alert"
      tabIndex={-1}
      className={`p-4 rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400 space-y-2 ${className}`}
    >
      <div className="flex items-center gap-2 font-semibold text-sm">
        <AlertTriangleIcon className="h-4 w-4 shrink-0 text-rose-500" />
        <span>{title}</span>
      </div>
      <ul className="list-disc list-inside text-xs space-y-1 pl-1">
        {errorList.map((err, idx) => (
          <li key={idx}>{err}</li>
        ))}
      </ul>
    </div>
  );
};
