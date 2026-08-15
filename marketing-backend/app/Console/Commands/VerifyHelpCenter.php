<?php

namespace App\Console\Commands;

use App\Models\HelpArticle;
use App\Models\HelpCategory;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;

#[Signature('support:help-verify {--file= : Path to the help center seed JSON} {--api= : Public help API base URL to compare against instead of the DB (e.g. https://example.com/api/public/help)} {--no-exit : Always exit 0, for report-only runs}')]
#[Description('Compare the frozen help center seed against the support DB or a live public API. Read-only.')]
class VerifyHelpCenter extends Command
{
    protected int $errors = 0;

    protected int $warnings = 0;

    protected array $report = [];

    protected ?array $snapshot = null;

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $file = $this->option('file')
            ?? database_path('seed-data/help-center.json');

        if (! is_file($file) || ! is_readable($file)) {
            $this->error("Seed file not found: {$file}");

            return self::FAILURE;
        }

        $data = json_decode(file_get_contents($file), true);

        if (! is_array($data) || (! isset($data['categories']) && ! isset($data['articles']))) {
            $this->error('Invalid seed file structure. Expected { categories: [], articles: [] }.');

            return self::FAILURE;
        }

        $source = $this->option('api')
            ? $this->apiSnapshot($this->option('api'))
            : $this->dbSnapshot();

        if ($source === null) {
            return self::FAILURE;
        }

        $this->snapshot = $source;

        $this->compare('Category', $this->seedCategories($data['categories'] ?? []), $source['categories']);
        $this->compare('Article', $this->seedArticles($data['articles'] ?? []), $source['articles']);

        $this->newLine();
        $this->info('── Help center verification summary ───────────────');
        $this->info('Categories: '.count($this->seedCategories($data['categories'] ?? [])).' seed records checked');
        $this->info('Articles:   '.count($this->seedArticles($data['articles'] ?? [])).' seed records checked');
        $this->info('Errors:     '.$this->errors);
        $this->info('Warnings:   '.$this->warnings);
        $this->newLine();

        $this->flushReport();

        if ($this->errors > 0) {
            $this->error('❌ Verification FAILED — content has diverged from the seed.');

            return $this->option('no-exit') ? self::SUCCESS : self::FAILURE;
        }

        $this->info('✅ Verification passed — no drift detected.');

        return self::SUCCESS;
    }

    protected function dbSnapshot(): array
    {
        $categories = [];
        foreach (HelpCategory::all() as $category) {
            $categories[$category->slug] = [
                'name' => $category->name,
                'blurb' => $category->blurb,
                'icon' => $category->icon,
            ];
        }

        $articles = [];
        foreach (HelpArticle::with('relatedArticles')->get() as $article) {
            $articles[$article->slug] = [
                'category' => $article->category?->slug,
                'title' => $article->title,
                'excerpt' => $article->excerpt,
                'sections' => $this->normaliseSections($article->sections),
                'keywords' => $this->normaliseKeywords($article->keywords),
                'related' => $article->relatedArticles->pluck('slug')->values()->all(),
                'state' => $article->state,
            ];
        }

        return ['categories' => $categories, 'articles' => $articles];
    }

    protected function apiSnapshot(string $base): ?array
    {
        $base = rtrim($base, '/');

        try {
            $categoriesResponse = Http::timeout(10)->get("{$base}/categories");
            $articlesResponse = Http::timeout(10)->get("{$base}/articles");
        } catch (\Throwable $e) {
            $this->error("Failed to reach help API at {$base}: {$e->getMessage()}");

            return null;
        }

        if ($categoriesResponse->failed() || $articlesResponse->failed()) {
            $this->error("Help API returned an error (categories: {$categoriesResponse->status()}, articles: {$articlesResponse->status()}).");

            return null;
        }

        $categories = [];
        foreach ($categoriesResponse->json() as $category) {
            $id = $category['id'] ?? $category['slug'] ?? null;
            if (! $id) {
                continue;
            }
            $categories[$id] = [
                'name' => $category['name'] ?? $category['label'] ?? '',
                'blurb' => $category['blurb'] ?? null,
                'icon' => $category['icon'] ?? null,
            ];
        }

        $articles = [];
        foreach ($articlesResponse->json() as $article) {
            $slug = $article['id'] ?? $article['slug'] ?? null;
            if (! $slug) {
                continue;
            }

            try {
                $detailResponse = Http::timeout(10)->get("{$base}/articles/{$slug}");
            } catch (\Throwable $e) {
                $this->error("Failed to fetch article {$slug} from help API: {$e->getMessage()}");
                $this->errors++;

                continue;
            }

            if ($detailResponse->failed()) {
                $this->error("Help API error fetching article {$slug} (HTTP {$detailResponse->status()}).");
                $this->errors++;

                continue;
            }

            $detail = $detailResponse->json();

            $related = collect($detail['related'] ?? [])->map(fn ($r) => $r['id'] ?? $r['slug'] ?? null)->filter()->values()->all();

            $articles[$slug] = [
                'category' => $detail['category'] ?? $article['category'] ?? null,
                'title' => $detail['title'] ?? $article['title'] ?? '',
                'excerpt' => $detail['excerpt'] ?? $article['excerpt'] ?? null,
                'sections' => $this->normaliseSections($detail['sections'] ?? []),
                'keywords' => $this->normaliseKeywords($detail['keywords'] ?? $article['keywords'] ?? []),
                'related' => $related,
                'state' => 'published',
            ];
        }

        return ['categories' => $categories, 'articles' => $articles];
    }

    protected function seedCategories(array $categories): array
    {
        $out = [];
        foreach ($categories as $index => $category) {
            $slug = $category['id'] ?? $category['slug'] ?? '';
            if (! $slug) {
                continue;
            }
            $out[$slug] = [
                'name' => $category['label'] ?? $category['name'] ?? '',
                'blurb' => $category['blurb'] ?? null,
                'icon' => $category['icon'] ?? null,
            ];
        }

        return $out;
    }

    protected function seedArticles(array $articles): array
    {
        $out = [];
        foreach ($articles as $article) {
            $slug = $article['id'] ?? $article['slug'] ?? '';
            if (! $slug) {
                continue;
            }
            $out[$slug] = [
                'category' => $article['categoryId'] ?? $article['category_id'] ?? null,
                'title' => $article['title'] ?? '',
                'excerpt' => $article['excerpt'] ?? null,
                'sections' => $this->normaliseSections($article['sections'] ?? []),
                'keywords' => $this->normaliseKeywords($article['keywords'] ?? []),
                'related' => $article['related'] ?? [],
                'state' => $article['state'] ?? 'published',
            ];
        }

        return $out;
    }

    protected function compare(string $label, array $expected, array $actual): void
    {
        foreach ($expected as $slug => $fields) {
            if (! array_key_exists($slug, $actual)) {
                $this->reportError("Missing {$label} in actual: {$slug}");

                continue;
            }

            foreach ($fields as $field => $value) {
                if ($field === 'state') {
                    if ($actual[$slug]['state'] !== 'published') {
                        $this->reportWarning("{$label} '{$slug}' is '{$actual[$slug]['state']}' in the DB — it will not be served publicly.");
                    }

                    continue;
                }

                $equal = match ($field) {
                    'sections' => $this->normaliseSections($value) === $this->normaliseSections($actual[$slug][$field] ?? null),
                    'keywords' => $this->normaliseKeywords($value) === $this->normaliseKeywords($actual[$slug][$field] ?? null),
                    default => json_encode($value) === json_encode($actual[$slug][$field] ?? null),
                };

                if (! $equal) {
                    $this->reportError(
                        "{$label} '{$slug}' {$field} mismatch:\n".
                        '  seed:   '.json_encode($value)."\n".
                        '  actual: '.json_encode($actual[$slug][$field] ?? null)
                    );
                }
            }
        }

        foreach (array_diff_key($actual, $expected) as $slug => $fields) {
            $this->reportWarning("Extra {$label} in actual (not in seed, likely CMS-managed): {$slug}");
        }
    }

    protected function normaliseSections(mixed $sections): array
    {
        if (! is_array($sections)) {
            return [];
        }

        return collect($sections)->map(fn ($s) => [
            'heading' => trim((string) ($s['heading'] ?? '')),
            'body' => trim((string) ($s['body'] ?? '')),
        ])->values()->all();
    }

    protected function normaliseKeywords(mixed $keywords): array
    {
        if (! is_array($keywords)) {
            return [];
        }

        return collect($keywords)->filter()->map(fn ($k) => trim((string) $k))->values()->all();
    }

    protected function reportError(string $message): void
    {
        $this->errors++;
        $this->report[] = ['type' => 'error', 'message' => $message];
    }

    protected function reportWarning(string $message): void
    {
        $this->warnings++;
        $this->report[] = ['type' => 'warning', 'message' => $message];
    }

    protected function flushReport(): void
    {
        foreach ($this->report as $entry) {
            if ($entry['type'] === 'error') {
                $this->error('✗ '.$entry['message']);
            } else {
                $this->warn('! '.$entry['message']);
            }
        }
    }
}
