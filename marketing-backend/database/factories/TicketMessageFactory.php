<?php

namespace Database\Factories;

use App\Models\StaffUser;
use App\Models\Ticket;
use App\Models\TicketMessage;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<TicketMessage>
 */
class TicketMessageFactory extends Factory
{
    protected $model = TicketMessage::class;

    public function definition(): array
    {
        return [
            'ticket_id' => Ticket::factory(),
            'type' => 'reply',
            'body' => fake()->paragraph(),
        ];
    }

    public function customerMessage(): static
    {
        return $this->state(fn (array $attributes) => [
            'type' => 'customer_message',
        ]);
    }

    public function forTicket(Ticket $ticket): static
    {
        return $this->state(fn (array $attributes) => [
            'ticket_id' => $ticket->id,
        ]);
    }

    public function internalNote(): static
    {
        return $this->state(fn (array $attributes) => [
            'type' => 'internal_note',
            'staff_user_id' => StaffUser::factory(),
            'metadata' => ['note' => true],
        ]);
    }
}
