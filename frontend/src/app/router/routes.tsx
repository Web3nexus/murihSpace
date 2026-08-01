import type { RouteObject } from "react-router";
import { Navigate } from "react-router";
import { LoginPage } from "@/pages/LoginPage";
import { ForgotPasswordPage } from "@/pages/ForgotPasswordPage";
import { ResetPasswordPage } from "@/pages/ResetPasswordPage";
import { AdminLoginPage } from "@/pages/AdminLoginPage";
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
import SearchPage from "@/pages/SearchPage";
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
import { AdminManagementPage } from "@/pages/AdminManagementPage";
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
import ContentStudioPage from "@/pages/ContentStudioPage";
import LinkInBioPage from "@/pages/LinkInBioPage";

import LinkInBioDomainPage from "@/pages/LinkInBioDomainPage";
import StorePostsPage from "@/pages/StorePostsPage";
import StoreProductsPage from "@/pages/StoreProductsPage";
import StoreMembershipsPage from "@/pages/StoreMembershipsPage";
import SavedAddressesPage from "@/pages/SavedAddressesPage";
import InventoryPage from "@/pages/InventoryPage";
import CategoriesPage from "@/pages/CategoriesPage";
import ReturnsPage from "@/pages/ReturnsPage";
import SupportThreadsPage from "@/pages/SupportThreadsPage";
import StoreSettingsPage from "@/pages/StoreSettingsPage";
import ProductPerformancePage from "@/pages/ProductPerformancePage";
import AdminDisputesPage from "@/pages/AdminDisputesPage";
import AdminModerationLogsPage from "@/pages/AdminModerationLogsPage";
import AdminSystemHealthPage from "@/pages/AdminSystemHealthPage";
import AdminAuditTrailPage from "@/pages/AdminAuditTrailPage";
import AdminSettingsPage from "@/pages/AdminSettingsPage";
import AdminAiSettingsPage from "@/pages/AdminAiSettingsPage";
import AdminStoragePage from "@/pages/AdminStoragePage";
import AdminObjectStorageProvidersPage from "@/pages/AdminObjectStorageProvidersPage";
import AdminConversionMetricsPage from "@/pages/AdminConversionMetricsPage";
import FeedPage from "@/pages/FeedPage";
import ChatPage from "@/pages/ChatPage";
import AiAssistantPage from "@/pages/AiAssistantPage";
import AiSettingsPage from "@/pages/AiSettingsPage";
import OnboardingPage from "@/pages/OnboardingPage";
import RequestsPage from "@/pages/RequestsPage";
import FriendsPage from "@/pages/FriendsPage";
import AffiliateProductsPage from "@/pages/AffiliateProductsPage";
import MarketingPage from "@/pages/MarketingPage";
import PublicLinkInBioPage from "@/pages/PublicLinkInBioPage";
import ActivityLogPage from "@/pages/ActivityLogPage";
import ContentPlannerPage from "@/pages/ContentPlannerPage";
import AdCampaignPage from "@/pages/AdCampaignPage";
import GiftsPage from "@/pages/GiftsPage";
import CreatorWalletPage from "@/pages/CreatorWalletPage";
import AdminAdsPage from "@/pages/AdminAdsPage";
import AdminGiftsPage from "@/pages/AdminGiftsPage";
import AdminCoinPacksPage from "@/pages/AdminCoinPacksPage";
import AdminStoriesPage from "@/pages/AdminStoriesPage";
import AdminAlgorithmPage from "@/pages/AdminAlgorithmPage";
import {
  NotFoundState,
} from "@/components/common/UIStateComponents";
import { RoutePaths } from "./route-paths";


export const routes: RouteObject[] = [
  // ── Public auth pages & Public Storefront ───
  { path: RoutePaths.LOGIN, element: <LoginPage /> },
  { path: RoutePaths.FORGOT_PASSWORD, element: <ForgotPasswordPage /> },
  { path: RoutePaths.RESET_PASSWORD, element: <ResetPasswordPage /> },
  { path: RoutePaths.SECUREGATE_LOGIN, element: <AdminLoginPage /> },
  { path: "/securegate", element: <Navigate to={RoutePaths.SECUREGATE_LOGIN} replace /> },
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
        element: <FeedPage />,
      },

      // ── Search ──────────────────────────────────
      {
        path: "search",
        element: <SearchPage />,
      },

      // ── Activity Log ────────────────────────────
      {
        path: "activity",
        element: <ActivityLogPage />,
      },

      // ── Identity Verification (KYC) ─────────────
      {
        path: "kyc",
        element: <KycSettingsPage />,
      },

      // ── Community Chat ──────────────────────────
      {
        path: "community-chat",
        element: <ChatPage />,
      },

      // ── AI Assistant ────────────────────────────
      {
        path: "ai-assistant",
        element: <AiAssistantPage />,
      },

      // ── AI Behavior settings ────────────────────
      {
        path: "ai-settings",
        element: <AiSettingsPage />,
      },

      // ── Requests (Friend & Community) ───────────
      {
        path: "requests",
        element: <RequestsPage />,
      },

      // ── Friends (dedicated friends manager) ──────
      {
        path: "friends",
        element: <FriendsPage />,
      },

      // ── Content Studio (Creator) ────────────────
      {
        path: "studio",
        element: <ProtectedRoute requiredRole="creator"><ContentStudioPage /></ProtectedRoute>,
      },

      // ── AI Onboarding wizard ────────────────────────
      {
        path: "onboarding",
        element: <OnboardingPage />,
      },

      // ── Link in Bio & Custom Sites ──────────────
      {
        path: "link-in-bio",
        element: <LinkInBioPage />,
      },
      {
        path: "link-in-bio/domain",
        element: <LinkInBioDomainPage />,
      },

      // ── MurihStore (Digital, Courses, Coaching, Physical, Subscriptions) ─
      {
        path: "store",
        element: <StoreManagementPage />,
      },
      {
        path: "store/products",
        element: <StoreProductsPage />,
      },
      {
        path: "store/memberships",
        element: <StoreMembershipsPage />,
      },
      {
        path: "store/saved-addresses",
        element: <SavedAddressesPage />,
      },
      {
        path: "store/posts",
        element: <ProtectedRoute requiredRole="creator"><StorePostsPage /></ProtectedRoute>,
      },
      {
        path: "store/physical-products",
        element: <ProtectedRoute requiredRole="creator"><PhysicalProductsPage /></ProtectedRoute>,
      },
      {
        path: "store/inventory",
        element: <ProtectedRoute requiredRole="creator"><InventoryPage /></ProtectedRoute>,
      },
      {
        path: "store/categories",
        element: <ProtectedRoute requiredRole="creator"><CategoriesPage /></ProtectedRoute>,
      },
      {
        path: "store/returns",
        element: <ProtectedRoute requiredRole="creator"><ReturnsPage /></ProtectedRoute>,
      },
      {
        path: "store/digital",
        element: <DigitalProductsPage />,
      },
      {
        path: "store/courses",
        element: <CoursesPage />,
      },
      {
        path: "store/coaching",
        element: <ProtectedRoute requiredRole="creator"><CoachingPage /></ProtectedRoute>,
      },
      {
        path: "store/physical",
        element: <ProtectedRoute requiredRole="creator"><PhysicalProductsPage /></ProtectedRoute>,
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
        path: "store/orders",
        element: <SalesOrdersPage />,
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

      // ── Advertising ────────────────────────────
      {
        path: "ads",
        element: <ProtectedRoute requiredRole="creator"><AdCampaignPage /></ProtectedRoute>,
      },

      // ── Gifts & Creator Wallet ─────────────────
      {
        path: "gifts",
        element: <GiftsPage />,
      },
      {
        path: "gifts/wallet",
        element: <ProtectedRoute requiredRole="creator"><CreatorWalletPage /></ProtectedRoute>,
      },

      // ── Marketing & Automations ────────────────
      {
        path: "marketing",
        element: <ProtectedRoute requiredRole="creator"><MarketingPage /></ProtectedRoute>,
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
        element: <AffiliateProductsPage />,
      },
      {
        path: "marketing/referrals",
        element: <ReferralsPage />,
      },
      {
        path: "marketing/planner",
        element: <ProtectedRoute requiredRole="creator"><ContentPlannerPage /></ProtectedRoute>,
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
        path: "events",
        element: <MyEventsPage />,
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
        element: <SupportThreadsPage />,
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
        element: <ProtectedRoute requiredRole="vendor"><ProductPerformancePage /></ProtectedRoute>,
      },
      {
        path: "analytics/milestones",
        element: <MilestonesPage />,
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
            element: <ProtectedRoute requiredRole="vendor"><StoreSettingsPage /></ProtectedRoute>,
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
        path: "securegate/admins",
        element: <ProtectedRoute requiredRole="admin"><AdminManagementPage /></ProtectedRoute>,
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
        element: <ProtectedRoute requiredRole="admin"><AdminDisputesPage /></ProtectedRoute>,
      },
      {
        path: "securegate/moderation-logs",
        element: <ProtectedRoute requiredRole="admin"><AdminModerationLogsPage /></ProtectedRoute>,
      },
      {
        path: "securegate/system-health",
        element: <ProtectedRoute requiredRole="admin"><AdminSystemHealthPage /></ProtectedRoute>,
      },
      {
        path: "securegate/audit-trail",
        element: <ProtectedRoute requiredRole="admin"><AdminAuditTrailPage /></ProtectedRoute>,
      },
      {
        path: "securegate/settings",
        element: <ProtectedRoute requiredRole="admin"><AdminSettingsPage /></ProtectedRoute>,
      },
      {
        path: "securegate/ai-settings",
        element: <ProtectedRoute requiredRole="admin"><AdminAiSettingsPage /></ProtectedRoute>,
      },
      {
        path: "securegate/storage",
        element: <ProtectedRoute requiredRole="admin"><AdminStoragePage /></ProtectedRoute>,
      },
      {
        path: "securegate/storage/providers",
        element: <ProtectedRoute requiredRole="admin"><AdminObjectStorageProvidersPage /></ProtectedRoute>,
      },
      {
        path: "securegate/analytics/overview",
        element: <ProtectedRoute requiredRole="admin"><AdminAnalyticsPage /></ProtectedRoute>,
      },
      {
        path: "securegate/analytics/growth",
        element: <ProtectedRoute requiredRole="admin"><AdminAnalyticsPage /></ProtectedRoute>,
      },
      {
        path: "securegate/analytics/revenue",
        element: <ProtectedRoute requiredRole="admin"><AdminAnalyticsPage /></ProtectedRoute>,
      },
      {
        path: "securegate/analytics/content",
        element: <ProtectedRoute requiredRole="admin"><AdminAnalyticsPage /></ProtectedRoute>,
      },
      {
        path: "securegate/analytics/conversions",
        element: <ProtectedRoute requiredRole="admin"><AdminConversionMetricsPage /></ProtectedRoute>,
      },
      {
        path: "securegate/ads",
        element: <ProtectedRoute requiredRole="admin"><AdminAdsPage /></ProtectedRoute>,
      },
      {
        path: "securegate/gifts",
        element: <ProtectedRoute requiredRole="admin"><AdminGiftsPage /></ProtectedRoute>,
      },
      {
        path: "securegate/coin-packs",
        element: <ProtectedRoute requiredRole="admin"><AdminCoinPacksPage /></ProtectedRoute>,
      },
      {
        path: "securegate/algorithm",
        element: <ProtectedRoute requiredRole="admin"><AdminAlgorithmPage /></ProtectedRoute>,
      },
      {
        path: "securegate/stories",
        element: <ProtectedRoute requiredRole="admin"><AdminStoriesPage /></ProtectedRoute>,
      },

      // Catch-all within /app
      { path: "*", element: <NotFoundState /> },
    ],
  },

  // ── Public home → redirect to app dashboard ────
  { path: RoutePaths.HOME, element: <Navigate to="/app" replace /> },

  // ── Public link-in-bio pages ─────────────────────
  { path: ":username", element: <PublicLinkInBioPage /> },

  // ── 404 ───────────────────────────────────────
  { path: "*", element: <NotFoundPage /> },
];
