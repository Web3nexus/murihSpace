import { useCallback, useEffect, useState } from "react";
import { apiClient } from "@/lib/api/client";

export interface PlatformConfig {
  platform_name: string;
  web_disabled_roles: Array<"member" | "creator" | "vendor">;
  app_download_url: string;
  app_qr_content: string;
  loading: boolean;
}

const EMPTY: Omit<PlatformConfig, "loading"> = {
  platform_name: "MurihSpace",
  web_disabled_roles: [],
  app_download_url: "https://apps.apple.com/app/murihspace",
  app_qr_content: "https://apps.apple.com/app/murihspace",
};

export function usePlatformConfig(): PlatformConfig {
  const [cfg, setCfg] = useState<Omit<PlatformConfig, "loading">>(EMPTY);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get("/platform");
      const j = res.data;
      const d = j?.success ? (j?.data?.data ?? j?.data) : j;
      if (d) {
        setCfg({
          platform_name: d.platform_name || EMPTY.platform_name,
          web_disabled_roles: Array.isArray(d.web_disabled_roles) ? d.web_disabled_roles : [],
          app_download_url: d.app_download_url || EMPTY.app_download_url,
          app_qr_content: d.app_qr_content || d.app_download_url || EMPTY.app_qr_content,
        });
      }
    } catch {
      // keep defaults on network failure
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { ...cfg, loading };
}
