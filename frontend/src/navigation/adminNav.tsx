import {
  ShieldAlert,
  UserCheck,
  UserX,
  Users,
  Building2,
  Flag,
  Star,
  ScrollText,
  ArrowLeftRight,
  Shield,
  BadgeDollarSign,
  RotateCcw,
  FileText,
  Activity,
  HeartPulse,
  TrendingUp,
  BarChart3,
  LineChart,
  Settings,
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
        icon: <Star className="size-4" />,
      },
      {
        title: "Moderation Logs",
        url: "/app/securegate/moderation-logs",
        icon: <ScrollText className="size-4" />,
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
        title: "Fulfilment Payouts",
        url: "/app/securegate/fulfilment-payouts",
        icon: <BadgeDollarSign className="size-4" />,
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
    ],
  },
];
