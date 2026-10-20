<?php

namespace App\Services\StaffSync;

use InvalidArgumentException;

/**
 * Maps marketing staff roles and permissions to the main backend's
 * AdminRole and AdminPermission values (web/backend/app/Enums/AdminRole.php,
 * AdminPermission.php). The main backend validates every value against those
 * enums, so a mismatch fails the sync.
 *
 * This is the one place the mapping lives. StaffAdminMappingTest pins every
 * role and the main backend's names, so a rename on either side fails a test.
 *
 * Unknown marketing roles or permissions throw instead of being dropped, so a
 * new marketing permission cannot silently reach the main backend without a grant.
 */
final class MainAdminMapping
{
    /** Marketing role => main AdminRole value. */
    public const ROLES = [
        'super_admin' => 'super_admin',
        'support_admin' => 'support_admin',
        'support_manager' => 'support_admin',
        'senior_agent' => 'support_staff',
        'support_agent' => 'support_staff',
        'technical_support' => 'support_staff',
        'billing_support' => 'finance_admin',
        'kyc_support' => 'kyc_admin',
        'help_editor' => 'content_admin',
        'content_manager' => 'content_admin',
        'crm_manager' => 'marketing_admin',
    ];

    /** Marketing permission => main AdminPermission value. */
    public const PERMISSIONS = [
        'ticket.view' => 'support',
        'ticket.reply' => 'support',
        'ticket.note' => 'support',
        'ticket.create' => 'support',
        'ticket.assign' => 'support',
        'ticket.close' => 'support',
        'ticket.escalate' => 'support',
        'customer.summary.view' => 'support',
        'customer.notes.create' => 'support',
        'agent.manage' => 'support',
        'team.manage' => 'support',
        'sla.manage' => 'support',
        'macro.manage' => 'support',
        'automation.view' => 'support',
        'automation.manage' => 'support',
        'help.article.view' => 'content',
        'help.article.create' => 'content',
        'help.article.edit' => 'content',
        'help.article.publish' => 'content',
        'help.article.archive' => 'content',
        'cms.view' => 'content',
        'cms.edit' => 'content',
        'cms.publish' => 'content',
        'announcement.view' => 'marketing',
        'announcement.manage' => 'marketing',
        'crm.view' => 'marketing',
        'refund.request' => 'commerce',
        'refund.approve' => 'commerce',
        'report.view' => 'analytics',
        'audit.view' => 'analytics',
        'settings.manage' => 'settings',
        'integration.view' => 'settings',
        'kyc.summary.view' => 'kyc',
    ];

    /** Every AdminPermission value on the main backend. Granted by the marketing wildcard. */
    public const ALL_MAIN_PERMISSIONS = [
        'users', 'warnings', 'kyc', 'approvals', 'content', 'commerce', 'accounting', 'tax',
        'payouts', 'analytics', 'settings', 'admins', 'wallets', 'fees', 'ads', 'marketing', 'support',
    ];

    public static function role(string $marketingRole): string
    {
        return self::ROLES[$marketingRole]
            ?? throw new InvalidArgumentException("No main AdminRole mapped for marketing role [{$marketingRole}].");
    }

    /**
     * @param  array<int, string>  $marketingPermissions  effective list, e.g. StaffUser::allPermissions()
     * @return array<int, string> sorted, unique main AdminPermission values
     */
    public static function permissions(array $marketingPermissions): array
    {
        if (in_array('*', $marketingPermissions, true)) {
            return self::ALL_MAIN_PERMISSIONS;
        }

        $mapped = [];
        foreach ($marketingPermissions as $permission) {
            $mapped[] = self::PERMISSIONS[$permission]
                ?? throw new InvalidArgumentException("No main AdminPermission mapped for marketing permission [{$permission}].");
        }

        $mapped = array_values(array_unique($mapped));
        sort($mapped);

        return $mapped;
    }
}
