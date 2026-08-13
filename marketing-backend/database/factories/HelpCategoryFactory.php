<?php

namespace Database\Factories;

use App\Models\HelpCategory;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<HelpCategory>
 */
class HelpCategoryFactory extends Factory
{
    public function definition(): array
    {
        $name = fake()->unique()->words(2, true);

        return [
            'parent_id' => null,
            'slug' => Str::slug($name),
            'name' => ucfirst($name),
            'blurb' => fake()->sentence(),
            'icon' => null,
            'sort_order' => 0,
            'featured' => false,
            'is_active' => true,
        ];
    }

    public function inactive(): static
    {
        return $this->state(fn () => ['is_active' => false]);
    }

    public function featured(): static
    {
        return $this->state(fn () => ['featured' => true]);
    }
}
