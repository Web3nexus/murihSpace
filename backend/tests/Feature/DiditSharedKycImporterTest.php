<?php

namespace Tests\Feature;

use App\Enums\KycStatus;
use App\Models\KycVerification;
use App\Models\User;
use App\Services\Kyc\Didit\DiditSharedKycImporter;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class DiditSharedKycImporterTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Config::set('kyc.didit.enabled', true);
        Config::set('kyc.didit.api_key', 'test-api-key');
        Config::set('kyc.didit.workflow_id', 'workflow-1');
    }

    /**
     * Fake the import and the decision lookup for the cloned session.
     */
    private function fakeImport(string $sessionId, string $status, string $legalFirst = 'Ada', string $legalLast = 'Lovelace', int $code = 201): void
    {
        Http::fake([
            'verification.didit.me/v3/session/import-shared/' => Http::response([
                'session_id' => $sessionId,
                'session_kind' => 'user',
                'shared_from_session' => 'origin-' . $sessionId,
                'status' => $status,
            ], $code),
            "verification.didit.me/v3/session/{$sessionId}/decision/" => Http::response([
                'status' => $status,
                'id_verifications' => [['first_name' => $legalFirst, 'last_name' => $legalLast]],
            ]),
        ]);
    }

    public function test_approved_shared_session_verifies_user_and_requires_owner_check(): void
    {
        $this->fakeImport('cloned-session-1', 'Approved');

        $user = User::factory()->create(['name' => 'Ada Lovelace', 'kyc_status' => 'unsubmitted']);

        $verification = app(DiditSharedKycImporter::class)->import($user, 'share-token-1');

        $this->assertNotNull($verification);
        $this->assertSame('verified', $verification->status);
        $this->assertSame('cloned-session-1', $verification->provider_session_id);
        $this->assertSame('origin-cloned-session-1', $verification->provider_metadata['shared_from_session']);
        $this->assertTrue($verification->provider_metadata['name_matched']);

        $user->refresh();
        $this->assertSame(KycStatus::Verified->value, $user->kyc_status);
        $this->assertSame($verification->id, $user->kyc_verification_id);
        $this->assertTrue($user->requires_ownership_check);

        Http::assertSent(function ($request) use ($user) {
            return $request->hasHeader('x-api-key', 'test-api-key')
                && $request['share_token'] === 'share-token-1'
                && $request['workflow_id'] === 'workflow-1'
                && $request['vendor_data'] === 'murihspace_user_' . $user->uuid
                && $request['trust_review'] === true;
        });
    }

    public function test_approved_session_with_different_legal_name_goes_to_review(): void
    {
        $this->fakeImport('cloned-session-5', 'Approved', 'Grace', 'Hopper');

        $user = User::factory()->create(['name' => 'Ada Lovelace', 'kyc_status' => 'unsubmitted']);

        $verification = app(DiditSharedKycImporter::class)->import($user, 'share-token-5');

        $this->assertSame('pending', $verification->status);
        $this->assertFalse($verification->provider_metadata['name_matched']);
        $this->assertSame(KycStatus::Pending->value, $user->fresh()->kyc_status);
    }

    public function test_retrying_the_same_import_does_not_create_a_second_verification(): void
    {
        $this->fakeImport('cloned-session-2', 'Approved');

        $user = User::factory()->create(['name' => 'Ada Lovelace', 'kyc_status' => 'unsubmitted']);
        $importer = app(DiditSharedKycImporter::class);

        $first = $importer->import($user, 'share-token-2');
        $user->refresh();
        $second = $importer->import($user, 'share-token-2');

        $this->assertSame($first->id, $second->id);
        $this->assertSame(1, KycVerification::where('provider_session_id', 'cloned-session-2')->count());
    }

    public function test_rejected_token_leaves_user_status_unchanged(): void
    {
        Http::fake([
            'verification.didit.me/v3/session/import-shared/' => Http::response([
                'detail' => 'This session has already been shared with your application.',
            ], 403),
        ]);

        $user = User::factory()->create(['kyc_status' => 'unsubmitted']);

        $this->assertNull(app(DiditSharedKycImporter::class)->import($user, 'reused-token'));

        $user->refresh();
        $this->assertSame('unsubmitted', $user->kyc_status);
        $this->assertFalse($user->requires_ownership_check);
        $this->assertSame(0, KycVerification::where('user_id', $user->id)->count());
    }

    public function test_in_review_session_marks_user_pending_not_verified(): void
    {
        $this->fakeImport('cloned-session-3', 'In Review');

        $user = User::factory()->create(['name' => 'Ada Lovelace', 'kyc_status' => 'unsubmitted']);

        $verification = app(DiditSharedKycImporter::class)->import($user, 'share-token-3');

        $this->assertSame('pending', $verification->status);
        $this->assertSame(KycStatus::Pending->value, $user->fresh()->kyc_status);
    }
}
