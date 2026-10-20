import { Scale } from "lucide-react";

export function meta() {
  return [
    { title: "Terms of Service | MurihSpace" },
    {
      name: "description",
      content:
        "Read the MurihSpace Terms of Service governing platform usage, creator monetization, and community conduct.",
    },
  ];
}

export default function TermsPage() {
  return (
    <div className="bg-[#F7FAFC] py-16 md:py-24">
      <div className="mx-auto max-w-4xl px-6">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 rounded-full bg-[#2164B6]/10 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-[#2164B6] mb-4">
            <Scale className="size-4" />
            <span>Platform Agreement</span>
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-[#102840]">
            Terms of Service
          </h1>
          <p className="mt-4 text-base md:text-lg text-[#5A7184] max-w-2xl mx-auto">
            These terms govern your access to and use of MurihSpace products, services, creator tools, and commerce infrastructure.
          </p>
        </div>

        {/* Content Body */}
        <div className="rounded-3xl border border-[#D6E0E8] bg-white p-8 md:p-12 shadow-sm space-y-8 text-sm md:text-base text-[#5A7184] leading-relaxed">
          <section>
            <h2 className="text-xl font-bold text-[#102840] mb-3">1. Account Registration & Conduct</h2>
            <p>
              To access MurihSpace, you agree to provide truthful account information and uphold community safety. You may not use MurihSpace for unlawful activities, harassment, unauthorized spam distribution, or copyright infringement.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#102840] mb-3">2. Creator Rights & Content Ownership</h2>
            <p>
              Creators retain 100% intellectual property ownership of courses, media, digital downloads, and community posts published on MurihSpace. You grant MurihSpace only the non-exclusive technical license required to host and deliver your content to your audience.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#102840] mb-3">3. Commerce, Payments & Escrow</h2>
            <p>
              Vendors and creators selling digital or physical products must comply with KYC verification standards. Customer funds for physical and custom milestone contracts are held in escrow until product shipment or fulfillment is confirmed.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#102840] mb-3">4. Termination & Dispute Resolution</h2>
            <p>
              MurihSpace reserves the right to suspend accounts that engage in fraudulent behavior, chargeback manipulation, or terms violations. Disputes are resolved in accordance with applicable commercial mediation guidelines.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

