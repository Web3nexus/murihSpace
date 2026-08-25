import {
  LayoutDashboard,
  Package,
  Warehouse,
  Tag,
  Store,
  ShoppingCart,
  Truck,
  Undo2,
  MessageCircle,
  MessageSquare,
  LifeBuoy,
  Users,
  Wallet,
  Receipt,
  BadgeDollarSign,
  Shield,
  TrendingUp,
  BarChart3,
  UserCircle,
  ShieldCheck,
  Settings,
  Lock,
  Bell,
} from "lucide-react";
import type { NavGroup } from "./navTypes";

export const vendorNav: NavGroup[] = [
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
    title: "STORE",
    items: [
      {
        title: "Products",
        url: "/app/store/physical-products",
        icon: <Package className="size-4" />,
        children: [
          { title: "Physical Merchandise", url: "/app/store/physical-products", featureFlag: "physical_products" },
          { title: "Inventory & Stock", url: "/app/store/inventory", featureFlag: "physical_products" },
        ],
      },
      {
        title: "Inventory",
        url: "/app/store/inventory",
        icon: <Warehouse className="size-4" />,
        featureFlag: "physical_products",
      },
      {
        title: "Categories",
        url: "/app/store/categories",
        icon: <Tag className="size-4" />,
        featureFlag: "physical_products",
      },
      {
        title: "Storefront",
        url: "/app/store",
        icon: <Store className="size-4" />,
        featureFlag: "storefront",
      },
    ],
  },
  {
    title: "ORDERS",
    items: [
      {
        title: "Orders",
        url: "/app/store/orders",
        icon: <ShoppingCart className="size-4" />,
        featureFlag: "orders",
      },
      {
        title: "Fulfilment & Shipping",
        url: "/app/store/fulfilment",
        icon: <Truck className="size-4" />,
        featureFlag: "orders",
      },
      {
        title: "Returns",
        url: "/app/store/returns",
        icon: <Undo2 className="size-4" />,
        featureFlag: "orders",
      },
      {
        title: "Reviews & Disputes",
        url: "/app/store/reviews",
        icon: <MessageCircle className="size-4" />,
        featureFlag: "moderation",
      },
    ],
  },
  {
    title: "CUSTOMERS",
    items: [
      {
        title: "MurihSpace Inbox",
        url: "/app/messages",
        icon: <MessageSquare className="size-4" />,
        featureFlag: "inbox",
      },
      {
        title: "Support Threads",
        url: "/app/messages/support",
        icon: <LifeBuoy className="size-4" />,
      },
      {
        title: "Community Chat",
        url: "/app/community-chat",
        icon: <Users className="size-4" />,
        featureFlag: "community_chat",
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
          { title: "Sales & Receipts", url: "/app/wallet/sales" },
          { title: "Payouts", url: "/app/wallet/payouts", featureFlag: "payouts" },
          { title: "Escrow", url: "/app/wallet/escrow", featureFlag: "escrow" },
        ],
      },
      {
        title: "Sales & Receipts",
        url: "/app/wallet/sales",
        icon: <Receipt className="size-4" />,
      },
      {
        title: "Payouts",
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
    ],
  },
  {
    title: "INSIGHTS",
    items: [
      {
        title: "Sales Analytics",
        url: "/app/analytics/revenue",
        icon: <TrendingUp className="size-4" />,
        featureFlag: "analytics",
      },
      {
        title: "Product Performance",
        url: "/app/analytics/products",
        icon: <BarChart3 className="size-4" />,
        featureFlag: "analytics",
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
        title: "Store Settings",
        url: "/app/settings/store",
        icon: <Settings className="size-4" />,
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
