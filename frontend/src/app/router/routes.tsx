import type { RouteObject } from "react-router";
import { LoginPage } from "@/pages/LoginPage";
import { RegisterPage } from "@/pages/RegisterPage";
import { HomePage } from "@/pages/HomePage";
import { AppPage } from "@/pages/AppPage";
import { ProfilePage } from "@/pages/ProfilePage";
import { AdminKycPage } from "@/pages/AdminKycPage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { SettingsLayout } from "@/components/layout/SettingsLayout";
import { ChatLayout } from "@/components/layout/ChatLayout";
import { CommunitiesPage } from "@/pages/CommunitiesPage";
import { CommunityPreviewPage } from "@/pages/CommunityPreviewPage";
import CommunityFeedPage from "@/pages/CommunityFeedPage";
import NotificationsPage from "@/pages/NotificationsPage";
import { StoreManagementPage } from "@/pages/StoreManagementPage";
import { PublicStorefrontPage } from "@/pages/PublicStorefrontPage";
import { DigitalProductsPage } from "@/pages/DigitalProductsPage";
import { SalesOrdersPage } from "@/pages/SalesOrdersPage";
import { WalletPage } from "@/pages/WalletPage";
import { DonationsPage } from "@/pages/DonationsPage";
import { PurchasesPage } from "@/pages/PurchasesPage";
import {
  EmptyState,
  NotFoundState,
} from "@/components/common/UIStateComponents";
import { RoutePaths } from "./route-paths";

// Helper to produce sprint-labelled empty states consistently
function sprint(title: string, description: string, sprintNum: number) {
  return (
    <EmptyState
      title={title}
      description={`${description} — available in Sprint ${sprintNum}.`}
    />
  );
}

export const routes: RouteObject[] = [
  // ── Public auth pages & Public Storefront ───
  { path: RoutePaths.LOGIN, element: <LoginPage /> },
  { path: RoutePaths.REGISTER, element: <RegisterPage /> },
  { path: "/store/:shortCode", element: <PublicStorefrontPage /> },

  // ── Authenticated Dashboard (sidebar-07 shell) ─
  {
    path: RoutePaths.APP,
    element: <DashboardLayout />,
    children: [
      // ── Home / Overview ─────────────────────────
      { index: true, element: <AppPage /> },

      // ── Link in Bio & Custom Sites ──────────────
      {
        path: "link-in-bio",
        element: sprint("Link in Bio Builder", "Drag-and-drop link in bio page builder and custom bio store", 18),
      },
      {
        path: "link-in-bio/design",
        element: sprint("Themes & Customization", "Customize colors, fonts, layouts and background styles", 18),
      },
      {
        path: "link-in-bio/domain",
        element: sprint("Custom Domain", "Connect your custom domain (e.g. yourname.com)", 18),
      },

      // ── MurihStore (Digital, Courses, Coaching, Physical, Subscriptions) ─
      {
        path: "store",
        element: <StoreManagementPage />,
      },
      {
        path: "store/digital",
        element: <DigitalProductsPage />,
      },
      {
        path: "store/courses",
        element: sprint("Online Courses & Masterclasses", "Host and monetize video courses, modules and lessons", 14),
      },
      {
        path: "store/coaching",
        element: sprint("1:1 Coaching & Bookings", "Calendar integration for 1-on-1 calls, consultations and advice", 21),
      },
      {
        path: "store/physical",
        element: sprint("Physical Products & Merch", "Physical products, inventory management, shipping and tracking", 30),
      },
      {
        path: "store/subscriptions",
        element: sprint("Subscriptions & Memberships", "Tiered memberships, recurring payments and VIP access", 22),
      },

      // ── Brand Deals & Media Kit ──────────────────
      {
        path: "brand-deals",
        element: sprint("Brand Deals Hub", "Manage brand partnerships, media kits and sponsor proposals", 38),
      },
      {
        path: "brand-deals/media-kit",
        element: sprint("Dynamic Media Kit", "Auto-updated audience analytics, engagement stats and rates sheet", 38),
      },
      {
        path: "brand-deals/proposals",
        element: sprint("Outreach & Pitching", "Send pitch proposals and manage brand deals workflow", 38),
      },
      {
        path: "brand-deals/invoicing",
        element: sprint("Brand Invoicing", "Generate professional invoices for sponsored content and deals", 38),
      },

      // ── Marketing & Automations ────────────────
      {
        path: "marketing",
        element: sprint("Marketing & Email Automations", "Email marketing campaigns, broadcasts, sequences and affiliate links", 38),
      },
      {
        path: "marketing/broadcasts",
        element: sprint("Email Broadcasts", "Send newsletters and promotional updates to your subscribers", 38),
      },
      {
        path: "marketing/sequences",
        element: sprint("Automated Sequences", "Drip campaigns and automated email funnels after purchases", 39),
      },
      {
        path: "marketing/affiliates",
        element: sprint("Affiliate Products", "Promote affiliate links and track referral commissions", 37),
      },
      {
        path: "marketing/referrals",
        element: sprint("Referral Program", "Reward fans and members for inviting friends to your community", 37),
      },

      // ── Community & Content ─────────────────────
      {
        path: "discover",
        element: <CommunitiesPage />,
      },
      {
        path: "communities",
        element: <CommunitiesPage />,
      },
      {
        path: "communities/:slug",
        element: <CommunityPreviewPage />,
      },
      {
        path: "communities/:slug/feed",
        element: <CommunityFeedPage />,
      },
      {
        path: "communities/events",
        element: sprint("Audio Rooms & Events", "Host live audio discussions, webinars and calendar events", 20),
      },

      // ── Messages ───────────────────────────────
      {
        path: "messages",
        element: <ChatLayout />,
      },

      // ── MurihPay Wallet (Sprint 16) ────────────
      {
        path: "wallet",
        element: <WalletPage />,
      },
      {
        path: "wallet/sales",
        element: <SalesOrdersPage />,
      },
      {
        path: "wallet/donations",
        element: <DonationsPage />,
      },
      {
        path: "wallet/purchases",
        element: <PurchasesPage />,
      },
      {
        path: "wallet/withdrawals",
        element: <WalletPage />,
      },
      {
        path: "wallet/escrow",
        element: sprint("Escrow Balances", "Track held funds for physical product deliveries and milestone payouts", 33),
      },

      // ── Analytics & Sales ──────────────────────
      {
        path: "analytics",
        element: sprint("Analytics Overview", "Comprehensive view of traffic, sales, engagement and growth", 40),
      },
      {
        path: "analytics/traffic",
        element: sprint("Link & Traffic Stats", "Click tracking, referral sources, link performance and top channels", 40),
      },
      {
        path: "analytics/revenue",
        element: sprint("Revenue & Conversions", "Sales funnels, revenue breakdown by product line and average order value", 40),
      },
      {
        path: "analytics/milestones",
        element: sprint("Milestones & Badges", "Community goals, sales targets, unlockable badges and rewards", 36),
      },
      {
        path: "milestones",
        element: sprint("Milestones & Badges", "Community goals, sales targets, unlockable badges and rewards", 36),
      },

      // ── Settings (sidebar-13) ──────────────────
      {
        path: "settings",
        element: <SettingsLayout />,
        children: [
          { index: true, element: <ProfilePage /> },
          {
            path: "kyc",
            element: sprint("KYC Verification", "Submit and track identity verification", 4),
          },
          {
            path: "security",
            element: sprint("Security", "Password, sessions and two-factor authentication", 4),
          },
          {
            path: "notifications",
            element: <NotificationsPage />,
          },
          {
            path: "privacy",
            element: sprint("Privacy & Visibility", "Profile visibility and data privacy controls", 4),
          },
          {
            path: "preferences",
            element: sprint("Appearance", "Theme and display preferences", 2),
          },
          {
            path: "language",
            element: sprint("Language & Region", "Language and regional settings", 9),
          },
          {
            path: "accessibility",
            element: sprint("Accessibility", "Accessibility preferences and options", 9),
          },
        ],
      },

      // ── Platform Administration ─────────────────
      {
        path: "admin",
        element: <AdminKycPage />,
      },
      {
        path: "admin/users",
        element: sprint("Users & Creators", "Manage all platform users, creators and vendors", 17),
      },
      {
        path: "admin/communities",
        element: sprint("Communities Admin", "Oversee communities, content reports and moderation", 17),
      },
      {
        path: "admin/transactions",
        element: sprint("Transactions", "Review all platform transactions, withdrawals, escrow and disputes", 17),
      },
      {
        path: "admin/reports",
        element: sprint("Reports & Audit", "Content reports, audit logs and system health monitoring", 17),
      },
      {
        path: "admin/analytics",
        element: sprint("Platform Analytics", "Revenue breakdown, growth trends and platform metrics", 17),
      },
      {
        path: "admin/plans",
        element: sprint("Plans & Fees", "Subscription plans and platform fee configuration", 17),
      },
      {
        path: "admin/cms",
        element: sprint("Website CMS", "Code-free management of public pages and announcements", 18),
      },

      // Catch-all within /app
      { path: "*", element: <NotFoundState /> },
    ],
  },

  // ── Public home / marketing ────────────────────
  { path: RoutePaths.HOME, element: <HomePage /> },

  // ── 404 ───────────────────────────────────────
  { path: "*", element: <NotFoundPage /> },
];
