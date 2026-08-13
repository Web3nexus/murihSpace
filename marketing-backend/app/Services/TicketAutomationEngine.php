<?php

namespace App\Services;

use App\Models\AutomationRule;
use App\Models\AutomationRuleLog;
use App\Models\StaffUser;
use App\Models\SupportTeam;
use App\Models\Ticket;
use App\Models\TicketCategory;
use App\Models\TicketEvent;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Evaluates enabled automation rules against a ticket and applies their
 * actions. Every evaluation is recorded to `automation_rule_logs` so staff can
 * audit what a rule did (or why it did nothing).
 */
class TicketAutomationEngine
{
    /**
     * Run all enabled rules for a trigger against a ticket.
     *
     * @return array<int, array{rule: AutomationRule, matched: bool, actions: array}>
     */
    public function apply(Ticket $ticket, ?string $trigger = null): array
    {
        $results = [];

        $rules = AutomationRule::query()
            ->where('enabled', true)
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get();

        foreach ($rules as $rule) {
            if (! $rule->shouldRunFor($trigger)) {
                continue;
            }

            $matched = $this->conditionsMatch($ticket, $rule->conditions ?? []);
            $applied = $matched ? $this->applyActions($ticket, $rule->actions ?? [], $rule) : [];

            $this->log($rule, $ticket, $matched, $applied, $trigger);

            $results[] = [
                'rule' => $rule,
                'matched' => $matched,
                'actions' => $applied,
            ];

            if ($matched && $rule->stop_after_match) {
                break;
            }
        }

        if ($results !== []) {
            $ticket->refresh();
        }

        return $results;
    }

    /**
     * Condition: a single {field, operator, value} triple.
     */
    public function conditionsMatch(Ticket $ticket, array $conditions): bool
    {
        foreach ($conditions as $condition) {
            $field = $condition['field'] ?? null;
            $operator = $condition['operator'] ?? 'equals';
            $value = $condition['value'] ?? null;

            if ($field === null || ! in_array($field, AutomationRule::CONDITION_FIELDS, true)) {
                return false;
            }

            if (! $this->evaluateCondition($this->fieldValue($ticket, $field), $operator, $value)) {
                return false;
            }
        }

        return $conditions !== [];
    }

    /**
     * Map a condition field name to the ticket's current value.
     */
    protected function fieldValue(Ticket $ticket, string $field): string|int|null
    {
        return match ($field) {
            'category_id' => $ticket->category_id,
            'category' => $ticket->category?->name,
            'priority' => $ticket->priority,
            'status' => $ticket->status,
            'channel' => $ticket->channel,
            'subject' => $ticket->subject,
            'description' => $ticket->description,
            'customer_email' => $ticket->customer_email,
            'keyword' => implode(' ', array_filter([$ticket->subject, $ticket->description])),
            default => null,
        };
    }

    protected function evaluateCondition(string|int|null $actual, string $operator, mixed $value): bool
    {
        return match ($operator) {
            'equals' => $actual !== null && Str::lower((string) $actual) === Str::lower((string) $value),
            'not_equals' => $actual === null || Str::lower((string) $actual) !== Str::lower((string) $value),
            'contains' => $actual !== null && Str::contains(Str::lower((string) $actual), Str::lower((string) $value)),
            'not_contains' => $actual === null || ! Str::contains(Str::lower((string) $actual), Str::lower((string) $value)),
            'in' => $actual !== null && in_array(Str::lower((string) $actual), $this->valueList($value), true),
            'not_in' => $actual === null || ! in_array(Str::lower((string) $actual), $this->valueList($value), true),
            'gt' => $actual !== null && (int) $actual > (int) $value,
            'lt' => $actual !== null && (int) $actual < (int) $value,
            'is_empty' => $actual === null || trim((string) $actual) === '',
            'not_empty' => $actual !== null && trim((string) $actual) !== '',
            default => false,
        };
    }

    protected function valueList(mixed $value): array
    {
        if (is_array($value)) {
            return array_map(fn ($v) => Str::lower((string) $v), $value);
        }

        return collect(explode(',', (string) $value))
            ->map(fn ($v) => Str::lower(trim((string) $v)))
            ->filter()
            ->all();
    }

    /**
     * Apply each recognized action inside a single transaction so a ticket is
     * never left half-mutated. Returns the list of actions applied.
     */
    protected function applyActions(Ticket $ticket, array $actions, AutomationRule $rule): array
    {
        $applied = [];

        DB::transaction(function () use ($ticket, $actions, $rule, &$applied) {
            foreach ($actions as $action) {
                $type = $action['type'] ?? null;
                $value = $action['value'] ?? null;

                if ($type === null || ! in_array($type, AutomationRule::ACTION_TYPES, true)) {
                    continue;
                }

                if ($this->runAction($ticket, $type, $value, $rule)) {
                    $applied[] = $type;
                }
            }
        });

        return $applied;
    }

    protected function runAction(Ticket $ticket, string $type, mixed $value, AutomationRule $rule): bool
    {
        return match ($type) {
            'set_priority' => $this->setPriority($ticket, $value),
            'set_status' => $this->setStatus($ticket, $value),
            'assign_agent' => $this->assignAgent($ticket, $value),
            'assign_team' => $this->assignTeam($ticket, $value),
            'set_category' => $this->setCategory($ticket, $value),
            'add_note' => $this->addNote($ticket, $value),
            'notify_staff' => $this->notifyStaff($ticket, $value),
            default => false,
        };
    }

    protected function setPriority(Ticket $ticket, mixed $value): bool
    {
        $priority = (string) $value;

        if (! in_array($priority, Ticket::PRIORITIES, true) || $ticket->priority === $priority) {
            return false;
        }

        $oldPriority = $ticket->priority;
        $ticket->forceFill(['priority' => $priority])->save();
        $this->event($ticket, 'automation_priority', $oldPriority, $priority);

        return true;
    }

    protected function setStatus(Ticket $ticket, mixed $value): bool
    {
        $status = (string) $value;

        if (! in_array($status, Ticket::STATUSES, true) || $ticket->status === $status) {
            return false;
        }

        $oldStatus = $ticket->status;
        $ticket->forceFill(['status' => $status])->save();
        $this->event($ticket, 'automation_status', $oldStatus, $status);

        return true;
    }

    protected function assignAgent(Ticket $ticket, mixed $value): bool
    {
        $agent = StaffUser::query()->whereKey($value)->where('is_active', true)->first();

        if (! $agent || $ticket->assigned_agent_id === $agent->id) {
            return false;
        }

        $oldAgentName = $ticket->assignedAgent?->name;
        $ticket->forceFill(['assigned_agent_id' => $agent->id])->save();
        $ticket->unsetRelation('assignedAgent');
        $this->event($ticket, 'automation_assigned', $oldAgentName, $agent->name);

        return true;
    }

    protected function assignTeam(Ticket $ticket, mixed $value): bool
    {
        $team = SupportTeam::query()->where('is_active', true)->find((int) $value);

        if (! $team || $ticket->assigned_team_id === $team->id) {
            return false;
        }

        $oldTeamName = $ticket->assignedTeam?->name;
        $ticket->forceFill(['assigned_team_id' => $team->id])->save();
        $ticket->unsetRelation('assignedTeam');
        $this->event($ticket, 'automation_team', $oldTeamName, $team->name);

        return true;
    }

    protected function setCategory(Ticket $ticket, mixed $value): bool
    {
        $categoryId = (int) $value;

        if ($categoryId <= 0 || $ticket->category_id === $categoryId) {
            return false;
        }

        $category = TicketCategory::query()->whereKey($categoryId)->first();

        if (! $category) {
            return false;
        }

        $oldCategoryName = $ticket->category?->name;
        $ticket->forceFill(['category_id' => $categoryId])->save();
        $ticket->unsetRelation('category');
        $this->event($ticket, 'automation_category', $oldCategoryName, $category->name);

        return true;
    }

    protected function addNote(Ticket $ticket, mixed $value): bool
    {
        $body = trim((string) $value);

        if ($body === '') {
            return false;
        }

        $ticket->messages()->create([
            'type' => 'internal_note',
            'body' => $body,
            'metadata' => ['note' => true, 'automation' => true],
        ]);

        $this->event($ticket, 'automation_note', null, Str::limit($body, 60));

        return true;
    }

    protected function notifyStaff(Ticket $ticket, mixed $value): bool
    {
        $staff = StaffUser::query()->whereKey($value)->where('is_active', true)->first();

        if (! $staff) {
            return false;
        }

        DB::afterCommit(function () use ($ticket, $staff) {
            app(StaffAlertService::class)->notify([
                'type' => 'automation_notify',
                'title' => "Ticket {$ticket->ticket_number}",
                'message' => "{$ticket->subject} — automation notification.",
                'action_url' => route('securecrm.tickets.show', $ticket),
                'ticket_number' => $ticket->ticket_number,
                'severity' => 'normal',
                'staff_ids' => [$staff->id],
            ]);
        });

        $this->event(
            $ticket,
            'automation_notify',
            null,
            sprintf('Notified %s (%s)', $staff->name, $staff->email),
        );

        return true;
    }

    protected function event(Ticket $ticket, string $event, ?string $oldValue, ?string $newValue): void
    {
        TicketEvent::create([
            'ticket_id' => $ticket->id,
            'event' => $event,
            'old_value' => $oldValue,
            'new_value' => $newValue,
        ]);
    }

    protected function log(
        AutomationRule $rule,
        Ticket $ticket,
        bool $matched,
        array $applied,
        ?string $trigger,
    ): void {
        AutomationRuleLog::create([
            'rule_id' => $rule->id,
            'ticket_id' => $ticket->id,
            'matched' => $matched,
            'actions' => $applied ?: null,
            'trigger' => $trigger ?? 'manual',
        ]);

        if ($matched && $applied !== []) {
            AutomationRule::query()
                ->whereKey($rule->id)
                ->increment('times_triggered', 1, ['last_triggered_at' => now()]);
        }
    }
}
