<?php

namespace Database\Factories;

use App\Models\HelpArticle;
use App\Models\HelpArticleRevision;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<HelpArticleRevision>
 */
class HelpArticleRevisionFactory extends Factory
{
    public function definition(): array
    {
        return [
            'article_id' => HelpArticle::factory(),
            'revision_number' => 1,
            'title' => fake()->sentence(),
            'excerpt' => fake()->sentence(),
            'body' => fake()->paragraph(),
            'sections' => [[
                'heading' => ucfirst(fake()->words(3, true)),
                'body' => fake()->paragraph(),
            ]],
            'keywords' => fake()->words(3),
            'tags' => fake()->words(2),
            'seo_title' => null,
            'seo_description' => null,
            'canonical_url' => null,
            'created_by_type' => null,
            'created_by_id' => null,
            'note' => null,
        ];
    }

    public function numbered(int $number): static
    {
        return $this->state(fn () => ['revision_number' => $number]);
    }
}
