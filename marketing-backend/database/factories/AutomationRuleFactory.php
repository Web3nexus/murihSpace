<?php

namespace Database\Factories;

use App\Models\AutomationRule;
use Illuminate\Database\Eloquent\Factories\Factory;

class AutomationRuleFactory extends Factory
{
    protected $model = AutomationRule::class;

    public function definition(): array
    {
        return [
            'name' => $this->faker->words(3, true),
            'trigger' => 'created',
            'conditions' => [],
            'actions' => [],
            'sort_order' => 100,
            'enabled' => true,
            'stop_after_match' => true,
            'times_triggered' => 0,
        ];
    }

    public function disabled(): static
    {
        return $this->state(fn () => ['enabled' => false]);
    }

    public function onUpdated(): static
    {
        return $this->state(fn () => ['trigger' => 'updated']);
    }
}
