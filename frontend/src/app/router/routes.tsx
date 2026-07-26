import type { RouteObject } from "react-router";
import { Navigate } from "react-router";
import { LoginPage } from "@/pages/LoginPage";
import { RegisterPage } from "@/pages/RegisterPage";
import { AppPage } from "@/pages/AppPage";
import { ProfilePage } from "@/pages/ProfilePage";
import { AdminKycPage } from "@/pages/AdminKycPage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { SettingsLayout } from "@/components/layout/SettingsLayout";
import { ChatLayout } from "@/components/layout/ChatLayout";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { CommunitiesPage } from "@/pages/CommunitiesPage";
import { CommunityPreviewPage } from "@/pages/CommunityPreviewPage";
import CommunityFeedPage from "@/pages/CommunityFeedPage";
import { EventsPage } from "@/pages/EventsPage";
import { EventDetailPage } from "@/pages/EventDetailPage";
import { MyEventsPage } from "@/pages/MyEventsPage";
import NotificationsPage from "@/pages/NotificationsPage";
import AppearancePage from "@/pages/AppearancePage";
import SecurityPage from "@/pages/SecurityPage";
import PrivacyPage from "@/pages/PrivacyPage";
import KycSettingsPage from "@/pages/KycSettingsPage";
import LanguagePage from "@/pages/LanguagePage";
import AccessibilityPage from "@/pages/AccessibilityPage";
import CoursesPage from "@/pages/CoursesPage";
import { StoreManagementPage } from "@/pages/StoreManagementPage";
import { PublicStorefrontPage } from "@/pages/PublicStorefrontPage";
import { DigitalProductsPage } from "@/pages/DigitalProductsPage";
import { SalesOrdersPage } from "@/pages/SalesOrdersPage";
import { AudioRoomsPage } from "@/pages/AudioRoomsPage";
import { AnalyticsPage } from "@/pages/AnalyticsPage";
import { BrandDealsPage } from "@/pages/BrandDealsPage";
import { BrandInvoicingPage } from "@/pages/BrandInvoicingPage";
import { CoachingPage } from "@/pages/CoachingPage";
import { PhysicalProductsPage } from "@/pages/PhysicalProductsPage";
import { CartPage } from "@/pages/CartPage";
import { AddressesPage } from "@/pages/AddressesPage";
import { FulfilmentPage } from "@/pages/FulfilmentPage";
import { ReviewsPage } from "@/pages/ReviewsPage";
import { DisputesPage } from "@/pages/DisputesPage";
import { ShippingProfilesPage } from "@/pages/ShippingProfilesPage";
import { PayoutsPage } from "@/pages/PayoutsPage";
import { MilestonesPage } from "@/pages/MilestonesPage";
import { MediaKitPage } from "@/pages/MediaKitPage";
import { ProposalsPage } from "@/pages/ProposalsPage";
import { ReferralsPage } from "@/pages/ReferralsPage";
import { SubscriptionManagementPage } from "@/pages/SubscriptionManagementPage";
import { BrowsePlansPage } from "@/pages/BrowsePlansPage";
import { MySubscriptionsPage } from "@/pages/MySubscriptionsPage";
import { WalletPage } from "@/pages/WalletPage";
import { DonationsPage } from "@/pages/DonationsPage";
import { EmailBroadcastsPage } from "@/pages/EmailBroadcastsPage";
import { EmailSequencesPage } from "@/pages/EmailSequencesPage";
import { EscrowPage } from "@/pages/EscrowPage";
import { PurchasesPage } from "@/pages/PurchasesPage";
import { SecuregateOverviewPage } from "@/pages/SecuregateOverviewPage";
import { AdminUsersPage } from "@/pages/AdminUsersPage";
import { AdminTransactionsPage } from "@/pages/AdminTransactionsPage";
import { AdminReconciliationPage } from "@/pages/AdminReconciliationPage";
import { AdminReportsPage } from "@/pages/AdminReportsPage";
import { AdminFeatureFlagsPage } from "@/pages/AdminFeatureFlagsPage";
import { QueueMonitorPage } from "@/pages/QueueMonitorPage";
import { AdminReviewsPage } from "@/pages/AdminReviewsPage";
import { AdminAnalyticsPage } from "@/pages/AdminAnalyticsPage";
import { AdminPlansPage } from "@/pages/AdminPlansPage";
import { AdminCommunitiesPage } from "@/pages/AdminCommunitiesPage";
import { AdminEscrowPage } from "@/pages/AdminEscrowPage";
import { AdminPayoutsPage } from "@/pages/AdminPayoutsPage";
import { AdminCmsPage } from "@/pages/AdminCmsPage";
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
    element: (
      <ProtectedRoute>
        <DashboardLayout />
      </ProtectedRoute>
    ),
    children: [
      // ── Home / Overview ─────────────────────────
      { index: true, element: <AppPage /> },

      // ── Feed (member community feed) ─────────────
      {
        path: "feed",
        element: sprint("Feed", "Your personalized community feed", 20),
      },

      // ── Community Chat ──────────────────────────
      {
        path: "community-chat",
        element: sprint("Community Chat", "Real-time community chat rooms", 20),
      },

      // ── AI Assistant ────────────────────────────
      {
        path: "ai-assistant",
        element: sprint("AI Assistant", "AI-powered content and community assistant", 20),
      },

      // ── Content Studio (Creator) ────────────────
      {
        path: "studio",
        element: <ProtectedRoute requiredRole="creator"><>{sprint("Content Studio", "Create and manage your digital content", 18)}</></ProtectedRoute>,
      },

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
        path: "store/products",
        element: sprint("Products", "Manage your digital and physical products", 18),
      },
      {
        path: "store/memberships",
        element: sprint("Memberships", "Manage recurring membership plans", 18),
      },
      {
        path: "store/saved-addresses",
        element: sprint("Saved Addresses", "Manage your shipping addresses", 18),
      },
      {
        path: "store/physical-products",
        element: <ProtectedRoute requiredRole="vendor"><PhysicalProductsPage /></ProtectedRoute>,
      },
      {
        path: "store/inventory",
        element: <ProtectedRoute requiredRole="vendor">{sprint("Inventory Management", "Track and manage product stock levels", 16)}</ProtectedRoute>,
      },
      {
        path: "store/categories",
        element: <ProtectedRoute requiredRole="vendor">{sprint("Categories", "Organize products into categories", 16)}</ProtectedRoute>,
      },
      {
        path: "store/returns",
        element: <ProtectedRoute requiredRole="vendor">{sprint("Returns Management", "Process customer returns and exchanges", 16)}</ProtectedRoute>,
      },
      {
        path: "store/digital",
        element: <DigitalProductsPage />,
      },
      {
        path: "store/courses",
        element: <ProtectedRoute requiredRole="creator"><CoursesPage /></ProtectedRoute>,
      },
      {
        path: "store/coaching",
        element: <ProtectedRoute requiredRole="creator"><CoachingPage /></ProtectedRoute>,
      },
      {
        path: "store/physical",
        element: <ProtectedRoute requiredRole="vendor"><PhysicalProductsPage /></ProtectedRoute>,
      },
      {
        path: "store/cart",
        element: <CartPage />,
      },
      {
        path: "store/addresses",
        element: <AddressesPage />,
      },
      {
        path: "store/fulfilment",
        element: <ProtectedRoute requiredRole="vendor"><FulfilmentPage /></ProtectedRoute>,
      },
      {
        path: "store/reviews",
        element: <ReviewsPage />,
      },
      {
        path: "store/disputes",
        element: <DisputesPage />,
      },
      {
        path: "store/shipping",
        element: <ProtectedRoute requiredRole="vendor"><ShippingProfilesPage /></ProtectedRoute>,
      },
      {
        path: "store/payouts",
        element: <PayoutsPage />,
      },
      {
        path: "store/subscriptions",
        element: <ProtectedRoute requiredRole="creator"><SubscriptionManagementPage /></ProtectedRoute>,
      },
      {
        path: "milestones",
        element: <ProtectedRoute requiredRole="creator"><MilestonesPage /></ProtectedRoute>,
      },

      // ── Brand Deals & Media Kit ──────────────────
      {
        path: "brand-deals",
        element: <ProtectedRoute requiredRole="creator"><BrandDealsPage /></ProtectedRoute>,
      },
      {
        path: "brand-deals/media-kit",
        element: <ProtectedRoute requiredRole="creator"><MediaKitPage /></ProtectedRoute>,
      },
      {
        path: "brand-deals/proposals",
        element: <ProtectedRoute requiredRole="creator"><ProposalsPage /></ProtectedRoute>,
      },
      {
        path: "brand-deals/invoicing",
        element: <ProtectedRoute requiredRole="creator"><BrandInvoicingPage /></ProtectedRoute>,
      },

      // ── Marketing & Automations ────────────────
      {
        path: "marketing",
        element: <ProtectedRoute requiredRole="creator">{sprint("Marketing & Email Automations", "Email marketing campaigns, broadcasts, sequences and affiliate links", 38)}</ProtectedRoute>,
      },
      {
        path: "marketing/broadcasts",
        element: <ProtectedRoute requiredRole="creator"><EmailBroadcastsPage /></ProtectedRoute>,
      },
      {
        path: "marketing/sequences",
        element: <ProtectedRoute requiredRole="creator"><EmailSequencesPage /></ProtectedRoute>,
      },
      {
        path: "marketing/affiliates",
        element: sprint("Affiliate Products", "Promote affiliate links and track referral commissions", 37),
      },
      {
        path: "marketing/referrals",
        element: <ReferralsPage />,
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
        element: <EventsPage />,
      },
      {
        path: "audio-rooms",
        element: <AudioRoomsPage />,
      },
      {
        path: "events/:id",
        element: <EventDetailPage />,
      },
      {
        path: "my-events",
        element: <MyEventsPage />,
      },

      // ── Subscriptions & Memberships ─────────────
      {
        path: "subscriptions",
        element: <BrowsePlansPage />,
      },
      {
        path: "subscriptions/discover",
        element: <BrowsePlansPage />,
      },
      {
        path: "subscriptions/my-subscriptions",
        element: <MySubscriptionsPage />,
      },
      {
        path: "subscriptions/mine",
        element: <MySubscriptionsPage />,
      },

      // ── Messages ───────────────────────────────
      {
        path: "messages",
        element: <ChatLayout />,
      },
      {
        path: "messages/support",
        element: sprint("Support Threads", "Customer support ticket threads", 16),
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
        path: "wallet/purchase-library",
        element: <PurchasesPage />,
      },
      {
        path: "wallet/tips",
        element: <DonationsPage />,
      },
      {
        path: "wallet/payouts",
        element: <PayoutsPage />,
      },
      {
        path: "wallet/withdrawals",
        element: <WalletPage />,
      },
      {
        path: "wallet/escrow",
        element: <EscrowPage />,
      },

      // ── Analytics & Sales ──────────────────────
      {
        path: "analytics",
        element: <AnalyticsPage />,
      },
      {
        path: "analytics/traffic",
        element: <AnalyticsPage />,
      },
      {
        path: "analytics/revenue",
        element: <AnalyticsPage />,
      },
      {
        path: "analytics/ai",
        element: <AnalyticsPage />,
      },
      {
        path: "analytics/products",
        element: <ProtectedRoute requiredRole="vendor">{sprint("Product Performance", "Analytics for your physical product performance", 16)}</ProtectedRoute>,
      },
      {
        path: "analytics/milestones",
        element: sprint("Milestones & Badges", "Community goals, sales targets, unlockable badges and rewards", 36),
      },

      // ── Settings (sidebar-13) ──────────────────
      {
        path: "settings",
        element: <SettingsLayout />,
        children: [
          { index: true, element: <ProfilePage /> },
          {
            path: "profile",
            element: <ProfilePage />,
          },
          {
            path: "store",
            element: <ProtectedRoute requiredRole="vendor">{sprint("Store Settings", "Configure your store profile and preferences", 16)}</ProtectedRoute>,
          },
          {
            path: "kyc",
            element: <KycSettingsPage />,
          },
          {
            path: "security",
            element: <SecurityPage />,
          },
          {
            path: "notifications",
            element: <NotificationsPage />,
          },
          {
            path: "privacy",
            element: <PrivacyPage />,
          },
          {
            path: "preferences",
            element: <AppearancePage />,
          },
          {
            path: "language",
            element: <LanguagePage />,
          },
          {
            path: "accessibility",
            element: <AccessibilityPage />,
          },
        ],
      },

      // ── Sprint 17: Platform Administration (/securegate) ─
      {
        path: "securegate",
        element: <ProtectedRoute requiredRole="admin"><SecuregateOverviewPage /></ProtectedRoute>,
      },
      {
        path: "securegate/users",
        element: <ProtectedRoute requiredRole="admin"><AdminUsersPage /></ProtectedRoute>,
      },
      {
        path: "securegate/transactions",
        element: <ProtectedRoute requiredRole="admin"><AdminTransactionsPage /></ProtectedRoute>,
      },
      {
        path: "securegate/reports",
        element: <ProtectedRoute requiredRole="admin"><AdminReportsPage /></ProtectedRoute>,
      },
      {
        path: "securegate/feature-flags",
        element: <ProtectedRoute requiredRole="admin"><AdminFeatureFlagsPage /></ProtectedRoute>,
      },
      {
        path: "securegate/analytics",
        element: <ProtectedRoute requiredRole="admin"><AdminAnalyticsPage /></ProtectedRoute>,
      },
      {
        path: "securegate/plans",
        element: <ProtectedRoute requiredRole="admin"><AdminPlansPage /></ProtectedRoute>,
      },
      {
        path: "securegate/cms",
        element: <ProtectedRoute requiredRole="admin"><AdminCmsPage /></ProtectedRoute>,
      },
      {
        path: "securegate/reconciliation",
        element: <ProtectedRoute requiredRole="admin"><AdminReconciliationPage /></ProtectedRoute>,
      },
      {
        path: "securegate/kyc",
        element: <ProtectedRoute requiredRole="admin"><AdminKycPage /></ProtectedRoute>,
      },
      {
        path: "securegate/queue",
        element: <ProtectedRoute requiredRole="admin"><QueueMonitorPage /></ProtectedRoute>,
      },
      {
        path: "securegate/reviews",
        element: <ProtectedRoute requiredRole="admin"><AdminReviewsPage /></ProtectedRoute>,
      },
      {
        path: "securegate/communities",
        element: <ProtectedRoute requiredRole="admin"><AdminCommunitiesPage /></ProtectedRoute>,
      },
      {
        path: "securegate/escrow",
        element: <ProtectedRoute requiredRole="admin"><AdminEscrowPage /></ProtectedRoute>,
      },
      {
        path: "securegate/payouts",
        element: <ProtectedRoute requiredRole="admin"><AdminPayoutsPage /></ProtectedRoute>,
      },
      {
        path: "securegate/disputes",
        element: <ProtectedRoute requiredRole="admin">{sprint("Disputes Management", "Manage refund requests and disputes", 16)}</ProtectedRoute>,
      },
      {
        path: "securegate/fulfilment-payouts",
        element: <ProtectedRoute requiredRole="admin">{sprint("Fulfilment Payouts", "Manage vendor fulfilment payouts", 16)}</ProtectedRoute>,
      },
      {
        path: "securegate/moderation-logs",
        element: <ProtectedRoute requiredRole="admin">{sprint("Moderation Logs", "View content moderation history", 16)}</ProtectedRoute>,
      },
      {
        path: "securegate/system-health",
        element: <ProtectedRoute requiredRole="admin">{sprint("System Health", "Monitor platform system health and uptime", 16)}</ProtectedRoute>,
      },
      {
        path: "securegate/audit-trail",
        element: <ProtectedRoute requiredRole="admin">{sprint("Audit Trail", "View platform audit logs", 16)}</ProtectedRoute>,
      },
      {
        path: "securegate/settings",
        element: <ProtectedRoute requiredRole="admin">{sprint("Admin Settings", "Platform configuration and settings", 16)}</ProtectedRoute>,
      },
      {
        path: "securegate/analytics/growth",
        element: <ProtectedRoute requiredRole="admin">{sprint("Ecosystem Growth", "Platform growth and user acquisition metrics", 16)}</ProtectedRoute>,
      },
      {
        path: "securegate/analytics/conversions",
        element: <ProtectedRoute requiredRole="admin">{sprint("Conversion Metrics", "Platform conversion funnel analytics", 16)}</ProtectedRoute>,
      },

      // Catch-all within /app
      { path: "*", element: <NotFoundState /> },
    ],
  },

  // ── Public home → redirect to app dashboard ────
  { path: RoutePaths.HOME, element: <Navigate to="/app" replace /> },

  // ── 404 ───────────────────────────────────────
  { path: "*", element: <NotFoundPage /> },
];
