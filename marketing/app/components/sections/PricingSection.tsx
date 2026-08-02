import { motion } from "motion/react";
import { Check, ArrowRight } from "lucide-react";
import { Link } from "react-router";
import { Button } from "../ui/button";

const plans = [
  {
    name: "Starter",
    price: "Free",
    description: "Perfect for getting started",
    features: [
      "Basic community access",
      "Public profile",
      "Up to 100 members",
      "Basic analytics",
    ],
    cta: "Get started",
    popular: false,
  },
  {
    name: "Creator",
    price: "$12",
    period: "/month",
    description: "For serious creators",
    features: [
      "Everything in Starter",
      "Custom storefront",
      "Unlimited members",
      "Sell digital products",
      "Real-time messaging",
      "AI-powered insights",
      "Priority support",
    ],
    cta: "Start creating",
    popular: true,
  },
  {
    name: "Vendor",
    price: "$29",
    period: "/month",
    description: "For growing businesses",
    features: [
      "Everything in Creator",
      "Physical product sales",
      "Shipping & fulfilment",
      "Team management",
      "Advanced analytics",
      "Custom domain",
      "API access",
    ],
    cta: "Go Pro",
    popular: false,
  },
];

export function PricingSection() {
  return (
    <section className="py-20 md:py-28 bg-muted/30" id="pricing">
      <div className="mx-auto max-w-7xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.5 }}
          className="text-center max-w-2xl mx-auto mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
            Simple pricing.{" "}
            <span className="bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">
              No surprises.
            </span>
          </h2>
          <p className="mt-4 text-muted-foreground text-lg">
            Start free. Upgrade when you're ready.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {plans.map((plan, index) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
              className={`relative rounded-xl border p-6 ${
                plan.popular
                  ? "border-primary/50 bg-background shadow-lg shadow-primary/5"
                  : "border-border/50 bg-background"
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-xs font-medium text-primary-foreground">
                  Most popular
                </div>
              )}
              <div className="mb-6">
                <h3 className="font-semibold text-lg">{plan.name}</h3>
                <div className="mt-2 flex items-baseline gap-0.5">
                  <span className="text-3xl font-extrabold tracking-tight">
                    {plan.price}
                  </span>
                  {plan.period && (
                    <span className="text-sm text-muted-foreground">
                      {plan.period}
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {plan.description}
                </p>
              </div>

              <ul className="space-y-2.5 mb-6">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm">
                    <Check className="size-4 text-primary shrink-0" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <Link to="/register">
                <Button
                  variant={plan.popular ? "default" : "outline"}
                  className="w-full h-10 gap-2"
                >
                  {plan.cta}
                  <ArrowRight className="size-4" />
                </Button>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
