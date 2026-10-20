<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdsSponsoredRouteTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Regression: GET /ads/{id} used to swallow /ads/sponsored, so the
     * controller received the string "sponsored" and threw a TypeError (500).
     * The sponsored endpoint must be reachable and never return a server error.
     */
    public function test_sponsored_ads_endpoint_is_not_captured_by_ad_id_route(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user, 'sanctum')
            ->getJson('/api/v1/ads/sponsored?placement=right_rail&limit=2');

        $this->assertNotEquals(500, $response->getStatusCode());
        $response->assertStatus(200);
    }

    /**
     * Non-numeric ad ids must not reach the controller.
     */
    public function test_ad_show_rejects_non_numeric_ids(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user, 'sanctum')->getJson('/api/v1/ads/not-a-number');

        $this->assertNotEquals(500, $response->getStatusCode());
        $this->assertGreaterThanOrEqual(400, $response->getStatusCode());
        $this->assertLessThan(500, $response->getStatusCode());
    }
}
