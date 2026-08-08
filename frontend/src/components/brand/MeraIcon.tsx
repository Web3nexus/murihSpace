import { cn } from "@/lib/utils";

export function MeraIcon({ className, alt = "Mera" }: { className?: string; alt?: string }) {
  return <img src="/logos/mera-icon.png" alt={alt} draggable={false} className={cn("h-4 w-4 shrink-0 object-contain", className)} />;
}