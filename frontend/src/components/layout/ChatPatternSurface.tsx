import React from "react";
import chatPatternDesktop from "@/assets/chat-pattern-desktop.png";

/**
 * WhatsApp-style doodle backdrop for the desktop chat surface.
 *
 * The wrapper deliberately does *not* scroll, so the pattern stays pinned while
 * the message list inside it scrolls. Styling lives in `styles/chat.css`: the
 * artwork is used as an alpha mask over a solid ink colour, which lets one
 * light-blue asset serve both the light and dark themes, and it is gated behind
 * the `lg` breakpoint because the artwork is a 1920x1080 desktop composition.
 */
export function ChatPatternSurface({
  className = "",
  style,
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...rest}
      className={`chat-pattern relative flex-1 min-h-0 ${className}`.trim()}
      style={
        {
          "--chat-pattern-image": `url(${chatPatternDesktop})`,
          ...style,
        } as React.CSSProperties
      }
    >
      {children}
    </div>
  );
}
