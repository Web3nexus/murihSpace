import {
  Rocket,
  UserCircle,
  Sparkles,
  Gift,
  Wallet,
  Users,
  ShoppingBag,
  Crown,
  ShieldCheck,
  HelpCircle,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  "getting-started": Rocket,
  account: UserCircle,
  creators: Sparkles,
  gifting: Gift,
  murihpay: Wallet,
  communities: Users,
  store: ShoppingBag,
  subscriptions: Crown,
  security: ShieldCheck,
};

export function categoryIcon(slug: string | null | undefined): LucideIcon {
  return (slug && ICONS[slug]) || HelpCircle;
}