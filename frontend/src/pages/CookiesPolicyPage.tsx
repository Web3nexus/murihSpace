import { Cookie } from "lucide-react";
import { LegalLayout } from "@/components/layout/LegalLayout";

export default function CookiesPolicyPage() {
  return (
    <LegalLayout
      icon={<Cookie className="h-6 w-6" />}
      eyebrow="Legal"
      title="Cookies Policy"
      updated="August 4, 2026"
      intro="This Cookies Policy explains what cookies are, how MurihSpace uses them, and the choices you have when you visit our platform. It works together with our Privacy Policy."
      sections={[
        {
          heading: "What Are Cookies?",
          paragraphs: [
            "Cookies are small text files placed on your device when you visit a website. They are widely used to make websites work efficiently and to provide information to the owners of the site.",
            "We also use similar technologies such as local storage and web beacons, which we refer to collectively as \"cookies\" in this policy.",
          ],
        },
        {
          heading: "Cookies We Use",
          paragraphs: [
            "Essential cookies: these are required for the platform to function, such as keeping you signed in and remembering your preferences.",
            "Analytics cookies: these help us understand how visitors use the platform so we can improve it. They collect aggregated information.",
            "Preference cookies: these remember choices you make, such as your language or appearance settings.",
            "We do not use cookies to sell your personal data to third parties.",
          ],
        },
        {
          heading: "How to Control Cookies",
          paragraphs: [
            "You can control and manage cookies through your browser settings. Most browsers let you block or delete cookies, or alert you when a cookie is set.",
            "Blocking essential cookies may prevent some parts of the platform from working correctly.",
            "Where required by law, we ask for your consent before placing non-essential cookies.",
          ],
        },
        {
          heading: "Third-Party Cookies",
          paragraphs: [
            "Some cookies are placed by trusted third parties, such as analytics providers and payment gateways. These providers have their own privacy and cookie policies.",
          ],
        },
        {
          heading: "Changes to This Policy",
          paragraphs: [
            "We may update this Cookies Policy from time to time. Changes take effect when published on this page.",
          ],
        },
        {
          heading: "Contact Us",
          paragraphs: [
            "If you have any questions about our use of cookies, please contact our support team through the Help Center.",
          ],
        },
      ]}
      footerNote="By continuing to use MurihSpace, you consent to our use of cookies as described in this policy, subject to your browser settings."
    />
  );
}
