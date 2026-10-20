import { useEffect, useState } from "react";
import { Button } from "../../../components/ui/button";
import { Card, CardTitle } from "../../../components/ui/card";
import { CheckCircle, ShieldAlert } from "lucide-react";
import { AdsApiError, adsRequest } from "../../../lib/ads-api";

interface PendingAdvertiser {
  id: number;
  business_name: string | null;
  verification_status: string;
}

export default function AdvertiserVerification() {
  const [advertisers, setAdvertisers] = useState<PendingAdvertiser[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  useEffect(() => {
    adsRequest<{ data: PendingAdvertiser[] }>("/admin/advertisers/pending")
      .then((res) => setAdvertisers(res.data ?? []))
      .catch((err: unknown) => {
        setLoadError(err instanceof AdsApiError ? err.message : "Could not load the verification queue.");
        setAdvertisers([]);
      });
  }, []);

  const approve = async (id: number) => {
    setBusyId(id);
    setActionError(null);
    try {
      await adsRequest(`/admin/advertisers/${id}/verify`, {
        method: "POST",
        body: { status: "identity_verified" },
      });
      setAdvertisers((list) => (list ?? []).filter((a) => a.id !== id));
    } catch (err: unknown) {
      setActionError(err instanceof AdsApiError ? err.message : "Could not approve this advertiser.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Advertiser Verification</h2>
          <p className="text-muted-foreground mt-2">Advertisers waiting for verification status to be raised.</p>
        </div>
      </div>

      {loadError && <p role="alert" className="text-sm text-red-700">{loadError}</p>}
      {actionError && <p role="alert" className="text-sm text-red-700">{actionError}</p>}

      {advertisers === null ? (
        <div className="p-8 text-center text-muted-foreground border rounded-md">Loading...</div>
      ) : advertisers.length === 0 ? (
        <div className="p-8 text-center text-muted-foreground border rounded-md">
          {loadError ? "The queue is unavailable." : "No advertisers are waiting for verification."}
        </div>
      ) : (
        <div className="grid gap-4">
          {advertisers.map((adv) => (
            <Card key={adv.id} className="flex items-center justify-between p-6">
              <div>
                <CardTitle className="text-xl flex items-center gap-2">
                  {adv.business_name || `Advertiser #${adv.id}`}
                  <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full uppercase">
                    {adv.verification_status}
                  </span>
                </CardTitle>
                <div className="text-sm text-muted-foreground mt-2 flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4" />
                  Advertiser ID: <strong>{adv.id}</strong>
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => approve(adv.id)} disabled={busyId === adv.id}>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Approve Verification
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
