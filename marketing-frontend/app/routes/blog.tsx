import { useCmsSection } from "../hooks/useCms";
import type { CmsContentItem } from "../lib/cms";
import { Link } from "react-router";

interface BlogPost {
  title: string;
  excerpt: string;
  body: string;
  [key: string]: string;
}

const defaultPosts: BlogPost[] = [];

export function meta() {
  return [
    { title: "Blog | MurihSpace" },
    { name: "description", content: "Tips, guides, and stories from the MurihSpace team." },
  ];
}

export default function Blog() {
  const { items, loading } = useCmsSection("blog");

  const posts: Array<CmsContentItem & { content: BlogPost }> =
    items.length > 0
      ? items.map((item) => ({ ...item, content: (item.content ?? {}) as BlogPost }))
      : defaultPosts.map((p) => ({
          id: "",
          slug: "",
          section: "blog",
          title: p.title,
          excerpt: p.excerpt,
          body: p.body,
          content: p,
          sort_order: 0,
          seo_title: null,
          seo_description: null,
          updated_at: null,
          published_at: null,
        }));

  return (
    <div className="mx-auto max-w-5xl px-6 py-20 md:py-24">
      <h1 className="text-3xl font-bold tracking-tight">Blog</h1>
      <p className="mt-3 text-muted-foreground">
        Tips, guides, and stories from the MurihSpace team.
      </p>

      {!loading && posts.length === 0 && (
        <div className="mt-16 text-center text-muted-foreground">
          Articles coming soon. We'll be sharing tips and guides for creators.
        </div>
      )}

      <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-6">
        {posts.map((post) => (
          <Link
            key={post.slug}
            to={`/blog/${post.slug}`}
            className="group rounded-xl border border-border/50 bg-background p-6 hover:border-border/80 hover:shadow-md transition-all"
          >
            <h2 className="font-semibold text-lg group-hover:text-primary transition-colors">
              {post.title ?? post.content.title}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed line-clamp-3">
              {post.excerpt ?? post.content.excerpt}
            </p>
            {post.published_at && (
              <p className="mt-4 text-xs text-muted-foreground">
                {new Date(post.published_at).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
