<?php

namespace Database\Factories;

use App\Models\Announcement;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Announcement>
 */
class AnnouncementFactory extends Factory
{
    public function definition(): array
    {
        return [
            'title' => fake()->sentence(5),
            'body' => fake()->paragraph(),
            'state' => 'draft',
            'featured' => false,
            'published_at' => null,
            'scheduled_at' => null,
            'archived_at' => null,
        ];
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
}
