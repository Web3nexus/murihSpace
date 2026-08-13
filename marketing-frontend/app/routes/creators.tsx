export function meta() {
  return [
    { title: "Creator Stories — MurihSpace" },
    { name: "description", content: "Hear from creators who built their businesses on MurihSpace." },
  ];
}

export default function Creators() {
  return (
    <div className="flex-1 flex items-center justify-center py-24">
      <div className="text-center max-w-lg mx-auto px-6">
        <h1 className="text-3xl font-bold tracking-tight">Creator Stories</h1>
        <p className="mt-3 text-muted-foreground">
          We're collecting stories from our creator community. Check back soon.
        </p>
      </div>
    </div>
  );
}
