<?php

namespace Tests\Feature;

use App\Models\Advertiser;
use App\Models\AdAccount;
use App\Models\AdAccountMember;
use App\Models\Campaign;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * The Ads Manager list endpoints add per-row delivery totals from ad_metrics
 * and accept an optional date range. These tests pin the totals and the range.
 */
class AdsManagerListTotalsTest extends TestCase
{
    use RefreshDatabase;

    private User $user;
    private AdAccount $account;
    private Campaign $campaign;
    private int $adId;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::factory()->create(['murihspace_user_id' => 77]);
        $advertiser = Advertiser::create([
            'murihspace_user_id' => $this->user->murihspace_user_id,
            'business_name' => 'Test Business',
            'country' => 'US',
            'currency' => 'USD',
            'timezone' => 'UTC',
        ]);
        $this->account = AdAccount::create([
            'advertiser_id' => $advertiser->id,
            'name' => 'Test Ad Account',
            'currency' => 'USD',
            'timezone' => 'UTC',
            'status' => 'active',
        ]);
        AdAccountMember::create([
            'ad_account_id' => $this->account->id,
            'murihspace_user_id' => $this->user->murihspace_user_id,
            'role' => 'owner',
        ]);

        $this->campaign = Campaign::create([
            'ad_account_id' => $this->account->id,
            'advertiser_id' => $advertiser->id,
            'name' => 'Spring Sale',
            'objective' => 'traffic',
            'status' => 'active',
            'budget_type' => 'daily',
            'budget_amount' => 50,
        ]);

        $groupId = DB::table('ad_groups')->insertGetId([
            'campaign_id' => $this->campaign->id,
            'name' => 'Group A',
            'status' => 'active',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->adId = DB::table('ads')->insertGetId([
            'ad_group_id' => $groupId,
            'name' => 'Ad A',
            'status' => 'active',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->metric('2026-10-01', 100, 5, 250, 1, 900);
        $this->metric('2026-10-10', 50, 1, 100, 0, 0);
    }

    private function metric(string $date, int $impressions, int $clicks, int $spend, int $conversions, int $value): void
    {
        DB::table('ad_metrics')->insert([
            'ad_id' => $this->adId,
            'date' => $date,
            'impressions' => $impressions,
            'clicks' => $clicks,
            'spend' => $spend,
            'conversions' => $conversions,
            'conversion_value' => $value,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function test_campaign_list_adds_totals_across_all_dates_by_default(): void
    {
        $response = $this->actingAs($this->user, 'sanctum')->getJson('/api/campaigns');

        $response->assertOk()
            ->assertJsonStructure(['data', 'current_page', 'last_page', 'per_page', 'total'])
            ->assertJsonPath('data.0.totals.impressions', 150)
            ->assertJsonPath('data.0.totals.clicks', 6)
            ->assertJsonPath('data.0.totals.spend', 350)
            ->assertJsonPath('data.0.totals.conversions', 1)
            ->assertJsonPath('data.0.totals.conversion_value', 900);
    }

    public function test_campaign_list_limits_totals_to_the_requested_date_range(): void
    {
        $response = $this->actingAs($this->user, 'sanctum')
            ->getJson('/api/campaigns?start_date=2026-10-05&end_date=2026-10-31');

        $response->assertOk()
            ->assertJsonPath('data.0.totals.impressions', 50)
            ->assertJsonPath('data.0.totals.spend', 100);
    }

    public function test_ad_list_adds_totals_per_ad(): void
    {
        $response = $this->actingAs($this->user, 'sanctum')->getJson('/api/ads');

        $response->assertOk()
            ->assertJsonPath('data.0.totals.impressions', 150)
            ->assertJsonPath('data.0.totals.clicks', 6);
    }

    public function test_page_size_is_capped_at_one_hundred(): void
    {
        $this->actingAs($this->user, 'sanctum')
            ->getJson('/api/campaigns?per_page=500')
            ->assertOk()
            ->assertJsonPath('per_page', 100);
    }

    public function test_malformed_date_range_is_rejected(): void
    {
        $this->actingAs($this->user, 'sanctum')
            ->getJson('/api/campaigns?start_date=10/01/2026')
            ->assertStatus(422);
    }

    public function test_analytics_report_respects_the_requested_date_range(): void
    {
        $response = $this->actingAs($this->user, 'sanctum')
            ->withHeaders(['X-Advertiser-ID' => (string) $this->account->id])
            ->getJson('/api/analytics/report?start_date=2026-10-05&end_date=2026-10-31');

        $response->assertOk()
            ->assertJsonPath('summary.impressions', 50)
            ->assertJsonPath('summary.spend_usd', 1);
    }
}
