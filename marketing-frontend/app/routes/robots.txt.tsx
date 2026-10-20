// The hidden staff sign-in path is deliberately not listed here. Listing a
// Disallow path would publish it. The staff page is kept out of search by its
// noindex meta tag and by having no link anywhere on the site.
export function loader() {
  const body = ["User-agent: *", "Allow: /", ""].join("\n");

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
