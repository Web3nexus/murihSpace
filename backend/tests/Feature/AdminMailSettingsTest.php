<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\MailEngineService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AdminMailSettingsTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_update_mail_engine_to_resend_and_apply_settings(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        Sanctum::actingAs($admin);

        $response = $this->putJson('/api/v1/securegate/mail-settings', [
            'transport' => 'resend',
            'resend_key' => 're_test_key_123456789',
            'from_address' => 'notifications@murihspace.com',
            'from_name' => 'MurihSpace',
        ]);

        $response->assertStatus(200);

        $json = $response->json();
        $data = $json['data']['data'] ?? $json['data'];
        $this->assertEquals('resend', $data['transport']);

        /** @var MailEngineService $engine */
        $engine = app(MailEngineService::class);
        $engine->apply();

        $this->assertEquals('resend', config('mail.default'));
        $this->assertEquals('re_test_key_123456789', config('services.resend.key'));
        $this->assertEquals('notifications@murihspace.com', config('mail.from.address'));
    }

    public function test_all_supported_transports_can_be_configured_and_applied(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        Sanctum::actingAs($admin);

        /** @var MailEngineService $engine */
        $engine = app(MailEngineService::class);

        $transports = $engine->transports(); // smtp, log, postmark, ses, resend, sendmail, array

        foreach ($transports as $transport) {
            $response = $this->putJson('/api/v1/securegate/mail-settings', [
                'transport' => $transport,
                'postmark_key' => 'pm_test_key',
                'resend_key' => 're_test_key',
            ]);

            $response->assertStatus(200);
            $engine->apply();

            $this->assertEquals($transport, config('mail.default'), "Failed configuring {$transport}");
        }
    }

    public function test_resend_transport_can_be_instantiated_without_missing_class_error(): void
    {
        Mail::fake();

        $admin = User::factory()->create(['role' => 'admin']);
        Sanctum::actingAs($admin);

        $response = $this->postJson('/api/v1/securegate/mail-settings/test', [
            'to' => 'testuser@example.com',
        ]);

        $response->assertStatus(200);
        $response->assertJsonFragment([
            'message' => 'Test email sent. Check the inbox of testuser@example.com.',
        ]);
    }
}
