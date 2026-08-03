<?php

namespace App\Services;

use App\Jobs\CheckCreatorQualification;
use App\Models\AdminSetting;
use App\Models\CreatorQualificationEvent;
use App\Models\SocialAccount;
use App\Models\SocialFollowerSnapshot;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\Log;

class SocialAccountService
{
    /**
     * Upsert a social account record after an OAuth connect/login.
     * Called from SocialAuthController::callback() and the dedicated connect flow.
     */
    public function connect(User $user, string $provider, array $profile): SocialAccount
    {
        $providerFollowerCount = $profile['followers_count'] ?? $profile['follower_count'] ?? null;
        $hasFollowerCount = $providerFollowerCount !== null;

        // Only overwrite follower_count when the provider actually returned a value.
        // If omitted, preserve any previously stored count.
        $updateData = [
            'provider_user_id'       => $profile['id'] ?? null,
            'username'               => $profile['username'] ?? $profile['name'] ?? null,
            'profile_url'            => $profile['profile_url'] ?? $profile['link'] ?? null,
            'following_count'        => $profile['following_count'] ?? null,
            'verified_on_provider'   => (bool) ($profile['verified'] ?? false),
            'count_is_self_reported' => ! $hasFollowerCount,
            'connected_at'           => now(),
            'last_synced_at'         => now(),
            // Mark pending when no follower count supplied so a later sync is expected.
            'sync_status'            => $hasFollowerCount ? 'synced' : 'pending',
            'raw_metadata'           => $profile,
        ];

        if ($hasFollowerCount) {
            $updateData['follower_count'] = $providerFollowerCount;
        }

        $account = SocialAccount::updateOrCreate(
            ['user_id' => $user->id, 'provider' => $provider],
            $updateData
        );

        // Recheck qualification threshold after every connect/sync.
        $this->maybeQueueQualification($user);

        return $account;
    }

    /**
     * Manually set follower count (self-reported, no OAuth token).
     */
    public function manualConnect(User $user, string $provider, array $data): SocialAccount
    {
        $account = SocialAccount::updateOrCreate(
            ['user_id' => $user->id, 'provider' => $provider],
            [
                'username'               => $data['username'] ?? null,
                'profile_url'            => $data['profile_url'] ?? null,
                'follower_count'         => $data['follower_count'] ?? 0,
                'count_is_self_reported' => true,
                'connected_at'           => now(),
                'last_synced_at'         => now(),
                'sync_status'            => 'synced',
            ]
        );

        $this->maybeQueueQualification($user);

        return $account;
    }

    /**
     * Get all admin-enabled providers.
     */
    public function enabledProviders(): array
    {
        $setting = AdminSetting::get('creator_qualification.enabled_providers');
        if ($setting) {
            $decoded = json_decode($setting, true);
            if (is_array($decoded)) {
                return $decoded;
            }
        }

        return SocialAccount::supportedProviders();
    }

    /**
     * Calculate the combined verified follower count for a user.
     * Only counts accounts from enabled providers.
     */
    public function calculateCombinedFollowers(User $user): array
    {
        $enabledProviders = $this->enabledProviders();
        $combineAll       = (bool) AdminSetting::get('creator_qualification.combine_counts', true);

        $accounts = $user->socialAccounts()
            ->whereIn('provider', $enabledProviders)
            ->where('sync_status', 'synced')
            ->whereNotNull('follower_count')
            ->get();

        $breakdown = [];
        $total     = 0;

        foreach ($accounts as $account) {
            $breakdown[$account->provider] = $account->follower_count;
            $total += $account->follower_count;
        }

        return [
            'combined_followers' => $combineAll ? $total : ($accounts->max('follower_count') ?? 0),
            'provider_breakdown' => $breakdown,
            'account_count'      => $accounts->count(),
        ];
    }

    /**
     * Check whether the user's combined followers meet the configured threshold.
     */
    public function checkQualificationThreshold(User $user): bool
    {
        $enabled = (bool) AdminSetting::get('creator_qualification.enabled', true);

        if (! $enabled) {
            return false;
        }

        // Already a creator — no need to qualify
        if ($user->role === 'creator') {
            return false;
        }

        $minAccounts = (int) AdminSetting::get('creator_qualification.min_connected_accounts', 1);
        $threshold   = (int) AdminSetting::get('creator_qualification.follower_threshold', 10000);
        $summary     = $this->calculateCombinedFollowers($user);

        return $summary['account_count'] >= $minAccounts
            && $summary['combined_followers'] >= $threshold;
    }

    /**
     * Take and persist a follower snapshot.
     */
    public function takeFollowerSnapshot(User $user): SocialFollowerSnapshot
    {
        $summary   = $this->calculateCombinedFollowers($user);
        $threshold = (int) AdminSetting::get('creator_qualification.follower_threshold', 10000);

        return SocialFollowerSnapshot::create([
            'user_id'            => $user->id,
            'combined_followers' => $summary['combined_followers'],
            'provider_breakdown' => $summary['provider_breakdown'],
            'threshold_at_time'  => $threshold,
            'captured_at'        => now(),
        ]);
    }

    /**
     * Trigger the full qualification workflow: snapshot → event → delayed job.
     */
    public function triggerQualificationWorkflow(User $user): CreatorQualificationEvent
    {
        $snapshot = $this->takeFollowerSnapshot($user);

        $delayAmount = (int) AdminSetting::get('creator_qualification.delay_amount', 24);
        $delayUnit   = AdminSetting::get('creator_qualification.delay_unit', 'hours');
        $expiryHours = (int) AdminSetting::get('creator_qualification.auto_expiry_hours', 168);

        $delay     = $delayUnit === 'days'
            ? Carbon::now()->addDays($delayAmount)
            : Carbon::now()->addHours($delayAmount);

        $expiresAt = Carbon::now()->addHours($expiryHours);

        $event = CreatorQualificationEvent::create([
            'user_id'      => $user->id,
            'snapshot_id'  => $snapshot->id,
            'status'       => 'pending',
            'scheduled_at' => $delay,
            'expires_at'   => $expiresAt,
        ]);

        // Dispatch the check job with the configured delay
        CheckCreatorQualification::dispatch($event->id)->delay($delay);

        Log::info('Creator qualification workflow triggered', [
            'user_id'    => $user->id,
            'event_id'   => $event->id,
            'snapshot'   => $snapshot->combined_followers,
            'fires_at'   => $delay->toIso8601String(),
        ]);

        return $event;
    }

    /**
     * If the user meets the threshold and has no open pending event, trigger the workflow.
     */
    public function maybeQueueQualification(User $user): void
    {
        if (! $this->checkQualificationThreshold($user)) {
            return;
        }

        // Wrap in a transaction with a row-level lock to prevent race conditions
        // where two simultaneous requests both pass the exists() check and create
        // duplicate pending events.
        \Illuminate\Support\Facades\DB::transaction(function () use ($user) {
            $hasOpenEvent = CreatorQualificationEvent::where('user_id', $user->id)
                ->whereIn('status', ['pending', 'notified'])
                ->lockForUpdate()
                ->exists();

            if ($hasOpenEvent) {
                return;
            }

            $this->triggerQualificationWorkflow($user);
        });
    }
}
