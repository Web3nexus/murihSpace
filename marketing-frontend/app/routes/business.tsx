import { Link } from "react-router";
import { ShoppingBag, ShieldCheck, Zap, Users, Package, Truck, Award, FileText, ArrowRight, CheckCircle2, Shield, DollarSign } from "lucide-react";
import { getLoginUrl, getRegisterUrl, getWebClientUrl } from "~/lib/env";

export function meta() {
  return [
    { title: "MurihSpace Business | Commerce, Storefronts & Escrow Payments" },
    {
      name: "description",
      content:
        "Empower your business with MurihSpace: Digital and physical storefronts, inventory management, automated order tracking, and escrow-protected payouts.",
    },
  ];
}

export default function BusinessPage() {
  return (
    <div className="bg-[#FAF9F5] text-[#102840]">
      {/* ================= HERO ================= */}
      <section className="hero-section">
        <div className="container-landing">
          <div className="hero-grid">
            <div className="hero-content">
              <span className="feature-tag">MurihSpace Commerce &amp; Retail</span>
              <h1 className="title-hero">Grow your business with MurihSpace</h1>
              <p className="subtitle-hero">
                Sell digital downloads, courses, physical merchandise, and coaching packages. Integrated inventory, automated order tracking, and escrow protection keep every transaction secure.
              </p>
              <div className="hero-actions">
                <a href={getRegisterUrl()} className="btn-wa-primary">
                  Get Started Free
                </a>
                <a href={getWebClientUrl()} className="btn-wa-outline">
                  Open Web Dashboard
                </a>
              </div>
            </div>

            {/* Right Hero Visual: Bespoke Storefront Preview Card */}
            <div className="hero-visual-wrapper">
              <div className="feature-card-frame bg-white p-6 rounded-3xl border border-[#D6E0E8] shadow-xl">
                <div className="flex items-center justify-between pb-4 border-b border-[#D6E0E8]">
                  <div className="flex items-center gap-2">
                    <ShoppingBag className="size-5 text-[#2164B6]" />
                    <span className="text-sm font-bold text-[#102840]">Studio Sarah Jenkins</span>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200 flex items-center gap-1">
                    <Award className="size-3" /> KYC Verified Vendor
                  </span>
                </div>

                <div className="my-5 flex flex-col gap-3">
                  <div className="p-3.5 rounded-2xl bg-[#FAF9F5] border border-[#D6E0E8] flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-[#102840]">Design System Masterclass</h4>
                      <p className="text-[11px] text-[#5A7184] mt-0.5">Digital Video Course • 12 Lessons</p>
                    </div>
                    <span className="text-sm font-extrabold text-[#2164B6]">$79.00</span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-[#FAF9F5] border border-[#D6E0E8] flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-[#102840]">Official Creator Hoodie (Heavyweight)</h4>
                      <p className="text-[11px] text-[#5A7184] mt-0.5">Physical Merch • 18 in stock</p>
                    </div>
                    <span className="text-sm font-extrabold text-[#2164B6]">$65.00</span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-[#FAF9F5] border border-[#D6E0E8] flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-[#102840]">1-on-1 Portfolio Teardown (60 Min)</h4>
                      <p className="text-[11px] text-[#5A7184] mt-0.5">Live Coaching • Calendar Sync</p>
                    </div>
                    <span className="text-sm font-extrabold text-[#2164B6]">$120.00</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[#E8F8FF] border border-[#D6E0E8] flex items-center justify-between text-xs text-[#2164B6]">
                  <span className="font-semibold flex items-center gap-1.5">
                    <ShieldCheck className="size-4" /> Protected by Milestone Escrow
                  </span>
                  <span className="font-bold">0% Setup Fee</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= TWO TIERS / SOLUTIONS ================= */}
      <section className="feature-section bg-white" id="solutions">
        <div className="container-landing">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="feature-tag justify-center">Tailored Commerce</span>
            <h2 className="title-section">Solutions for every vendor &amp; merchant</h2>
            <p className="subtitle-hero mt-3">
              Whether you are a solo creator selling downloads or a multi-location merchant shipping physical goods globally.
            </p>
          </div>

          <div className="download-platforms-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))" }}>
            {/* Solution 1: Creator & Independent Merchant */}
            <div className="platform-card items-start text-left">
              <span className="feature-tag text-[#2164B6]">For Creators &amp; Solo Vendors</span>
              <h3 className="platform-title mt-2">MurihSpace Storefront</h3>
              <p className="platform-desc">
                An instant commerce storefront directly inside your community feed to sell goods and services effortlessly.
              </p>
              <ul className="flex flex-col gap-3 my-4 list-none p-0 text-sm">
                <li className="flex items-start gap-2.5">
                  <ShoppingBag className="size-4 text-[#2164B6] shrink-0 mt-0.5" />
                  <span><strong>Digital &amp; Physical Products:</strong> E-books, presets, templates, apparel, and crafts.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <ShieldCheck className="size-4 text-[#2164B6] shrink-0 mt-0.5" />
                  <span><strong>Escrow Protection:</strong> Buyers and sellers are protected with milestone escrow.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Zap className="size-4 text-[#2164B6] shrink-0 mt-0.5" />
                  <span><strong>Quick Checkout:</strong> Frictionless in-chat purchasing and automated download delivery.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Users className="size-4 text-[#2164B6] shrink-0 mt-0.5" />
                  <span><strong>Customer Management:</strong> Segment buyers, track order states, and communicate directly.</span>
                </li>
              </ul>
              <a href={getRegisterUrl()} className="btn-wa-primary w-full text-center mt-auto">
                Open Free Storefront
              </a>
            </div>

            {/* Solution 2: Merchant & Enterprise */}
            <div className="platform-card items-start text-left border-[#2164B6]">
              <div className="platform-badge-recommended">Verified Merchant</div>
              <span className="feature-tag text-[#2164B6] mt-2">For Brands &amp; Volume Merchants</span>
              <h3 className="platform-title mt-2">MurihSpace Merchant Suite</h3>
              <p className="platform-desc">
                Complete back-office capabilities with multi-inventory warehousing, automated shipping, and KYC verification.
              </p>
              <ul className="flex flex-col gap-3 my-4 list-none p-0 text-sm">
                <li className="flex items-start gap-2.5">
                  <Package className="size-4 text-[#2164B6] shrink-0 mt-0.5" />
                  <span><strong>Inventory &amp; Warehousing:</strong> Real-time stock alerts and automated SKU sync.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Truck className="size-4 text-[#2164B6] shrink-0 mt-0.5" />
                  <span><strong>Shipping &amp; Tracking:</strong> Waybill generation, carrier tracking, and instant delivery alerts.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Award className="size-4 text-[#2164B6] shrink-0 mt-0.5" />
                  <span><strong>KYC Verified Badge:</strong> Platform identity vetting that maximizes buyer trust.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <FileText className="size-4 text-[#2164B6] shrink-0 mt-0.5" />
                  <span><strong>Automated Invoicing:</strong> Tax invoices, commercial receipts, and detailed sales analytics.</span>
                </li>
              </ul>
              <a href={getLoginUrl()} className="btn-wa-outline w-full text-center mt-auto border-[#102840] text-[#102840]">
                Launch Merchant Account
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ================= ESCROW & TRUST HIGHLIGHT ================= */}
      <section className="feature-section bg-[#F0F4F8]" id="escrow">
        <div className="container-landing">
          <div className="feature-grid">
            <div className="feature-info">
              <span className="feature-tag">Security &amp; Guarantee</span>
              <h2 className="title-section">Zero payment disputes with built-in milestone escrow</h2>
              <p className="subtitle-hero">
                MurihSpace protects buyers and sellers with automated smart escrow. Funds are locked securely when an order is placed and released automatically upon delivery confirmation or milestone approval.
              </p>
              <div className="mt-6 flex flex-col gap-3 text-sm text-[#5A7184]">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="size-4 text-[#2164B6]" />
                  <span>100% money-back guarantee for fraudulent or undelivered orders</span>
                </div>
                <div className="flex items-center gap-2">
                  <Award className="size-4 text-[#2164B6]" />
                  <span>Verified merchant reputation scores displayed on all product listings</span>
                </div>
                <div className="flex items-center gap-2">
                  <Zap className="size-4 text-[#2164B6]" />
                  <span>Instant payouts directly to your local bank account or mobile money</span>
                </div>
              </div>
            </div>

            {/* Right Escrow Timeline Visual */}
            <div className="feature-visual">
              <div className="feature-card-frame bg-white p-6 rounded-3xl border border-[#D6E0E8] shadow-lg">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#102840] mb-4">
                  Escrow Transaction Lifecycle
                </h4>
                <div className="flex flex-col gap-4 text-xs">
                  <div className="flex items-start gap-3">
                    <div className="size-7 rounded-full bg-[#E8F8FF] text-[#2164B6] flex items-center justify-center font-bold shrink-0">
                      1
                    </div>
                    <div>
                      <span className="font-bold text-[#102840] block">Order Placed &amp; Funds Locked</span>
                      <p className="text-[#5A7184] mt-0.5">Payment is placed in secure MurihSpace escrow holding vault.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="size-7 rounded-full bg-[#E8F8FF] text-[#2164B6] flex items-center justify-center font-bold shrink-0">
                      2
                    </div>
                    <div>
                      <span className="font-bold text-[#102840] block">Order Shipped or Download Delivered</span>
                      <p className="text-[#5A7184] mt-0.5">Merchant generates waybill or file delivery link with timestamp.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="size-7 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold shrink-0">
                      3
                    </div>
                    <div>
                      <span className="font-bold text-emerald-800 block">Delivery Confirmed &amp; Payout Released</span>
                      <p className="text-[#5A7184] mt-0.5">Buyer confirms receipt, releasing funds directly to creator wallet.</p>
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-[#D6E0E8] flex items-center justify-between text-xs text-[#8696A0]">
                  <span>Status: Verified Safe</span>
                  <span className="text-emerald-700 font-bold">100% Guaranteed</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= BOTTOM CTA ================= */}
      <section className="cta-banner">
        <div className="container-landing">
          <div className="cta-content">
            <h2 className="cta-title">Ready to scale your business on MurihSpace?</h2>
            <p className="cta-subtitle">
              Join thousands of creators and volume merchants selling securely with verified identity and zero initial setup fees.
            </p>
            <div className="cta-buttons">
              <a href={getRegisterUrl()} className="btn-wa-primary">
                <span>Start Selling Free</span>
                <ArrowRight className="size-4 ml-1 inline" />
              </a>
              <Link to="/features" className="btn-wa-outline" style={{ color: "#FFFFFF", borderColor: "#FFFFFF" }}>
                Explore All Features
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
