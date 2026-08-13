<?php

namespace Database\Factories;

use App\Models\StaffUser;
use App\Models\Ticket;
use App\Models\TicketCategory;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Ticket>
 */
class TicketFactory extends Factory
{
    protected $model = Ticket::class;

    public function definition(): array
    {
        return [
            'ticket_number' => Ticket::generateTicketNumber(),
            'subject' => fake()->sentence(6),
            'description' => fake()->paragraph(4),
            'priority' => fake()->randomElement(Ticket::PRIORITIES),
            'status' => 'new',
            'channel' => 'help_center_form',
        ];
    }

    public function open(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => 'open',
            'assigned_agent_id' => StaffUser::factory(),
        ]);
    }

    public function assigned(): static
    {
        return $this->state(fn (array $attributes) => [
            'assigned_agent_id' => StaffUser::factory(),
        ]);
    }

    public function resolved(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => 'resolved',
            'resolved_at' => now(),
        ]);
    }

    public function staffCreated(): static
    {
        return $this->state(fn (array $attributes) => [
            'channel' => 'staff_created',
            'created_by' => StaffUser::factory(),
        ]);
    }

    public function forUser(?User $user = null): static
    {
        return $this->state(fn (array $attributes) => [
            'user_id' => $user?->id ?? User::factory(),
        ]);
    }

    public function withCategory(?TicketCategory $category = null): static
    {
        return $this->state(fn (array $attributes) => [
            'category_id' => $category?->id ?? TicketCategory::factory(),
        ]);
    }
}
