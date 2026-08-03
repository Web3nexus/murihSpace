<?php

namespace App\Services;

/**
 * Central platform permission registry.
 *
 * Every protected action should be represented here.
 * Roles: member | creator | vendor | admin
 *
 * Usage:
 *   PermissionService::rolesFor('storefront.manage')  // → ['creator', 'vendor', 'admin']
 *   PermissionService::permissionsFor('vendor')        // → ['storefront.view', ...]
 */
class PermissionService
{
    /**
     * Map of permission key → roles that hold it.
     * Admin always holds all permissions (handled separately).
     */
    private const MAP = [
        // Storefront
        'storefront.view'            => ['creator', 'vendor', 'admin'],
        'storefront.manage'          => ['creator', 'vendor', 'admin'],

        // Products
        'product.create'             => ['creator', 'vendor', 'admin'],
        'product.manage'             => ['creator', 'vendor', 'admin'],

        // Community
        'community.create'           => ['creator', 'admin'],
        'community.manage'           => ['creator', 'admin'],

        // Events
        'event.create'               => ['creator', 'admin'],
        'event.manage'               => ['creator', 'admin'],

        // Conferencing
        'conference.host'            => ['creator', 'admin'],
        'conference.join'            => ['member', 'creator', 'vendor', 'admin'],

        // Live sessions
        'live.host'                  => ['creator', 'admin'],

        // Gifts
        'gift.send'                  => ['member', 'creator', 'vendor', 'admin'],
        'gift.receive'               => ['creator', 'admin'],

        // Wallet
        'wallet.deposit'             => ['member', 'creator', 'vendor', 'admin'],
        'wallet.transfer'            => ['creator', 'vendor', 'admin'],
        'wallet.withdraw'            => ['creator', 'vendor', 'admin'],

        // Analytics
        'creator.analytics.view'     => ['creator', 'admin'],
        'vendor.analytics.view'      => ['vendor', 'admin'],

        // Link-in-bio
        'link_in_bio.manage'         => ['creator', 'admin'],

        // AI onboarding
        'ai_onboarding.access'       => ['creator', 'vendor', 'admin'],

        // Verification
        'verification.apply'         => ['member', 'creator', 'vendor', 'admin'],

        // Role upgrades
        'role.upgrade.apply'         => ['member', 'creator', 'vendor'],
        'role.upgrade.review'        => ['admin'],

        // Courses & coaching
        'course.create'              => ['creator', 'admin'],
        'coaching.offer'             => ['creator', 'admin'],

        // Memberships (selling)
        'membership.create'          => ['creator', 'admin'],

        // Brand deals & marketing
        'brand_deal.manage'          => ['creator', 'admin'],
        'marketing.manage'           => ['creator', 'admin'],

        // Media kit
        'media_kit.manage'           => ['creator', 'admin'],

        // Payouts
        'payout.request'             => ['creator', 'vendor', 'admin'],
    ];

    /**
     * Return the roles that hold a given permission.
     * Admins always pass regardless (checked first in middleware).
     */
    public static function rolesFor(string $permission): array
    {
        return self::MAP[$permission] ?? [];
    }

    /**
     * Return all permissions granted to a given role.
     */
    public static function permissionsFor(string $role): array
    {
        $granted = [];

        foreach (self::MAP as $permission => $roles) {
            if (in_array($role, $roles, true)) {
                $granted[] = $permission;
            }
        }

        return $granted;
    }

    /**
     * Check whether a role holds a given permission.
     */
    public static function roleHas(string $role, string $permission): bool
    {
        // Admins hold all permissions
        if ($role === 'admin') {
            return true;
        }

        return in_array($role, self::MAP[$permission] ?? [], true);
    }

    /**
     * Return the full permission map (for API exposure).
     */
    public static function all(): array
    {
        return self::MAP;
    }
}
