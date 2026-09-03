import { Suspense } from "react";
import type { RouteObject } from "react-router";
import { Navigate } from "react-router";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { SettingsLayout } from "@/components/layout/SettingsLayout";
import { ChatLayout } from "@/components/layout/ChatLayout";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { lazyWithRetry } from "@/lib/lazyWithRetry";

import {
  NotFoundState,
} from "@/components/common/UIStateComponents";
import { RoutePaths } from "./route-paths";

import { Loader2 } from "lucide-react";

const PageLoader = () => (<div className="flex h-[50vh] w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary/50" /></div>);

// Lazy-loaded pages with automated deployment chunk-retry
const LoginPage = lazyWithRetry(() => import("@/pages/LoginPage"), "LoginPage");
const ForgotPasswordPage = lazyWithRetry(() => import("@/pages/ForgotPasswordPage"), "ForgotPasswordPage");
const ResetPasswordPage = lazyWithRetry(() => import("@/pages/ResetPasswordPage"), "ResetPasswordPage");
const AdminLoginPage = lazyWithRetry(() => import("@/pages/AdminLoginPage"), "AdminLoginPage");
const RegisterPage = lazyWithRetry(() => import("@/pages/RegisterPage"), "RegisterPage");
const AppPage = lazyWithRetry(() => import("@/pages/AppPage"), "AppPage");
const ProfilePage = lazyWithRetry(() => import("@/pages/ProfilePage"), "ProfilePage");
const AdminKycPage = lazyWithRetry(() => import("@/pages/AdminKycPage"), "AdminKycPage");
const NotFoundPage = lazyWithRetry(() => import("@/pages/NotFoundPage"), "NotFoundPage");
const CommunitiesPage = lazyWithRetry(() => import("@/pages/CommunitiesPage"), "CommunitiesPage");
const CommunityPreviewPage = lazyWithRetry(() => import("@/pages/CommunityPreviewPage"), "CommunityPreviewPage");
const PublicCommunitiesPage = lazyWithRetry(() => import("@/pages/PublicCommunitiesPage"), "PublicCommunitiesPage");
const CommunityFeedPage = lazyWithRetry(() => import("@/pages/CommunityFeedPage"));
const SearchPage = lazyWithRetry(() => import("@/pages/SearchPage"));
const EventsPage = lazyWithRetry(() => import("@/pages/EventsPage"), "EventsPage");
const EventDetailPage = lazyWithRetry(() => import("@/pages/EventDetailPage"), "EventDetailPage");
const MyEventsPage = lazyWithRetry(() => import("@/pages/MyEventsPage"), "MyEventsPage");
const NotificationsPage = lazyWithRetry(() => import("@/pages/NotificationsPage"));
const AppearancePage = lazyWithRetry(() => import("@/pages/AppearancePage"));
const SecurityPage = lazyWithRetry(() => import("@/pages/SecurityPage"));
const PrivacyPage = lazyWithRetry(() => import("@/pages/PrivacyPage"));
const KycSettingsPage = lazyWithRetry(() => import("@/pages/KycSettingsPage"));
const LanguagePage = lazyWithRetry(() => import("@/pages/LanguagePage"));
const AccessibilityPage = lazyWithRetry(() => import("@/pages/AccessibilityPage"));
const UpgradeAccountPage = lazyWithRetry(() => import("@/pages/UpgradeAccountPage"), "UpgradeAccountPage");
const AdminRoleApplicationsPage = lazyWithRetry(() => import("@/pages/AdminRoleApplicationsPage"), "AdminRoleApplicationsPage");
const AdminVerificationBadgesPage = lazyWithRetry(() => import("@/pages/AdminVerificationBadgesPage"), "AdminVerificationBadgesPage");
const CoursesPage = lazyWithRetry(() => import("@/pages/CoursesPage"));
const StoreManagementPage = lazyWithRetry(() => import("@/pages/StoreManagementPage"), "StoreManagementPage");
const PublicStorefrontPage = lazyWithRetry(() => import("@/pages/PublicStorefrontPage"), "PublicStorefrontPage");
const PublicMediaKitPage = lazyWithRetry(() => import("@/pages/PublicMediaKitPage"), "PublicMediaKitPage");
const DigitalProductsPage = lazyWithRetry(() => import("@/pages/DigitalProductsPage"), "DigitalProductsPage");
const SalesOrdersPage = lazyWithRetry(() => import("@/pages/SalesOrdersPage"), "SalesOrdersPage");
const AudioRoomsPage = lazyWithRetry(() => import("@/pages/AudioRoomsPage"), "AudioRoomsPage");
const AnalyticsPage = lazyWithRetry(() => import("@/pages/AnalyticsPage"), "AnalyticsPage");
const BrandDealsPage = lazyWithRetry(() => import("@/pages/BrandDealsPage"), "BrandDealsPage");
const BrandInvoicingPage = lazyWithRetry(() => import("@/pages/BrandInvoicingPage"), "BrandInvoicingPage");
const CoachingPage = lazyWithRetry(() => import("@/pages/CoachingPage"), "CoachingPage");
const PhysicalProductsPage = lazyWithRetry(() => import("@/pages/PhysicalProductsPage"), "PhysicalProductsPage");
const CartPage = lazyWithRetry(() => import("@/pages/CartPage"), "CartPage");
const AddressesPage = lazyWithRetry(() => import("@/pages/AddressesPage"), "AddressesPage");
const FulfilmentPage = lazyWithRetry(() => import("@/pages/FulfilmentPage"), "FulfilmentPage");
const ReviewsPage = lazyWithRetry(() => import("@/pages/ReviewsPage"), "ReviewsPage");
const DisputesPage = lazyWithRetry(() => import("@/pages/DisputesPage"), "DisputesPage");
const ShippingProfilesPage = lazyWithRetry(() => import("@/pages/ShippingProfilesPage"), "ShippingProfilesPage");
const PayoutsPage = lazyWithRetry(() => import("@/pages/PayoutsPage"), "PayoutsPage");
const MilestonesPage = lazyWithRetry(() => import("@/pages/MilestonesPage"), "MilestonesPage");
const MediaKitPage = lazyWithRetry(() => import("@/pages/MediaKitPage"), "MediaKitPage");
const ProposalsPage = lazyWithRetry(() => import("@/pages/ProposalsPage"), "ProposalsPage");
const ReferralsPage = lazyWithRetry(() => import("@/pages/ReferralsPage"), "ReferralsPage");
const SubscriptionManagementPage = lazyWithRetry(() => import("@/pages/SubscriptionManagementPage"), "SubscriptionManagementPage");
const BrowsePlansPage = lazyWithRetry(() => import("@/pages/BrowsePlansPage"), "BrowsePlansPage");
const MySubscriptionsPage = lazyWithRetry(() => import("@/pages/MySubscriptionsPage"), "MySubscriptionsPage");
const WalletPage = lazyWithRetry(() => import("@/pages/WalletPage"), "WalletPage");
const DonationsPage = lazyWithRetry(() => import("@/pages/DonationsPage"), "DonationsPage");
const EmailBroadcastsPage = lazyWithRetry(() => import("@/pages/EmailBroadcastsPage"), "EmailBroadcastsPage");
const EmailSequencesPage = lazyWithRetry(() => import("@/pages/EmailSequencesPage"), "EmailSequencesPage");
const EscrowPage = lazyWithRetry(() => import("@/pages/EscrowPage"), "EscrowPage");
const PurchasesPage = lazyWithRetry(() => import("@/pages/PurchasesPage"), "PurchasesPage");
const SecuregateOverviewPage = lazyWithRetry(() => import("@/pages/SecuregateOverviewPage"), "SecuregateOverviewPage");
const AdminUsersPage = lazyWithRetry(() => import("@/pages/AdminUsersPage"), "AdminUsersPage");
const AdminManagementPage = lazyWithRetry(() => import("@/pages/AdminManagementPage"), "AdminManagementPage");
const AdminTransactionsPage = lazyWithRetry(() => import("@/pages/AdminTransactionsPage"), "AdminTransactionsPage");
const AdminReconciliationPage = lazyWithRetry(() => import("@/pages/AdminReconciliationPage"), "AdminReconciliationPage");
const AdminReportsPage = lazyWithRetry(() => import("@/pages/AdminReportsPage"), "AdminReportsPage");
const AdminFeatureFlagsPage = lazyWithRetry(() => import("@/pages/AdminFeatureFlagsPage"), "AdminFeatureFlagsPage");
const QueueMonitorPage = lazyWithRetry(() => import("@/pages/QueueMonitorPage"), "QueueMonitorPage");
const AdminReviewsPage = lazyWithRetry(() => import("@/pages/AdminReviewsPage"), "AdminReviewsPage");
const AdminAnalyticsPage = lazyWithRetry(() => import("@/pages/AdminAnalyticsPage"), "AdminAnalyticsPage");
const AdminPlansPage = lazyWithRetry(() => import("@/pages/AdminPlansPage"), "AdminPlansPage");
const AdminCommunitiesPage = lazyWithRetry(() => import("@/pages/AdminCommunitiesPage"), "AdminCommunitiesPage");
const AdminEscrowPage = lazyWithRetry(() => import("@/pages/AdminEscrowPage"), "AdminEscrowPage");
const AdminPayoutsPage = lazyWithRetry(() => import("@/pages/AdminPayoutsPage"), "AdminPayoutsPage");
const AdminCmsPage = lazyWithRetry(() => import("@/pages/AdminCmsPage"), "AdminCmsPage");
const ContentStudioPage = lazyWithRetry(() => import("@/pages/ContentStudioPage"));
const LinkInBioPage = lazyWithRetry(() => import("@/pages/LinkInBioPage"));
const LinkInBioDomainPage = lazyWithRetry(() => import("@/pages/LinkInBioDomainPage"));
const StorePostsPage = lazyWithRetry(() => import("@/pages/StorePostsPage"));
const StoreProductsPage = lazyWithRetry(() => import("@/pages/StoreProductsPage"));
const StoreMembershipsPage = lazyWithRetry(() => import("@/pages/StoreMembershipsPage"));
const SavedAddressesPage = lazyWithRetry(() => import("@/pages/SavedAddressesPage"));
const InventoryPage = lazyWithRetry(() => import("@/pages/InventoryPage"));
const CategoriesPage = lazyWithRetry(() => import("@/pages/CategoriesPage"));
const ReturnsPage = lazyWithRetry(() => import("@/pages/ReturnsPage"));
const SupportThreadsPage = lazyWithRetry(() => import("@/pages/SupportThreadsPage"));
const StoreSettingsPage = lazyWithRetry(() => import("@/pages/StoreSettingsPage"));
const ProductPerformancePage = lazyWithRetry(() => import("@/pages/ProductPerformancePage"));
const AdminDisputesPage = lazyWithRetry(() => import("@/pages/AdminDisputesPage"));
const AdminModerationLogsPage = lazyWithRetry(() => import("@/pages/AdminModerationLogsPage"));
const AdminSystemHealthPage = lazyWithRetry(() => import("@/pages/AdminSystemHealthPage"));
const AdminAuditTrailPage = lazyWithRetry(() => import("@/pages/AdminAuditTrailPage"));
const AdminSettingsPage = lazyWithRetry(() => import("@/pages/AdminSettingsPage"));
const AdminAuthMethodsPage = lazyWithRetry(() => import("@/pages/AdminAuthMethodsPage"));
const AdminAiSettingsPage = lazyWithRetry(() => import("@/pages/AdminAiSettingsPage"));
const AdminEmailEngineSettingsPage = lazyWithRetry(() => import("@/pages/AdminEmailEngineSettingsPage"));
const AdminSmsEngineSettingsPage = lazyWithRetry(() => import("@/pages/AdminSmsEngineSettingsPage"));
const AdminEmailTemplatesPage = lazyWithRetry(() => import("@/pages/AdminEmailTemplatesPage"));
const AdminSocialLoginSettingsPage = lazyWithRetry(() => import("@/pages/AdminSocialLoginSettingsPage"));
const AdminStoragePage = lazyWithRetry(() => import("@/pages/AdminStoragePage"));
const AdminObjectStorageProvidersPage = lazyWithRetry(() => import("@/pages/AdminObjectStorageProvidersPage"));
const ConnectedAccountsPage = lazyWithRetry(() => import("@/pages/ConnectedAccountsPage"));
const AdminCreatorQualificationPage = lazyWithRetry(() => import("@/pages/AdminCreatorQualificationPage"));
const AdminQualificationEventsPage = lazyWithRetry(() => import("@/pages/AdminQualificationEventsPage"));
const AdminConversionMetricsPage = lazyWithRetry(() => import("@/pages/AdminConversionMetricsPage"));
const FeedPage = lazyWithRetry(() => import("@/pages/FeedPage"));
const ChatPage = lazyWithRetry(() => import("@/pages/ChatPage"));
const AiAssistantPage = lazyWithRetry(() => import("@/pages/AiAssistantPage"));
const AiSettingsPage = lazyWithRetry(() => import("@/pages/AiSettingsPage"));
const OnboardingPage = lazyWithRetry(() => import("@/pages/OnboardingPage"));
const RequestsPage = lazyWithRetry(() => import("@/pages/RequestsPage"));
const FriendsPage = lazyWithRetry(() => import("@/pages/FriendsPage"));
const AffiliateProductsPage = lazyWithRetry(() => import("@/pages/AffiliateProductsPage"));
const MarketingPage = lazyWithRetry(() => import("@/pages/MarketingPage"));
const PublicLinkInBioPage = lazyWithRetry(() => import("@/pages/PublicLinkInBioPage"));
const ActivityLogPage = lazyWithRetry(() => import("@/pages/ActivityLogPage"));
const ContentPlannerPage = lazyWithRetry(() => import("@/pages/ContentPlannerPage"));
const AdCampaignPage = lazyWithRetry(() => import("@/pages/AdCampaignPage"));
const GiftsPage = lazyWithRetry(() => import("@/pages/GiftsPage"));
const CreatorWalletPage = lazyWithRetry(() => import("@/pages/CreatorWalletPage"));
const BusinessWalletPage = lazyWithRetry(() => import("@/pages/BusinessWalletPage"));
const AdminFeeManagementPage = lazyWithRetry(() => import("@/pages/AdminFeeManagementPage"), "AdminFeeManagementPage");
const AdminAdsPage = lazyWithRetry(() => import("@/pages/AdminAdsPage"));
const AdminGiftsPage = lazyWithRetry(() => import("@/pages/AdminGiftsPage"));
const AdminSoundLibraryPage = lazyWithRetry(() => import("@/pages/AdminSoundLibraryPage"));
const AdminCoinPacksPage = lazyWithRetry(() => import("@/pages/AdminCoinPacksPage"));
const AdminStoriesPage = lazyWithRetry(() => import("@/pages/AdminStoriesPage"));
const AdminAlgorithmPage = lazyWithRetry(() => import("@/pages/AdminAlgorithmPage"));
const AdminMediaManagerPage = lazyWithRetry(() => import("@/pages/AdminMediaManagerPage"));
const SocialAuthCallbackPage = lazyWithRetry(() => import("@/pages/SocialAuthCallbackPage"), "SocialAuthCallbackPage");
const PrivacyPolicyPage = lazyWithRetry(() => import("@/pages/PrivacyPolicyPage"));
const TermsOfServicePage = lazyWithRetry(() => import("@/pages/TermsOfServicePage"));
const GDPRPolicyPage = lazyWithRetry(() => import("@/pages/GDPRPolicyPage"), "GDPRPolicyPage");
const CookiesPolicyPage = lazyWithRetry(() => import("@/pages/CookiesPolicyPage"));
const HelpCenterPage = lazyWithRetry(() => import("@/pages/HelpCenterPage"));

export const routes: RouteObject[] = [
  // ── Public auth pages & Public Storefront ───
  { path: RoutePaths.LOGIN, element: <Suspense fallback={<PageLoader />}><LoginPage /></Suspense> },
  { path: RoutePaths.FORGOT_PASSWORD, element: <Suspense fallback={<PageLoader />}><ForgotPasswordPage /></Suspense> },
  { path: RoutePaths.RESET_PASSWORD, element: <Suspense fallback={<PageLoader />}><ResetPasswordPage /></Suspense> },
  { path: RoutePaths.SECUREGATE_LOGIN, element: <Suspense fallback={<PageLoader />}><AdminLoginPage /></Suspense> },
  { path: "/securegate", element: <Navigate to={RoutePaths.SECUREGATE_LOGIN} replace /> },
  { path: RoutePaths.REGISTER, element: <Suspense fallback={<PageLoader />}><RegisterPage /></Suspense> },
  { path: "/social/callback", element: <Suspense fallback={<PageLoader />}><SocialAuthCallbackPage /></Suspense> },
  { path: "/store/:shortCode", element: <Suspense fallback={<PageLoader />}><PublicStorefrontPage /></Suspense> },
  { path: "/media-kit/:creatorId", element: <Suspense fallback={<PageLoader />}><PublicMediaKitPage /></Suspense> },
  { path: "/communities", element: <Suspense fallback={<PageLoader />}><PublicCommunitiesPage /></Suspense> },
  { path: "/privacy", element: <Suspense fallback={<PageLoader />}><PrivacyPolicyPage /></Suspense> },
  { path: "/terms", element: <Suspense fallback={<PageLoader />}><TermsOfServicePage /></Suspense> },
  { path: "/gdpr", element: <Suspense fallback={<PageLoader />}><GDPRPolicyPage /></Suspense> },
  { path: "/cookies", element: <Suspense fallback={<PageLoader />}><CookiesPolicyPage /></Suspense> },
  { path: "/help", element: <Suspense fallback={<PageLoader />}><HelpCenterPage /></Suspense> },

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
      { index: true, element: <Suspense fallback={<PageLoader />}><AppPage /></Suspense> },

      // ── Feed (member community feed) ─────────────
      {
        path: "feed",
        element: <Suspense fallback={<PageLoader />}><FeedPage /></Suspense>,
      },

      // ── Search ──────────────────────────────────
      {
        path: "search",
        element: <Suspense fallback={<PageLoader />}><SearchPage /></Suspense>,
      },

      // ── Activity Log ────────────────────────────
      {
        path: "activity",
        element: <Suspense fallback={<PageLoader />}><ActivityLogPage /></Suspense>,
      },

      // ── 1:1 Coaching & Bookings ─────────────────
      {
        path: "coaching",
        element: <Suspense fallback={<PageLoader />}><CoachingPage /></Suspense>,
      },

      // ── Identity Verification (KYC) ─────────────
      {
        path: "kyc",
        element: <Suspense fallback={<PageLoader />}><KycSettingsPage /></Suspense>,
      },

      // ── Community Chat ──────────────────────────
      {
        path: "community-chat",
        element: <Suspense fallback={<PageLoader />}><ChatPage /></Suspense>,
      },

      // ── AI Assistant ────────────────────────────
      {
        path: "ai-assistant",
        element: <Suspense fallback={<PageLoader />}><AiAssistantPage /></Suspense>,
      },

      // ── AI Behavior settings ────────────────────
      {
        path: "ai-settings",
        element: <Suspense fallback={<PageLoader />}><AiSettingsPage /></Suspense>,
      },

      // ── Requests (Friend & Community) ───────────
      {
        path: "requests",
        element: <Suspense fallback={<PageLoader />}><RequestsPage /></Suspense>,
      },

      // ── Friends (dedicated friends manager) ──────
      {
        path: "friends",
        element: <Suspense fallback={<PageLoader />}><FriendsPage /></Suspense>,
      },

      // ── Content Studio (Creator) ────────────────
      {
        path: "studio",
        element: <ProtectedRoute requiredRole="creator"><Suspense fallback={<PageLoader />}><ContentStudioPage /></Suspense></ProtectedRoute>,
      },

      // ── AI Onboarding wizard ────────────────────────
      {
        path: "onboarding",
        element: <Suspense fallback={<PageLoader />}><OnboardingPage /></Suspense>,
      },

      // ── Link in Bio & Custom Sites ──────────────
      {
        path: "link-in-bio",
        element: <Suspense fallback={<PageLoader />}><LinkInBioPage /></Suspense>,
      },
      {
        path: "link-in-bio/domain",
        element: <Suspense fallback={<PageLoader />}><LinkInBioDomainPage /></Suspense>,
      },

      // ── MurihStore (Digital, Courses, Coaching, Physical, Subscriptions) ─
      {
        path: "store",
        element: <Suspense fallback={<PageLoader />}><StoreManagementPage /></Suspense>,
      },
      {
        path: "store/products",
        element: <Suspense fallback={<PageLoader />}><StoreProductsPage /></Suspense>,
      },
      {
        path: "store/memberships",
        element: <Suspense fallback={<PageLoader />}><StoreMembershipsPage /></Suspense>,
      },
      {
        path: "store/saved-addresses",
        element: <Suspense fallback={<PageLoader />}><SavedAddressesPage /></Suspense>,
      },
      {
        path: "store/posts",
        element: <ProtectedRoute requiredRole="creator"><Suspense fallback={<PageLoader />}><StorePostsPage /></Suspense></ProtectedRoute>,
      },
      {
        path: "store/physical-products",
        element: <ProtectedRoute requiredRole="creator"><Suspense fallback={<PageLoader />}><PhysicalProductsPage /></Suspense></ProtectedRoute>,
      },
      {
        path: "store/inventory",
        element: <ProtectedRoute requiredRole="creator"><Suspense fallback={<PageLoader />}><InventoryPage /></Suspense></ProtectedRoute>,
      },
      {
        path: "store/categories",
        element: <ProtectedRoute requiredRole="creator"><Suspense fallback={<PageLoader />}><CategoriesPage /></Suspense></ProtectedRoute>,
      },
      {
        path: "store/returns",
        element: <ProtectedRoute requiredRole="creator"><Suspense fallback={<PageLoader />}><ReturnsPage /></Suspense></ProtectedRoute>,
      },
      {
        path: "store/digital",
        element: <Suspense fallback={<PageLoader />}><DigitalProductsPage /></Suspense>,
      },
      {
        path: "store/courses",
        element: <Suspense fallback={<PageLoader />}><CoursesPage /></Suspense>,
      },
      {
        path: "store/coaching",
        element: <ProtectedRoute requiredRole="creator"><Suspense fallback={<PageLoader />}><CoachingPage /></Suspense></ProtectedRoute>,
      },
      {
        path: "store/physical",
        element: <ProtectedRoute requiredRole="creator"><Suspense fallback={<PageLoader />}><PhysicalProductsPage /></Suspense></ProtectedRoute>,
      },
      {
        path: "store/cart",
        element: <Suspense fallback={<PageLoader />}><CartPage /></Suspense>,
      },
      {
        path: "store/addresses",
        element: <Suspense fallback={<PageLoader />}><AddressesPage /></Suspense>,
      },
      {
        path: "store/fulfilment",
        element: <ProtectedRoute requiredRole="vendor"><Suspense fallback={<PageLoader />}><FulfilmentPage /></Suspense></ProtectedRoute>,
      },
      {
        path: "store/reviews",
        element: <Suspense fallback={<PageLoader />}><ReviewsPage /></Suspense>,
      },
      {
        path: "store/disputes",
        element: <Suspense fallback={<PageLoader />}><DisputesPage /></Suspense>,
      },
      {
        path: "store/shipping",
        element: <ProtectedRoute requiredRole="vendor"><Suspense fallback={<PageLoader />}><ShippingProfilesPage /></Suspense></ProtectedRoute>,
      },
      {
        path: "store/orders",
        element: <Suspense fallback={<PageLoader />}><SalesOrdersPage /></Suspense>,
      },
      {
        path: "store/payouts",
        element: <Suspense fallback={<PageLoader />}><PayoutsPage /></Suspense>,
      },
      {
        path: "store/subscriptions",
        element: <ProtectedRoute requiredRole="creator"><Suspense fallback={<PageLoader />}><SubscriptionManagementPage /></Suspense></ProtectedRoute>,
      },
      {
        path: "milestones",
        element: <ProtectedRoute requiredRole="creator"><Suspense fallback={<PageLoader />}><MilestonesPage /></Suspense></ProtectedRoute>,
      },

      // ── Brand Deals & Media Kit ──────────────────
      {
        path: "brand-deals",
        element: <ProtectedRoute requiredRole="creator"><Suspense fallback={<PageLoader />}><BrandDealsPage /></Suspense></ProtectedRoute>,
      },
      {
        path: "brand-deals/media-kit",
        element: <ProtectedRoute requiredRole="creator"><Suspense fallback={<PageLoader />}><MediaKitPage /></Suspense></ProtectedRoute>,
      },
      {
        path: "brand-deals/proposals",
        element: <ProtectedRoute requiredRole="creator"><Suspense fallback={<PageLoader />}><ProposalsPage /></Suspense></ProtectedRoute>,
      },
      {
        path: "brand-deals/invoicing",
        element: <ProtectedRoute requiredRole="creator"><Suspense fallback={<PageLoader />}><BrandInvoicingPage /></Suspense></ProtectedRoute>,
      },

      // ── Advertising ────────────────────────────
      {
        path: "ads",
        element: <ProtectedRoute requiredRole="creator"><Suspense fallback={<PageLoader />}><AdCampaignPage /></Suspense></ProtectedRoute>,
      },

      // ── Gifts & Creator Wallet ─────────────────
      {
        path: "gifts",
        element: <Suspense fallback={<PageLoader />}><GiftsPage /></Suspense>,
      },
      {
        path: "gifts/wallet",
        element: <ProtectedRoute requiredRole="creator"><Suspense fallback={<PageLoader />}><CreatorWalletPage /></Suspense></ProtectedRoute>,
      },

      // ── Marketing & Automations ────────────────
      {
        path: "marketing",
        element: <ProtectedRoute requiredRole="creator"><Suspense fallback={<PageLoader />}><MarketingPage /></Suspense></ProtectedRoute>,
      },
      {
        path: "marketing/broadcasts",
        element: <ProtectedRoute requiredRole="creator"><Suspense fallback={<PageLoader />}><EmailBroadcastsPage /></Suspense></ProtectedRoute>,
      },
      {
        path: "marketing/sequences",
        element: <ProtectedRoute requiredRole="creator"><Suspense fallback={<PageLoader />}><EmailSequencesPage /></Suspense></ProtectedRoute>,
      },
      {
        path: "marketing/affiliates",
        element: <Suspense fallback={<PageLoader />}><AffiliateProductsPage /></Suspense>,
      },
      {
        path: "marketing/referrals",
        element: <Suspense fallback={<PageLoader />}><ReferralsPage /></Suspense>,
      },
      {
        path: "marketing/planner",
        element: <ProtectedRoute requiredRole="creator"><Suspense fallback={<PageLoader />}><ContentPlannerPage /></Suspense></ProtectedRoute>,
      },

      // ── Community & Content ─────────────────────
      {
        path: "discover",
        element: <Suspense fallback={<PageLoader />}><CommunitiesPage /></Suspense>,
      },
      {
        path: "communities",
        element: <Suspense fallback={<PageLoader />}><CommunitiesPage /></Suspense>,
      },
      {
        path: "communities/:slug",
        element: <Suspense fallback={<PageLoader />}><CommunityPreviewPage /></Suspense>,
      },
      {
        path: "communities/:slug/feed",
        element: <Suspense fallback={<PageLoader />}><CommunityFeedPage /></Suspense>,
      },
      {
        path: "communities/events",
        element: <Suspense fallback={<PageLoader />}><EventsPage /></Suspense>,
      },
      {
        path: "events",
        element: <Suspense fallback={<PageLoader />}><MyEventsPage /></Suspense>,
      },
      {
        path: "audio-rooms",
        element: <Suspense fallback={<PageLoader />}><AudioRoomsPage /></Suspense>,
      },
      {
        path: "events/:id",
        element: <Suspense fallback={<PageLoader />}><EventDetailPage /></Suspense>,
      },
      {
        path: "my-events",
        element: <Suspense fallback={<PageLoader />}><MyEventsPage /></Suspense>,
      },

      // ── Subscriptions & Memberships ─────────────
      {
        path: "subscriptions",
        element: <Suspense fallback={<PageLoader />}><BrowsePlansPage /></Suspense>,
      },
      {
        path: "subscriptions/discover",
        element: <Suspense fallback={<PageLoader />}><BrowsePlansPage /></Suspense>,
      },
      {
        path: "subscriptions/my-subscriptions",
        element: <Suspense fallback={<PageLoader />}><MySubscriptionsPage /></Suspense>,
      },
      {
        path: "subscriptions/mine",
        element: <Suspense fallback={<PageLoader />}><MySubscriptionsPage /></Suspense>,
      },

      // ── Messages ───────────────────────────────
      {
        path: "messages",
        element: <ChatLayout />,
      },
      {
        path: "messages/support",
        element: <Suspense fallback={<PageLoader />}><SupportThreadsPage /></Suspense>,
      },

      // ── MurihPay Wallet (Sprint 16) ────────────
      {
        path: "wallet",
        element: <Suspense fallback={<PageLoader />}><WalletPage /></Suspense>,
      },
      {
        path: "wallet/business",
        element: <ProtectedRoute requiredRole="creator"><Suspense fallback={<PageLoader />}><BusinessWalletPage /></Suspense></ProtectedRoute>,
      },
      {
        path: "wallet/sales",
        element: <Suspense fallback={<PageLoader />}><SalesOrdersPage /></Suspense>,
      },
      {
        path: "wallet/donations",
        element: <Suspense fallback={<PageLoader />}><DonationsPage /></Suspense>,
      },
      {
        path: "wallet/purchases",
        element: <Suspense fallback={<PageLoader />}><PurchasesPage /></Suspense>,
      },
      {
        path: "wallet/purchase-library",
        element: <Suspense fallback={<PageLoader />}><PurchasesPage /></Suspense>,
      },
      {
        path: "wallet/tips",
        element: <Suspense fallback={<PageLoader />}><DonationsPage /></Suspense>,
      },
      {
        path: "wallet/payouts",
        element: <Suspense fallback={<PageLoader />}><PayoutsPage /></Suspense>,
      },
      {
        path: "wallet/withdrawals",
        element: <Suspense fallback={<PageLoader />}><WalletPage /></Suspense>,
      },
      {
        path: "wallet/escrow",
        element: <Suspense fallback={<PageLoader />}><EscrowPage /></Suspense>,
      },

      // ── Analytics & Sales ──────────────────────
      {
        path: "analytics",
        element: <Suspense fallback={<PageLoader />}><AnalyticsPage /></Suspense>,
      },
      {
        path: "analytics/traffic",
        element: <Suspense fallback={<PageLoader />}><AnalyticsPage /></Suspense>,
      },
      {
        path: "analytics/revenue",
        element: <Suspense fallback={<PageLoader />}><AnalyticsPage /></Suspense>,
      },
      {
        path: "analytics/ai",
        element: <Suspense fallback={<PageLoader />}><AnalyticsPage /></Suspense>,
      },
      {
        path: "analytics/products",
        element: <ProtectedRoute requiredRole="vendor"><Suspense fallback={<PageLoader />}><ProductPerformancePage /></Suspense></ProtectedRoute>,
      },
      {
        path: "analytics/milestones",
        element: <Suspense fallback={<PageLoader />}><MilestonesPage /></Suspense>,
      },

      // ── Settings (sidebar-13) ──────────────────
      {
        path: "settings",
        element: <SettingsLayout />,
        children: [
          { index: true, element: <Suspense fallback={<PageLoader />}><ProfilePage /></Suspense> },
          {
            path: "profile",
            element: <Suspense fallback={<PageLoader />}><ProfilePage /></Suspense>,
          },
          {
            path: "upgrade",
            element: <Suspense fallback={<PageLoader />}><UpgradeAccountPage /></Suspense>,
          },
          {
            path: "connected-accounts",
            element: <Suspense fallback={<PageLoader />}><ConnectedAccountsPage /></Suspense>,
          },
          {
            path: "store",
            element: <ProtectedRoute requiredRole="vendor"><Suspense fallback={<PageLoader />}><StoreSettingsPage /></Suspense></ProtectedRoute>,
          },
          {
            path: "kyc",
            element: <Suspense fallback={<PageLoader />}><KycSettingsPage /></Suspense>,
          },
          {
            path: "security",
            element: <Suspense fallback={<PageLoader />}><SecurityPage /></Suspense>,
          },
          {
            path: "notifications",
            element: <Suspense fallback={<PageLoader />}><NotificationsPage /></Suspense>,
          },
          {
            path: "privacy",
            element: <Suspense fallback={<PageLoader />}><PrivacyPage /></Suspense>,
          },
          {
            path: "preferences",
            element: <Suspense fallback={<PageLoader />}><AppearancePage /></Suspense>,
          },
          {
            path: "language",
            element: <Suspense fallback={<PageLoader />}><LanguagePage /></Suspense>,
          },
          {
            path: "accessibility",
            element: <Suspense fallback={<PageLoader />}><AccessibilityPage /></Suspense>,
          },
          {
            path: "help",
            element: <Suspense fallback={<PageLoader />}><SupportThreadsPage /></Suspense>,
          },
        ],
      },

      // ── Sprint 17: Platform Administration (/securegate) ─
      {
        path: "securegate",
        element: <ProtectedRoute requiredRole="admin"><Suspense fallback={<PageLoader />}><SecuregateOverviewPage /></Suspense></ProtectedRoute>,
      },
      {
        path: "securegate/users",
        element: <ProtectedRoute requiredRole="admin"><Suspense fallback={<PageLoader />}><AdminUsersPage /></Suspense></ProtectedRoute>,
      },
      {
        path: "securegate/admins",
        element: <ProtectedRoute requiredRole="admin"><Suspense fallback={<PageLoader />}><AdminManagementPage /></Suspense></ProtectedRoute>,
      },
      {
        path: "securegate/transactions",
        element: <ProtectedRoute requiredRole="admin"><Suspense fallback={<PageLoader />}><AdminTransactionsPage /></Suspense></ProtectedRoute>,
      },
      {
        path: "securegate/reports",
        element: <ProtectedRoute requiredRole="admin"><Suspense fallback={<PageLoader />}><AdminReportsPage /></Suspense></ProtectedRoute>,
      },
      {
        path: "securegate/feature-flags",
        element: <ProtectedRoute requiredRole="admin"><Suspense fallback={<PageLoader />}><AdminFeatureFlagsPage /></Suspense></ProtectedRoute>,
      },
      {
        path: "securegate/analytics",
        element: <ProtectedRoute requiredRole="admin"><Suspense fallback={<PageLoader />}><AdminAnalyticsPage /></Suspense></ProtectedRoute>,
      },
      {
        path: "securegate/plans",
        element: <ProtectedRoute requiredRole="admin"><Suspense fallback={<PageLoader />}><AdminPlansPage /></Suspense></ProtectedRoute>,
      },
      {
        path: "securegate/cms",
        element: <ProtectedRoute requiredRole="admin"><Suspense fallback={<PageLoader />}><AdminCmsPage /></Suspense></ProtectedRoute>,
      },
      {
        path: "securegate/reconciliation",
        element: <ProtectedRoute requiredRole="admin"><Suspense fallback={<PageLoader />}><AdminReconciliationPage /></Suspense></ProtectedRoute>,
      },
      {
        path: "securegate/kyc",
        element: <ProtectedRoute requiredRole="admin"><Suspense fallback={<PageLoader />}><AdminKycPage /></Suspense></ProtectedRoute>,
      },
      {
        path: "securegate/role-applications",
        element: <ProtectedRoute requiredRole="admin"><Suspense fallback={<PageLoader />}><AdminRoleApplicationsPage /></Suspense></ProtectedRoute>,
      },
      {
        path: "securegate/verification-badges",
        element: <ProtectedRoute requiredRole="admin"><Suspense fallback={<PageLoader />}><AdminVerificationBadgesPage /></Suspense></ProtectedRoute>,
      },
      {
        path: "securegate/fees",
        element: <ProtectedRoute requiredRole="admin"><Suspense fallback={<PageLoader />}><AdminFeeManagementPage /></Suspense></ProtectedRoute>,
      },
      {
        path: "securegate/queue",
        element: <ProtectedRoute requiredRole="admin"><Suspense fallback={<PageLoader />}><QueueMonitorPage /></Suspense></ProtectedRoute>,
      },
      {
        path: "securegate/reviews",
        element: <ProtectedRoute requiredRole="admin"><Suspense fallback={<PageLoader />}><AdminReviewsPage /></Suspense></ProtectedRoute>,
      },
      {
        path: "securegate/communities",
        element: <ProtectedRoute requiredRole="admin"><Suspense fallback={<PageLoader />}><AdminCommunitiesPage /></Suspense></ProtectedRoute>,
      },
      {
        path: "securegate/escrow",
        element: <ProtectedRoute requiredRole="admin"><Suspense fallback={<PageLoader />}><AdminEscrowPage /></Suspense></ProtectedRoute>,
      },
      {
        path: "securegate/payouts",
        element: <ProtectedRoute requiredRole="admin"><Suspense fallback={<PageLoader />}><AdminPayoutsPage /></Suspense></ProtectedRoute>,
      },
      {
        path: "securegate/disputes",
        element: <ProtectedRoute requiredRole="admin"><Suspense fallback={<PageLoader />}><AdminDisputesPage /></Suspense></ProtectedRoute>,
      },
      {
        path: "securegate/moderation-logs",
        element: <ProtectedRoute requiredRole="admin"><Suspense fallback={<PageLoader />}><AdminModerationLogsPage /></Suspense></ProtectedRoute>,
      },
      {
        path: "securegate/system-health",
        element: <ProtectedRoute requiredRole="admin"><Suspense fallback={<PageLoader />}><AdminSystemHealthPage /></Suspense></ProtectedRoute>,
      },
      {
        path: "securegate/audit-trail",
        element: <ProtectedRoute requiredRole="admin"><Suspense fallback={<PageLoader />}><AdminAuditTrailPage /></Suspense></ProtectedRoute>,
      },
      {
        path: "securegate/settings",
        element: <ProtectedRoute requiredRole="admin"><Suspense fallback={<PageLoader />}><AdminSettingsPage /></Suspense></ProtectedRoute>,
      },
      {
        path: "securegate/ai-settings",
        element: <ProtectedRoute requiredRole="admin"><Suspense fallback={<PageLoader />}><AdminAiSettingsPage /></Suspense></ProtectedRoute>,
      },
      {
        path: "securegate/email-engine",
        element: <ProtectedRoute requiredRole="admin"><Suspense fallback={<PageLoader />}><AdminEmailEngineSettingsPage /></Suspense></ProtectedRoute>,
      },
      {
        path: "securegate/sms-engine",
        element: <ProtectedRoute requiredRole="admin"><Suspense fallback={<PageLoader />}><AdminSmsEngineSettingsPage /></Suspense></ProtectedRoute>,
      },
      {
        path: "securegate/email-templates",
        element: <ProtectedRoute requiredRole="admin"><Suspense fallback={<PageLoader />}><AdminEmailTemplatesPage /></Suspense></ProtectedRoute>,
      },
      {
        path: "securegate/social-login",
        element: <ProtectedRoute requiredRole="admin"><Suspense fallback={<PageLoader />}><AdminSocialLoginSettingsPage /></Suspense></ProtectedRoute>,
      },
      {
        path: "securegate/auth-methods",
        element: <ProtectedRoute requiredRole="admin"><Suspense fallback={<PageLoader />}><AdminAuthMethodsPage /></Suspense></ProtectedRoute>,
      },
      {
        path: "securegate/creator-qualification",
        element: <ProtectedRoute requiredRole="admin"><Suspense fallback={<PageLoader />}><AdminCreatorQualificationPage /></Suspense></ProtectedRoute>,
      },
      {
        path: "securegate/creator-qualification/events",
        element: <ProtectedRoute requiredRole="admin"><Suspense fallback={<PageLoader />}><AdminQualificationEventsPage /></Suspense></ProtectedRoute>,
      },
      {
        path: "securegate/storage",
        element: <ProtectedRoute requiredRole="admin"><Suspense fallback={<PageLoader />}><AdminStoragePage /></Suspense></ProtectedRoute>,
      },
      {
        path: "securegate/media",
        element: <ProtectedRoute requiredRole="admin"><Suspense fallback={<PageLoader />}><AdminMediaManagerPage /></Suspense></ProtectedRoute>,
      },
      {
        path: "securegate/storage/providers",
        element: <ProtectedRoute requiredRole="admin"><Suspense fallback={<PageLoader />}><AdminObjectStorageProvidersPage /></Suspense></ProtectedRoute>,
      },
      {
        path: "securegate/analytics/overview",
        element: <ProtectedRoute requiredRole="admin"><Suspense fallback={<PageLoader />}><AdminAnalyticsPage /></Suspense></ProtectedRoute>,
      },
      {
        path: "securegate/analytics/growth",
        element: <ProtectedRoute requiredRole="admin"><Suspense fallback={<PageLoader />}><AdminAnalyticsPage /></Suspense></ProtectedRoute>,
      },
      {
        path: "securegate/analytics/revenue",
        element: <ProtectedRoute requiredRole="admin"><Suspense fallback={<PageLoader />}><AdminAnalyticsPage /></Suspense></ProtectedRoute>,
      },
      {
        path: "securegate/analytics/content",
        element: <ProtectedRoute requiredRole="admin"><Suspense fallback={<PageLoader />}><AdminAnalyticsPage /></Suspense></ProtectedRoute>,
      },
      {
        path: "securegate/analytics/conversions",
        element: <ProtectedRoute requiredRole="admin"><Suspense fallback={<PageLoader />}><AdminConversionMetricsPage /></Suspense></ProtectedRoute>,
      },
      {
        path: "securegate/ads",
        element: <ProtectedRoute requiredRole="admin"><Suspense fallback={<PageLoader />}><AdminAdsPage /></Suspense></ProtectedRoute>,
      },
      {
        path: "securegate/gifts",
        element: <ProtectedRoute requiredRole="admin"><Suspense fallback={<PageLoader />}><AdminGiftsPage /></Suspense></ProtectedRoute>,
      },
      {
        path: "securegate/sound-tracks",
        element: <ProtectedRoute requiredRole="admin"><Suspense fallback={<PageLoader />}><AdminSoundLibraryPage /></Suspense></ProtectedRoute>,
      },
      {
        path: "securegate/coin-packs",
        element: <ProtectedRoute requiredRole="admin"><Suspense fallback={<PageLoader />}><AdminCoinPacksPage /></Suspense></ProtectedRoute>,
      },
      {
        path: "securegate/algorithm",
        element: <ProtectedRoute requiredRole="admin"><Suspense fallback={<PageLoader />}><AdminAlgorithmPage /></Suspense></ProtectedRoute>,
      },
      {
        path: "securegate/stories",
        element: <ProtectedRoute requiredRole="admin"><Suspense fallback={<PageLoader />}><AdminStoriesPage /></Suspense></ProtectedRoute>,
      },

      // Catch-all within /app
      { path: "*", element: <NotFoundState /> },
    ],
  },

  // ── Public home → redirect to app dashboard ────
  { path: RoutePaths.HOME, element: <Navigate to="/app" replace /> },

  // ── Public link-in-bio pages ─────────────────────
  { path: ":username", element: <Suspense fallback={<PageLoader />}><PublicLinkInBioPage /></Suspense> },

  // ── 404 ───────────────────────────────────────
  { path: "*", element: <Suspense fallback={<PageLoader />}><NotFoundPage /></Suspense> },
];
