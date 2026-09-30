<?php

namespace App\Support;

use App\Enums\AdminPermission;
use App\Enums\AdminRole;
use App\Models\User;

/**
 * The single source of truth for what each administrator role may do.
 *
 * Clients must not keep their own copy of this matrix. They resolve an
 * administrator's effective permissions from GET /api/v1/securegate/me and render
 * from that, so a role change on the server takes effect without a client release
 * and so no client is trusted to decide what is permitted.
 */
final class AdminPermissionMatrix
{
    /**
     * Navigation sections offered to administrator clients, each mapped to the
     * permissions that unlock it. A section is shown when the administrator holds
     * at least one of the listed permissions.
     *
     * @return array<string, array{label: string, permissions: array<int, AdminPermission>}>
     */
    public static function sections(): array
    {
        return [
            'overview' => [
                'label' => 'Overview',
                'permissions' => [],
            ],
            'kyc' => [
                'label' => 'KYC Requests',
                'permissions' => [AdminPermission::Kyc],
            ],
            'approvals' => [
                'label' => 'Role Approvals',
                'permissions' => [AdminPermission::Approvals],
            ],
            'users' => [
                'label' => 'Users',
                'permissions' => [AdminPermission::Users],
            ],
            // Deliberately its own section rather than part of `users`: a
            // moderator holds `warnings` but not `users`, and folding it into
            // `users` would show them a Users screen their token cannot load.
            'enforcement' => [
                'label' => 'Trust & Safety',
                'permissions' => [AdminPermission::Warnings],
            ],
            'moderation' => [
                'label' => 'Moderation',
                'permissions' => [AdminPermission::Content],
            ],
            'support' => [
                'label' => 'Support',
                'permissions' => [AdminPermission::Support],
            ],
            'finance' => [
                'label' => 'Finance',
                'permissions' => [
                    AdminPermission::Payouts,
                    AdminPermission::Wallets,
                    AdminPermission::Accounting,
                ],
            ],
            'commerce' => [
                'label' => 'Commerce',
                'permissions' => [AdminPermission::Commerce],
            ],
            'tax' => [
                'label' => 'Tax',
                'permissions' => [AdminPermission::Tax],
            ],
            'fees' => [
                'label' => 'Fees',
                'permissions' => [AdminPermission::Fees],
            ],
            'ads' => [
                'label' => 'Ads',
                'permissions' => [AdminPermission::Ads],
            ],
            'marketing' => [
                'label' => 'Marketing',
                'permissions' => [AdminPermission::Marketing],
            ],
            'analytics' => [
                'label' => 'Analytics',
                'permissions' => [AdminPermission::Analytics],
            ],
            'settings' => [
                'label' => 'Settings',
                'permissions' => [AdminPermission::Settings],
            ],
            'admins' => [
                'label' => 'Administrators',
                'permissions' => [AdminPermission::Admins],
            ],
        ];
    }

    /**
     * Resolve the permissions an administrator actually holds.
     *
     * Resolution order:
     *   1. Not an administrator  -> no permissions.
     *   2. Super admin           -> every permission.
     *   3. Explicit grant list   -> exactly that list, never widened. An
     *                               administrator whose grants were deliberately
     *                               narrowed must not silently regain access when
     *                               this matrix changes.
     *   4. Otherwise             -> the defaults for the role.
     *
     * @return array<int, AdminPermission>
     */
    public static function effectiveFor(?User $user): array
    {
        if (! $user || ! $user->isAdmin()) {
            return [];
        }

        if ($user->isSuperAdmin()) {
            return AdminPermission::all();
        }

        $granted = $user->admin_permissions;

        if (is_array($granted) && $granted !== []) {
            return AdminPermission::parse($granted);
        }

        $role = $user->adminRole();

        return $role ? $role->defaultPermissions() : [];
    }

    /**
     * @return array<int, string>
     */
    public static function effectiveNamesFor(?User $user): array
    {
        return array_map(
            fn (AdminPermission $permission) => $permission->value,
            self::effectiveFor($user)
        );
    }

    /**
     * The navigation sections an administrator client should render.
     *
     * @return array<string, string>
     */
    public static function sectionsFor(?User $user): array
    {
        $effective = self::effectiveFor($user);
        $sections = [];

        foreach (self::sections() as $key => $section) {
            if ($section['permissions'] === []) {
                $sections[$key] = $section['label'];

                continue;
            }

            foreach ($section['permissions'] as $permission) {
                if (in_array($permission, $effective, true)) {
                    $sections[$key] = $section['label'];

                    break;
                }
            }
        }

        return $sections;
    }

    /**
     * Whether the administrator must clear a second factor before any
     * administration request is served.
     *
     * Every administrator qualifies, including the most narrowly-privileged
     * ones. A tiered scheme ("only super admins and money movers") was
     * considered and rejected: an administration session is a single token, so
     * the tier has to be decided at login and then trusted for the life of the
     * session. Any administrator without a second factor would therefore still
     * hold an unrestricted, long-lived session, which is precisely the exposure
     * this control exists to close.
     *
     * Enforced by AdminAuthController on issue, and independently re-checked by
     * IsAdmin on every administration request, so revoking the factor mid-session
     * takes effect immediately rather than at the next sign-in.
     */
    public static function requiresMfa(User $user): bool
    {
        return $user->isAdmin();
    }

    /**
     * Whether the administrator has completed two-factor enrolment. Enrolment
     * produces a confirmed secret; a half-finished enrolment is not sufficient.
     */
    public static function hasEnrolledMfa(User $user): bool
    {
        return $user->two_factor_secret !== null && $user->two_factor_confirmed_at !== null;
    }

    /**
     * The default grant list for a role, as plain strings for storage.
     *
     * @return array<int, string>
     */
    public static function defaultNamesFor(AdminRole $role): array
    {
        return array_map(
            fn (AdminPermission $permission) => $permission->value,
            $role->defaultPermissions()
        );
    }
}
