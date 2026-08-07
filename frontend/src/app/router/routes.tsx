import { lazy, Suspense } from "react";
import type { RouteObject } from "react-router";
import { Navigate } from "react-router";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { SettingsLayout } from "@/components/layout/SettingsLayout";
import { ChatLayout } from "@/components/layout/ChatLayout";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

import {
  NotFoundState,
} from "@/components/common/UIStateComponents";
import { RoutePaths } from "./route-paths";



import { Loader2 } from "lucide-react";

const PageLoader = () => (<div className="flex h-[50vh] w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary/50" /></div>);

// Lazy-loaded pages
const LoginPage = lazy(() => import("@/pages/LoginPage").then(module => ({ default: module.LoginPage })));
const ForgotPasswordPage = lazy(() => import("@/pages/ForgotPasswordPage").then(module => ({ default: module.ForgotPasswordPage })));
const ResetPasswordPage = lazy(() => import("@/pages/ResetPasswordPage").then(module => ({ default: module.ResetPasswordPage })));
const AdminLoginPage = lazy(() => import("@/pages/AdminLoginPage").then(module => ({ default: module.AdminLoginPage })));
const RegisterPage = lazy(() => import("@/pages/RegisterPage").then(module => ({ default: module.RegisterPage })));
const AppPage = lazy(() => import("@/pages/AppPage").then(module => ({ default: module.AppPage })));
const ProfilePage = lazy(() => import("@/pages/ProfilePage").then(module => ({ default: module.ProfilePage })));
const AdminKycPage = lazy(() => import("@/pages/AdminKycPage").then(module => ({ default: module.AdminKycPage })));
const NotFoundPage = lazy(() => import("@/pages/NotFoundPage").then(module => ({ default: module.NotFoundPage })));
const CommunitiesPage = lazy(() => import("@/pages/CommunitiesPage").then(module => ({ default: module.CommunitiesPage })));
const CommunityPreviewPage = lazy(() => import("@/pages/CommunityPreviewPage").then(module => ({ default: module.CommunityPreviewPage })));
const PublicCommunitiesPage = lazy(() => import("@/pages/PublicCommunitiesPage").then(module => ({ default: module.PublicCommunitiesPage })));
const CommunityFeedPage = lazy(() => import("@/pages/CommunityFeedPage"));
const SearchPage = lazy(() => import("@/pages/SearchPage"));
const EventsPage = lazy(() => import("@/pages/EventsPage").then(module => ({ default: module.EventsPage })));
const EventDetailPage = lazy(() => import("@/pages/EventDetailPage").then(module => ({ default: module.EventDetailPage })));
const MyEventsPage = lazy(() => import("@/pages/MyEventsPage").then(module => ({ default: module.MyEventsPage })));
const NotificationsPage = lazy(() => import("@/pages/NotificationsPage"));
const AppearancePage = lazy(() => import("@/pages/AppearancePage"));
const SecurityPage = lazy(() => import("@/pages/SecurityPage"));
const PrivacyPage = lazy(() => import("@/pages/PrivacyPage"));
const KycSettingsPage = lazy(() => import("@/pages/KycSettingsPage"));
const LanguagePage = lazy(() => import("@/pages/LanguagePage"));
const AccessibilityPage = lazy(() => import("@/pages/AccessibilityPage"));
const UpgradeAccountPage = lazy(() => import("@/pages/UpgradeAccountPage").then(module => ({ default: module.UpgradeAccountPage })));
const AdminRoleApplicationsPage = lazy(() => import("@/pages/AdminRoleApplicationsPage").then(module => ({ default: module.AdminRoleApplicationsPage })));
const AdminVerificationBadgesPage = lazy(() => import("@/pages/AdminVerificationBadgesPage").then(module => ({ default: module.AdminVerificationBadgesPage })));
const CoursesPage = lazy(() => import("@/pages/CoursesPage"));
const StoreManagementPage = lazy(() => import("@/pages/StoreManagementPage").then(module => ({ default: module.StoreManagementPage })));
const PublicStorefrontPage = lazy(() => import("@/pages/PublicStorefrontPage").then(module => ({ default: module.PublicStorefrontPage })));
const PublicMediaKitPage = lazy(() => import("@/pages/PublicMediaKitPage").then(module => ({ default: module.PublicMediaKitPage })));
const DigitalProductsPage = lazy(() => import("@/pages/DigitalProductsPage").then(module => ({ default: module.DigitalProductsPage })));
const SalesOrdersPage = lazy(() => import("@/pages/SalesOrdersPage").then(module => ({ default: module.SalesOrdersPage })));
const AudioRoomsPage = lazy(() => import("@/pages/AudioRoomsPage").then(module => ({ default: module.AudioRoomsPage })));
const AnalyticsPage = lazy(() => import("@/pages/AnalyticsPage").then(module => ({ default: module.AnalyticsPage })));
const BrandDealsPage = lazy(() => import("@/pages/BrandDealsPage").then(module => ({ default: module.BrandDealsPage })));
const BrandInvoicingPage = lazy(() => import("@/pages/BrandInvoicingPage").then(module => ({ default: module.BrandInvoicingPage })));
const CoachingPage = lazy(() => import("@/pages/CoachingPage").then(module => ({ default: module.CoachingPage })));
const PhysicalProductsPage = lazy(() => import("@/pages/PhysicalProductsPage").then(module => ({ default: module.PhysicalProductsPage })));
const CartPage = lazy(() => import("@/pages/CartPage").then(module => ({ default: module.CartPage })));
const AddressesPage = lazy(() => import("@/pages/AddressesPage").then(module => ({ default: module.AddressesPage })));
const FulfilmentPage = lazy(() => import("@/pages/FulfilmentPage").then(module => ({ default: module.FulfilmentPage })));
const ReviewsPage = lazy(() => import("@/pages/ReviewsPage").then(module => ({ default: module.ReviewsPage })));
const DisputesPage = lazy(() => import("@/pages/DisputesPage").then(module => ({ default: module.DisputesPage })));
const ShippingProfilesPage = lazy(() => import("@/pages/ShippingProfilesPage").then(module => ({ default: module.ShippingProfilesPage })));
const PayoutsPage = lazy(() => import("@/pages/PayoutsPage").then(module => ({ default: module.PayoutsPage })));
const MilestonesPage = lazy(() => import("@/pages/MilestonesPage").then(module => ({ default: module.MilestonesPage })));
const MediaKitPage = lazy(() => import("@/pages/MediaKitPage").then(module => ({ default: module.MediaKitPage })));
const ProposalsPage = lazy(() => import("@/pages/ProposalsPage").then(module => ({ default: module.ProposalsPage })));
const ReferralsPage = lazy(() => import("@/pages/ReferralsPage").then(module => ({ default: module.ReferralsPage })));
const SubscriptionManagementPage = lazy(() => import("@/pages/SubscriptionManagementPage").then(module => ({ default: module.SubscriptionManagementPage })));
const BrowsePlansPage = lazy(() => import("@/pages/BrowsePlansPage").then(module => ({ default: module.BrowsePlansPage })));
const MySubscriptionsPage = lazy(() => import("@/pages/MySubscriptionsPage").then(module => ({ default: module.MySubscriptionsPage })));
const WalletPage = lazy(() => import("@/pages/WalletPage").then(module => ({ default: module.WalletPage })));
const DonationsPage = lazy(() => import("@/pages/DonationsPage").then(module => ({ default: module.DonationsPage })));
const EmailBroadcastsPage = lazy(() => import("@/pages/EmailBroadcastsPage").then(module => ({ default: module.EmailBroadcastsPage })));
const EmailSequencesPage = lazy(() => import("@/pages/EmailSequencesPage").then(module => ({ default: module.EmailSequencesPage })));
const EscrowPage = lazy(() => import("@/pages/EscrowPage").then(module => ({ default: module.EscrowPage })));
const PurchasesPage = lazy(() => import("@/pages/PurchasesPage").then(module => ({ default: module.PurchasesPage })));
const SecuregateOverviewPage = lazy(() => import("@/pages/SecuregateOverviewPage").then(module => ({ default: module.SecuregateOverviewPage })));
const AdminUsersPage = lazy(() => import("@/pages/AdminUsersPage").then(module => ({ default: module.AdminUsersPage })));
const AdminManagementPage = lazy(() => import("@/pages/AdminManagementPage").then(module => ({ default: module.AdminManagementPage })));
const AdminTransactionsPage = lazy(() => import("@/pages/AdminTransactionsPage").then(module => ({ default: module.AdminTransactionsPage })));
const AdminReconciliationPage = lazy(() => import("@/pages/AdminReconciliationPage").then(module => ({ default: module.AdminReconciliationPage })));
const AdminReportsPage = lazy(() => import("@/pages/AdminReportsPage").then(module => ({ default: module.AdminReportsPage })));
const AdminFeatureFlagsPage = lazy(() => import("@/pages/AdminFeatureFlagsPage").then(module => ({ default: module.AdminFeatureFlagsPage })));
const QueueMonitorPage = lazy(() => import("@/pages/QueueMonitorPage").then(module => ({ default: module.QueueMonitorPage })));
const AdminReviewsPage = lazy(() => import("@/pages/AdminReviewsPage").then(module => ({ default: module.AdminReviewsPage })));
const AdminAnalyticsPage = lazy(() => import("@/pages/AdminAnalyticsPage").then(module => ({ default: module.AdminAnalyticsPage })));
const AdminPlansPage = lazy(() => import("@/pages/AdminPlansPage").then(module => ({ default: module.AdminPlansPage })));
const AdminCommunitiesPage = lazy(() => import("@/pages/AdminCommunitiesPage").then(module => ({ default: module.AdminCommunitiesPage })));
const AdminEscrowPage = lazy(() => import("@/pages/AdminEscrowPage").then(module => ({ default: module.AdminEscrowPage })));
const AdminPayoutsPage = lazy(() => import("@/pages/AdminPayoutsPage").then(module => ({ default: module.AdminPayoutsPage })));
const AdminCmsPage = lazy(() => import("@/pages/AdminCmsPage").then(module => ({ default: module.AdminCmsPage })));
const ContentStudioPage = lazy(() => import("@/pages/ContentStudioPage"));
const LinkInBioPage = lazy(() => import("@/pages/LinkInBioPage"));
const LinkInBioDomainPage = lazy(() => import("@/pages/LinkInBioDomainPage"));
const StorePostsPage = lazy(() => import("@/pages/StorePostsPage"));
const StoreProductsPage = lazy(() => import("@/pages/StoreProductsPage"));
const StoreMembershipsPage = lazy(() => import("@/pages/StoreMembershipsPage"));
const SavedAddressesPage = lazy(() => import("@/pages/SavedAddressesPage"));
const InventoryPage = lazy(() => import("@/pages/InventoryPage"));
const CategoriesPage = lazy(() => import("@/pages/CategoriesPage"));
const ReturnsPage = lazy(() => import("@/pages/ReturnsPage"));
const SupportThreadsPage = lazy(() => import("@/pages/SupportThreadsPage"));
const StoreSettingsPage = lazy(() => import("@/pages/StoreSettingsPage"));
const ProductPerformancePage = lazy(() => import("@/pages/ProductPerformancePage"));
const AdminDisputesPage = lazy(() => import("@/pages/AdminDisputesPage"));
const AdminModerationLogsPage = lazy(() => import("@/pages/AdminModerationLogsPage"));
const AdminSystemHealthPage = lazy(() => import("@/pages/AdminSystemHealthPage"));
const AdminAuditTrailPage = lazy(() => import("@/pages/AdminAuditTrailPage"));
const AdminSettingsPage = lazy(() => import("@/pages/AdminSettingsPage"));
const AdminAuthMethodsPage = lazy(() => import("@/pages/AdminAuthMethodsPage"));
const AdminAiSettingsPage = lazy(() => import("@/pages/AdminAiSettingsPage"));
const AdminEmailEngineSettingsPage = lazy(() => import("@/pages/AdminEmailEngineSettingsPage"));
const AdminSmsEngineSettingsPage = lazy(() => import("@/pages/AdminSmsEngineSettingsPage"));
const AdminEmailTemplatesPage = lazy(() => import("@/pages/AdminEmailTemplatesPage"));
const AdminSocialLoginSettingsPage = lazy(() => import("@/pages/AdminSocialLoginSettingsPage"));
const AdminStoragePage = lazy(() => import("@/pages/AdminStoragePage"));
const AdminObjectStorageProvidersPage = lazy(() => import("@/pages/AdminObjectStorageProvidersPage"));
const ConnectedAccountsPage = lazy(() => import("@/pages/ConnectedAccountsPage"));
const AdminCreatorQualificationPage = lazy(() => import("@/pages/AdminCreatorQualificationPage"));
const AdminQualificationEventsPage = lazy(() => import("@/pages/AdminQualificationEventsPage"));
const AdminConversionMetricsPage = lazy(() => import("@/pages/AdminConversionMetricsPage"));
const FeedPage = lazy(() => import("@/pages/FeedPage"));
const ChatPage = lazy(() => import("@/pages/ChatPage"));
const AiAssistantPage = lazy(() => import("@/pages/AiAssistantPage"));
const AiSettingsPage = lazy(() => import("@/pages/AiSettingsPage"));
const OnboardingPage = lazy(() => import("@/pages/OnboardingPage"));
const RequestsPage = lazy(() => import("@/pages/RequestsPage"));
const FriendsPage = lazy(() => import("@/pages/FriendsPage"));
const AffiliateProductsPage = lazy(() => import("@/pages/AffiliateProductsPage"));
const MarketingPage = lazy(() => import("@/pages/MarketingPage"));
const PublicLinkInBioPage = lazy(() => import("@/pages/PublicLinkInBioPage"));
const ActivityLogPage = lazy(() => import("@/pages/ActivityLogPage"));
const ContentPlannerPage = lazy(() => import("@/pages/ContentPlannerPage"));
const AdCampaignPage = lazy(() => import("@/pages/AdCampaignPage"));
const GiftsPage = lazy(() => import("@/pages/GiftsPage"));
const CreatorWalletPage = lazy(() => import("@/pages/CreatorWalletPage"));
const BusinessWalletPage = lazy(() => import("@/pages/BusinessWalletPage"));
const AdminFeeManagementPage = lazy(() => import("@/pages/AdminFeeManagementPage").then(module => ({ default: module.AdminFeeManagementPage })));
const AdminAdsPage = lazy(() => import("@/pages/AdminAdsPage"));
const AdminGiftsPage = lazy(() => import("@/pages/AdminGiftsPage"));
const AdminCoinPacksPage = lazy(() => import("@/pages/AdminCoinPacksPage"));
const AdminStoriesPage = lazy(() => import("@/pages/AdminStoriesPage"));
const AdminAlgorithmPage = lazy(() => import("@/pages/AdminAlgorithmPage"));
const SocialAuthCallbackPage = lazy(() => import("@/pages/SocialAuthCallbackPage").then(module => ({ default: module.SocialAuthCallbackPage })));
const PrivacyPolicyPage = lazy(() => import("@/pages/PrivacyPolicyPage"));
const TermsOfServicePage = lazy(() => import("@/pages/TermsOfServicePage"));
const GDPRPolicyPage = lazy(() => import("@/pages/GDPRPolicyPage").then(m => ({ default: m.GDPRPolicyPage })));
const CookiesPolicyPage = lazy(() => import("@/pages/CookiesPolicyPage"));
const HelpCenterPage = lazy(() => import("@/pages/HelpCenterPage"));

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
