<?php

namespace Database\Factories;

use App\Models\Community;
use App\Models\Event;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class EventFactory extends Factory
{
    protected $model = Event::class;

    public function definition(): array
    {
        $start = fake()->dateTimeBetween('+1 week', '+2 months');
        $end = (clone $start)->modify('+2 hours');

        return [
            'community_id' => Community::factory(),
            'creator_id' => User::factory(),
            'title' => fake()->sentence(4),
            'slug' => fake()->unique()->slug(3),
            'description' => fake()->paragraphs(3, true),
            'event_type' => fake()->randomElement(['online', 'in_person', 'hybrid']),
            'start_date' => $start,
            'end_date' => $end,
            'timezone' => 'UTC',
            'location' => fake()->optional()->address(),
            'meeting_url' => fake()->optional()->url(),
            'cover_url' => fake()->optional()->imageUrl(),
            'capacity' => fake()->optional()->numberBetween(10, 500),
            'registration_deadline' => fake()->optional()->dateTimeBetween('-1 day', '+1 month'),
            'status' => 'published',
            'is_featured' => false,
        ];
    }

    public function draft(): static
    {
        return $this->state(fn () => ['status' => 'draft']);
    }

    public function past(): static
    {
        $start = fake()->dateTimeBetween('-2 months', '-1 day');
        $end = (clone $start)->modify('+2 hours');

        return $this->state(fn () => [
            'start_date' => $start,
            'end_date' => $end,
            'status' => 'completed',
        ]);
    }
}
