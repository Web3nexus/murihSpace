<?php

namespace App\Services\Ads;

use App\Models\User;
use App\Models\AdCampaign;
use App\Models\AdCreative;
use App\Models\AdAnalytics;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class AdsSyncService
{
    /**
     * Generate an authenticated SSO handshake payload for MurihSpace Ads Studio.
     */
    public function generateSsoToken(User $user): array
    {
        $issuedAt = time();
        $expiresAt = $issuedAt + 3600; // 1 hour validity

        $payload = [
            'user_id'       => $user->id,
            'name'          => $user->name,
            'email'         => $user->email,
            'username'      => $user->username ?? 'user_' . $user->id,
            'avatar_url'    => $user->avatar_url ?? $user->avatar ?? null,
            'role'          => $user->role ?? 'creator',
            'business_name' => $user->business_name ?? ($user->name . ' Ads'),
            'iat'           => $issuedAt,
            'exp'           => $expiresAt,
        ];

        $encodedPayload = base64_encode(json_encode($payload));
        $signature = hash_hmac('sha256', $encodedPayload, config('app.key'));
        $token = $encodedPayload . '.' . $signature;

        // Perform background database synchronization if ads database is reachable
        $this->syncUserToAdsDb($user);

        $adsFrontendUrl = env('ADS_FRONTEND_URL', 'http://localhost:5174');
        $ssoLaunchUrl = rtrim($adsFrontendUrl, '/') . '/auth/sso?token=' . urlencode($token);

        return [
            'token'          => $token,
            'expires_at'     => $expiresAt,
            'sso_launch_url' => $ssoLaunchUrl,
            'user'           => $payload,
        ];
    }

    /**
     * Validate an SSO token issued by MurihSpace.
     */
    public function validateSsoToken(string $token): ?array
    {
        $parts = explode('.', $token);
        if (count($parts) !== 2) {
            return null;
        }

        [$encodedPayload, $signature] = $parts;
        $expectedSignature = hash_hmac('sha256', $encodedPayload, config('app.key'));

        if (!hash_equals($expectedSignature, $signature)) {
            return null;
        }

        $payload = json_decode(base64_decode($encodedPayload), true);
        if (!$payload || !isset($payload['exp']) || time() > $payload['exp']) {
            return null;
        }

        return $payload;
    }

    /**
     * Synchronize a MurihSpace user into the dedicated murihspace_ads database.
     */
    public function syncUserToAdsDb(User $user): bool
    {
        try {
            $adsDb = DB::connection('ads_pgsql');
            
            // 1. Sync or create User in murihspace_ads
            $existingUser = $adsDb->table('users')->where('email', $user->email)->first();
            $adsUserId = $existingUser ? $existingUser->id : null;

            if (!$existingUser) {
                $adsUserId = $adsDb->table('users')->insertGetId([
                    'name'       => $user->name,
                    'email'      => $user->email,
                    'password'   => $user->password,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            } else {
                $adsDb->table('users')->where('id', $adsUserId)->update([
                    'name'       => $user->name,
                    'updated_at' => now(),
                ]);
            }

            // 2. Sync or create Advertiser in murihspace_ads
            if ($adsDb->getSchemaBuilder()->hasTable('advertisers')) {
                $advertiser = $adsDb->table('advertisers')
                    ->where('murihspace_user_id', $user->id)
                    ->orWhere('id', $adsUserId)
                    ->first();

                $businessName = $user->business_name ?? ($user->name . ' Studio');

                if (!$advertiser) {
                    $advertiserId = $adsDb->table('advertisers')->insertGetId([
                        'murihspace_user_id'  => $user->id,
                        'business_name'       => $businessName,
                        'business_type'       => $user->role === 'vendor' ? 'ecommerce' : 'creator',
                        'country'             => 'US',
                        'currency'            => 'USD',
                        'timezone'            => 'UTC',
                        'verification_status' => 'identity_verified',
                        'account_status'      => 'active',
                        'created_at'          => now(),
                        'updated_at'          => now(),
                    ]);
                } else {
                    $advertiserId = $advertiser->id;
                    $adsDb->table('advertisers')->where('id', $advertiserId)->update([
                        'business_name'  => $businessName,
                        'account_status' => 'active',
                        'updated_at'     => now(),
                    ]);
                }

                // 3. Sync or create Ad Account
                if ($adsDb->getSchemaBuilder()->hasTable('ad_accounts')) {
                    $adAccount = $adsDb->table('ad_accounts')
                        ->where('advertiser_id', $advertiserId)
                        ->first();

                    if (!$adAccount) {
                        $adsDb->table('ad_accounts')->insert([
                            'advertiser_id' => $advertiserId,
                            'name'          => $businessName . ' Account',
                            'currency'      => 'USD',
                            'timezone'      => 'UTC',
                            'status'        => 'active',
                            'created_at'    => now(),
                            'updated_at'    => now(),
                        ]);
                    }
                }

                // 4. Sync or create Ad Wallet
                if ($adsDb->getSchemaBuilder()->hasTable('ad_wallets')) {
                    $adWallet = $adsDb->table('ad_wallets')
                        ->where('advertiser_id', $advertiserId)
                        ->first();

                    if (!$adWallet) {
                        $adsDb->table('ad_wallets')->insert([
                            'advertiser_id' => $advertiserId,
                            'balance'       => 100.00, // Initial promo credit
                            'currency'      => 'USD',
                            'created_at'    => now(),
                            'updated_at'    => now(),
                        ]);
                    }
                }
            }

            return true;
        } catch (\Throwable $e) {
            Log::warning('Ads DB cross-talk sync skipped or unavailable: ' . $e->getMessage());
            return false;
        }
    }

    /**
     * Get active sponsored advertisements for specific placements:
     * - 'right_rail' (desktop right side sponsored bar)
     * - 'inter_post' (in-feed TikTok & Facebook style video/image with countdown)
     * - 'feed' (general feed sponsored item)
     */
    public function getSponsoredAds(string $placement = 'right_rail', ?int $viewerId = null, int $limit = 3): array
    {
        $ads = [];

        // 1. Try local AdCampaigns from MurihSpace database
        try {
            $campaigns = AdCampaign::with(['creatives', 'user'])
                ->where('status', 'active')
                ->where('review_status', 'approved')
                ->latest()
                ->take($limit)
                ->get();

            foreach ($campaigns as $camp) {
                $creative = $camp->creatives->first();
                if (!$creative) continue;

                $ads[] = [
                    'id'               => $camp->id,
                    'campaign_id'      => $camp->id,
                    'placement'        => $placement,
                    'advertiser_name'  => $camp->user->name ?? 'MurihSpace Creator',
                    'advertiser_avatar'=> $camp->user->avatar_url ?? $camp->user->avatar ?? null,
                    'headline'         => $creative->headline ?? $camp->name,
                    'description'      => $creative->description ?? 'Discover exclusive products and content.',
                    'media_url'        => $creative->media_url ?? 'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=800&q=80',
                    'media_type'       => $creative->media_type ?? (str_ends_with($creative->media_url ?? '', '.mp4') ? 'video' : 'image'),
                    'cta_text'         => $creative->cta_text ?? 'Learn More',
                    'destination_url'  => $creative->destination_url ?? '/app/store',
                    'skip_countdown'   => 5, // 5 seconds unskippable duration
                    'is_sponsored'     => true,
                    'source'           => 'murihspace_campaign',
                ];
            }
        } catch (\Throwable $e) {
            Log::debug('Error loading local ad campaigns: ' . $e->getMessage());
        }

        // 2. Try querying murihspace_ads database if available
        if (count($ads) < $limit) {
            try {
                $adsDb = DB::connection('ads_pgsql');
                if ($adsDb->getSchemaBuilder()->hasTable('ads')) {
                    $remoteAds = $adsDb->table('ads')
                        ->join('creatives', 'ads.creative_id', '=', 'creatives.id')
                        ->join('ad_groups', 'ads.ad_group_id', '=', 'ad_groups.id')
                        ->join('campaigns', 'ad_groups.campaign_id', '=', 'campaigns.id')
                        ->select(
                            'ads.id',
                            'ads.name as ad_name',
                            'ads.cta_type',
                            'ads.cta_url',
                            'creatives.headline',
                            'creatives.body',
                            'creatives.image_url',
                            'creatives.video_url',
                            'campaigns.name as campaign_name'
                        )
                        ->where('ads.status', 'active')
                        ->take($limit - count($ads))
                        ->get();

                    foreach ($remoteAds as $rAd) {
                        $ads[] = [
                            'id'               => 'remote_' . $rAd->id,
                            'campaign_id'      => $rAd->id,
                            'placement'        => $placement,
                            'advertiser_name'  => 'Verified Advertiser',
                            'advertiser_avatar'=> null,
                            'headline'         => $rAd->headline ?? $rAd->ad_name,
                            'description'      => $rAd->body ?? 'Explore trending collections and top creators on MurihSpace.',
                            'media_url'        => $rAd->video_url ?? $rAd->image_url ?? 'https://images.unsplash.com/photo-1556742049-0a67c5574f73?w=800&q=80',
                            'media_type'       => !empty($rAd->video_url) ? 'video' : 'image',
                            'cta_text'         => $rAd->cta_type ?? 'Shop Now',
                            'destination_url'  => $rAd->cta_url ?? '/app/store',
                            'skip_countdown'   => 5,
                            'is_sponsored'     => true,
                            'source'           => 'ads_studio',
                        ];
                    }
                }
            } catch (\Throwable $e) {
                // Secondary database offline or table not present yet
            }
        }

        // 3. Guaranteed High-Quality Curated Presets
        // Ensures the Right Rail and In-Feed Countdown Ads are ALWAYS populated with gorgeous, functional ads
        if (count($ads) < $limit) {
            $presets = $this->getCuratedPresets($placement);
            foreach ($presets as $p) {
                if (count($ads) >= $limit) break;
                $ads[] = $p;
            }
        }

        return $ads;
    }

    /**
     * Curated platform sponsor advertisements for instant live preview.
     */
    protected function getCuratedPresets(string $placement): array
    {
        if ($placement === 'inter_post') {
            return [
                [
                    'id'               => 'preset_inter_1',
                    'campaign_id'      => 101,
                    'placement'        => 'inter_post',
                    'advertiser_name'  => 'MurihSpace Creator Studio',
                    'advertiser_avatar'=> 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&q=80',
                    'headline'         => 'Monetize Your Audience in 1 Click',
                    'description'      => 'Unlock courses, digital merchandise, 1:1 bookings, and member tiers with 0 setup fee.',
                    'media_url'        => 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1000&q=80',
                    'media_type'       => 'image',
                    'cta_text'         => 'Join Creator Studio',
                    'destination_url'  => '/app/onboarding',
                    'skip_countdown'   => 5,
                    'is_sponsored'     => true,
                    'badge'            => 'Sponsored',
                    'likes'            => 1420,
                    'comments'         => 86,
                ],
                [
                    'id'               => 'preset_inter_2',
                    'campaign_id'      => 102,
                    'placement'        => 'inter_post',
                    'advertiser_name'  => 'Apex Audio & Gear Co.',
                    'advertiser_avatar'=> 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&q=80',
                    'headline'         => 'Studio Pro Headphones — 30% Off This Week',
                    'description'      => 'Immersive spatial audio built for podcast creators, streamers, and music lovers.',
                    'media_url'        => 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=1000&q=80',
                    'media_type'       => 'image',
                    'cta_text'         => 'Shop Merchandise',
                    'destination_url'  => '/app/store',
                    'skip_countdown'   => 5,
                    'is_sponsored'     => true,
                    'badge'            => 'Sponsored',
                    'likes'            => 984,
                    'comments'         => 42,
                ],
            ];
        }

        // Right Rail Presets
        return [
            [
                'id'               => 'preset_rail_1',
                'campaign_id'      => 201,
                'placement'        => 'right_rail',
                'advertiser_name'  => 'Vanguard Mastermind',
                'advertiser_avatar'=> 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&q=80',
                'headline'         => 'Private Founder Cohort 2026',
                'description'      => 'Weekly live strategy sessions with top tier tech and e-commerce leaders.',
                'media_url'        => 'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=600&q=80',
                'media_type'       => 'image',
                'cta_text'         => 'Apply Now',
                'destination_url'  => '/app/communities',
                'skip_countdown'   => 0,
                'is_sponsored'     => true,
                'badge'            => 'Sponsored',
            ],
            [
                'id'               => 'preset_rail_2',
                'campaign_id'      => 202,
                'placement'        => 'right_rail',
                'advertiser_name'  => 'Pulse Fitness Apparel',
                'advertiser_avatar'=> 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=100&q=80',
                'headline'         => 'Breathable High-Performance Activewear',
                'description'      => 'Designed for all-day training and creator lifestyle.',
                'media_url'        => 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=600&q=80',
                'media_type'       => 'image',
                'cta_text'         => 'View Store',
                'destination_url'  => '/app/store',
                'skip_countdown'   => 0,
                'is_sponsored'     => true,
                'badge'            => 'Sponsored',
            ],
        ];
    }

    /**
     * Record an ad impression.
     */
    public function recordImpression(int|string $campaignId, ?int $viewerId = null): void
    {
        if (is_numeric($campaignId)) {
            try {
                $today = now()->toDateString();
                AdAnalytics::updateOrCreate(
                    ['campaign_id' => $campaignId, 'date' => $today],
                    ['impressions' => DB::raw('impressions + 1'), 'reach' => DB::raw('reach + 1')]
                );
            } catch (\Throwable $e) {}
        }
    }

    /**
     * Record an ad click.
     */
    public function recordClick(int|string $campaignId, ?int $viewerId = null): void
    {
        if (is_numeric($campaignId)) {
            try {
                $today = now()->toDateString();
                AdAnalytics::updateOrCreate(
                    ['campaign_id' => $campaignId, 'date' => $today],
                    ['clicks' => DB::raw('clicks + 1')]
                );
            } catch (\Throwable $e) {}
        }
    }
}

