import { type RouteConfig, index, layout, route } from "@react-router/dev/routes";
import { resolveStaffLoginPath } from "./lib/staff-login";

const staffLoginPath = resolveStaffLoginPath(process.env.STAFF_LOGIN_PATH);

export default [
  layout("components/PublicLayout.tsx", [
    index("routes/home.tsx"),
    route("features", "routes/features.tsx"),
    route("business", "routes/business.tsx"),
    route("ads-manager", "routes/ads-manager.tsx"),
    route("download", "routes/download.tsx"),
    route("creators", "routes/creators.tsx"),
    route("blog", "routes/blog.tsx"),
    route("blog/:slug", "routes/blog-article.tsx"),
    route("help", "routes/help.tsx"),
    route("help/category/:slug", "routes/help-category.tsx"),
    route("help/article/:slug", "routes/help-article.tsx"),
    route("privacy", "routes/privacy.tsx"),
    route("terms", "routes/terms.tsx"),
    route("login", "routes/login.tsx"),
    route("register", "routes/register.tsx"),
    route("web", "routes/web.tsx"),
  ]),
  route("sitemap.xml", "routes/sitemap.xml.tsx"),
  route("robots.txt", "routes/robots.txt.tsx"),
  // Hidden staff sign-in. Deliberately outside PublicLayout so it never gets
  // the site navigation or footer. Do not add it to the sitemap or any menu.
  route(staffLoginPath, "routes/staff-login.tsx"),
] satisfies RouteConfig;
