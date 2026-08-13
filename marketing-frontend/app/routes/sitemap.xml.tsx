import type { Route } from "./+types/sitemap.xml";
import { getCategories, getArticles } from "../lib/help";

const STATIC_URLS = ["", "/features", "/pricing", "/creators", "/blog", "/help", "/privacy", "/terms"];

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildUrl(siteUrl: string, rel: string): string {
  const path = rel === "" ? "" : `/${rel.replace(/^\//, "")}`;
  return esc(`${siteUrl}${path}`);
}

export async function loader({ request }: Route.LoaderArgs) {
  let siteUrl = import.meta.env.VITE_SITE_URL;
  if (!siteUrl) {
    siteUrl = import.meta.env.PROD ? new URL(request.url).origin : "http://localhost:3000";
  }
  siteUrl = siteUrl.replace(/\/+$/, "");

  const [articles, categories] = await Promise.all([getArticles(), getCategories()]);
  const items = [
    ...STATIC_URLS.map((p) => `<loc>${buildUrl(siteUrl, p)}</loc>`),
    ...categories.map((c) => `<loc>${buildUrl(siteUrl, `/help/category/${c.slug}`)}</loc>`),
    ...articles.map((a) => `<loc>${buildUrl(siteUrl, `/help/article/${a.slug}`)}</loc>`),
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${items.map((loc) => `<url>${loc}</url>`).join("\n  ")}
</urlset>`;
  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}