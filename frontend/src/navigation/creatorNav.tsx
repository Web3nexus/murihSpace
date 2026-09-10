import {
  ChartBar,
  Users,
  LinkSimple,
  UsersThree,
  ChatCircleDots,
  VideoCamera,
  GraduationCap,
  CalendarCheck,
  Megaphone,
  Broadcast,
  Handshake,
  ShoppingBag,
  TrendUp,
  Gift,
  Wallet,
  Gear,
  ShieldCheck,
} from "@phosphor-icons/react";
import type { NavGroup } from "./navTypes";

export const creatorNav: NavGroup[] = [
  {
    title: "",
    items: [
      {
        title: "Insights",
        url: "/app/insights",
        icon: <ChartBar weight="fill" className="h-5 w-5" />,
      },
      {
        title: "Friends",
        url: "/app/friends",
        icon: <Users weight="fill" className="h-5 w-5" />,
        featureFlag: "friends",
      },
      {
        title: "Link in Bio & Site",
        url: "/app/link-in-bio",
        icon: <LinkSimple weight="bold" className="h-5 w-5" />,
        featureFlag: "link_in_bio",
      },
      {
        title: "Community",
        url: "/app/communities",
        icon: <UsersThree weight="fill" className="h-5 w-5" />,
        featureFlag: "community_hub",
      },
      {
        title: "Groups",
        url: "/app/groups",
        icon: <ChatCircleDots weight="fill" className="h-5 w-5" />,
      },
      {
        title: "Live Video & Events",
        url: "/app/events",
        icon: <VideoCamera weight="fill" className="h-5 w-5" />,
        featureFlag: "events",
      },
      {
        title: "Online Courses",
        url: "/app/courses",
        icon: <GraduationCap weight="fill" className="h-5 w-5" />,
        featureFlag: "courses",
      },
      {
        title: "1:1 Consultations & Meetings",
        url: "/app/coaching",
        icon: <CalendarCheck weight="fill" className="h-5 w-5" />,
        featureFlag: "coaching",
      },
      {
        title: "Ads Manager",
        url: "/app/ads",
        icon: <Megaphone weight="fill" className="h-5 w-5" />,
      },
      {
        title: "Marketing",
        url: "/app/marketing",
        icon: <Broadcast weight="fill" className="h-5 w-5" />,
        featureFlag: "email_broadcasts",
      },
      {
        title: "Brand Deals",
        url: "/app/brand-deals",
        icon: <Handshake weight="fill" className="h-5 w-5" />,
        featureFlag: "brand_deals",
      },
      {
        title: "Store Catalog",
        url: "/app/store",
        icon: <ShoppingBag weight="fill" className="h-5 w-5" />,
        featureFlag: "digital_products",
      },
      {
        title: "Affiliate Hub",
        url: "/app/affiliate",
        icon: <TrendUp weight="fill" className="h-5 w-5" />,
        featureFlag: "affiliate",
      },
      {
        title: "Referrals & Rewards",
        url: "/app/referrals",
        icon: <Gift weight="fill" className="h-5 w-5" />,
      },
      {
        title: "MurihPay Wallet",
        url: "/app/wallet",
        icon: <Wallet weight="fill" className="h-5 w-5" />,
        featureFlag: "wallet",
      },
    ],
  },
  {
    title: "Shortcuts",
    items: [
      {
        title: "Settings & Profile",
        url: "/app/settings",
        icon: <Gear weight="fill" className="h-5 w-5" />,
      },
      {
        title: "KYC Verification",
        url: "/app/kyc",
        icon: <ShieldCheck weight="fill" className="h-5 w-5" />,
        featureFlag: "kyc",
      },
    ],
  },
];
