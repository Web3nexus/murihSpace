<?php

namespace App\Services;

use App\Models\HelpArticle;
use App\Models\HelpCategory;
use App\Models\HelpSearchTerm;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;

class HelpSearchService
{
    /**
     * Search published help articles across title, keywords, body,
     * category name and tags. Returns matching articles ranked by score.
     */
    public function search(string $query, int $limit = 10): Collection
    {
        $like = $this->likeOperator();
        $casts = $this->jsonCast();

        $articles = HelpArticle::query()
            ->published()
            ->select(['help_articles.*'])
            ->leftJoin('help_categories', 'help_categories.id', '=', 'help_articles.category_id')
            ->where(function ($q) use ($query, $like, $casts) {
                $q->where('help_articles.title', $like, "%{$query}%")
                    ->orWhere('help_articles.excerpt', $like, "%{$query}%")
                    ->orWhere('help_articles.body', $like, "%{$query}%")
                    ->orWhere('help_categories.name', $like, "%{$query}%")
                    ->orWhere('help_categories.slug', $like, "%{$query}%")
                    ->orWhereRaw("{$casts('help_articles.keywords')} {$like} ?", ["%{$query}%"])
                    ->orWhereRaw("{$casts('help_articles.tags')} {$like} ?", ["%{$query}%"])
                    ->orWhereRaw("{$casts('help_articles.sections')} {$like} ?", ["%{$query}%"]);
            })
            ->with('category')
            ->get()
            ->map(function (HelpArticle $article) use ($query) {
                $article->search_score = self::score($article, $query);

                return $article;
            })
            ->filter(fn ($article) => $article->search_score > 0)
            ->sortByDesc('search_score')
            ->take($limit)
            ->values();

        $this->logSearch($query, $articles->count());

        return $articles;
    }

    public static function score(HelpArticle $article, string $query): int
    {
        $needle = mb_strtolower($query);
        $score = 0;

        if (str_contains(mb_strtolower($article->title), $needle)) {
            $score += 5;
        }

        if (str_contains(mb_strtolower($article->excerpt ?? ''), $needle)) {
            $score += 4;
        }

        foreach (($article->keywords ?? []) as $keyword) {
            if (str_contains(mb_strtolower($keyword), $needle)) {
                $score += 3;
            }
        }

        foreach (($article->tags ?? []) as $tag) {
            if (str_contains(mb_strtolower($tag), $needle)) {
                $score += 2;
            }
        }

        if (str_contains(mb_strtolower($article->body ?? ''), $needle)) {
            $score += 1;
        }

        if ($article->category) {
            $category = mb_strtolower((string) $article->category->name);

            if (str_contains($category, $needle)) {
                $score += 3;
            }
        }

        return $score;
    }

    protected function likeOperator(): string
    {
        return DB::getDriverName() === 'pgsql' ? 'ilike' : 'like';
    }

    protected function jsonCast(): callable
    {
        if (DB::getDriverName() === 'pgsql') {
            return fn ($column) => "CAST({$column} AS TEXT)";
        }

        return fn ($column) => $column;
    }

    protected function logSearch(string $query, int $resultCount): void
    {
        try {
            HelpSearchTerm::create([
                'query' => $query,
                'result_count' => $resultCount,
            ]);
        } catch (\Throwable $e) {
            // Logging a search must never break the response.
            report($e);
        }
    }

    public function relatedByCategory(HelpCategory $category, int $limit = 5): Collection
    {
        return HelpArticle::query()
            ->published()
            ->where('category_id', $category->id)
            ->orderByDesc('featured')
            ->orderByDesc('view_count')
            ->limit($limit)
            ->get();
    }
}
