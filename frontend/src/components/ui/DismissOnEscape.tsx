import { useEffect, useRef } from "react";

/**
 * Closes the dialog that renders it when Escape is pressed anywhere on the page.
 * A backdrop's own key handler only sees keys pressed inside it, and focus usually
 * stays on the button that opened the dialog.
 */
export function DismissOnEscape({ onDismiss }: { onDismiss: () => void }) {
  const latest = useRef(onDismiss);

  useEffect(() => {
    latest.current = onDismiss;
  });

  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (e.key === "Escape") latest.current();
    };
    document.addEventListener("keydown", handle);
    return () => document.removeEventListener("keydown", handle);
  }, []);

  return null;
}
