import {
  ShieldAlert,
  UserCheck,
  UserX,
  Users,
  Building2,
  Flag,
  MessageCircle,
  ScrollText,
  ArrowLeftRight,
  Shield,
  ShieldCheck,
  BadgeDollarSign,
  RotateCcw,
  Gift,
  FileText,
  Activity,
  HeartPulse,
  HardDrive,
  Sparkles,
  TrendingUp,
  BarChart3,
  LineChart,
  Settings,
  BookOpen,
  Mail,
  MailOpen,
  MessageSquareText,
  LinkIcon,
  Receipt,
  Wallet,
  KeyRound,
} from "lucide-react";
import type { NavGroup } from "./navTypes";

export const adminNav: NavGroup[] = [
  {
    title: "OVERVIEW",
    items: [
      {
        title: "Dashboard",
        url: "/app/securegate",
        icon: <ShieldAlert className="size-4" />,
      },
    ],
  },
  {
    title: "TRUST & VERIFICATION",
    items: [
      {
        title: "KYC Queue",
        url: "/app/securegate/kyc?status=pending",
        icon: <UserCheck className="size-4" />,
        badge: "Pending",
      },
      {
        title: "Verification Badges",
        url: "/app/securegate/verification-badges",
        icon: <ShieldCheck className="size-4" />,
      },
      {
        title: "Approved Accounts",
        url: "/app/securegate/kyc?status=verified",
        icon: <UserCheck className="size-4" />,
      },
      {
        title: "Rejected Submissions",
        url: "/app/securegate/kyc?status=rejected",
        icon: <UserX className="size-4" />,
      },
    ],
  },
  {
    title: "USERS",
    items: [
      {
        title: "All Users",
        url: "/app/securegate/users",
        icon: <Users className="size-4" />,
      },
      {
        title: "Role Applications",
        url: "/app/securegate/role-applications",
        icon: <UserCheck className="size-4" />,
      },
      {
        title: "Admin Management",
        url: "/app/securegate/admins",
        icon: <ShieldCheck className="size-4" />,
      },
    ],
  },
  {
    title: "CONTENT",
    items: [
      {
        title: "Communities",
        url: "/app/securegate/communities",
        icon: <Building2 className="size-4" />,
      },
      {
        title: "Posts & Reports",
        url: "/app/securegate/reports",
        icon: <Flag className="size-4" />,
      },
      {
        title: "Reviews",
        url: "/app/securegate/reviews",
        icon: <MessageCircle className="size-4" />,
      },
      {
        title: "Moderation Logs",
        url: "/app/securegate/moderation-logs",
        icon: <ScrollText className="size-4" />,
      },
      {
        title: "Stories",
        url: "/app/securegate/stories",
        icon: <BookOpen className="size-4" />,
      },
    ],
  },
  {
    title: "COMMERCE",
    items: [
      {
        title: "Transactions",
        url: "/app/securegate/transactions",
        icon: <ArrowLeftRight className="size-4" />,
      },
      {
        title: "Escrow",
        url: "/app/securegate/escrow",
        icon: <Shield className="size-4" />,
      },
      {
        title: "Payouts",
        url: "/app/securegate/payouts",
        icon: <BadgeDollarSign className="size-4" />,
      },
      {
        title: "Refunds & Disputes",
        url: "/app/securegate/disputes",
        icon: <RotateCcw className="size-4" />,
      },
      {
        title: "Gifts",
        url: "/app/securegate/gifts",
        icon: <Gift className="size-4" />,
      },
      {
        title: "Coin Packs",
        url: "/app/securegate/coin-packs",
        icon: <BadgeDollarSign className="size-4" />,
      },
      {
        title: "Wallet Ledger",
        url: "/app/securegate/reconciliation",
        icon: <Wallet className="size-4" />,
      },
      {
        title: "Platform Fees",
        url: "/app/securegate/fees",
        icon: <Receipt className="size-4" />,
      },
    ],
  },
  {
    title: "PLATFORM",
    items: [
      {
        title: "Feature Flags",
        url: "/app/securegate/feature-flags",
        icon: <Flag className="size-4" />,
      },
      {
        title: "Plans & Fees",
        url: "/app/securegate/plans",
        icon: <FileText className="size-4" />,
      },
      {
        title: "CMS",
        url: "/app/securegate/cms",
        icon: <FileText className="size-4" />,
      },
      {
        title: "Queue Monitor",
        url: "/app/securegate/queue",
        icon: <Activity className="size-4" />,
      },
      {
        title: "System Health",
        url: "/app/securegate/system-health",
        icon: <HeartPulse className="size-4" />,
      },
    ],
  },
  {
    title: "ANALYTICS",
    items: [
      {
        title: "Growth",
        url: "/app/securegate/analytics/growth",
        icon: <TrendingUp className="size-4" />,
      },
      {
        title: "Revenue",
        url: "/app/securegate/analytics/revenue",
        icon: <BarChart3 className="size-4" />,
      },
      {
        title: "Conversions",
        url: "/app/securegate/analytics/conversions",
        icon: <LineChart className="size-4" />,
      },
    ],
  },
  {
    title: "SETTINGS",
    items: [
      {
        title: "Audit Trail",
        url: "/app/securegate/audit-trail",
        icon: <ScrollText className="size-4" />,
      },
      {
        title: "Admin Settings",
        url: "/app/securegate/settings",
        icon: <Settings className="size-4" />,
      },
      {
        title: "AI Providers",
        url: "/app/securegate/ai-settings",
        icon: <Sparkles className="size-4" />,
      },
      {
        title: "Auth Methods",
        url: "/app/securegate/auth-methods",
        icon: <KeyRound className="size-4" />,
      },
      {
        title: "Storage",
        url: "/app/securegate/storage",
        icon: <HardDrive className="size-4" />,
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
        title: "Mail Engine",
        url: "/app/securegate/email-engine",
        icon: <Mail className="size-4" />,
      },
      {
        title: "Email Templates",
        url: "/app/securegate/email-templates",
        icon: <MailOpen className="size-4" />,
      },
      {
        title: "SMS Engine",
        url: "/app/securegate/sms-engine",
        icon: <MessageSquareText className="size-4" />,
      },
      {
        title: "Social Login",
        url: "/app/securegate/social-login",
        icon: <LinkIcon className="size-4" />,
      },
    ],
  },
];
