<?php

namespace App\Services;

use App\Models\SlaPolicy;
use App\Models\Ticket;
use Carbon\CarbonInterface;

/**
 * SLA assignment and state computation for tickets.
 *
 * The snapshot describes where a ticket's SLA clock stands: its per-metric
 * figures (first response / next response / resolution), whether time is
 * currently paused (waiting on the customer), and an overall status of
 * remaining / paused / breached / completed.
 */
class SlaService
{
    /**
     * Assign the best enabled policy for a ticket's priority (or clear it).
     */
    public function assignPolicy(Ticket $ticket): ?SlaPolicy
    {
        $policy = SlaPolicy::query()
            ->where('enabled', true)
            ->where('priority', $ticket->priority)
            ->orderBy('id')
            ->first();

        $ticket->forceFill(['sla_policy_id' => $policy?->id])->save();

        return $policy;
    }

    /**
     * Begin an SLA pause (e.g. waiting on the customer).
     */
    public function pause(Ticket $ticket): void
    {
        if ($ticket->sla_policy_id === null || $ticket->sla_paused_at !== null) {
            return;
        }

        $ticket->forceFill(['sla_paused_at' => now()])->save();
    }

    /**
     * End an active SLA pause and convert it to accumulated paused seconds.
     */
    public function resume(Ticket $ticket): void
    {
        if ($ticket->sla_paused_at === null) {
            return;
        }

        $paused = $ticket->sla_paused_seconds + abs(now()->diffInSeconds($ticket->sla_paused_at));

        $ticket->forceFill([
            'sla_paused_at' => null,
            'sla_paused_seconds' => $paused,
        ])->save();
    }

    /**
     * Number of countable seconds consumed toward the SLA so far.
     */
    public function consumedSeconds(Ticket $ticket, CarbonInterface $now): int
    {
        $policy = $ticket->slaPolicy;
        $paused = $ticket->sla_paused_seconds;

        if ($policy === null) {
            return 0;
        }

        $end = $now;
        if ($ticket->sla_paused_at !== null) {
            $end = $ticket->sla_paused_at;
        }

        $elapsed = BusinessTime::secondsBetween($ticket->created_at, $end, $policy);

        return max(0, $elapsed - $paused);
    }

    /**
     * Full SLA state for a ticket, or null when no enabled policy applies.
     */
    public function snapshot(Ticket $ticket, ?CarbonInterface $now = null): ?array
    {
        $policy = $ticket->slaPolicy;

        if ($policy === null || ! $policy->enabled) {
            return null;
        }

        $now ??= now();
        $consumed = $this->consumedSeconds($ticket, $now);
        $paused = $ticket->sla_paused_at !== null;

        $firstResponse = $this->metric(
            target: $policy->first_response_target * 60,
            consumed: $consumed,
            metAt: $ticket->first_response_at,
            createdAt: $ticket->created_at,
            now: $now,
        );

        $resolution = $this->metric(
            target: $policy->resolution_target * 60,
            consumed: $consumed,
            metAt: $ticket->resolved_at ?? $ticket->closed_at,
            createdAt: $ticket->created_at,
            now: $now,
        );

        $nextResponse = null;
        if ($policy->next_response_target !== null) {
            $nextResponse = $this->metric(
                target: $policy->next_response_target * 60,
                consumed: $consumed,
                metAt: null,
                createdAt: $ticket->created_at,
                now: $now,
            );
        }

        $order = ['breached' => 0, 'paused' => 1, 'completed' => 2, 'remaining' => 3];
        $metrics = array_filter([$firstResponse, $resolution]);
        $overall = $paused ? 'paused' : collect($metrics)
            ->sortBy(fn ($m) => $order[$m['status']] ?? 9)
            ->first()['status'];
        $completed = $overall === 'completed';

        return [
            'policy' => [
                'id' => $policy->id,
                'name' => $policy->name,
                'priority' => $policy->priority,
                'pause_on_customer' => $policy->pause_on_customer,
            ],
            'status' => $overall,
            'paused' => $paused,
            'completed' => $completed,
            'paused_seconds' => $ticket->sla_paused_seconds,
            'first_response' => $firstResponse,
            'next_response' => $nextResponse,
            'resolution' => $resolution,
        ];
    }

    /**
     * Compute one SLA metric (deadline, remaining, progress, status).
     */
    protected function metric(
        int $target,
        int $consumed,
        ?CarbonInterface $metAt,
        CarbonInterface $createdAt,
        CarbonInterface $now,
    ): array {
        $deadlineAt = $createdAt->copy()->addSeconds($target);

        if ($metAt !== null) {
            $metOnTime = $metAt->isBefore($deadlineAt) || $metAt->equalTo($deadlineAt);
            $spent = $consumed;

            return [
                'target_seconds' => $target,
                'deadline_at' => $deadlineAt->toIso8601String(),
                'met_at' => $metAt->toIso8601String(),
                'status' => $metOnTime ? 'completed' : 'breached',
                'remaining' => max(0, $target - $spent),
                'progress' => min(100, (int) round(($spent / max(1, $target)) * 100)),
            ];
        }

        $remaining = max(0, $target - $consumed);
        $breached = $consumed >= $target;

        return [
            'target_seconds' => $target,
            'deadline_at' => $deadlineAt->toIso8601String(),
            'met_at' => null,
            'status' => $breached ? 'breached' : 'remaining',
            'remaining' => $remaining,
            'progress' => min(100, (int) round(($consumed / max(1, $target)) * 100)),
        ];
    }
}
