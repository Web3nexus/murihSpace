import { useState } from "react";
import { Button } from "../../../components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "../../../components/ui/card";
import { CheckCircle, ShieldAlert } from "lucide-react";

export default function AdvertiserVerification() {
  const [advertisers, setAdvertisers] = useState([
    { id: 101, name: "Acme Corp", current_status: "basic", document_submitted: "Business License" },
    { id: 102, name: "John Doe LLC", current_status: "unverified", document_submitted: "Passport" },
  ]);

  const handleAction = async (id: number, action: 'approve' | 'reject') => {
    try {
      const res = await fetch(`${import.meta.env.VITE_ADS_API_URL}/api/admin/advertisers/${id}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        setAdvertisers(advertisers.filter(a => a.id !== id));
        alert(`Advertiser ${id} ${action}d successfully.`);
      } else {
        alert("Failed to process advertiser.");
      }
    } catch (err) {
      alert("Error contacting API.");
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Advertiser Verification</h2>
          <p className="text-muted-foreground mt-2">Review KYC/KYB documents to elevate advertiser verification status.</p>
        </div>
      </div>
      
      {advertisers.length === 0 ? (
        <div className="p-8 text-center text-muted-foreground border rounded-md">
          All advertisers are fully verified.
        </div>
      ) : (
        <div className="grid gap-4">
          {advertisers.map(adv => (
            <Card key={adv.id} className="flex items-center justify-between p-6">
              <div>
                <CardTitle className="text-xl flex items-center gap-2">
                  {adv.name}
                  <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full uppercase">
                    {adv.current_status}
                  </span>
                </CardTitle>
                <div className="text-sm text-muted-foreground mt-2 flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4" />
                  Document for review: <strong>{adv.document_submitted}</strong>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => handleAction(adv.id, 'reject')}>Reject</Button>
                <Button onClick={() => handleAction(adv.id, 'approve')}>
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
