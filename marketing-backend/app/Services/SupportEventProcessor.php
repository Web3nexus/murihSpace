<?php

namespace App\Services;

use App\Models\SupportEvent;
use App\Models\Ticket;
use App\Models\TicketCategory;
use Illuminate\Support\Facades\DB;

class SupportEventProcessor
{
    /**
     * Critical event keys that should raise a support ticket automatically.
     * Keyed by a human-readable subject line.
     */
    private const TICKETABLE = [
        'order.failed' => 'Order payment failed',
        'payment.failed' => 'Payment failed',
        'withdrawal.failed' => 'Withdrawal failed',
        'refund.requested' => 'Refund requested',
        'account.security_alert' => 'Account security alert',
        'kyc.rejected' => 'Identity verification rejected',
    ];

    public function process(SupportEvent $event): SupportEvent
    {
        $subject = self::TICKETABLE[$event->event_key] ?? null;

        if ($subject === null) {
            $event->forceFill(['status' => 'ignored'])->save();

            return $event;
        }

        return DB::transaction(function () use ($event, $subject) {
            if ($event->ticket_number !== null) {
                return $event;
            }

            $category = TicketCategory::query()
                ->whereIn('name', ['Account & Security', 'Payments & Billing'])
                ->first();

            $ticket = Ticket::create([
                'ticket_number' => Ticket::generateTicketNumber(),
                'customer_email' => $event->customer_email,
                'customer_name' => $event->payload['user_name'] ?? ($event->payload['actor']['name'] ?? null),
                'subject' => $subject,
                'description' => $this->describe($event),
                'category_id' => $category?->id,
                'priority' => 'high',
                'status' => 'new',
                'channel' => 'system',
                'related_order_id' => $event->actor_type === 'order' && is_numeric($event->actor_reference) ? (int) $event->actor_reference : null,
                'related_transaction_id' => $event->actor_type === 'transaction' && is_numeric($event->actor_reference) ? (int) $event->actor_reference : null,
                'related_kyc_reference' => $event->actor_type === 'kyc' ? (string) $event->actor_reference : null,
            ]);

            $event->forceFill([
                'status' => 'ticket_created',
                'ticket_number' => $ticket->ticket_number,
            ])->save();

            (new TicketAutomationEngine)->apply($ticket, 'created');
            (new SlaService)->assignPolicy($ticket);

            return $event;
        });
    }

    private function describe(SupportEvent $event): string
    {
        $lines = ["Automatic ticket from a system event (`{$event->event_key}`)."];
        $lines[] = '';

        foreach ($event->payload ?? [] as $key => $value) {
            if (is_bool($value)) {
                $value = $value ? 'yes' : 'no';
            }
            if (is_array($value) || is_object($value)) {
                $value = json_encode($value);
            }
            $lines[] = sprintf('%s: %s', ucfirst(str_replace('_', ' ', $key)), $value);
        }

        return implode("\n", $lines);
    }
}
