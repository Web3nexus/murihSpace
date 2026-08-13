<?php

namespace Database\Factories;

use App\Models\HelpArticle;
use App\Models\HelpCategory;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<HelpArticle>
 */
class HelpArticleFactory extends Factory
{
    public function definition(): array
    {
        $sections = collect(range(1, fake()->numberBetween(2, 3)))
            ->map(fn () => [
                'heading' => ucfirst(fake()->words(3, true)),
                'body' => fake()->paragraph(),
            ])
            ->all();

        $title = fake()->unique()->words(5, true);

        return [
            'category_id' => HelpCategory::factory(),
            'slug' => Str::slug($title).'-'.Str::lower(Str::random(4)),
            'title' => ucfirst($title),
            'excerpt' => fake()->sentence(),
            'body' => collect($sections)
                ->map(fn ($s) => "## {$s['heading']}\n\n{$s['body']}")
                ->implode("\n\n"),
            'sections' => $sections,
            'keywords' => fake()->words(3),
            'tags' => fake()->words(2),
            'state' => 'draft',
            'featured' => false,
            'seo_title' => null,
            'seo_description' => null,
            'canonical_url' => null,
            'published_at' => null,
            'scheduled_at' => null,
            'archived_at' => null,
        ];
    }

    public function draft(): static
    {
        return $this->state(fn () => [
            'state' => 'draft',
            'published_at' => null,
            'scheduled_at' => null,
            'archived_at' => null,
        ]);
    }

    public function review(): static
    {
        return $this->state(fn () => [
            'state' => 'review',
            'published_at' => null,
            'scheduled_at' => null,
            'archived_at' => null,
        ]);
    }

    public function scheduled(?string $at = null): static
    {
        return $this->state(fn () => [
            'state' => 'scheduled',
            'scheduled_at' => $at ?? now()->addDay(),
            'published_at' => null,
            'archived_at' => null,
        ]);
    }

    public function published(?string $at = null): static
    {
        return $this->state(fn () => [
            'state' => 'published',
            'published_at' => $at ?? now(),
            'scheduled_at' => null,
            'archived_at' => null,
        ]);
    }

    public function archived(): static
    {
        return $this->state(fn () => [
            'state' => 'archived',
            'archived_at' => now(),
            'scheduled_at' => null,
            'published_at' => null,
        ]);
    }
}
