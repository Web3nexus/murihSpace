<?php

namespace Tests\Feature;

use App\Http\Controllers\LinkInBioController;
use App\Models\LinkInBioLink;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\ActsAsSession;
use Tests\TestCase;

class LinkInBioRedirectLoopTest extends TestCase
{
    use ActsAsSession;
    use RefreshDatabase;

    public function test_detects_links_that_point_at_our_redirect_routes(): void
    {
        $this->assertTrue(LinkInBioController::isRedirectRoute('https://api.murihspace.com/api/v1/l/click/5'));
        $this->assertTrue(LinkInBioController::isRedirectRoute('https://api.murihspace.com/api/v1/l/affiliate/9'));
        $this->assertFalse(LinkInBioController::isRedirectRoute('https://example.com/shop'));
        $this->assertFalse(LinkInBioController::isRedirectRoute('https://example.com/click'));
    }

    public function test_saving_a_link_to_a_redirect_route_is_rejected(): void
    {
        $user = User::factory()->create();

        $this->actAsSession($user)->postJson('/api/v1/link-in-bio', [
            'title' => 'Loop',
            'url' => 'https://api.murihspace.com/api/v1/l/click/1',
        ])->assertStatus(422);

        $this->assertSame(0, LinkInBioLink::where('user_id', $user->id)->count());
    }

    public function test_redirect_refuses_a_link_that_points_at_a_redirect_route(): void
    {
        $user = User::factory()->create();
        $link = LinkInBioLink::create([
            'user_id' => $user->id,
            'title' => 'Loop',
            'url' => 'https://api.murihspace.com/api/v1/l/click/1',
            'is_active' => true,
        ]);

        $this->get("/api/v1/l/click/{$link->id}")->assertNotFound();
    }
}
