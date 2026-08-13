import { useState, useEffect } from "react";
import { Button } from "../../../components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "../../../components/ui/card";
import { CheckCircle, XCircle } from "lucide-react";

export default function ModerationCreatives() {
  const [creatives, setCreatives] = useState([
    { id: 1, advertiser: "Nike Official", type: "video", status: "pending", created_at: "2 hours ago" },
    { id: 2, advertiser: "Tech Gadgets Store", type: "single_image", status: "pending", created_at: "3 hours ago" },
  ]);

  const handleModerate = async (id: number, action: 'approve' | 'reject') => {
    try {
      const res = await fetch(`${import.meta.env.VITE_ADS_API_URL}/api/admin/creatives/${id}/moderate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        setCreatives(creatives.filter(c => c.id !== id));
        alert(`Creative ${id} ${action}d successfully.`);
      } else {
        alert("Failed to moderate creative.");
      }
    } catch (err) {
      alert("Error contacting API.");
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Creative Moderation</h2>
          <p className="text-muted-foreground mt-2">Review pending creatives to ensure they comply with MurihSpace Advertising Policies.</p>
        </div>
      </div>
      
      {creatives.length === 0 ? (
        <div className="p-8 text-center text-muted-foreground border rounded-md">
          No pending creatives in the queue! 🎉
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {creatives.map(creative => (
            <Card key={creative.id}>
              <CardHeader>
                <CardTitle className="text-lg">{creative.advertiser}</CardTitle>
                <div className="text-sm text-muted-foreground">Type: {creative.type} | Submitted: {creative.created_at}</div>
              </CardHeader>
              <CardContent>
                <div className="aspect-video bg-slate-100 flex items-center justify-center border rounded">
                  <span className="text-muted-foreground">Creative Preview Placeholder</span>
                </div>
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => handleModerate(creative.id, 'reject')}>
                  <XCircle className="mr-2 h-4 w-4" />
                  Reject
                </Button>
                <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={() => handleModerate(creative.id, 'approve')}>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Approve
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
