<?php

namespace App\Services;

use App\Exceptions\UnauthorizedException;

/**
 * Client for the Main MurihSpace backend.
 * Owns: users, profiles, posts, comments, reactions, social graph, marketplace, wallet, notifications.
 */
class MainApiClient extends ApiClient
{
    protected function baseUrl(): string
    {
        return config('api.main_base_url');
    }

    protected function serviceToken(): string
    {
        return config('api.main_service_token');
    }

    // -----------------------------------------------------------------------
    // Authentication
    // -----------------------------------------------------------------------

    /**
     * Verify an end-user Bearer token and return the user object.
     *
     * @throws UnauthorizedException
     */
    public function getAuthenticatedUser(string $token): array
    {
        $response = $this->get('user', [], $token);

        if (empty($response['data']) && empty($response['id'])) {
            throw new UnauthorizedException('Invalid token response from Main backend.');
        }

        // Normalise: the main backend may return { data: {...} } or bare object
        return $response['data'] ?? $response;
    }

    // -----------------------------------------------------------------------
    // Users
    // -----------------------------------------------------------------------

    public function getUser(string $userId, string $token): array
    {
        return $this->get("users/{$userId}", [], $token);
    }

    // -----------------------------------------------------------------------
    // Posts
    // -----------------------------------------------------------------------

    public function getPost(string $postId, string $token): array
    {
        return $this->get("posts/{$postId}", [], $token);
    }

    public function getPostComments(string $postId, array $query, string $token): array
    {
        return $this->get("posts/{$postId}/comments", $query, $token);
    }

    // -----------------------------------------------------------------------
    // Phase 2: Social graph edges
    // -----------------------------------------------------------------------

    public function getUserPosts(string $userId, array $query, string $token): array
    {
        return $this->get("v1/users/{$userId}/posts", $query, $token);
    }

    public function getUserFollowers(string $userId, array $query, string $token): array
    {
        return $this->get("v1/users/{$userId}/followers", $query, $token);
    }

    public function getUserFollowing(string $userId, array $query, string $token): array
    {
        return $this->get("v1/users/{$userId}/following", $query, $token);
    }

    // -----------------------------------------------------------------------
    // Phase 2: Businesses / Storefronts
    // -----------------------------------------------------------------------

    public function getStorefront(string $id, string $token): array
    {
        return $this->get("v1/storefronts/{$id}", [], $token);
    }

    public function getStorefrontByShortCode(string $shortCode): array
    {
        return $this->get("v1/stores/{$shortCode}", [], '');
    }

    public function getStorefrontProducts(string $id, array $query, string $token): array
    {
        return $this->get("v1/storefronts/{$id}/products", $query, $token);
    }

    public function getStorefrontPosts(string $shortCode, array $query): array
    {
        return $this->get("v1/stores/{$shortCode}/posts", $query, '');
    }

    // -----------------------------------------------------------------------
    // Phase 2: Products
    // -----------------------------------------------------------------------

    public function getProduct(string $id, string $token): array
    {
        return $this->get("v1/public/products/{$id}", [], $token);
    }
}
