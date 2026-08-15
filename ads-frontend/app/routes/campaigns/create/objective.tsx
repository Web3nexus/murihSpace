import { Link } from "react-router";
import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../../components/ui/card";
import { Telescope, MousePointerClick, ShoppingBag, Users, MessagesSquare, Heart } from "lucide-react";

const objectives = [
  { id: "awareness", title: "Get discovered", description: "Show your ads to people who are most likely to remember them.", icon: Telescope },
  { id: "traffic", title: "Get more visitors", description: "Send people to a destination, like your website or app.", icon: MousePointerClick },
  { id: "sales", title: "Sell products", description: "Find people likely to purchase your goods or services.", icon: ShoppingBag },
  { id: "followers", title: "Get more followers", description: "Grow your audience on MurihSpace.", icon: Users },
  { id: "community", title: "Grow my community", description: "Encourage people to join and engage with your community.", icon: Heart },
  { id: "messages", title: "Get more messages", description: "Encourage people to start a conversation with your business.", icon: MessagesSquare },
];

export default function CreateCampaignObjective() {
  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-8 py-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">What do you want to achieve?</h2>
        <p className="text-muted-foreground mt-2">Choose a campaign objective that aligns with your business goals.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {objectives.map((obj) => (
          <Link key={obj.id} to={`/campaigns/create/object?objective=${obj.id}`} className="block">
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
      
      <div className="flex justify-end mt-4">
        <Button variant="outline" render={<Link to="/campaigns" />}>Cancel</Button>
      </div>
    </div>
  );
}
