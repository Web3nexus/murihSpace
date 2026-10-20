<?php

namespace Tests\Feature;

use App\Models\StaffUser;
use App\Services\StaffSync\MainAdminMapping;
use App\Services\StaffSync\StaffSyncClient;
use App\Services\StaffSync\StaffSyncException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use InvalidArgumentException;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * Pins the marketing => main backend mapping. The expected values are written out
 * here on purpose: changing a mapping, or a name on the main backend, fails a test.
 */
class StaffAdminMappingTest extends TestCase
{
    use RefreshDatabase;

    /** AdminRole values in web/backend/app/Enums/AdminRole.php. */
    private const MAIN_ROLES = [
        'super_admin', 'kyc_admin', 'finance_admin', 'support_admin', 'commerce_admin', 'content_admin',
        'ads_admin', 'marketing_admin', 'compliance_admin', 'operations_admin', 'support_staff', 'moderator',
    ];

    /** AdminPermission values in web/backend/app/Enums/AdminPermission.php. */
    private const MAIN_PERMISSIONS = [
        'users', 'warnings', 'kyc', 'approvals', 'content', 'commerce', 'accounting', 'tax', 'payouts',
        'analytics', 'settings', 'admins', 'wallets', 'fees', 'ads', 'marketing', 'support',
    ];

    /**
     * One case per marketing role: [marketing role, main role, main permissions (sorted)].
     *
     * @return array<string, array{0: string, 1: string, 2: array<int, string>}>
     */
    public static function roles(): array
    {
        return [
            'super_admin' => ['super_admin', 'super_admin', self::MAIN_PERMISSIONS],
            'support_admin' => ['support_admin', 'support_admin', self::MAIN_PERMISSIONS],
            'support_manager' => ['support_manager', 'support_admin', ['analytics', 'commerce', 'content', 'settings', 'support']],
            'senior_agent' => ['senior_agent', 'support_staff', ['content', 'support']],
            'support_agent' => ['support_agent', 'support_staff', ['content', 'support']],
            'technical_support' => ['technical_support', 'support_staff', ['content', 'settings', 'support']],
            'billing_support' => ['billing_support', 'finance_admin', ['analytics', 'commerce', 'content', 'support']],
            'kyc_support' => ['kyc_support', 'kyc_admin', ['content', 'kyc', 'support']],
            'help_editor' => ['help_editor', 'content_admin', ['content']],
            'content_manager' => ['content_manager', 'content_admin', ['content', 'marketing']],
            'crm_manager' => ['crm_manager', 'marketing_admin', ['analytics', 'marketing', 'support']],
        ];
    }

    #[DataProvider('roles')]
    public function test_role_maps_to_the_closest_main_role_and_permissions(string $marketingRole, string $mainRole, array $mainPermissions): void
    {
        $staff = StaffUser::factory()->role($marketingRole)->create();
        $payload = StaffSyncClient::payload($staff);

        $this->assertSame($mainRole, $payload['role']);
        $this->assertSame($mainPermissions, $payload['permissions']);
        $this->assertNotEmpty($payload['permissions']);
    }

    public function test_every_mapped_value_is_a_real_main_backend_name(): void
    {
        $this->assertEqualsCanonicalizing(
            array_keys(MainAdminMapping::ROLES),
            array_keys(self::roles()),
            'Every marketing role needs a test case.'
        );

        foreach (MainAdminMapping::ROLES as $marketing => $main) {
            $this->assertContains($main, self::MAIN_ROLES, "Role [{$marketing}] maps to unknown [{$main}].");
        }

        foreach (MainAdminMapping::PERMISSIONS as $marketing => $main) {
            $this->assertContains($main, self::MAIN_PERMISSIONS, "Permission [{$marketing}] maps to unknown [{$main}].");
        }

        $this->assertSame(self::MAIN_PERMISSIONS, MainAdminMapping::ALL_MAIN_PERMISSIONS);
    }

    public function test_an_unknown_marketing_role_is_refused(): void
    {
        $this->expectException(InvalidArgumentException::class);
        MainAdminMapping::role('retired_role');
    }

    public function test_an_unknown_marketing_permission_is_refused_rather_than_dropped(): void
    {
        $this->expectException(InvalidArgumentException::class);
        MainAdminMapping::permissions(['ticket.view', 'brand.new.permission']);
    }

    public function test_a_super_admin_wildcard_grants_every_main_permission(): void
    {
        $this->assertSame(self::MAIN_PERMISSIONS, MainAdminMapping::permissions(['*']));
    }

    public function test_an_empty_grant_is_refused_before_sending(): void
    {
        $staff = StaffUser::factory()->role('support_agent')->withPermissions([])->create();

        $this->expectException(StaffSyncException::class);
        StaffSyncClient::payload($staff);
    }
}
