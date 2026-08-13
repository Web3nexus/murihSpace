import { type RouteConfig, index, route, layout } from "@react-router/dev/routes";

export default [
  layout("layouts/dashboard-layout.tsx", [
    index("routes/overview.tsx"),
    
    // Campaigns
    route("campaigns", "routes/campaigns/index.tsx"),
    route("campaigns/create/objective", "routes/campaigns/create/objective.tsx"),

    route("campaigns/create/object", "routes/campaigns/create/object.tsx"),
    route("campaigns/create/details", "routes/campaigns/create/details.tsx"),
    
    // Remaining Sections
    route("creative", "routes/creative/index.tsx"),
    route("audiences", "routes/audiences/index.tsx"),
    route("analytics", "routes/analytics/index.tsx"),
    route("billing", "routes/billing/index.tsx"),
    route("business", "routes/business/index.tsx"),
  ]),
  
  // Admin Routes
  route("secureads/login", "routes/secureads/login.tsx"),
  layout("routes/secureads/layout.tsx", [
    route("secureads/moderation/creatives", "routes/secureads/moderation/creatives.tsx"),
    route("secureads/advertisers/verification", "routes/secureads/advertisers/verification.tsx"),
  ])
] satisfies RouteConfig;
