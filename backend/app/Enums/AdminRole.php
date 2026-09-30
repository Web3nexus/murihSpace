<?php

namespace App\Enums;

enum AdminRole: string
{
    case SuperAdmin = 'super_admin';
    case KycAdmin = 'kyc_admin';
    case FinanceAdmin = 'finance_admin';
    case SupportAdmin = 'support_admin';
    case CommerceAdmin = 'commerce_admin';
    case ContentAdmin = 'content_admin';
    case AdsAdmin = 'ads_admin';
    case MarketingAdmin = 'marketing_admin';
    case ComplianceAdmin = 'compliance_admin';
    case OperationsAdmin = 'operations_admin';
    case SupportStaff = 'support_staff';
    case Moderator = 'moderator';

    public function label(): string
    {
        return match ($this) {
            self::SuperAdmin => 'Super Admin',
            self::KycAdmin => 'KYC & Identity Admin',
            self::FinanceAdmin => 'Finance & Accounting Admin',
            self::SupportAdmin => 'Customer Support Admin',
            self::CommerceAdmin => 'Commerce & Marketplace Admin',
            self::ContentAdmin => 'Content Moderation Admin',
            self::AdsAdmin => 'Advertisements & Campaigns Admin',
            self::MarketingAdmin => 'Marketing & Growth Admin',
            self::ComplianceAdmin => 'Compliance & Risk Admin',
            self::OperationsAdmin => 'Operations & Staff Admin',
            self::SupportStaff => 'Support Representative / Staff',
            self::Moderator => 'Content Moderator / Staff',
        };
    }

    /**
     * The permissions a role receives when an administrator is created without an
     * explicit grant list.
     *
     * These are a starting point for the creation form, not a bypass. Whatever is
     * stored on the administrator is what is ultimately enforced, so an explicit
     * grant list always wins — see AdminPermissionMatrix::effectiveFor().
     *
     * Deliberately narrow: §21 requires that each role see only the resources
     * necessary for its responsibilities, that a Support Admin not gain withdrawal
     * management, and that a KYC Admin not gain unrelated financial functions.
     *
     * @return array<int, AdminPermission>
     */
    public function defaultPermissions(): array
    {
        return match ($this) {
            self::SuperAdmin => AdminPermission::all(),

            // Identity only. No financial functions. Creator/Vendor approval sits
            // with compliance and operations, not with identity verification.
            self::KycAdmin => [
                AdminPermission::Kyc,
                AdminPermission::Users,
            ],

            // Money. No user administration, no platform configuration.
            self::FinanceAdmin => [
                AdminPermission::Accounting,
                AdminPermission::Tax,
                AdminPermission::Payouts,
                AdminPermission::Wallets,
                AdminPermission::Fees,
                AdminPermission::Analytics,
            ],

            // Support. Deliberately excludes payouts, wallets and accounting (§21).
            self::SupportAdmin => [
                AdminPermission::Support,
                AdminPermission::Users,
                AdminPermission::Warnings,
            ],

            self::CommerceAdmin => [
                AdminPermission::Commerce,
                AdminPermission::Payouts,
                AdminPermission::Wallets,
                AdminPermission::Fees,
            ],

            self::ContentAdmin => [
                AdminPermission::Content,
                AdminPermission::Users,
                AdminPermission::Warnings,
            ],

            self::AdsAdmin => [
                AdminPermission::Ads,
                AdminPermission::Marketing,
                AdminPermission::Analytics,
            ],

            self::MarketingAdmin => [
                AdminPermission::Marketing,
                AdminPermission::Ads,
                AdminPermission::Analytics,
            ],

            self::ComplianceAdmin => [
                AdminPermission::Kyc,
                AdminPermission::Approvals,
                AdminPermission::Content,
                AdminPermission::Users,
                AdminPermission::Warnings,
                AdminPermission::Analytics,
            ],

            self::OperationsAdmin => [
                AdminPermission::Users,
                AdminPermission::Approvals,
                AdminPermission::Settings,
                AdminPermission::Content,
                AdminPermission::Warnings,
                AdminPermission::Analytics,
            ],

            // Narrowest roles. Staff can act only in their own lane.
            self::SupportStaff => [
                AdminPermission::Support,
            ],

            // A moderator may flag content and warn, but not ban: DEC-012 keeps
            // the terminal action with a narrower set of roles.
            self::Moderator => [
                AdminPermission::Content,
                AdminPermission::Warnings,
            ],
        };
    }

    /**
     * @return array<int, string>
     */
    public static function names(): array
    {
        return array_column(self::cases(), 'value');
    }

    /**
     * @return array<string, string>
     */
    public static function labelled(): array
    {
        $out = [];

        foreach (self::cases() as $case) {
            $out[$case->value] = $case->label();
        }

        return $out;
    }
}
