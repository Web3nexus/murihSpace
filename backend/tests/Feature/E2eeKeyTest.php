<?php

namespace Tests\Feature;

use App\Models\E2eeDevice;
use App\Models\E2eeOneTimePrekey;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\ActsAsSession;
use Tests\TestCase;

class E2eeKeyTest extends TestCase
{
    use ActsAsSession;
    use RefreshDatabase;

    private function devicePayload(string $uuid = 'device-a'): array
    {
        return [
            'device_uuid' => $uuid,
            'registration_id' => 1234,
            'identity_key' => base64_encode(str_repeat('i', 32)),
            'signed_prekey_id' => 1,
            'signed_prekey_public' => base64_encode(str_repeat('s', 32)),
            'signed_prekey_signature' => base64_encode(str_repeat('g', 64)),
            'kyber_prekey_id' => 1,
            'kyber_prekey_public' => $this->kyberPublicKey(),
            'kyber_prekey_signature' => base64_encode(str_repeat('k', 64)),
        ];
    }

    /** A Kyber1024 public key (1569 bytes serialized) is about 2.1 KB once base64 encoded. */
    private function kyberPublicKey(): string
    {
        return base64_encode(str_repeat('K', 1569));
    }

    private function prekeys(int $from, int $count): array
    {
        return array_map(fn (int $i) => [
            'key_id' => $i,
            'public_key' => base64_encode(str_repeat(chr(65 + ($i % 26)), 32)),
        ], range($from, $from + $count - 1));
    }

    public function test_register_creates_a_device_and_updates_it_on_repeat(): void
    {
        $user = User::factory()->create();

        $this->actAsSession($user)->postJson('/api/v1/e2ee/devices', $this->devicePayload())
            ->assertCreated()
            ->assertJsonPath('data.data.device_uuid', 'device-a');

        $this->actAsSession($user)->postJson('/api/v1/e2ee/devices', array_merge($this->devicePayload(), ['registration_id' => 999]))
            ->assertCreated();

        $this->assertSame(1, E2eeDevice::where('user_id', $user->id)->count());
        $this->assertSame(999, E2eeDevice::where('user_id', $user->id)->first()->registration_id);
    }

    public function test_register_rejects_missing_keys(): void
    {
        $user = User::factory()->create();

        $this->actAsSession($user)->postJson('/api/v1/e2ee/devices', ['device_uuid' => 'device-a'])
            ->assertStatus(422);
    }

    public function test_prekeys_can_only_be_uploaded_to_your_own_device(): void
    {
        $owner = User::factory()->create();
        $other = User::factory()->create();
        $this->actAsSession($owner)->postJson('/api/v1/e2ee/devices', $this->devicePayload());

        $this->actAsSession($owner)->postJson('/api/v1/e2ee/devices/device-a/prekeys', ['prekeys' => $this->prekeys(1, 5)])
            ->assertOk()
            ->assertJsonPath('data.data.available', 5);

        $this->actAsSession($other)->postJson('/api/v1/e2ee/devices/device-a/prekeys', ['prekeys' => $this->prekeys(100, 2)])
            ->assertNotFound();
    }

    public function test_prekey_upload_never_replaces_a_key_that_was_already_stored(): void
    {
        $user = User::factory()->create();
        $this->actAsSession($user)->postJson('/api/v1/e2ee/devices', $this->devicePayload());
        $this->actAsSession($user)->postJson('/api/v1/e2ee/devices/device-a/prekeys', ['prekeys' => $this->prekeys(1, 1)]);
        $original = E2eeOneTimePrekey::where('key_id', 1)->first()->public_key;

        $this->actAsSession($user)->postJson('/api/v1/e2ee/devices/device-a/prekeys', [
            'prekeys' => [['key_id' => 1, 'public_key' => base64_encode('replacement-key-value-000000000')]],
        ])->assertOk();

        $this->assertSame($original, E2eeOneTimePrekey::where('key_id', 1)->first()->public_key);
    }

    public function test_bundle_hands_out_each_one_time_prekey_only_once(): void
    {
        $owner = User::factory()->create();
        $sender = User::factory()->create();
        $this->actAsSession($owner)->postJson('/api/v1/e2ee/devices', $this->devicePayload());
        $this->actAsSession($owner)->postJson('/api/v1/e2ee/devices/device-a/prekeys', ['prekeys' => $this->prekeys(1, 2)]);

        $first = $this->actAsSession($sender)->getJson("/api/v1/e2ee/users/{$owner->id}/bundles")
            ->assertOk()
            ->json('data.data.0');
        $second = $this->actAsSession($sender)->getJson("/api/v1/e2ee/users/{$owner->id}/bundles")
            ->json('data.data.0');
        $third = $this->actAsSession($sender)->getJson("/api/v1/e2ee/users/{$owner->id}/bundles")
            ->json('data.data.0');

        $this->assertSame('device-a', $first['device_uuid']);
        $this->assertSame(1, $first['one_time_prekey']['id']);
        $this->assertSame(2, $second['one_time_prekey']['id']);
        $this->assertNull($third['one_time_prekey']);
        $this->assertNotNull($first['signed_prekey_signature']);
    }

    public function test_register_accepts_a_two_kilobyte_kyber_key_and_stores_it(): void
    {
        $user = User::factory()->create();
        $payload = $this->devicePayload();
        $this->assertGreaterThan(2000, strlen($payload['kyber_prekey_public']));

        $this->actAsSession($user)->postJson('/api/v1/e2ee/devices', $payload)->assertCreated();

        $device = E2eeDevice::where('user_id', $user->id)->firstOrFail();
        $this->assertSame($payload['kyber_prekey_public'], $device->kyber_prekey_public);
        $this->assertSame($payload['kyber_prekey_signature'], $device->kyber_prekey_signature);
        $this->assertSame(1, $device->kyber_prekey_id);
    }

    public function test_register_refuses_a_missing_kyber_field(): void
    {
        $user = User::factory()->create();

        foreach (['kyber_prekey_id', 'kyber_prekey_public', 'kyber_prekey_signature'] as $field) {
            $payload = $this->devicePayload();
            unset($payload[$field]);

            $this->actAsSession($user)->postJson('/api/v1/e2ee/devices', $payload)
                ->assertStatus(422)
                ->assertJsonValidationErrors([$field]);
        }

        $this->assertSame(0, E2eeDevice::count());
    }

    public function test_bundle_returns_the_kyber_fields_in_the_flat_shape(): void
    {
        $owner = User::factory()->create();
        $sender = User::factory()->create();
        $payload = $this->devicePayload();
        $this->actAsSession($owner)->postJson('/api/v1/e2ee/devices', $payload);
        $this->actAsSession($owner)->postJson('/api/v1/e2ee/devices/device-a/prekeys', ['prekeys' => $this->prekeys(1, 1)]);

        $bundle = $this->actAsSession($sender)->getJson("/api/v1/e2ee/users/{$owner->id}/bundles")
            ->assertOk()
            ->json('data.data.0');

        $this->assertSame(
            ['device_uuid', 'identity_key', 'kyber_prekey_id', 'kyber_prekey_public', 'kyber_prekey_signature', 'one_time_prekey', 'registration_id', 'signed_prekey_id', 'signed_prekey_public', 'signed_prekey_signature'],
            collect(array_keys($bundle))->sort()->values()->all(),
        );
        $this->assertSame($payload['kyber_prekey_public'], $bundle['kyber_prekey_public']);
        $this->assertSame($payload['kyber_prekey_signature'], $bundle['kyber_prekey_signature']);
        $this->assertSame(1, $bundle['kyber_prekey_id']);
        $this->assertSame(['id' => 1, 'public_key' => $this->prekeys(1, 1)[0]['public_key']], $bundle['one_time_prekey']);
    }

    public function test_bundle_leaves_out_devices_registered_without_kyber_keys(): void
    {
        $owner = User::factory()->create();
        E2eeDevice::create([
            'user_id' => $owner->id,
            'device_uuid' => 'old-device',
            'registration_id' => 1,
            'identity_key' => base64_encode(str_repeat('i', 32)),
            'signed_prekey_id' => 1,
            'signed_prekey_public' => base64_encode(str_repeat('s', 32)),
            'signed_prekey_signature' => base64_encode(str_repeat('g', 64)),
        ]);
        $this->actAsSession($owner)->postJson('/api/v1/e2ee/devices', array_merge($this->devicePayload('device-new')));

        $bundles = $this->actAsSession($owner)->getJson("/api/v1/e2ee/users/{$owner->id}/bundles")
            ->assertOk()
            ->json('data.data');

        $this->assertSame(['device-new'], array_column($bundles, 'device_uuid'));
    }

    public function test_longer_identity_and_signed_keys_are_stored_intact(): void
    {
        $user = User::factory()->create();
        $payload = array_merge($this->devicePayload(), [
            'identity_key' => base64_encode(str_repeat('i', 300)),
            'signed_prekey_signature' => base64_encode(str_repeat('g', 300)),
        ]);

        $this->actAsSession($user)->postJson('/api/v1/e2ee/devices', $payload)->assertCreated();

        $device = E2eeDevice::where('user_id', $user->id)->firstOrFail();
        $this->assertSame($payload['identity_key'], $device->identity_key);
        $this->assertSame($payload['signed_prekey_signature'], $device->signed_prekey_signature);
    }

    public function test_bundle_requires_sign_in(): void
    {
        $owner = User::factory()->create();

        $this->getJson("/api/v1/e2ee/users/{$owner->id}/bundles")->assertUnauthorized();
    }

    public function test_upload_rejects_more_than_one_hundred_prekeys(): void
    {
        $user = User::factory()->create();
        $this->actAsSession($user)->postJson('/api/v1/e2ee/devices', $this->devicePayload());

        $this->actAsSession($user)->postJson('/api/v1/e2ee/devices/device-a/prekeys', ['prekeys' => $this->prekeys(1, 101)])
            ->assertStatus(422);
    }
}
