import {
  Package,
  Warehouse,
  Tag,
  Storefront,
  ShoppingCart,
  Truck,
  ArrowUUpLeft,
  ChatCircle,
  ChatTeardropText,
  Wallet,
  Receipt,
  CurrencyDollar,
  TrendUp,
  Megaphone,
  UserCircle,
  ShieldCheck,
  Gear,
} from "@phosphor-icons/react";
import type { NavGroup } from "./navTypes";

export const vendorNav: NavGroup[] = [
  {
    title: "",
    items: [
      {
        title: "Products",
        url: "/app/store/physical-products",
        icon: <Package weight="fill" className="h-5 w-5" />,
        children: [
          { title: "Physical Merchandise", url: "/app/store/physical-products", featureFlag: "physical_products" },
          { title: "Inventory & Stock", url: "/app/store/inventory", featureFlag: "physical_products" },
        ],
      },
      {
        title: "Inventory",
        url: "/app/store/inventory",
        icon: <Warehouse weight="fill" className="h-5 w-5" />,
        featureFlag: "physical_products",
      },
      {
        title: "Categories",
        url: "/app/store/categories",
        icon: <Tag weight="fill" className="h-5 w-5" />,
        featureFlag: "physical_products",
      },
      {
        title: "Storefront",
        url: "/app/store",
        icon: <Storefront weight="fill" className="h-5 w-5" />,
        featureFlag: "storefront",
      },
      {
        title: "Orders",
        url: "/app/store/orders",
        icon: <ShoppingCart weight="fill" className="h-5 w-5" />,
        featureFlag: "orders",
      },
      {
        title: "Fulfilment & Shipping",
        url: "/app/store/fulfilment",
        icon: <Truck weight="fill" className="h-5 w-5" />,
        featureFlag: "orders",
      },
      {
        title: "Returns",
        url: "/app/store/returns",
        icon: <ArrowUUpLeft weight="fill" className="h-5 w-5" />,
        featureFlag: "orders",
      },
      {
        title: "Reviews & Disputes",
        url: "/app/store/reviews",
        icon: <ChatCircle weight="fill" className="h-5 w-5" />,
        featureFlag: "moderation",
      },
      {
        title: "MurihChat",
        url: "/app/messages",
        icon: <ChatTeardropText weight="fill" className="h-5 w-5" />,
        featureFlag: "inbox",
      },
      {
        title: "MurihPay Wallet",
        url: "/app/wallet",
        icon: <Wallet weight="fill" className="h-5 w-5" />,
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
        icon: <Receipt weight="fill" className="h-5 w-5" />,
      },
      {
        title: "Payouts",
        url: "/app/wallet/payouts",
        icon: <CurrencyDollar weight="fill" className="h-5 w-5" />,
        featureFlag: "payouts",
      },
      {
        title: "Sales Analytics",
        url: "/app/analytics/revenue",
        icon: <TrendUp weight="fill" className="h-5 w-5" />,
        featureFlag: "analytics",
      },
      {
        title: "Ads Manager",
        url: "/app/ads",
        icon: <Megaphone weight="fill" className="h-5 w-5" />,
      },
    ],
  },
  {
    title: "Shortcuts",
    items: [
      {
        title: "Profile & Identity",
        url: "/app/settings/profile",
        icon: <UserCircle weight="fill" className="h-5 w-5" />,
      },
      {
        title: "Settings",
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
