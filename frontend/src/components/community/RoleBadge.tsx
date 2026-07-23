import { Badge } from "@/components/ui/badge";
import { Crown, Shield, ShieldAlert, UserCheck, Sparkles } from "lucide-react";

interface RoleBadgeProps {
  role?: string;
  isOwner?: boolean;
  color?: string;
  className?: string;
}

export function RoleBadge({ role = "member", isOwner = false, color, className = "" }: RoleBadgeProps) {
  const normalizedRole = isOwner ? "owner" : role.toLowerCase();

  if (normalizedRole === "owner") {
    return (
      <Badge
        className={`bg-[#102840] text-white border-transparent gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md shadow-2xs ${className}`}
      >
        <Crown className="h-3 w-3 text-amber-400 fill-amber-400" />
        <span>Owner</span>
      </Badge>
    );
  }

  if (normalizedRole === "admin" || normalizedRole === "administrator") {
    return (
      <Badge
        className={`bg-[#38A8D8] text-white border-transparent gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md shadow-2xs ${className}`}
      >
        <ShieldAlert className="h-3 w-3" />
        <span>Admin</span>
      </Badge>
    );
  }

  if (normalizedRole === "moderator") {
    return (
      <Badge
        className={`bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md ${className}`}
      >
        <Shield className="h-3 w-3" />
        <span>Moderator</span>
      </Badge>
    );
  }

  if (color) {
    return (
      <Badge
        style={{ backgroundColor: `${color}20`, color: color, borderColor: `${color}40` }}
        className={`gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md border ${className}`}
      >
        <Sparkles className="h-3 w-3" />
        <span className="capitalize">{role}</span>
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className={`text-muted-foreground text-[10.5px] font-medium px-2 py-0.5 ${className}`}>
      <UserCheck className="h-3 w-3 text-muted-foreground/60" />
      <span className="capitalize">{role}</span>
    </Badge>
  );
}
