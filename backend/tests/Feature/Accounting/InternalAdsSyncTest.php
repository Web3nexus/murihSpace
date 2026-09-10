<?php

namespace Tests\Feature\Accounting;

use App\Models\RevenueStreamEntry;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class InternalAdsSyncTest extends TestCase
{
    use RefreshDatabase;

    public function test_successfully_syncs_ad_revenue_with_valid_key(): void
    {
        $payload = [
            'amount_cents'  => 45000,
            'currency'      => 'USD',
            'advertiser_id' => 101,
            'campaign_id'   => 'CAMP_SUMMER_2026',
            'country_code'  => 'USA',
            'tax_cents'     => 0,
            'description'   => 'CPC ad spend for summer campaign',
        ];

        $response = $this->withHeaders([
            'X-Internal-Service-Key' => 'murihspace_internal_ads_secret_key_default',
        ])->postJson('/api/v1/internal/accounting/sync-ad-revenue', $payload);

        $response->assertStatus(201);
        $response->assertJson(['success' => true]);

        $this->assertDatabaseHas('revenue_stream_entries', [
            'stream_type'        => 'ads',
            'source_system'      => 'ads-backend',
            'source_id'          => 'CAMP_SUMMER_2026',
            'gross_amount_cents' => 45000,
        ]);
    }

    public function test_rejects_sync_with_missing_or_invalid_key(): void
    {
        $payload = [
            'amount_cents'  => 1000,
            'currency'      => 'USD',
            'advertiser_id' => 55,
        ];

        // Missing key
        $res1 = $this->postJson('/api/v1/internal/accounting/sync-ad-revenue', $payload);
        $res1->assertStatus(401);

        // Invalid key
        $res2 = $this->withHeaders([
            'X-Internal-Service-Key' => 'wrong_secret_key',
        ])->postJson('/api/v1/internal/accounting/sync-ad-revenue', $payload);
        $res2->assertStatus(401);
    }
}

