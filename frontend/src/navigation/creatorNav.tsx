import {
  LayoutDashboard,
  Link2,
  Users,
  Radio,
  Package,
  Megaphone,
  Briefcase,
  BarChart3,
  MessageSquare,
  Bot,
  Wallet,
  BadgeDollarSign,
  Shield,
  Gift,
  UserCircle,
  ShieldCheck,
  Lock,
  Bell,
  UserPlus,
  Film,
  Sparkles,
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
        title: "Requests",
        url: "/app/requests",
        icon: <UserPlus className="size-4" />,
      },
      {
        title: "Content Studio",
        url: "/app/studio",
        icon: <Film className="size-4" />,
        featureFlag: "content_studio",
      },
      {
        title: "Friends",
        url: "/app/friends",
        icon: <UserCircle className="size-4" />,
      },
      {
        title: "Link in Bio & Site",
        url: "/app/link-in-bio",
        icon: <Link2 className="size-4" />,
        featureFlag: "link_in_bio",
        children: [
          { title: "Link in Bio Builder", url: "/app/link-in-bio" },
          { title: "Custom Domain & Site", url: "/app/link-in-bio/domain" },
        ],
      },
      {
        title: "Community",
        url: "/app/communities",
        icon: <Users className="size-4" />,
        featureFlag: "community_hub",
        children: [
          { title: "My Communities", url: "/app/communities" },
          { title: "Feed & Posts", url: "/app/feed", featureFlag: "community_feed" },
        ],
      },
      {
        title: "Events & Audio Rooms",
        url: "/app/events",
        icon: <Radio className="size-4" />,
        featureFlag: "events",
        children: [
          { title: "Events", url: "/app/events" },
          { title: "My Events", url: "/app/my-events" },
          { title: "Audio Rooms", url: "/app/audio-rooms", featureFlag: "audio_rooms" },
        ],
      },
    ],
  },
  {
    title: "LEARN & TEACH",
    items: [
      {
        title: "Online Courses",
        url: "/app/store/courses",
        icon: <Package className="size-4" />,
        featureFlag: "online_courses",
        children: [
          { title: "My Courses", url: "/app/store/courses" },
          { title: "Course Analytics", url: "/app/store/courses/analytics", featureFlag: "analytics" },
        ],
      },
      {
        title: "1:1 Coaching & Bookings",
        url: "/app/store/coaching",
        icon: <Briefcase className="size-4" />,
        featureFlag: "coaching",
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
          { title: "Email Broadcasts", url: "/app/marketing/broadcasts", featureFlag: "email_broadcasts" },
          { title: "Automated Sequences", url: "/app/marketing/sequences", featureFlag: "email_sequences" },
          { title: "Affiliate Products", url: "/app/marketing/affiliates", featureFlag: "affiliates" },
          { title: "Referral Program", url: "/app/marketing/referrals", featureFlag: "referrals" },
        ],
      },
      {
        title: "Brand Deals",
        url: "/app/brand-deals",
        icon: <Briefcase className="size-4" />,
        featureFlag: "brand_deals",
        children: [
          { title: "Creator Media Kit", url: "/app/brand-deals/media-kit", featureFlag: "media_kit" },
          { title: "Outreach & Proposals", url: "/app/brand-deals/proposals" },
          { title: "Brand Invoicing", url: "/app/brand-deals/invoicing" },
        ],
      },
      {
        title: "Analytics",
        url: "/app/analytics",
        icon: <BarChart3 className="size-4" />,
        featureFlag: "analytics",
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
        featureFlag: "inbox",
      },
      {
        title: "Community Chat",
        url: "/app/community-chat",
        icon: <Users className="size-4" />,
        featureFlag: "community_chat",
      },
      {
        title: "AI Assistant",
        url: "/app/ai-assistant",
        icon: <Bot className="size-4" />,
        featureFlag: "ai_assistant",
      },
      {
        title: "Mera's Behavior",
        url: "/app/ai-settings",
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
        featureFlag: "wallet",
        children: [
          { title: "Wallet Overview", url: "/app/wallet" },
          { title: "Payouts & Earnings", url: "/app/wallet/payouts", featureFlag: "payouts" },
          { title: "Escrow", url: "/app/wallet/escrow", featureFlag: "escrow" },
        ],
      },
      {
        title: "Payouts & Earnings",
        url: "/app/wallet/payouts",
        icon: <BadgeDollarSign className="size-4" />,
        featureFlag: "payouts",
      },
      {
        title: "Escrow",
        url: "/app/wallet/escrow",
        icon: <Shield className="size-4" />,
        featureFlag: "escrow",
      },
      {
        title: "Gifts",
        url: "/app/gifts",
        icon: <Gift className="size-4" />,
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
        url: "/app/kyc",
        icon: <ShieldCheck className="size-4" />,
        featureFlag: "kyc",
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
