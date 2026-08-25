import {
  LayoutDashboard,
  Users,
  Video,
  Sparkles,
  Link2,
  GraduationCap,
  CalendarCheck,
  Megaphone,
  Handshake,
  DollarSign,
  TrendingUp,
  Award,
  Wallet,
  Settings,
  ShieldCheck,
  Package,
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
        icon: <Sparkles className="size-4" />,
        featureFlag: "creator_requests",
      },
      {
        title: "Friends",
        url: "/app/friends",
        icon: <Users className="size-4" />,
        featureFlag: "friends",
        children: [
          { title: "My Friends", url: "/app/friends" },
          { title: "Friend Requests", url: "/app/requests/friends" },
          { title: "Find Friends", url: "/app/friends/find" },
        ],
      },
      {
        title: "Link in Bio & Site",
        url: "/app/link-in-bio",
        icon: <Link2 className="size-4" />,
        featureFlag: "link_in_bio",
        children: [
          { title: "Bio Page Editor", url: "/app/link-in-bio" },
          { title: "Custom Domain", url: "/app/link-in-bio/domain" },
          { title: "Appearance & Theme", url: "/app/link-in-bio/theme" },
          { title: "Analytics", url: "/app/link-in-bio/analytics" },
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
        title: "Live Video & Events",
        url: "/app/events",
        icon: <Video className="size-4" />,
        featureFlag: "events",
        children: [
          { title: "Live Video Studio", url: "/app/audio-rooms", featureFlag: "audio_rooms" },
          { title: "Events", url: "/app/events" },
          { title: "My Events", url: "/app/my-events" },
        ],
      },
    ],
  },
  {
    title: "LEARN & TEACH",
    items: [
      {
        title: "Online Courses",
        url: "/app/courses",
        icon: <GraduationCap className="size-4" />,
        featureFlag: "courses",
        children: [
          { title: "Browse Courses", url: "/app/courses" },
          { title: "My Enrolled Courses", url: "/app/courses/my" },
          { title: "Course Studio (Creator)", url: "/app/courses/studio", featureFlag: "courses" },
        ],
      },
      {
        title: "1:1 Coaching & Bookings",
        url: "/app/coaching",
        icon: <CalendarCheck className="size-4" />,
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
        featureFlag: "email_broadcasts",
        children: [
          { title: "Overview", url: "/app/marketing" },
          { title: "Email Broadcasts", url: "/app/marketing/broadcasts" },
          { title: "Automated Sequences", url: "/app/marketing/sequences" },
          { title: "Ad Campaigns", url: "/app/marketing/ads", featureFlag: "ad_campaigns" },
        ],
      },
      {
        title: "Brand Deals",
        url: "/app/brand-deals",
        icon: <Handshake className="size-4" />,
        featureFlag: "brand_deals",
        children: [
          { title: "Marketplace", url: "/app/brand-deals" },
          { title: "Active Proposals", url: "/app/brand-deals/proposals" },
          { title: "Media Kit", url: "/app/brand-deals/media-kit" },
          { title: "Brand Invoices", url: "/app/brand-deals/invoices" },
        ],
      },
    ],
  },
  {
    title: "MONETIZE",
    items: [
      {
        title: "Store Catalog",
        url: "/app/store/digital",
        icon: <Package className="size-4" />,
        featureFlag: "digital_products",
        children: [
          { title: "Digital Products", url: "/app/store/digital" },
          { title: "Store Overview", url: "/app/store" },
        ],
      },
      {
        title: "Memberships",
        url: "/app/store/memberships",
        icon: <DollarSign className="size-4" />,
        featureFlag: "memberships",
      },
      {
        title: "Affiliate Hub",
        url: "/app/affiliate",
        icon: <TrendingUp className="size-4" />,
        featureFlag: "affiliate",
      },
      {
        title: "Referrals & Rewards",
        url: "/app/referrals",
        icon: <Award className="size-4" />,
      },
      {
        title: "MurihPay Wallet",
        url: "/app/wallet",
        icon: <Wallet className="size-4" />,
        featureFlag: "wallet",
      },
    ],
  },
  {
    title: "SETTINGS",
    items: [
      {
        title: "Settings & Profile",
        url: "/app/settings",
        icon: <Settings className="size-4" />,
      },
      {
        title: "KYC Verification",
        url: "/app/kyc",
        icon: <ShieldCheck className="size-4" />,
        featureFlag: "kyc",
      },
    ],
  },
];
