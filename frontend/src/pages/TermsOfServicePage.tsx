import { ScrollText } from "lucide-react";
import { LegalLayout } from "@/components/layout/LegalLayout";

export default function TermsOfServicePage() {
  return (
    <LegalLayout
      icon={<ScrollText className="h-6 w-6" />}
      eyebrow="Legal"
      title="Terms of Service"
      updated="August 4, 2026"
      intro="These Terms of Service (Terms) govern your access to and use of the MurihSpace platform. Please read them carefully. By creating an account or using MurihSpace, you agree to be bound by these Terms."
      sections={[
        {
          heading: "Acceptance of Terms",
          paragraphs: [
            "By accessing or using MurihSpace, you confirm that you are at least 13 years old and that you agree to these Terms and our Privacy Policy.",
            "If you are using MurihSpace on behalf of an organisation, you represent that you have authority to bind that organisation.",
          ],
        },
        {
          heading: "Your Account",
          paragraphs: [
            "You are responsible for maintaining the confidentiality of your login credentials and for all activity that occurs under your account. Notify us immediately of any unauthorised use.",
            "You must provide accurate information when registering and keep your details up to date.",
            "Accounts that are suspended or banned may not access the platform.",
          ],
        },
        {
          heading: "Acceptable Use",
          paragraphs: [
            "You agree not to misuse the platform, including by: posting unlawful, harmful, harassing, defamatory or infringing content; attempting to access other users' accounts; introducing malware; or interfering with the operation of the service.",
            "Content you post must comply with our community guidelines. We may remove content that violates these Terms.",
          ],
        },
        {
          heading: "Payments, Wallets and Fees",
          paragraphs: [
            "MurihPay wallets hold balances in minor units and are used for gifts, tips, purchases and payouts on the platform.",
            "Transaction fees are shown before you confirm a transaction. Fees may change from time to time with notice.",
            "Payouts require completed identity (KYC) verification and are subject to review by our finance team.",
            "You are responsible for ensuring your payment details are correct. Provide accurate information to avoid failed or delayed transfers.",
          ],
        },
        {
          heading: "Intellectual Property",
          paragraphs: [
            "MurihSpace and its content, features and branding are owned by us and are protected by intellectual property laws. You may not copy, modify or redistribute them without permission.",
            "You retain ownership of the content you create and post. By posting it, you grant us a worldwide, non-exclusive licence to host, display and distribute it to provide the service.",
          ],
        },
        {
          heading: "Third-Party Services",
          paragraphs: [
            "MurihSpace may link to third-party services (such as payment providers and social platforms). We are not responsible for their content, policies or practices.",
          ],
        },
        {
          heading: "Termination",
          paragraphs: [
            "You may close your account at any time. We may suspend or terminate your access if you violate these Terms, if required by law, or to protect the platform and its users.",
            "Upon termination, sections of these Terms that by their nature should survive will continue to apply.",
          ],
        },
        {
          heading: "Limitation of Liability",
          paragraphs: [
            "To the maximum extent permitted by law, MurihSpace shall not be liable for indirect, incidental, special or consequential damages, or for loss of profits, data or goodwill arising from your use of the platform.",
            "Our total liability shall not exceed the amount you paid to us in the twelve months preceding the claim.",
          ],
        },
        {
          heading: "Changes to These Terms",
          paragraphs: [
            "We may revise these Terms from time to time. Updated terms are posted on this page and take effect when published. Continued use of the platform after changes constitutes acceptance.",
          ],
        },
        {
          heading: "Governing Law and Contact",
          paragraphs: [
            "These Terms are governed by the laws of the jurisdiction in which MurihSpace is established, without regard to conflict of law principles.",
            "For questions about these Terms, please contact our support team through the Help Center.",
          ],
        },
      ]}
      footerNote="These Terms are for information only and may be updated at any time. Please review this page periodically for the current version."
    />
  );
}
