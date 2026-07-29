import {
  LayoutDashboard,
  Film,
  Link2,
  Users,
  Radio,
  Package,
  ShoppingCart,
  Crown,
  Star,
  Megaphone,
  Briefcase,
  BarChart3,
  MessageSquare,
  Sparkles,
  Wallet,
  BadgeDollarSign,
  Shield,
  UserCircle,
  ShieldCheck,
  Lock,
  Bell,
} from "lucide-react";
import type { NavGroup } from "./navTypes";

export const creatorNav: NavGroup[] = [
  {
    title: "MAIN",
    items: [
      {
        title: "Dashboard",
        url: "/app",
        icon: <LayoutDashboard className="size-4" />,
      },
    ],
  },
  {
    title: "CREATE",
    items: [
      {
        title: "Content Studio",
        url: "/app/studio",
        icon: <Film className="size-4" />,
      },
      {
        title: "Link in Bio & Site",
        url: "/app/link-in-bio",
        icon: <Link2 className="size-4" />,
        children: [
          { title: "Link in Bio Builder", url: "/app/link-in-bio" },
          { title: "Custom Domain & Site", url: "/app/link-in-bio/domain" },
        ],
      },
      {
        title: "Community",
        url: "/app/communities",
        icon: <Users className="size-4" />,
        children: [
          { title: "My Communities", url: "/app/communities" },
          { title: "Feed & Posts", url: "/app/feed" },
        ],
      },
      {
        title: "Events & Audio Rooms",
        url: "/app/events",
        icon: <Radio className="size-4" />,
      },
    ],
  },
  {
    title: "SELL",
    items: [
      {
        title: "Products",
        url: "/app/store/products",
        icon: <Package className="size-4" />,
        children: [
          { title: "Digital Downloads", url: "/app/store/digital" },
          { title: "Online Courses", url: "/app/store/courses" },
          { title: "1:1 Coaching & Bookings", url: "/app/store/coaching" },
          { title: "Physical Products & Merch", url: "/app/store/physical" },
        ],
      },
      {
        title: "Orders",
        url: "/app/store/orders",
        icon: <ShoppingCart className="size-4" />,
      },
      {
        title: "Memberships",
        url: "/app/store/memberships",
        icon: <Crown className="size-4" />,
        badge: "Hot",
      },
      {
        title: "Reviews & Disputes",
        url: "/app/store/reviews",
        icon: <Star className="size-4" />,
      },
    ],
  },
  {
    title: "GROW",
    items: [
      {
        title: "Marketing",
        url: "/app/marketing",
        icon: <Megaphone className="size-4" />,
        children: [
          { title: "Email Broadcasts", url: "/app/marketing/broadcasts" },
          { title: "Automated Sequences", url: "/app/marketing/sequences" },
          { title: "Affiliate Products", url: "/app/marketing/affiliates" },
          { title: "Referral Program", url: "/app/marketing/referrals" },
        ],
      },
      {
        title: "Brand Deals",
        url: "/app/brand-deals",
        icon: <Briefcase className="size-4" />,
        children: [
          { title: "Creator Media Kit", url: "/app/brand-deals/media-kit" },
          { title: "Outreach & Proposals", url: "/app/brand-deals/proposals" },
          { title: "Brand Invoicing", url: "/app/brand-deals/invoicing" },
        ],
      },
      {
        title: "Analytics",
        url: "/app/analytics",
        icon: <BarChart3 className="size-4" />,
        children: [
          { title: "Link & Traffic Stats", url: "/app/analytics/traffic" },
          { title: "Revenue & Conversions", url: "/app/analytics/revenue" },
          { title: "AI Insights", url: "/app/analytics/ai" },
        ],
      },
    ],
  },
  {
    title: "CONNECT",
    items: [
      {
        title: "MurihSpace Inbox",
        url: "/app/messages",
        icon: <MessageSquare className="size-4" />,
      },
      {
        title: "Community Chat",
        url: "/app/community-chat",
        icon: <Users className="size-4" />,
      },
      {
        title: "AI Assistant",
        url: "/app/ai-assistant",
        icon: <Sparkles className="size-4" />,
      },
    ],
  },
  {
    title: "MONEY",
    items: [
      {
        title: "MurihPay Wallet",
        url: "/app/wallet",
        icon: <Wallet className="size-4" />,
        children: [
          { title: "Wallet Overview", url: "/app/wallet" },
          { title: "Payouts & Earnings", url: "/app/wallet/payouts" },
          { title: "Escrow", url: "/app/wallet/escrow" },
        ],
      },
      {
        title: "Payouts & Earnings",
        url: "/app/wallet/payouts",
        icon: <BadgeDollarSign className="size-4" />,
      },
      {
        title: "Escrow",
        url: "/app/wallet/escrow",
        icon: <Shield className="size-4" />,
      },
    ],
  },
  {
    title: "SETTINGS",
    items: [
      {
        title: "Profile & Identity",
        url: "/app/settings/profile",
        icon: <UserCircle className="size-4" />,
      },
      {
        title: "KYC Verification",
        url: "/app/settings/kyc",
        icon: <ShieldCheck className="size-4" />,
      },
      {
        title: "Security",
        url: "/app/settings/security",
        icon: <Lock className="size-4" />,
      },
      {
        title: "Notifications",
        url: "/app/settings/notifications",
        icon: <Bell className="size-4" />,
      },
    ],
  },
];
