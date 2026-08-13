import { motion } from "motion/react";
import { useCmsCollection } from "../../hooks/useCms";

interface CmsStat {
  value: string;
  label: string;
}

const defaultStats: CmsStat[] = [
  { value: "12K+", label: "Active creators" },
  { value: "340K+", label: "Community members" },
  { value: "$2.8M", label: "Paid out to creators" },
  { value: "99.9%", label: "Platform uptime" },
];

export function StatsSection() {
  const { data: stats } = useCmsCollection<CmsStat>("stats", defaultStats);

  return (
    <section className="py-16 md:py-20 border-y border-border/50 bg-muted/30">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
          {stats.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
              className="text-center"
            >
              <div className="text-3xl md:text-4xl font-extrabold tracking-tight bg-gradient-to-b from-foreground to-foreground/70 bg-clip-text text-transparent">
                {stat.value}
              </div>
              <div className="text-sm text-muted-foreground mt-1.5">
                {stat.label}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
