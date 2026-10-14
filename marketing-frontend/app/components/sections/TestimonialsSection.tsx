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
    quote: "MurihSpace changed how I connect with my audience. I've built a real community that actually pays for my work, all privately.",
    author: "Amara O.",
    role: "Digital creator, 45K followers",
  },
  {
    quote: "The storefront and messaging alone saved me thousands in platform fees. And my fans love interacting with me directly.",
    author: "James K.",
    role: "Course creator & coach",
  },
  {
    quote: "I tried five platforms before MurihSpace. This is the first one that combines end-to-end privacy, community, and commerce seamlessly.",
    author: "Liam C.",
    role: "Photographer & educator",
  },
];

export function TestimonialsSection() {
  const { data: testimonials } = useCmsCollection<CmsTestimonial>("testimonials", defaultTestimonials);

  return (
    <section className="bg-white py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.5 }}
          className="text-center max-w-2xl mx-auto mb-16"
        >
          <span className="text-xs font-bold uppercase tracking-wider text-[#2164B6] bg-[#E8F8FF] px-3.5 py-1.5 rounded-full mb-3 inline-block">
            Community Love
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#102840]">
            Loved by creators worldwide
          </h2>
          <p className="mt-4 text-[#5A7184] text-lg">
            Hear from members who run their entire business on MurihSpace.
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
              className="rounded-3xl border border-[#D6E0E8] bg-[#F7FAFC] p-8 flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow"
            >
              <div>
                <Quote className="size-8 text-[#38A8D8] mb-4" />
                <p className="text-[#102840] text-base leading-relaxed italic">
                  "{t.quote}"
                </p>
              </div>
              <div className="mt-6 pt-6 border-t border-[#D6E0E8] flex items-center gap-3">
                <div className="size-10 rounded-full bg-[#102840] text-white flex items-center justify-center font-bold text-sm">
                  {t.author.charAt(0)}
                </div>
                <div>
                  <div className="font-bold text-sm text-[#102840]">{t.author}</div>
                  <div className="text-xs text-[#5A7184]">{t.role}</div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default TestimonialsSection;
