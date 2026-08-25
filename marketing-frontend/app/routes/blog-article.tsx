import { useLoaderData, Link } from "react-router";
import type { Route } from "./+types/blog-article";
import { fetchCmsSection } from "../lib/cms";

export async function loader({ params }: Route.LoaderArgs) {
  const items = await fetchCmsSection("blog");
  const post = items?.find((item) => item.slug === params.slug) ?? null;
  return { post };
}

export function meta({ loaderData }: Route.MetaArgs) {
  return [
    { title: loaderData?.post?.title ?? "Blog — MurihSpace" },
    { name: "description", content: loaderData?.post?.excerpt ?? undefined },
  ];
}

export default function BlogArticle() {
  const { post } = useLoaderData<typeof loader>();

  if (!post) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-24 text-center">
        <h1 className="text-2xl font-bold tracking-tight">Article not found</h1>
        <Link to="/blog" className="mt-4 inline-block text-sm text-primary hover:underline">
          ← Back to blog
        </Link>
      </div>
    );
  }

  const body = post.body ?? "";

  return (
    <article className="mx-auto max-w-3xl px-6 py-16 md:py-20">
      <Link to="/blog" className="text-sm text-primary hover:underline">
        ← Back to blog
      </Link>
      <h1 className="mt-6 text-3xl md:text-4xl font-bold tracking-tight">
        {post.title}
      </h1>
      {post.published_at && (
        <p className="mt-4 text-sm text-muted-foreground">
          {new Date(post.published_at).toLocaleDateString(undefined, {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>
      )}
      {post.excerpt && (
        <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
          {post.excerpt}
        </p>
      )}
      {body && (
        <div className="mt-8 prose prose-slate max-w-none">
          {body.split(/\n{2,}/).map((block, i) => {
            const isHeading = /^#{1,3}\s/.test(block);
            return isHeading ? (
              <h2 key={i} className="mt-8 text-2xl font-bold tracking-tight first:mt-0">
                {block.replace(/^#{1,3}\s/, "")}
              </h2>
            ) : (
              <p key={i} className="mt-4 leading-relaxed text-muted-foreground">
                {block}
              </p>
            );
          })}
        </div>
      )}
    </article>
  );
}
