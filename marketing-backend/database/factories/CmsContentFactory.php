<?php

namespace Database\Factories;

use App\Models\CmsContent;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<CmsContent>
 */
class CmsContentFactory extends Factory
{
    public function definition(): array
    {
        $title = ucfirst(fake()->words(3, true));

        return [
            'section' => 'features',
            'slug' => Str::slug($title).'-'.Str::lower(Str::random(4)),
            'title' => $title,
            'excerpt' => fake()->sentence(),
            'body' => fake()->paragraphs(2, true),
            'content' => null,
            'state' => 'draft',
            'sort_order' => 0,
            'seo_title' => null,
            'seo_description' => null,
            'published_at' => null,
            'scheduled_at' => null,
            'archived_at' => null,
        ];
    }

    public function inSection(string $section): static
    {
        return $this->state(fn () => ['section' => $section]);
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

    public function draft(): static
    {
        return $this->state(fn () => [
            'state' => 'draft',
            'published_at' => null,
            'scheduled_at' => null,
            'archived_at' => null,
        ]);
    }

    public function archived(): static
    {
        return $this->state(fn () => [
            'state' => 'archived',
            'published_at' => null,
            'scheduled_at' => null,
            'archived_at' => now(),
        ]);
    }
}
