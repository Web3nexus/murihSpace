<?php

namespace App\Enums;

enum AdminPermission: string
{
    case Users = 'users';
    case Warnings = 'warnings';
    case Kyc = 'kyc';
    case Approvals = 'approvals';
    case Content = 'content';
    case Commerce = 'commerce';
    case Accounting = 'accounting';
    case Tax = 'tax';
    case Payouts = 'payouts';
    case Analytics = 'analytics';
    case Settings = 'settings';
    case Admins = 'admins';
    case Wallets = 'wallets';
    case Fees = 'fees';
    case Ads = 'ads';
    case Marketing = 'marketing';
    case Support = 'support';

    public function label(): string
    {
        return match ($this) {
            self::Users => 'User management & impersonation',
            self::Warnings => 'Warn, flag, suspend & ban members',
            self::Kyc => 'KYC verification & identity audits',
            self::Approvals => 'Account upgrade approvals (Creator & Vendor)',
            self::Content => 'Content moderation & reporting',
            self::Commerce => 'Commerce & orders management',
            self::Accounting => 'Accounting & revenue streams',
            self::Tax => 'Tax management & compliance',
            self::Payouts => 'Payouts & escrow management',
            self::Analytics => 'Analytics & platform reports',
            self::Settings => 'Platform settings & configuration',
            self::Admins => 'Admin & staff access management',
            self::Wallets => 'Wallet & ledger adjustment',
            self::Fees => 'Platform fee rules & commission percentage',
            self::Ads => 'Advertisements & sponsor campaigns',
            self::Marketing => 'Marketing & customer engagement',
            self::Support => 'Customer support & tickets',
        };
    }

    /**
     * @return array<int, self>
     */
    public static function all(): array
    {
        return self::cases();
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

    /**
     * @param  array<int, string>  $permissions
     * @return array<int, self>
     */
    public static function parse(array $permissions): array
    {
        return array_values(array_filter(
            self::cases(),
            fn (self $case) => in_array($case->value, $permissions, true)
        ));
    }
}
