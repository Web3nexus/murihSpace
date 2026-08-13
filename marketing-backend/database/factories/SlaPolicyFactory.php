<?php

namespace Database\Factories;

use App\Models\SlaPolicy;
use Illuminate\Database\Eloquent\Factories\Factory;

class SlaPolicyFactory extends Factory
{
    protected $model = SlaPolicy::class;

    public function definition(): array
    {
        return [
            'name' => $this->faker->words(2, true),
            'priority' => 'normal',
            'first_response_target' => 60,
            'resolution_target' => 1440,
            'business_hours' => false,
            'weekends' => true,
            'holidays' => false,
            'pause_on_customer' => false,
            'enabled' => true,
        ];
    }

    public function forPriority(string $priority, int $firstResponse = 60, int $resolution = 1440): static
    {
        return $this->state(fn () => [
            'priority' => $priority,
            'first_response_target' => $firstResponse,
            'resolution_target' => $resolution,
        ]);
    }

    public function disabled(): static
    {
        return $this->state(fn () => ['enabled' => false]);
    }

    public function pauseOnCustomer(): static
    {
        return $this->state(fn () => ['pause_on_customer' => true]);
    }

    public function businessHours(): static
    {
        return $this->state(fn () => ['business_hours' => true, 'weekends' => false]);
    }
}
