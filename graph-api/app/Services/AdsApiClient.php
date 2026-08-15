<?php

namespace App\Services;

/**
 * Client for the Ads backend.
 *
 * Owns: ad accounts, campaigns, ad groups, ads, creatives, audiences,
 *       pixels, product catalogs, budgets, reporting, analytics.
 *
 * Service-to-service: the Graph API forwards requests using a service token
 * and passes the verified MurihSpace user ID via X-MurihSpace-User-ID header
 * so the Ads backend can scope resources to the correct advertiser.
 */
class AdsApiClient extends ApiClient
{
    protected function baseUrl(): string
    {
        return config('api.ads_base_url');
    }

    protected function serviceToken(): string
    {
        return config('api.ads_service_token');
    }

    // -----------------------------------------------------------------------
    // User identity propagation
    // -----------------------------------------------------------------------

    /**
     * Build Guzzle options that include the authenticated user header
     * so the Ads backend can scope advertiser membership checks.
     */
    private function userHeaders(string $murihUserId): array
    {
        return ['headers' => ['X-MurihSpace-User-ID' => $murihUserId]];
    }

    // -----------------------------------------------------------------------
    // Ad Accounts
    // -----------------------------------------------------------------------

    public function getAdAccounts(string $userId, array $query = []): array
    {
        return $this->get('ad-accounts', array_merge($query, ['user_id' => $userId]));
    }

    public function getAdAccount(string $accountId, string $userId): array
    {
        return $this->get("ad-accounts/{$accountId}", ['user_id' => $userId]);
    }

    // -----------------------------------------------------------------------
    // Campaigns
    // -----------------------------------------------------------------------

    public function getCampaigns(string $accountId, array $query, string $userId): array
    {
        return $this->get('campaigns', array_merge($query, [
            'ad_account_id' => $accountId,
            'user_id'       => $userId,
        ]));
    }

    public function getCampaign(string $campaignId, string $userId): array
    {
        return $this->get("campaigns/{$campaignId}", ['user_id' => $userId]);
    }

    // -----------------------------------------------------------------------
    // Ad Groups
    // -----------------------------------------------------------------------

    public function getAdGroups(string $campaignId, array $query, string $userId): array
    {
        return $this->get('ad-groups', array_merge($query, [
            'campaign_id' => $campaignId,
            'user_id'     => $userId,
        ]));
    }

    public function getAdGroup(string $adGroupId, string $userId): array
    {
        return $this->get("ad-groups/{$adGroupId}", ['user_id' => $userId]);
    }

    // -----------------------------------------------------------------------
    // Ads
    // -----------------------------------------------------------------------

    public function getAds(string $adGroupId, array $query, string $userId): array
    {
        return $this->get('ads', array_merge($query, [
            'ad_group_id' => $adGroupId,
            'user_id'     => $userId,
        ]));
    }

    public function getAd(string $adId, string $userId): array
    {
        return $this->get("ads/{$adId}", ['user_id' => $userId]);
    }

    // -----------------------------------------------------------------------
    // Creatives
    // -----------------------------------------------------------------------

    public function getCreatives(string $adId, array $query, string $userId): array
    {
        return $this->get('creatives', array_merge($query, [
            'ad_id'   => $adId,
            'user_id' => $userId,
        ]));
    }

    public function getCreative(string $creativeId, string $userId): array
    {
        return $this->get("creatives/{$creativeId}", ['user_id' => $userId]);
    }

    // -----------------------------------------------------------------------
    // Analytics
    // -----------------------------------------------------------------------

    public function getAnalytics(string $accountId, array $query, string $userId): array
    {
        return $this->get('analytics/report', array_merge($query, [
            'advertiser_id' => $accountId,
            'user_id'       => $userId,
        ]));
    }

    // -----------------------------------------------------------------------
    // Health check
    // -----------------------------------------------------------------------

    public function health(): array
    {
        return $this->get('health');
    }
}

