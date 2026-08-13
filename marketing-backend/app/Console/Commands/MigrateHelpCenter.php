<?php

namespace App\Console\Commands;

use App\Models\HelpArticle;
use App\Models\HelpArticleRelation;
use App\Models\HelpArticleRevision;
use App\Models\HelpCategory;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

#[Signature('support:migrate-help-center {--file= : Path to the help center seed JSON}')]
#[Description('Migrate/import help center categories, articles and revisions into the support database. Idempotent.')]
class MigrateHelpCenter extends Command
{
    protected int $categoriesImported = 0;

    protected int $categoriesUpdated = 0;

    protected int $articlesImported = 0;

    protected int $articlesUpdated = 0;

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

        DB::transaction(function () use ($data) {
            $this->importCategories($data['categories'] ?? []);
            $this->importArticles($data['articles'] ?? []);
        });

        $this->newLine();
        $this->info('── Help center migration summary ─────────────────────');
        $this->info("Categories: {$this->categoriesImported} imported, {$this->categoriesUpdated} updated");
        $this->info("Articles:   {$this->articlesImported} imported, {$this->articlesUpdated} updated");

        return self::SUCCESS;
    }

    protected function importCategories(array $categories): void
    {
        foreach ($categories as $index => $category) {
            $slug = $category['id'] ?? $category['slug'] ?? Str::slug($category['name'] ?? '');
            $categoryId = (int) ($category['id'] ?? 0);

            $existing = HelpCategory::firstWhere('slug', $slug);

            $payload = [
                'slug' => $slug,
                'name' => $category['label'] ?? $category['name'] ?? '',
                'blurb' => $category['blurb'] ?? null,
                'icon' => $category['icon'] ?? null,
                'sort_order' => $category['sort_order'] ?? $index,
                'featured' => $category['featured'] ?? false,
                'is_active' => $category['is_active'] ?? true,
            ];

            if ($existing) {
                $existing->update($payload);
                $this->categoriesUpdated++;
            } else {
                HelpCategory::create($payload);
                $this->categoriesImported++;
            }
        }
    }

    protected function importArticles(array $articles): void
    {
        foreach ($articles as $article) {
            $slug = $article['id'] ?? $article['slug'] ?? Str::slug($article['title'] ?? '');
            $categorySlug = $article['categoryId'] ?? $article['category_id'] ?? null;

            $category = $categorySlug ? HelpCategory::firstWhere('slug', $categorySlug) : null;

            $title = $article['title'] ?? '';
            $excerpt = $article['excerpt'] ?? null;
            $sections = $article['sections'] ?? [];
            $keywords = $article['keywords'] ?? [];
            $related = $article['related'] ?? [];

            $body = self::sectionsToBody($sections);

            $existing = HelpArticle::firstWhere('slug', $slug);

            $seoTitle = $article['seo_title'] ?? null;
            $seoDescription = $article['seo_description'] ?? $excerpt;
            $canonicalUrl = $article['canonical_url'] ?? null;

            $payload = [
                'category_id' => $category?->id,
                'slug' => $slug,
                'title' => $title,
                'excerpt' => $excerpt,
                'body' => $body,
                'sections' => $sections,
                'keywords' => $keywords,
                'state' => $article['state'] ?? 'published',
                'featured' => $article['featured'] ?? false,
                'seo_title' => $seoTitle,
                'seo_description' => $seoDescription,
                'canonical_url' => $canonicalUrl,
                'published_at' => $article['published_at'] ?? now(),
            ];

            if ($existing) {
                $existing->update($payload);
                $this->syncRelations($existing, $related);
                $this->articlesUpdated++;

                continue;
            }

            $created = HelpArticle::create($payload);
            $this->syncRelations($created, $related);
            $this->createRevision($created, $title, $excerpt, $body, $sections, $keywords, $seoTitle, $seoDescription, $canonicalUrl);
            $this->articlesImported++;
        }
    }

    protected function syncRelations(HelpArticle $article, array $relatedSlugs): void
    {
        HelpArticleRelation::where('article_id', $article->id)->delete();

        foreach ($relatedSlugs as $index => $relatedSlug) {
            $related = HelpArticle::firstWhere('slug', $relatedSlug);
            if ($related && $related->id !== $article->id) {
                HelpArticleRelation::create([
                    'article_id' => $article->id,
                    'related_article_id' => $related->id,
                    'sort_order' => $index,
                ]);
            }
        }
    }

    protected function createRevision(HelpArticle $article, string $title, ?string $excerpt, string $body, array $sections, array $keywords, ?string $seoTitle, ?string $seoDescription, ?string $canonicalUrl): void
    {
        HelpArticleRevision::create([
            'article_id' => $article->id,
            'revision_number' => 1,
            'title' => $title,
            'excerpt' => $excerpt,
            'body' => $body,
            'sections' => $sections,
            'keywords' => $keywords,
            'seo_title' => $seoTitle,
            'seo_description' => $seoDescription,
            'canonical_url' => $canonicalUrl,
            'note' => 'Initial import',
        ]);
    }

    public static function sectionsToBody(array $sections): string
    {
        if (empty($sections)) {
            return '';
        }

        return collect($sections)
            ->map(fn ($s) => trim("## ".($s['heading'] ?? '')."\n\n".($s['body'] ?? '')))
            ->implode("\n\n");
    }
}
