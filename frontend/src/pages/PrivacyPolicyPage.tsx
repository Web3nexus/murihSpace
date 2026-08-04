import { ShieldCheck } from "lucide-react";
import { LegalLayout } from "@/components/layout/LegalLayout";

export default function PrivacyPolicyPage() {
  return (
    <LegalLayout
      icon={<ShieldCheck className="h-6 w-6" />}
      eyebrow="Legal"
      title="Privacy Policy"
      updated="August 4, 2026"
      intro="This Privacy Policy explains how MurihSpace (we, us or our) collects, uses, stores and protects your personal information when you use our platform, website and services. By creating an account or using MurihSpace, you agree to the practices described in this policy."
      sections={[
        {
          heading: "Information We Collect",
          paragraphs: [
            "Account information: your name, username, email address, mobile number, password (stored securely and hashed), country and account role.",
            "Profile information: photos, bio, links, content you post, communities you join and preferences you set.",
            "Transaction information: wallet balances, deposits, gifts, purchases, payouts and payment references needed to operate the platform.",
            "Technical information: IP address, device and browser type, pages visited, and cookies (see our Cookies Policy).",
          ],
        },
        {
          heading: "How We Use Your Information",
          paragraphs: [
            "We use your information to provide and improve the platform: creating and managing your account, processing transactions, sending service notifications and verifying your identity.",
            "We may use aggregated, non-identifying data to understand usage, improve features and keep the platform secure.",
            "With your consent, we may send marketing communications. You can opt out at any time.",
          ],
        },
        {
          heading: "How We Share Your Information",
          paragraphs: [
            "We do not sell your personal information. We only share it with trusted service providers (such as payment processors and email providers) who are bound by confidentiality obligations and process data solely to provide services to us.",
            "We may disclose information where required by law, to protect the rights and safety of our users and the platform, or in connection with a merger or sale.",
            "Public content you choose to share (posts, storefronts, community activity) is visible to others on the platform as you intend.",
          ],
        },
        {
          heading: "Data Retention",
          paragraphs: [
            "We retain your information for as long as your account is active and as needed to provide the services, comply with legal obligations, resolve disputes and enforce our agreements.",
            "When you close your account, we delete or anonymise your personal information unless we are required to retain it by law.",
          ],
        },
        {
          heading: "Your Rights and Choices",
          paragraphs: [
            "You can access, update and correct your personal information at any time from your account settings.",
            "You may request deletion of your data, restrict processing, or object to processing by contacting support.",
            "Where processing relies on consent, you may withdraw consent at any time without affecting the lawfulness of processing carried out before withdrawal.",
          ],
        },
        {
          heading: "Children's Privacy",
          paragraphs: [
            "MurihSpace is not directed at children under 13, and we do not knowingly collect personal information from children. If you believe a child has provided us information, please contact us and we will delete it.",
          ],
        },
        {
          heading: "Changes to This Policy",
          paragraphs: [
            "We may update this Privacy Policy from time to time. We will notify you of material changes by posting the updated policy on this page and, where appropriate, by email.",
          ],
        },
        {
          heading: "Contact Us",
          paragraphs: [
            "If you have any questions about this Privacy Policy or how we handle your data, please contact our support team through the Help Center.",
          ],
        },
      ]}
      footerNote="This page is for information only. The current, legally binding version of the Privacy Policy may be updated at any time — please review this page periodically."
    />
  );
}
