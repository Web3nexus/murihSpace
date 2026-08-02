import { type RouteConfig, index, layout, route } from "@react-router/dev/routes";

export default [
  layout("components/PublicLayout.tsx", [
    index("routes/home.tsx"),
    route("features", "routes/features.tsx"),
    route("pricing", "routes/pricing.tsx"),
    route("creators", "routes/creators.tsx"),
    route("blog", "routes/blog.tsx"),
  ]),
] satisfies RouteConfig;
