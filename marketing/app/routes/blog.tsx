export function meta() {
  return [
    { title: "Blog — MurihSpace" },
    { name: "description", content: "Tips, guides, and stories from the MurihSpace team." },
  ];
}

export default function Blog() {
  return (
    <div className="flex-1 flex items-center justify-center py-24">
      <div className="text-center max-w-lg mx-auto px-6">
        <h1 className="text-3xl font-bold tracking-tight">Blog</h1>
        <p className="mt-3 text-muted-foreground">
          Articles coming soon. We'll be sharing tips and guides for creators.
        </p>
      </div>
    </div>
  );
}
