<?php

namespace Tests\Feature;

use App\Models\User;
use App\Notifications\MurihOfficialNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class FollowNotificationTest extends TestCase
{
    use RefreshDatabase;

    public function test_following_a_user_notifies_them(): void
    {
        Notification::fake();
        $follower = User::factory()->create(['email_verified_at' => now()]);
        $target = User::factory()->create(['email_verified_at' => now()]);
        Sanctum::actingAs($follower);

        $this->postJson("/api/v1/users/{$target->id}/follow")->assertOk();

        Notification::assertSentTo($target, MurihOfficialNotification::class, function (MurihOfficialNotification $n) {
            return $n->type === 'new_follower';
        });
    }
}
