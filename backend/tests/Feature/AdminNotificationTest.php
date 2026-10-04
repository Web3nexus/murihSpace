<?php

namespace Tests\Feature;

use App\Enums\AdminNotificationCategory;
use App\Enums\AdminPermission;
use App\Enums\AdminRole;
use App\Models\AdminNotification;
use App\Models\User;
use App\Services\AdminNotificationService;
use App\Support\AdminSession;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\ActsAsSession;
use Tests\TestCase;

class AdminNotificationTest extends TestCase
{
    use ActsAsSession;
    use RefreshDatabase;

    private function createAdmin(array $permissions = [], string $role = 'operations_admin'): User
    {
        return User::factory()->create([
            'role' => 'admin',
            'admin_role' => $role,
            'admin_permissions' => $permissions,
        ]);
    }

    public function test_non_admin_cannot_access_admin_notifications(): void
    {
        $member = User::factory()->create(['role' => 'member']);
        $this->actAsSession($member);

        $response = $this->getJson('/api/v1/securegate/notifications');
        $response->assertStatus(403);
    }

    public function test_admin_with_specific_permission_only_sees_authorized_categories(): void
    {
        $service = app(AdminNotificationService::class);

        // Create a KYC notification
        $service->dispatch([
            'category' => AdminNotificationCategory::KycRequest->value,
            'severity' => 'warning',
            'title' => 'KYC Submitted',
            'message' => 'User submitted documents',
        ]);

        // Create a Withdrawal notification
        $service->dispatch([
            'category' => AdminNotificationCategory::WithdrawalRequest->value,
            'severity' => 'warning',
            'title' => 'Withdrawal Requested',
            'message' => 'User requested payout',
        ]);

        // Compliance admin with only KYC permission
        $complianceAdmin = $this->createAdmin([AdminPermission::Kyc->value]);
        $this->actAsSession($complianceAdmin, ['*', AdminSession::ABILITY_MFA]);

        $response = $this->getJson('/api/v1/securegate/notifications');
        $response->assertOk();
        $data = $response->json('data');

        $this->assertCount(1, $data);
        $this->assertEquals(AdminNotificationCategory::KycRequest->value, $data[0]['category']);

        // Financial admin with only Payouts permission
        $financeAdmin = $this->createAdmin([AdminPermission::Payouts->value]);
        $this->actAsSession($financeAdmin, ['*', AdminSession::ABILITY_MFA]);

        $responseFinance = $this->getJson('/api/v1/securegate/notifications');
        $responseFinance->assertOk();
        $financeData = $responseFinance->json('data');

        $this->assertCount(1, $financeData);
        $this->assertEquals(AdminNotificationCategory::WithdrawalRequest->value, $financeData[0]['category']);
    }

    public function test_super_admin_sees_all_categories(): void
    {
        $service = app(AdminNotificationService::class);

        foreach (AdminNotificationCategory::cases() as $case) {
            $service->dispatch([
                'category' => $case->value,
                'severity' => 'info',
                'title' => $case->label(),
                'message' => 'Test alert for ' . $case->label(),
            ]);
        }

        $superAdmin = User::factory()->create([
            'role' => 'admin',
            'admin_role' => AdminRole::SuperAdmin->value,
            'admin_permissions' => [],
        ]);
        $this->actAsSession($superAdmin, ['*', AdminSession::ABILITY_MFA]);

        $response = $this->getJson('/api/v1/securegate/notifications?per_page=50');
        $response->assertOk();
        $this->assertEquals(count(AdminNotificationCategory::cases()), $response->json('pagination.total'));
    }

    public function test_read_state_is_isolated_per_admin(): void
    {
        $service = app(AdminNotificationService::class);

        $notification = $service->dispatch([
            'category' => AdminNotificationCategory::SecurityAlerts->value,
            'severity' => 'critical',
            'title' => 'Suspicious Login',
            'message' => 'Multiple failed attempts',
        ]);

        $admin1 = $this->createAdmin([AdminPermission::Settings->value]);
        $admin2 = $this->createAdmin([AdminPermission::Settings->value]);

        // Admin 1 marks as read
        $this->actAsSession($admin1, ['*', AdminSession::ABILITY_MFA]);
        $this->postJson("/api/v1/securegate/notifications/{$notification->id}/read")->assertOk();

        // Check Admin 1 view: read
        $resp1 = $this->getJson('/api/v1/securegate/notifications');
        $resp1->assertOk();
        $this->assertTrue($resp1->json('data.0.is_read'));
        $this->assertEquals(0, $resp1->json('unread_count'));

        // Check Admin 2 view: still unread!
        $this->actAsSession($admin2, ['*', AdminSession::ABILITY_MFA]);
        $resp2 = $this->getJson('/api/v1/securegate/notifications');
        $resp2->assertOk();
        $this->assertFalse($resp2->json('data.0.is_read'));
        $this->assertEquals(1, $resp2->json('unread_count'));
    }

    public function test_admin_notification_preferences_toggling(): void
    {
        $admin = $this->createAdmin([AdminPermission::Kyc->value, AdminPermission::Users->value]);
        $this->actAsSession($admin, ['*', AdminSession::ABILITY_MFA]);

        // Get default preferences
        $getResp = $this->getJson('/api/v1/securegate/notifications/preferences');
        $getResp->assertOk();
        $this->assertTrue($getResp->json('data.kyc_request.in_app'));

        // Disable in_app for kyc_request
        $updateResp = $this->putJson('/api/v1/securegate/notifications/preferences', [
            'preferences' => [
                [
                    'category' => 'kyc_request',
                    'channel' => 'in_app',
                    'enabled' => false,
                ],
            ],
        ]);
        $updateResp->assertOk();
        $this->assertFalse($updateResp->json('data.kyc_request.in_app'));

        // Create a KYC notification
        $service = app(AdminNotificationService::class);
        $service->dispatch([
            'category' => AdminNotificationCategory::KycRequest->value,
            'severity' => 'warning',
            'title' => 'KYC Submitted',
            'message' => 'New user docs',
        ]);

        // Query: disabled category should NOT be returned in in-app list
        $listResp = $this->getJson('/api/v1/securegate/notifications');
        $listResp->assertOk();
        $this->assertEmpty($listResp->json('data'));
    }

    public function test_sensitive_credentials_are_sanitized_in_messages(): void
    {
        $service = app(AdminNotificationService::class);

        $notif = $service->dispatch([
            'category' => AdminNotificationCategory::SystemAlerts->value,
            'title' => 'Password issue password: secret_pass_123',
            'message' => 'Login code 892011 was attempted with card 4111-2222-3333-4444',
        ]);

        $this->assertStringNotContainsString('892011', $notif->message);
        $this->assertStringNotContainsString('4111-2222-3333-4444', $notif->message);
        $this->assertStringNotContainsString('secret_pass_123', $notif->title);
    }
}
