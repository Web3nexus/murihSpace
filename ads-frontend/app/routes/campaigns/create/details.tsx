import { Link, useSearchParams, Form, redirect, useActionData } from "react-router";
import type { ActionFunctionArgs } from "react-router";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const data = Object.fromEntries(formData);

  try {
    const res = await fetch(`${import.meta.env.VITE_ADS_API_URL}/api/campaigns`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      return redirect("/campaigns");
    }
    return { error: "Failed to publish campaign." };
  } catch (err) {
    return { error: "API connection error." };
  }
}

export default function CreateCampaignDetails() {
  const [searchParams] = useSearchParams();
  const objective = searchParams.get("objective") ?? "";
  const object = searchParams.get("object") ?? "";
  const actionData = useActionData<{ error?: string }>();

  return (
    <Form method="post" className="max-w-4xl mx-auto flex flex-col gap-8 py-8">
      <input type="hidden" name="objective" value={objective} />
      <input type="hidden" name="object" value={object} />
      
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Campaign Details</h2>
        <p className="text-muted-foreground mt-2">Configure your Ad Group and Ad creatives.</p>
        {actionData?.error && (
          <p className="text-red-600 mt-2 font-medium">{actionData.error}</p>
        )}
      </div>

      <div className="grid gap-8">
        <div className="grid gap-4 bg-card p-6 rounded-lg border shadow-sm">
          <h3 className="text-xl font-semibold">1. Campaign Settings</h3>
          <div className="grid gap-2">
            <Label htmlFor="campaign-name">Campaign Name</Label>
            <Input 
              id="campaign-name" 
              name="name" 
              placeholder={objective ? `New ${objective} Campaign` : "New Campaign"} 
              required 
            />
          </div>
        </div>

        <div className="grid gap-4 bg-card p-6 rounded-lg border shadow-sm">
          <h3 className="text-xl font-semibold">2. Ad Group Settings</h3>
          <div className="grid gap-2">
            <Label htmlFor="daily-budget">Daily Budget (USD)</Label>
            <Input id="daily-budget" name="daily_budget" type="number" placeholder="50.00" required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="audience">Target Audience</Label>
            <div className="p-4 border border-dashed rounded-md text-sm text-muted-foreground">
              Audience selection component will be implemented here.
            </div>
          </div>
        </div>

        <div className="grid gap-4 bg-card p-6 rounded-lg border shadow-sm">
          <h3 className="text-xl font-semibold">3. Ad Creative</h3>
          <div className="grid gap-2">
            <Label>Promoted Object</Label>
            <Input disabled value={object ? object.toUpperCase() : "Select object"} />
          </div>
          <div className="p-8 border border-dashed rounded-md text-center text-muted-foreground">
            Media uploader and text editor will be implemented here.
          </div>
        </div>
      </div>
      
      <div className="flex justify-between mt-4">
        <Button variant="outline" render={<Link to={`/campaigns/create/object?objective=${encodeURIComponent(objective)}`} />}>Back</Button>
        <Button type="submit">
          Publish Campaign
        </Button>
      </div>
    </Form>
  );
}
