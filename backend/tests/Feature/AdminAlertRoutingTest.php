<?php

namespace Tests\Feature;

use App\Models\AdminAlert;
use App\Models\User;
use App\Services\AdminAlertService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminAlertRoutingTest extends TestCase
{
    use RefreshDatabase;

    public function test_warning_alert_routes_to_email_and_telegram(): void
    {
        $service = app(AdminAlertService::class);
        $alert = $service->dispatch([
            'event_type' => 'deposit_failed',
            'severity' => 'warning',
            'environment' => 'production',
            'title' => 'Deposit failed',
            'description' => 'A deposit failed for user 42',
            'affected_service' => 'wallet',
            'reference' => 'DEP-1',
            'metadata' => ['card_last4' => '4242'],
        ]);

        $this->assertSame('new', $alert->status);
        $this->assertContains('email', $alert->channels);
        $this->assertContains('telegram', $alert->channels);
    }

    public function test_critical_alert_requires_acknowledgement_and_redacts_sensitive_data(): void
    {
        $service = app(AdminAlertService::class);
        $alert = $service->dispatch([
            'event_type' => 'wallet_imbalance',
            'severity' => 'critical',
            'environment' => 'production',
            'title' => 'Wallet imbalance',
            'description' => 'Card 4242-4242-4242-4242 failed and token abc123 was exposed',
            'affected_service' => 'wallet',
            'reference' => 'WLT-1',
            'metadata' => ['otp_code' => '123456', 'card_number' => '4242424242424242'],
        ]);

        $this->assertTrue($alert->requires_acknowledgement);
        $this->assertSame('new', $alert->status);
        $this->assertStringNotContainsString('4242424242424242', $alert->description);
        $this->assertStringNotContainsString('abc123', $alert->description);
    }

    public function test_alert_can_be_acknowledged(): void
    {
        $service = app(AdminAlertService::class);
        $actor = User::factory()->create(['role' => 'admin']);
        $alert = $service->dispatch([
            'event_type' => 'suspicious_login',
            'severity' => 'critical',
            'environment' => 'production',
            'title' => 'Suspicious login',
            'description' => 'Suspicious login detected',
            'affected_service' => 'auth',
            'reference' => 'AUTH-1',
        ]);

        $updated = $service->acknowledge($alert, $actor, 'Investigating');

        $this->assertSame('acknowledged', $updated->status);
        $this->assertSame($actor->id, $updated->acknowledged_by);
    }
}
