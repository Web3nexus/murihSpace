import { useState, useEffect } from "react";
import { Link } from "react-router";
import { useAuth } from "@/hooks/useAuth";
import { apiClient } from "@/lib/api/client";
import {
  ArrowSquareOut,
  SealCheck,
  DotsThree,
  Info,
  Storefront,
} from "@phosphor-icons/react";

interface SponsoredAdItem {
  id: string | number;
  campaign_id: number | string;
  advertiser_name: string;
  advertiser_avatar?: string | null;
  headline: string;
  description: string;
  media_url?: string;
  media_type?: string;
  cta_text?: string;
  destination_url?: string;
  badge?: string;
}

export function SponsoredRightRail() {
  const { user } = useAuth();
  const [ads, setAds] = useState<SponsoredAdItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Strictly suppress sponsored ads for admin users
  if (user?.role === "admin") {
    return null;
  }

  useEffect(() => {
    let cancelled = false;

    apiClient
      .get<{ status: string; data: SponsoredAdItem[] }>("/ads/sponsored?placement=right_rail&limit=2")
      .then((res) => {
        if (cancelled) return;
        if (res.data?.data && Array.isArray(res.data.data)) {
          setAds(res.data.data);
          // Record impressions
          res.data.data.forEach((ad) => {
            apiClient.post("/ads/track/impression", { ad_id: ad.id, campaign_id: ad.campaign_id }).catch(() => {});
          });
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleAdClick = (ad: SponsoredAdItem) => {
    apiClient.post("/ads/track/click", { ad_id: ad.id, campaign_id: ad.campaign_id }).catch(() => {});
  };

  if (!loading && ads.length === 0) {
    return null;
  }

  return (
    <aside className="w-[280px] xl:w-[320px] shrink-0 sticky top-16 self-start space-y-4 py-3 select-none">
      {/* ── Section Header ── */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground/90">
            Sponsored
          </span>
          <span title="Sponsored content curated for your space" className="cursor-help text-muted-foreground/60 hover:text-muted-foreground">
            <Info weight="bold" className="w-3.5 h-3.5" />
          </span>
        </div>

        <Link
          to="/app/ads"
          className="text-[11px] font-semibold text-[#2164b6] dark:text-[#7ab0ff] hover:underline flex items-center gap-1"
        >
          <span>Create Ad</span>
        </Link>
      </div>

      {/* ── Sponsored Ads List ── */}
      <div className="space-y-3.5">
        {loading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="p-3.5 rounded-2xl bg-card border border-border/60 animate-pulse space-y-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-muted" />
                  <div className="h-3 w-28 bg-muted rounded" />
                </div>
                <div className="h-28 w-full bg-muted rounded-xl" />
                <div className="h-3 w-3/4 bg-muted rounded" />
              </div>
            ))}
          </div>
        ) : (
          ads.map((ad) => {
            const isInternal = ad.destination_url?.startsWith("/");

            return (
              <div
                key={ad.id}
                className="group rounded-2xl bg-card border border-border/70 overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col"
              >
                {/* Header: Advertiser Info */}
                <div className="p-3 pb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-primary/10 overflow-hidden shrink-0 flex items-center justify-center font-bold text-xs text-primary">
                      {ad.advertiser_avatar ? (
                        <img src={ad.advertiser_avatar} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <Storefront weight="fill" className="w-4 h-4" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-bold text-foreground truncate">
                          {ad.advertiser_name}
                        </span>
                        <SealCheck weight="fill" className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                      </div>
                      <span className="text-[10px] text-muted-foreground block truncate">
                        Sponsored
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="p-1 text-muted-foreground hover:text-foreground rounded-lg"
                    title="Ad Options"
                  >
                    <DotsThree weight="bold" className="w-4 h-4" />
                  </button>
                </div>

                {/* Media Creative */}
                {ad.media_url && (
                  <div className="relative aspect-video w-full overflow-hidden bg-slate-900">
                    <img
                      src={ad.media_url}
                      alt={ad.headline}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded-md bg-black/60 backdrop-blur-xs text-[9px] font-bold text-white uppercase tracking-wider">
                      Ad
                    </div>
                  </div>
                )}

                {/* Body Details */}
                <div className="p-3 space-y-2 flex-1 flex flex-col justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-foreground leading-snug line-clamp-2 group-hover:text-[#2164b6] dark:text-[#7ab0ff] transition-colors">
                      {ad.headline}
                    </h4>
                    <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                      {ad.description}
                    </p>
                  </div>

                  {/* Action CTA Link */}
                  {ad.destination_url && (
                    <div className="pt-1">
                      {isInternal ? (
                        <Link
                          to={ad.destination_url}
                          onClick={() => handleAdClick(ad)}
                          className="w-full h-8 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-[#2164b6] dark:text-[#7ab0ff] font-bold text-xs transition-colors flex items-center justify-center gap-1.5"
                        >
                          <span>{ad.cta_text || "Learn More"}</span>
                          <ArrowSquareOut weight="bold" className="w-3.5 h-3.5" />
                        </Link>
                      ) : (
                        <a
                          href={ad.destination_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => handleAdClick(ad)}
                          className="w-full h-8 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-[#2164b6] dark:text-[#7ab0ff] font-bold text-xs transition-colors flex items-center justify-center gap-1.5"
                        >
                          <span>{ad.cta_text || "Learn More"}</span>
                          <ArrowSquareOut weight="bold" className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}

