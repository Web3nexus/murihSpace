import { motion } from "motion/react";
import { Quote } from "lucide-react";
import { useCmsCollection } from "../../hooks/useCms";

interface CmsTestimonial {
  quote: string;
  author: string;
  role: string;
}

const defaultTestimonials: CmsTestimonial[] = [
  {
    quote: "MurihSpace changed how I connect with my audience. I've built a real community that actually pays for my work.",
    author: "Amara O.",
    role: "Digital creator, 45K followers",
  },
  {
    quote: "The storefront alone saved me thousands in platform fees. And my fans love buying directly from me.",
    author: "James K.",
    role: "Course creator & coach",
  },
  {
    quote: "I tried five platforms before MurihSpace. This is the first one that actually feels like it was built for creators like me.",
    author: "Liam C.",
    role: "Photographer & educator",
  },
];

export function TestimonialsSection() {
  const { data: testimonials } = useCmsCollection<CmsTestimonial>("testimonials", defaultTestimonials);

  return (
    <section className="py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.5 }}
          className="text-center max-w-2xl mx-auto mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
            Loved by creators{" "}
            <span className="bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">
              worldwide
            </span>
          </h2>
          <p className="mt-4 text-muted-foreground text-lg">
            Don't take our word for it.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonials.map((t, index) => (
            <motion.div
              key={t.author}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
              className="relative rounded-xl border border-border/50 bg-background p-6"
            >
              <Quote className="size-6 text-primary/30 mb-3" />
              <p className="text-sm leading-relaxed text-muted-foreground mb-4">
                "{t.quote}"
              </p>
              <div className="flex items-center gap-3">
                <div className="size-8 rounded-full bg-gradient-to-br from-primary/30 to-purple-500/30" />
                <div>
                  <div className="text-sm font-medium">{t.author}</div>
                  <div className="text-xs text-muted-foreground">{t.role}</div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
