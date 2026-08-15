<?php

namespace App\Support;

/**
 * Normalises upstream service responses into the standardised Graph API shape:
 *
 * Single resource:
 *   { "data": { "id": "usr_...", "type": "user", ... }, "meta": {} }
 *
 * Collection:
 *   { "data": [...], "paging": { "next_cursor": "...", "has_more": true } }
 */
class ResponseNormaliser
{
    // -----------------------------------------------------------------------
    // Object normalisers
    // -----------------------------------------------------------------------

    public static function user(array $raw): array
    {
        return array_filter([
            'id'         => self::id($raw, 'usr'),
            'type'       => 'user',
            'username'   => $raw['username'] ?? null,
            'name'       => $raw['name'] ?? null,
            'avatar_url' => $raw['avatar'] ?? $raw['avatar_url'] ?? null,
            'bio'        => $raw['bio'] ?? null,
            'verified'   => $raw['verified'] ?? false,
            'created_at' => $raw['created_at'] ?? null,
        ]);
    }

    public static function post(array $raw): array
    {
        return array_filter([
            'id'         => self::id($raw, 'pst'),
            'type'       => 'post',
            'text'       => $raw['body'] ?? $raw['text'] ?? $raw['content'] ?? null,
            'author'     => isset($raw['user']) ? ['id' => self::id($raw['user'], 'usr')] : null,
            'media'      => $raw['media'] ?? [],
            'created_at' => $raw['created_at'] ?? null,
        ]);
    }

    public static function comment(array $raw): array
    {
        return array_filter([
            'id'         => self::id($raw, 'cmt'),
            'type'       => 'comment',
            'text'       => $raw['body'] ?? $raw['text'] ?? $raw['content'] ?? null,
            'author'     => isset($raw['user']) ? ['id' => self::id($raw['user'], 'usr')] : null,
            'created_at' => $raw['created_at'] ?? null,
        ]);
    }

    public static function business(array $raw): array
    {
        return array_filter([
            'id'          => self::id($raw, 'biz'),
            'type'        => 'business',
            'name'        => $raw['name'] ?? null,
            'short_code'  => $raw['short_code'] ?? $raw['shortCode'] ?? null,
            'description' => $raw['description'] ?? null,
            'avatar_url'  => $raw['logo'] ?? $raw['avatar_url'] ?? null,
            'owner'       => isset($raw['user']) ? ['id' => self::id($raw['user'], 'usr')] : null,
            'created_at'  => $raw['created_at'] ?? null,
        ]);
    }

    public static function product(array $raw): array
    {
        return array_filter([
            'id'          => self::id($raw, 'prd'),
            'type'        => 'product',
            'name'        => $raw['name'] ?? $raw['title'] ?? null,
            'description' => $raw['description'] ?? null,
            'price'       => $raw['price'] ?? null,
            'currency'    => $raw['currency'] ?? 'USD',
            'product_type'=> $raw['type'] ?? $raw['product_type'] ?? 'digital',
            'thumbnail'   => $raw['thumbnail'] ?? $raw['cover_image'] ?? null,
            'seller'      => isset($raw['user']) ? ['id' => self::id($raw['user'], 'usr')] : null,
            'created_at'  => $raw['created_at'] ?? null,
        ]);
    }

    // -----------------------------------------------------------------------
    // Phase 3: Ads domain
    // -----------------------------------------------------------------------

    public static function adAccount(array $raw): array
    {
        return array_filter([
            'id'             => self::id($raw, 'aac'),
            'type'           => 'ad_account',
            'name'           => $raw['name'] ?? null,
            'status'         => $raw['status'] ?? null,
            'currency'       => $raw['currency'] ?? null,
            'timezone'       => $raw['timezone'] ?? null,
            'spending_limit' => $raw['spending_limit'] ?? null,
            'created_at'     => $raw['created_at'] ?? null,
        ]);
    }

    public static function campaign(array $raw): array
    {
        return array_filter([
            'id'              => self::id($raw, 'cmp'),
            'type'            => 'campaign',
            'name'            => $raw['name'] ?? null,
            'status'          => $raw['status'] ?? null,
            'objective'       => $raw['objective'] ?? null,
            'budget'          => $raw['budget'] ?? null,
            'budget_type'     => $raw['budget_type'] ?? null,
            'start_date'      => $raw['start_date'] ?? null,
            'end_date'        => $raw['end_date'] ?? null,
            'ad_account'      => isset($raw['ad_account_id']) ? ['id' => 'aac_' . $raw['ad_account_id']] : null,
            'created_at'      => $raw['created_at'] ?? null,
        ]);
    }

    public static function adGroup(array $raw): array
    {
        return array_filter([
            'id'           => self::id($raw, 'agp'),
            'type'         => 'ad_group',
            'name'         => $raw['name'] ?? null,
            'status'       => $raw['status'] ?? null,
            'bid_amount'   => $raw['bid_amount'] ?? null,
            'targeting'    => $raw['targeting'] ?? null,
            'campaign'     => isset($raw['campaign_id']) ? ['id' => 'cmp_' . $raw['campaign_id']] : null,
            'created_at'   => $raw['created_at'] ?? null,
        ]);
    }

    public static function ad(array $raw): array
    {
        return array_filter([
            'id'          => self::id($raw, 'ad_'),
            'type'        => 'ad',
            'name'        => $raw['name'] ?? null,
            'status'      => $raw['status'] ?? null,
            'format'      => $raw['format'] ?? null,
            'ad_group'    => isset($raw['ad_group_id']) ? ['id' => 'agp_' . $raw['ad_group_id']] : null,
            'creative'    => isset($raw['creative_id']) ? ['id' => 'cre_' . $raw['creative_id']] : null,
            'created_at'  => $raw['created_at'] ?? null,
        ]);
    }

    public static function creative(array $raw): array
    {
        return array_filter([
            'id'           => self::id($raw, 'cre'),
            'type'         => 'creative',
            'name'         => $raw['name'] ?? null,
            'format'       => $raw['format'] ?? null,
            'headline'     => $raw['headline'] ?? null,
            'body'         => $raw['body'] ?? $raw['description'] ?? null,
            'cta'          => $raw['cta'] ?? null,
            'media_url'    => $raw['media_url'] ?? $raw['image_url'] ?? null,
            'destination'  => $raw['destination_url'] ?? $raw['url'] ?? null,
            'created_at'   => $raw['created_at'] ?? null,
        ]);
    }

    // -----------------------------------------------------------------------
    // Phase 4: Support & Marketing domain
    // -----------------------------------------------------------------------

    public static function ticket(array $raw): array
    {
        return array_filter([
            'id'            => self::id($raw, 'tkt'),
            'type'          => 'ticket',
            'ticket_number' => $raw['ticket_number'] ?? null,
            'subject'       => $raw['subject'] ?? null,
            'description'   => $raw['description'] ?? null,
            'status'        => $raw['status'] ?? null,
            'priority'      => $raw['priority'] ?? null,
            'category'      => $raw['category'] ?? null,
            'messages'      => $raw['messages'] ?? null,
            'events'        => $raw['events'] ?? null,
            'attachments'   => $raw['attachments'] ?? null,
            'rating'        => $raw['rating'] ?? null,
            'created_at'    => $raw['created_at'] ?? null,
            'updated_at'    => $raw['updated_at'] ?? null,
        ]);
    }

    public static function helpArticle(array $raw): array
    {
        return array_filter([
            'id'          => self::id($raw, 'art'),
            'type'        => 'help_article',
            'title'       => $raw['title'] ?? null,
            'slug'        => $raw['slug'] ?? null,
            'content'     => $raw['content'] ?? $raw['body'] ?? null,
            'category'    => $raw['category'] ?? null,
            'created_at'  => $raw['created_at'] ?? null,
        ]);
    }

    public static function announcement(array $raw): array
    {
        return array_filter([
            'id'          => self::id($raw, 'anc'),
            'type'        => 'announcement',
            'title'       => $raw['title'] ?? null,
            'body'        => $raw['body'] ?? $raw['content'] ?? null,
            'published_at'=> $raw['published_at'] ?? $raw['created_at'] ?? null,
        ]);
    }

    // -----------------------------------------------------------------------
    // Collection wrapper
    // -----------------------------------------------------------------------

    public static function collection(array $raw, string $type = 'item'): array
    {
        $items  = $raw['data'] ?? $raw;
        $paging = [];

        if (isset($raw['next_cursor']) || isset($raw['paging'])) {
            $pagingRaw    = $raw['paging'] ?? [];
            $paging = [
                'next_cursor' => $raw['next_cursor'] ?? $pagingRaw['next_cursor'] ?? null,
                'has_more'    => $raw['has_more']    ?? $pagingRaw['has_more']    ?? false,
            ];
        }

        return array_filter([
            'data'   => array_values((array) $items),
            'paging' => $paging ?: null,
            'meta'   => [],
        ]);
    }

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    /**
     * Returns the existing Graph-prefixed ID or derives one from the numeric ID.
     * Avoids exposing raw sequential database IDs.
     */
    private static function id(array $raw, string $prefix): ?string
    {
        if (!empty($raw['id'])) {
            $id = (string) $raw['id'];
            // If already prefixed, return as-is
            if (str_starts_with($id, $prefix . '_')) {
                return $id;
            }
            return $prefix . '_' . $id;
        }
        return null;
    }
}
