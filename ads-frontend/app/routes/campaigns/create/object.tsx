import { Link, useSearchParams } from "react-router";
import { Button } from "../../../components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription } from "../../../components/ui/card";
import { User, FileText, Store, ShoppingCart, Users, Calendar } from "lucide-react";

const objects = [
  { id: "profile", title: "Profile", description: "Promote your creator or business profile.", icon: User },
  { id: "post", title: "Post", description: "Boost an existing organic post.", icon: FileText },
  { id: "store", title: "Store", description: "Drive traffic to your MurihSpace store.", icon: Store },
  { id: "product", title: "Product", description: "Highlight a specific product from your catalog.", icon: ShoppingCart },
  { id: "community", title: "Community", description: "Grow your MurihSpace community.", icon: Users },
  { id: "event", title: "Event", description: "Get more registrations for an upcoming event.", icon: Calendar },
];

export default function CreateCampaignObject() {
  const [searchParams] = useSearchParams();
  const objective = searchParams.get("objective");

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-8 py-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">What do you want to promote?</h2>
        <p className="text-muted-foreground mt-2">Select the destination or object for your ad (Objective: {objective}).</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {objects.map((obj) => (
          <Link key={obj.id} to={`/campaigns/create/details?objective=${objective}&object=${obj.id}`} className="block">
            <Card className="h-full hover:border-primary cursor-pointer transition-colors">
              <CardHeader>
                <obj.icon className="h-8 w-8 mb-4 text-primary" />
                <CardTitle className="text-xl">{obj.title}</CardTitle>
                <CardDescription>{obj.description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
      
      <div className="flex justify-between mt-4">
        <Button variant="outline" asChild>
          <Link to="/campaigns/create/objective">Back</Link>
        </Button>
      </div>
    </div>
  );
}
