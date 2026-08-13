import { authFetch } from "@/lib/api/authFetch";
import { useState, useEffect } from "react";
import { useParams, Link } from "react-router";
import { Loader2, AlertTriangle } from "lucide-react";
import type { LinkBioPageData } from "@/lib/linkBioTypes";
import TemplateRenderer from "@/components/linkbio/TemplateRenderer";



export default function PublicLinkInBioPage() {
  const { username } = useParams<{ username: string }>();
  const cleanUsername = (username ?? '').replace(/^@/, '');
  const [data, setData] = useState<LinkBioPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!cleanUsername) return;
    (async () => {
      try {
        const res = await authFetch(`/l/${encodeURIComponent(cleanUsername)}`, { headers: { Accept: "application/json" } });
        if (res.status === 404) { setNotFound(true); return; }
        if (!res.ok) { setNotFound(true); return; }
        const j = await res.json();
        const d = j?.success ? j?.data : j;
        setData(d?.data ?? d);
      } catch { setNotFound(true); }
      finally { setLoading(false); }
    })();
  }, [cleanUsername]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: '#2164b6' }} />
      </div>
    );
  }

  if (notFound || !data) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center space-y-4">
        <div className="p-4 rounded-full bg-destructive/10 text-destructive"><AlertTriangle className="h-8 w-8" /></div>
        <h2 className="text-xl font-bold text-foreground">Page Not Found</h2>
        <p className="text-sm text-muted-foreground max-w-sm">This link-in-bio page doesn't exist. The user may not have set up their page yet.</p>
        <Link to="/app" className="text-xs font-bold text-[#2164b6] dark:text-[#7ab0ff] hover:underline">Go to MurihSpace</Link>
      </div>
    );
  }

  return (
    <TemplateRenderer
      data={data}
      linkHref={(link) => `/l/click/${link.id}`}
      productHref={(p) => p.checkout_url ?? "#"}
    />
  );
}
