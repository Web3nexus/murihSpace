import {
  ShieldWarning as ShieldWarning,
  UserCheck as UserCheck,
  UserMinus as UserMinus,
  Users as Users,
  Buildings as Building2,
  Flag as Flag,
  ChatCircle as MessageCircle,
  Scroll as Scroll,
  ArrowsLeftRight as ArrowsLeftRight,
  Shield as Shield,
  ShieldCheck as ShieldCheck,
  CurrencyDollar as CurrencyDollar,
  ArrowCounterClockwise as RotateCcw,
  Gift as Gift,
  FileText as FileText,
  Waveform as Activity,
  Heartbeat as Heartbeat,
  HardDrive as HardDrive,
  TrendUp as TrendingUp,
  ChartBar as BarChart3,
  ChartLineUp as ChartLineUp,
  Gear as Settings,
  BookOpen as BookOpen,
  Envelope as Envelope,
  EnvelopeOpen as EnvelopeOpen,
  ChatText as ChatText,
  Link as LinkIcon,
  Receipt as Receipt,
  Wallet as Wallet,
  Key as Key,
  CreditCard as CreditCard
} from "@phosphor-icons/react";
import type { NavGroup } from "./navTypes";
import { MeraIcon } from "@/components/brand/MeraIcon";

export const adminNav: NavGroup[] = [
  {
    title: "OVERVIEW",
    items: [
      {
        title: "Dashboard",
        url: "/app/securegate",
        icon: <ShieldWarning weight="fill" className="size-4" />,
      },
    ],
  },
  {
    title: "TRUST & VERIFICATION",
    items: [
      {
        title: "KYC Queue",
        url: "/app/securegate/kyc?status=pending",
        icon: <UserCheck weight="fill" className="size-4" />,
      },
      {
        title: "Verification Badges",
        url: "/app/securegate/verification-badges",
        icon: <ShieldCheck weight="fill" className="size-4" />,
      },
      {
        title: "Approved Accounts",
        url: "/app/securegate/kyc?status=verified",
        icon: <UserCheck weight="fill" className="size-4" />,
      },
      {
        title: "Rejected Submissions",
        url: "/app/securegate/kyc?status=rejected",
        icon: <UserMinus weight="fill" className="size-4" />,
      },
    ],
  },
  {
    title: "USERS",
    items: [
      {
        title: "All Users",
        url: "/app/securegate/users",
        icon: <Users weight="fill" className="size-4" />,
      },
      {
        title: "Role Applications",
        url: "/app/securegate/role-applications",
        icon: <UserCheck weight="fill" className="size-4" />,
      },
      {
        title: "Admin Management",
        url: "/app/securegate/admins",
        icon: <ShieldCheck weight="fill" className="size-4" />,
      },
    ],
  },
  {
    title: "CONTENT",
    items: [
      {
        title: "Communities",
        url: "/app/securegate/communities",
        icon: <Building2 weight="fill" className="size-4" />,
      },
      {
        title: "Posts & Reports",
        url: "/app/securegate/reports",
        icon: <Flag weight="fill" className="size-4" />,
      },
      {
        title: "Reviews",
        url: "/app/securegate/reviews",
        icon: <MessageCircle weight="fill" className="size-4" />,
      },
      {
        title: "Moderation Logs",
        url: "/app/securegate/moderation-logs",
        icon: <Scroll weight="fill" className="size-4" />,
      },
      {
        title: "Stories",
        url: "/app/securegate/stories",
        icon: <BookOpen weight="fill" className="size-4" />,
      },
    ],
  },
  {
    title: "COMMERCE",
    items: [
      {
        title: "Payment Gateways",
        url: "/app/securegate/payment-providers",
        icon: <CreditCard weight="fill" className="size-4" />,
      },
      {
        title: "Transactions",
        url: "/app/securegate/transactions",
        icon: <ArrowsLeftRight weight="fill" className="size-4" />,
      },
      {
        title: "Escrow",
        url: "/app/securegate/escrow",
        icon: <Shield weight="fill" className="size-4" />,
      },
      {
        title: "Payouts",
        url: "/app/securegate/payouts",
        icon: <CurrencyDollar weight="fill" className="size-4" />,
      },
      {
        title: "Refunds & Disputes",
        url: "/app/securegate/disputes",
        icon: <RotateCcw weight="fill" className="size-4" />,
      },
      {
        title: "Gifts",
        url: "/app/securegate/gifts",
        icon: <Gift weight="fill" className="size-4" />,
      },
      {
        title: "Coin Packs",
        url: "/app/securegate/coin-packs",
        icon: <CurrencyDollar weight="fill" className="size-4" />,
      },
      {
        title: "Wallet Ledger",
        url: "/app/securegate/reconciliation",
        icon: <Wallet weight="fill" className="size-4" />,
      },
      {
        title: "Platform Fees",
        url: "/app/securegate/fees",
        icon: <Receipt weight="fill" className="size-4" />,
      },
    ],
  },
  {
    title: "ACCOUNTING & TAX",
    items: [
      {
        title: "Revenue & Tax Hub",
        url: "/app/securegate/accounting",
        icon: <Receipt weight="fill" className="size-4" />,
      },
    ],
  },
  {
    title: "PLATFORM",
    items: [
      {
        title: "Feature Flags",
        url: "/app/securegate/feature-flags",
        icon: <Flag weight="fill" className="size-4" />,
      },
      {
        title: "Plans & Fees",
        url: "/app/securegate/plans",
        icon: <FileText weight="fill" className="size-4" />,
      },
      {
        title: "CMS",
        url: "/app/securegate/cms",
        icon: <FileText weight="fill" className="size-4" />,
      },
      {
        title: "Queue Monitor",
        url: "/app/securegate/queue",
        icon: <Activity weight="fill" className="size-4" />,
      },
      {
        title: "System Health",
        url: "/app/securegate/system-health",
        icon: <Heartbeat weight="fill" className="size-4" />,
      },
    ],
  },
  {
    title: "ANALYTICS",
    items: [
      {
        title: "Growth",
        url: "/app/securegate/analytics/growth",
        icon: <TrendingUp weight="fill" className="size-4" />,
      },
      {
        title: "Revenue",
        url: "/app/securegate/analytics/revenue",
        icon: <BarChart3 weight="fill" className="size-4" />,
      },
      {
        title: "Conversions",
        url: "/app/securegate/analytics/conversions",
        icon: <ChartLineUp weight="fill" className="size-4" />,
      },
    ],
  },
  {
    title: "SETTINGS",
    items: [
      {
        title: "Audit Trail",
        url: "/app/securegate/audit-trail",
        icon: <Scroll weight="fill" className="size-4" />,
      },
      {
        title: "Admin Settings",
        url: "/app/securegate/settings",
        icon: <Settings weight="fill" className="size-4" />,
      },
      {
        title: "AI Providers",
        url: "/app/securegate/ai-settings",
        icon: <MeraIcon className="size-4" />,
      },
      {
        title: "Auth Methods",
        url: "/app/securegate/auth-methods",
        icon: <Key weight="fill" className="size-4" />,
      },
      {
        title: "Storage",
        url: "/app/securegate/storage",
        icon: <HardDrive weight="fill" className="size-4" />,
        children: [
          { title: "Routing Rules", url: "/app/securegate/storage" },
          { title: "Object Storage Providers", url: "/app/securegate/storage/providers" },
        ],
      },
    ],
  },
  {
    title: "EMAIL",
    items: [
      {
        title: "Envelope Engine",
        url: "/app/securegate/email-engine",
        icon: <Envelope weight="fill" className="size-4" />,
      },
      {
        title: "Email Templates",
        url: "/app/securegate/email-templates",
        icon: <EnvelopeOpen weight="fill" className="size-4" />,
      },
      {
        title: "SMS Engine",
        url: "/app/securegate/sms-engine",
        icon: <ChatText weight="fill" className="size-4" />,
      },
      {
        title: "Social Login",
        url: "/app/securegate/social-login",
        icon: <LinkIcon weight="fill" className="size-4" />,
      },
    ],
  },
];
