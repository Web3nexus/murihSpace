import { useRef, useCallback, type ClipboardEvent, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";

interface OtpInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
  className?: string;
}

export function OtpInput({
  length = 6,
  value,
  onChange,
  disabled = false,
  autoFocus = true,
  className = "",
}: OtpInputProps) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  const setChar = useCallback(
    (index: number, char: string) => {
      const digits = value.split("");
      digits[index] = char;
      onChange(digits.join("").slice(0, length));
    },
    [value, onChange, length]
  );

  const handleChange = (index: number, raw: string) => {
    const cleaned = raw.replace(/\D/g, "");
    if (!cleaned) {
      setChar(index, "");
      return;
    }
    const char = cleaned[cleaned.length - 1];
    setChar(index, char);
    if (index < length - 1) {
      refs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !value[index] && index > 0) {
      setChar(index - 1, "");
      refs.current[index - 1]?.focus();
    }
    if (e.key === "ArrowLeft" && index > 0) {
      refs.current[index - 1]?.focus();
    }
    if (e.key === "ArrowRight" && index < length - 1) {
      refs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    if (!pasted) return;
    onChange(pasted);
    const focusIndex = Math.min(pasted.length, length - 1);
    refs.current[focusIndex]?.focus();
  };

  return (
    <div className={cn("flex items-center justify-between gap-2", className)}>
      {Array.from({ length }).map((_, index) => (
        <input
          key={index}
          ref={(el) => {
            refs.current[index] = el;
          }}
          type="tel"
          inputMode="numeric"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          maxLength={2}
          disabled={disabled}
          autoFocus={autoFocus && index === 0}
          value={value[index] ?? ""}
          onChange={(e) => handleChange(index, e.target.value)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onPaste={handlePaste}
          aria-label={`Code digit ${index + 1}`}
          className="h-14 w-full max-w-14 rounded-xl border border-border bg-card text-center text-xl font-bold text-foreground focus:outline-none focus:border-[#2164b6] focus:ring-2 focus:ring-[#2164b6] transition-all disabled:opacity-50"
        />
      ))}
    </div>
  );
}
