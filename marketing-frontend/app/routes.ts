import { type RouteConfig, index, layout, route } from "@react-router/dev/routes";

export default [
  layout("components/PublicLayout.tsx", [
    index("routes/home.tsx"),
    route("features", "routes/features.tsx"),
    route("pricing", "routes/pricing.tsx"),
    route("creators", "routes/creators.tsx"),
    route("blog", "routes/blog.tsx"),
    route("blog/:slug", "routes/blog-article.tsx"),
    route("help", "routes/help.tsx"),
    route("help/category/:slug", "routes/help-category.tsx"),
    route("help/article/:slug", "routes/help-article.tsx"),
  ]),
  route("sitemap.xml", "routes/sitemap.xml.tsx"),
] satisfies RouteConfig;
