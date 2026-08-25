import type React from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface ActionTooltipProps {
  content: string;
  children: React.ReactElement;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
}

export function ActionTooltip({ content, children, side = "top", align = "center" }: ActionTooltipProps) {
  if (!content) return children;
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent side={side} align={align} className="bg-card text-foreground border border-border shadow-md text-xs font-bold px-2.5 py-1 z-50">
          {content}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
