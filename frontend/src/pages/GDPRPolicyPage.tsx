import { AnimatedPage } from "@/components/common/AnimatedPage";
import { AuthLayout } from "@/components/layout/AuthLayout";

export function GDPRPolicyPage() {
  return (
    <AnimatedPage>
      <AuthLayout headlineText="Data Privacy" accentText="and GDPR Compliance" subText="Your data belongs to you. Here's how we protect it.">
        <div className="space-y-6 text-sm leading-relaxed text-foreground">
          <div>
            <h2 className="text-lg font-bold">1. Overview</h2>
            <p className="mt-2 text-muted-foreground">
              MurihSpace is committed to protecting your privacy and complying with the General Data Protection Regulation (GDPR) and other applicable data protection laws. This document outlines your rights and our obligations.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-bold">2. Data Collection and Processing</h2>
            <p className="mt-2 text-muted-foreground">
              We collect and process personal data only when we have a lawful basis to do so. This includes data necessary to provide our services, data you consent to share, and data required for legal and compliance reasons (such as KYC verification).
            </p>
          </div>

          <div>
            <h2 className="text-lg font-bold">3. Your Rights Under GDPR</h2>
            <ul className="mt-2 list-disc list-inside text-muted-foreground space-y-1">
              <li><strong>Right to Access:</strong> You can request a copy of your personal data.</li>
              <li><strong>Right to Rectification:</strong> You can ask us to correct inaccurate data.</li>
              <li><strong>Right to Erasure (Right to be Forgotten):</strong> You can request the deletion of your personal data.</li>
              <li><strong>Right to Restrict Processing:</strong> You can ask us to limit how we use your data.</li>
              <li><strong>Right to Data Portability:</strong> You can request your data in a structured, machine-readable format.</li>
            </ul>
          </div>

          <div>
            <h2 className="text-lg font-bold">4. Data Security</h2>
            <p className="mt-2 text-muted-foreground">
              We implement robust technical and organizational measures to ensure the security of your personal data, including encryption in transit and at rest, and strict access controls.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-bold">5. Contact Us</h2>
            <p className="mt-2 text-muted-foreground">
              For any GDPR-related inquiries or to exercise your rights, please contact our Data Protection Officer through the Help Center.
            </p>
          </div>
        </div>
      </AuthLayout>
    </AnimatedPage>
  );
}
