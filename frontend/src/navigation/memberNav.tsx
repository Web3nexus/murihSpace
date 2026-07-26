import {
  LayoutDashboard,
  Compass,
  Users,
  Rss,
  Calendar,
  Crown,
  BookOpen,
  MapPin,
  Star,
  MessageSquare,
  Wallet,
  Heart,
  Shield,
  UserCircle,
  ShieldCheck,
  Lock,
  Bell,
} from "lucide-react";
import type { NavGroup } from "./navTypes";

export const memberNav: NavGroup[] = [
  {
    title: "MAIN",
    items: [
      {
        title: "Home",
        url: "/app",
        icon: <LayoutDashboard className="size-4" />,
      },
      {
        title: "Discover",
        url: "/app/discover",
        icon: <Compass className="size-4" />,
      },
    ],
  },
  {
    title: "COMMUNITY",
    items: [
      {
        title: "My Communities",
        url: "/app/communities",
        icon: <Users className="size-4" />,
        children: [
          { title: "All Communities", url: "/app/communities" },
          { title: "Feed", url: "/app/feed" },
          { title: "Events & Audio Rooms", url: "/app/events" },
        ],
      },
      {
        title: "Feed",
        url: "/app/feed",
        icon: <Rss className="size-4" />,
      },
      {
        title: "Events & Audio Rooms",
        url: "/app/events",
        icon: <Calendar className="size-4" />,
      },
    ],
  },
  {
    title: "SUBSCRIPTIONS",
    items: [
      {
        title: "Discover Plans",
        url: "/app/subscriptions/discover",
        icon: <Crown className="size-4" />,
      },
      {
        title: "My Subscriptions",
        url: "/app/subscriptions/my-subscriptions",
        icon: <Crown className="size-4" />,
      },
    ],
  },
  {
    title: "PURCHASES",
    items: [
      {
        title: "Purchase Library",
        url: "/app/wallet/purchase-library",
        icon: <BookOpen className="size-4" />,
      },
      {
        title: "Saved Addresses",
        url: "/app/store/saved-addresses",
        icon: <MapPin className="size-4" />,
      },
      {
        title: "Reviews & Disputes",
        url: "/app/store/reviews",
        icon: <Star className="size-4" />,
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
          { title: "Tips & Donations", url: "/app/wallet/tips" },
          { title: "Escrow", url: "/app/wallet/escrow" },
        ],
      },
      {
        title: "Tips & Donations",
        url: "/app/wallet/tips",
        icon: <Heart className="size-4" />,
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
