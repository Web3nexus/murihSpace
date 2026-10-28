<?php

namespace Tests\Feature;

use App\Models\E2eeBackup;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\ActsAsSession;
use Tests\TestCase;

class E2eeBackupTest extends TestCase
{
    use ActsAsSession;
    use RefreshDatabase;

    private function backupPayload(array $overrides = []): array
    {
        return array_merge([
            'version' => 1,
            'salt' => base64_encode(str_repeat('s', 16)),
            'iv' => base64_encode(str_repeat('i', 12)),
            'iterations' => 600000,
            'ciphertext' => base64_encode(str_repeat('c', 512)),
        ], $overrides);
    }

    public function test_unauthenticated_requests_are_refused(): void
    {
        $user = User::factory()->create();
        E2eeBackup::create($this->backupPayload() + ['user_id' => $user->id]);

        $this->putJson('/api/v1/e2ee/backup', $this->backupPayload())->assertUnauthorized();
        $this->getJson('/api/v1/e2ee/backup')->assertUnauthorized();
        $this->assertSame(1, E2eeBackup::count());
    }

    public function test_owner_can_store_and_read_back_the_blob(): void
    {
        $user = User::factory()->create();
        $payload = $this->backupPayload();

        $this->actAsSession($user)->putJson('/api/v1/e2ee/backup', $payload)
            ->assertOk()
            ->assertJsonPath('data.data.version', 1);

        $this->actAsSession($user)->getJson('/api/v1/e2ee/backup')
            ->assertOk()
            ->assertJsonPath('data.data.salt', $payload['salt'])
            ->assertJsonPath('data.data.iv', $payload['iv'])
            ->assertJsonPath('data.data.iterations', 600000)
            ->assertJsonPath('data.data.ciphertext', $payload['ciphertext']);
    }

    public function test_storing_again_replaces_the_backup(): void
    {
        $user = User::factory()->create();

        $this->actAsSession($user)->putJson('/api/v1/e2ee/backup', $this->backupPayload())->assertOk();
        $replacement = $this->backupPayload([
            'ciphertext' => base64_encode(str_repeat('z', 64)),
            'salt' => base64_encode(str_repeat('t', 16)),
        ]);
        $this->actAsSession($user)->putJson('/api/v1/e2ee/backup', $replacement)->assertOk();

        $this->assertSame(1, E2eeBackup::where('user_id', $user->id)->count());
        $this->actAsSession($user)->getJson('/api/v1/e2ee/backup')
            ->assertJsonPath('data.data.ciphertext', $replacement['ciphertext'])
            ->assertJsonPath('data.data.salt', $replacement['salt']);
    }

    public function test_a_backup_is_only_returned_to_its_owner(): void
    {
        $owner = User::factory()->create();
        $other = User::factory()->create();

        $this->actAsSession($owner)->putJson('/api/v1/e2ee/backup', $this->backupPayload())->assertOk();

        $this->actAsSession($other)->getJson('/api/v1/e2ee/backup')->assertNotFound();
    }

    public function test_reading_without_a_backup_returns_not_found(): void
    {
        $user = User::factory()->create();

        $this->actAsSession($user)->getJson('/api/v1/e2ee/backup')->assertNotFound();
    }

    public function test_a_backup_over_the_size_limit_is_refused(): void
    {
        $user = User::factory()->create();

        $this->actAsSession($user)->putJson('/api/v1/e2ee/backup', $this->backupPayload([
            'ciphertext' => str_repeat('A', 2097153),
        ]))->assertStatus(422)->assertJsonValidationErrors(['ciphertext']);

        $this->assertSame(0, E2eeBackup::count());
    }

    public function test_plaintext_or_extra_fields_are_refused(): void
    {
        $user = User::factory()->create();

        $this->actAsSession($user)->putJson('/api/v1/e2ee/backup', $this->backupPayload([
            'plaintext' => '{"identity":"private-key"}',
        ]))->assertStatus(422)->assertJsonValidationErrors(['plaintext']);

        $this->actAsSession($user)->putJson('/api/v1/e2ee/backup', $this->backupPayload([
            'device_state' => '{}',
        ]))->assertStatus(422);

        $this->assertSame(0, E2eeBackup::count());
    }

    public function test_weak_iteration_counts_are_refused(): void
    {
        $user = User::factory()->create();

        $this->actAsSession($user)->putJson('/api/v1/e2ee/backup', $this->backupPayload(['iterations' => 1000]))
            ->assertStatus(422)
            ->assertJsonValidationErrors(['iterations']);
    }

    public function test_missing_fields_are_refused(): void
    {
        $user = User::factory()->create();

        $this->actAsSession($user)->putJson('/api/v1/e2ee/backup', ['version' => 1])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['salt', 'iv', 'iterations', 'ciphertext']);
    }
}
