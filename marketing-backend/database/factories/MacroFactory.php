<?php

namespace Database\Factories;

use App\Models\Macro;
use App\Models\StaffUser;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Macro>
 */
class MacroFactory extends Factory
{
    protected $model = Macro::class;

    public function definition(): array
    {
        return [
            'name' => fake()->sentence(3),
            'category' => fake()->optional()->word(),
            'body' => fake()->paragraph(),
            'actions' => null,
            'created_by' => StaffUser::factory(),
            'is_active' => true,
        ];
    }

    public function disabled(): static
    {
        return $this->state(fn () => ['is_active' => false]);
    }
}
