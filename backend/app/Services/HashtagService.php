<?php

namespace App\Services;

use App\Models\Hashtag;
use App\Models\HashtagStat;
use App\Models\Post;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Tracks hashtag usage and derives trending topics from real activity.
 *
 * Hashtags are extracted from post content and the explicit `hashtags`
 * attribute, normalised (lowercase, `#` stripped, unicode aware) and recorded
 * into two tables:
 *
 *  - `hashtags`      all-time aggregate (posts_count, first/last used)
 *  - `hashtag_stats` one row per tag per day (the raw material for trending)
 *
 * Trending is a time-decayed sum over the daily buckets, so a tag that is
 * suddenly used a lot rises, and one that has gone quiet falls — no hardcoded
 * "popular topics" required.
 */
class HashtagService
{
    /** Per-day decay factor applied to older usage when scoring trends. */
    private const DECAY = 0.7;

    /** Default trending look-back window, in days. */
    public const DEFAULT_WINDOW_DAYS = 7;

    /** Only seed suggestions from tags used within this many days. */
    private const SUGGEST_RECENCY_DAYS = 90;

    private static ?bool $tablesReady = null;

    /** Guards against running before the tracking tables exist (e.g. upgrades). */
    public function tablesReady(): bool
    {
        return self::$tablesReady ??= (Schema::hasTable('hashtags') && Schema::hasTable('hashtag_stats'));
    }

    // -----------------------------------------------------------------------
    // Extraction
    // -----------------------------------------------------------------------

    /**
     * Extract hashtags from an explicit list and/or the post body.
     *
     * @return array<string,string> normalised key (lowercase) => display text (no '#')
     */
    public function extract(?string $content, ?array $explicit): array
    {
        $tags = [];

        foreach ((array) $explicit as $tag) {
            if (is_string($tag)) {
                $this->remember($tags, $tag);
            }
        }

        if (is_string($content) && $content !== '') {
            if (preg_match_all('/#([\p{L}\p{N}_]{1,100})/u', $content, $matches)) {
                foreach ($matches[1] as $raw) {
                    $this->remember($tags, $raw);
                }
            }
        }

        return $tags;
    }

    /** Hashtags to persist on the post, including the leading '#'. */
    public function tagsForStorage(?string $content, ?array $explicit): array
    {
        return array_values(array_map(fn (string $display) => '#' . $display, $this->extract($content, $explicit)));
    }

    private function remember(array &$tags, string $raw): void
    {
        $clean = preg_replace('/[^\p{L}\p{N}_]/u', '', ltrim(trim($raw), '#')) ?? '';

        if ($clean === '' || mb_strlen($clean) > 100) {
            return;
        }

        $key = mb_strtolower($clean);

        if (! isset($tags[$key])) {
            $tags[$key] = $clean;
        }
    }

    /** Normalise an already-stored hashtag list into key => display form. */
    public function normalise(?array $tags): array
    {
        $normalised = [];

        foreach ((array) $tags as $tag) {
            if (is_string($tag)) {
                $this->remember($normalised, $tag);
            }
        }

        return $normalised;
    }

    // -----------------------------------------------------------------------
    // Recording
    // -----------------------------------------------------------------------

    /** Record a published post's hashtags (idempotent per post since we forget first). */
    public function recordPost(Post $post, ?array $rawTags = null): void
    {
        if (! $this->tablesReady() || $post->is_draft || $post->privacy === 'private') {
            return;
        }

        $tags = $this->normalise($rawTags ?? $post->hashtags);

        if (empty($tags)) {
            return;
        }

        $usedAt = $post->created_at ?? now();
        $date = $usedAt->toDateString();

        DB::transaction(function () use ($tags, $usedAt, $date) {
            foreach ($tags as $key => $display) {
                $hashtag = Hashtag::where('tag', $key)->lockForUpdate()->first();

                if (! $hashtag) {
                    try {
                        $hashtag = Hashtag::create([
                            'tag' => $key,
                            'display_tag' => $display,
                            'first_used_at' => $usedAt,
                            'last_used_at' => $usedAt,
                            'posts_count' => 0,
                        ]);
                    } catch (\Illuminate\Database\QueryException) {
                        $hashtag = Hashtag::where('tag', $key)->lockForUpdate()->first();
                    }
                }

                if ($hashtag) {
                    $hashtag->increment('posts_count');

                    $updates = [];
                    if ($hashtag->display_tag !== $display) {
                        $updates['display_tag'] = $display;
                    }
                    if (! $hashtag->last_used_at || $usedAt->gt($hashtag->last_used_at)) {
                        $updates['last_used_at'] = $usedAt;
                    }
                    if (! empty($updates)) {
                        $hashtag->update($updates);
                    }

                    $stat = HashtagStat::firstOrCreate(
                        ['hashtag_id' => $hashtag->id, 'date' => $date],
                        ['posts_count' => 0]
                    );
                    $stat->increment('posts_count');
                }
            }
        });
    }

    /** Remove a previously-recorded set of hashtags (on edit or delete). */
    public function forgetTags(Post $post, ?array $rawTags): void
    {
        if (! $this->tablesReady()) {
            return;
        }

        $tags = $this->normalise($rawTags);

        if (empty($tags)) {
            return;
        }

        $usedAt = $post->created_at ?? now();
        $date = $usedAt->toDateString();

        DB::transaction(function () use ($tags, $date) {
            foreach (array_keys($tags) as $key) {
                $hashtag = Hashtag::where('tag', $key)->lockForUpdate()->first();

                if (! $hashtag) {
                    continue;
                }

                if ($hashtag->posts_count > 0) {
                    $hashtag->decrement('posts_count');
                }

                HashtagStat::where('hashtag_id', $hashtag->id)
                    ->where('date', $date)
                    ->where('posts_count', '>', 0)
                    ->decrement('posts_count');
            }
        });
    }

    // -----------------------------------------------------------------------
    // Queries
    // -----------------------------------------------------------------------

    /**
     * Return trending hashtags, highest first.
     *
     * Each entry: ['hashtag' => Hashtag, 'score', 'window_posts', 'last_24h',
     * 'previous_24h', 'growth'].
     *
     * @return array<int,array<string,mixed>>
     */
    public function trending(int $limit = 10, int $windowDays = self::DEFAULT_WINDOW_DAYS): array
    {
        if (! $this->tablesReady() || $limit < 1) {
            return [];
        }

        $windowDays = max(1, $windowDays);
        $start = now()->subDays($windowDays - 1)->startOfDay();

        /** @var Collection<int,HashtagStat> $rows */
        $rows = HashtagStat::query()
            ->where('date', '>=', $start->toDateString())
            ->get(['hashtag_id', 'date', 'posts_count']);

        if ($rows->isEmpty()) {
            return [];
        }

        $hashtags = Hashtag::whereIn('id', $rows->pluck('hashtag_id')->unique())
            ->get()
            ->keyBy('id');

        $today = now()->startOfDay();
        $scored = [];

        foreach ($rows->groupBy('hashtag_id') as $hashtagId => $stats) {
            $hashtag = $hashtags->get($hashtagId);

            if (! $hashtag) {
                continue;
            }

            $score = 0.0;
            $windowPosts = 0;
            $last24 = 0;
            $previous24 = 0;

            foreach ($stats as $stat) {
                $date = $stat->date instanceof Carbon
                    ? $stat->date->copy()->startOfDay()
                    : Carbon::parse($stat->date)->startOfDay();

                $daysAgo = max(0, (int) $today->diffInDays($date));
                $count = (int) $stat->posts_count;

                $windowPosts += $count;
                $score += $count * (self::DECAY ** $daysAgo);

                if ($daysAgo === 0) {
                    $last24 += $count;
                } elseif ($daysAgo === 1) {
                    $previous24 += $count;
                }
            }

            $scored[] = [
                'hashtag' => $hashtag,
                'score' => round($score, 4),
                'window_posts' => $windowPosts,
                'last_24h' => $last24,
                'previous_24h' => $previous24,
                'growth' => $this->growth($last24, $previous24),
            ];
        }

        usort($scored, fn (array $a, array $b) => $b['score'] <=> $a['score']);

        return array_slice($scored, 0, $limit);
    }

    /**
     * Suggest hashtags for the composer.
     *
     * @return Collection<int,Hashtag>
     */
    public function suggest(string $query, int $limit = 10): Collection
    {
        if (! $this->tablesReady()) {
            return collect();
        }

        $clean = ltrim(trim($query), '#');
        $builder = Hashtag::query()
            ->where('posts_count', '>', 0)
            ->where(function ($q) {
                $q->whereNull('last_used_at')
                    ->orWhere('last_used_at', '>=', now()->subDays(self::SUGGEST_RECENCY_DAYS));
            });

        if ($clean !== '') {
            $like = DB::connection()->getDriverName() === 'pgsql' ? 'ilike' : 'like';
            $builder->where(function ($q) use ($clean, $like) {
                $q->where('tag', $like, mb_strtolower($clean) . '%')
                    ->orWhere('display_tag', $like, $clean . '%');
            });
        }

        return $builder
            ->orderByDesc('posts_count')
            ->orderByDesc('last_used_at')
            ->take(max(1, $limit))
            ->get();
    }

    public function find(string $tag): ?Hashtag
    {
        if (! $this->tablesReady()) {
            return null;
        }

        $clean = mb_strtolower(preg_replace('/[^\p{L}\p{N}_]/u', '', ltrim(trim($tag), '#')) ?? '');

        if ($clean === '') {
            return null;
        }

        return Hashtag::where('tag', $clean)->first();
    }

    private function growth(int $current, int $previous): float
    {
        if ($previous > 0) {
            return round((($current - $previous) / $previous) * 100, 1);
        }

        return $current > 0 ? 100.0 : 0.0;
    }
}
