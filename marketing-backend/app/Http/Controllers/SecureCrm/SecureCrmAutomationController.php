<?php

namespace App\Http\Controllers\SecureCrm;

use App\Http\Controllers\Controller;
use App\Models\AutomationRule;
use App\Models\AutomationRuleLog;
use App\Models\StaffUser;
use App\Models\Ticket;
use App\Models\TicketCategory;
use App\Services\TicketAutomationEngine;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Illuminate\View\View;

class SecureCrmAutomationController extends Controller
{
    public function index(Request $request): View
    {
        $rules = AutomationRule::query()
            ->with(['createdBy'])
            ->withCount('logs')
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get();

        $logs = AutomationRuleLog::query()
            ->with(['rule:id,name', 'ticket:id,ticket_number'])
            ->latest('id')
            ->limit(25)
            ->get();

        $editRule = $request->filled('edit')
            ? AutomationRule::query()->find($request->integer('edit'))
            : null;

        return view('securecrm.automation.index', [
            'rules' => $rules,
            'logs' => $logs,
            'editRule' => $editRule,
            'fields' => AutomationRule::CONDITION_FIELDS,
            'operators' => AutomationRule::CONDITION_OPERATORS,
            'actionTypes' => AutomationRule::ACTION_TYPES,
            'triggers' => AutomationRule::TRIGGERS,
            'priorities' => Ticket::PRIORITIES,
            'statuses' => Ticket::STATUSES,
            'channels' => Ticket::CHANNELS,
            'categories' => TicketCategory::query()->orderBy('name')->get(),
            'agents' => StaffUser::query()->where('is_active', true)->orderBy('name')->get(),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $rule = AutomationRule::create(
            $this->rulePayload($request, createdBy: $request->user('staff')->id),
        );

        return redirect()->route('securecrm.automation')
            ->with('status', "Automation rule \"{$rule->name}\" saved.");
    }

    public function update(Request $request, AutomationRule $rule): RedirectResponse
    {
        $rule->update($this->rulePayload($request));

        return redirect()->route('securecrm.automation')
            ->with('status', "Automation rule \"{$rule->name}\" updated.");
    }

    public function toggle(Request $request, AutomationRule $rule): RedirectResponse
    {
        $rule->update(['enabled' => ! $rule->enabled]);

        return back()->with(
            'status',
            $rule->enabled ? "Rule \"{$rule->name}\" enabled." : "Rule \"{$rule->name}\" disabled.",
        );
    }

    public function destroy(Request $request, AutomationRule $rule): RedirectResponse
    {
        $name = $rule->name;
        $rule->logs()->delete();
        $rule->delete();

        return redirect()->route('securecrm.automation')
            ->with('status', "Automation rule \"{$name}\" deleted.");
    }

    /**
     * Dry-run a rule against an existing ticket without applying anything.
     */
    public function preview(Request $request, AutomationRule $rule): RedirectResponse
    {
        $ticket = Ticket::query()->find($request->integer('ticket_id'));

        if (! $ticket) {
            throw ValidationException::withMessages([
                'ticket_id' => 'Pick a ticket to preview against.',
            ]);
        }

        $matched = (new TicketAutomationEngine)->conditionsMatch($ticket, $rule->conditions ?? []);

        return back()->with(
            'status',
            $matched
                ? "Rule \"{$rule->name}\" would match ticket {$ticket->ticket_number}."
                : "Rule \"{$rule->name}\" would NOT match ticket {$ticket->ticket_number}.",
        );
    }

    protected function rulePayload(Request $request, ?int $createdBy = null): array
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:2000'],
            'trigger' => ['required', Rule::in(AutomationRule::TRIGGERS)],
            'sort_order' => ['nullable', 'integer', 'min:1', 'max:99999'],
            'enabled' => ['nullable', 'boolean'],
            'stop_after_match' => ['nullable', 'boolean'],
            'conditions' => ['required', 'array', 'min:1'],
            'conditions.*.field' => ['required', Rule::in(AutomationRule::CONDITION_FIELDS)],
            'conditions.*.operator' => ['required', Rule::in(AutomationRule::CONDITION_OPERATORS)],
            'conditions.*.value' => ['nullable'],
            'actions' => ['required', 'array', 'min:1'],
            'actions.*.type' => ['required', Rule::in(AutomationRule::ACTION_TYPES)],
            'actions.*.value' => ['nullable'],
        ]);

        $conditions = array_map(
            function (array $condition, int $index) {
                $needsValue = ! in_array($condition['operator'], ['is_empty', 'not_empty'], true);

                if ($needsValue && trim((string) ($condition['value'] ?? '')) === '') {
                    throw ValidationException::withMessages([
                        "conditions.{$index}.value" => 'A value is required for this condition.',
                    ]);
                }

                return [
                    'field' => $condition['field'],
                    'operator' => $condition['operator'],
                    'value' => $needsValue ? ($condition['value'] ?? null) : null,
                ];
            },
            $validated['conditions'],
            array_keys($validated['conditions']),
        );

        $actions = array_map(
            fn (array $action) => [
                'type' => $action['type'],
                'value' => $action['value'] ?? null,
            ],
            $validated['actions'],
        );

        $this->assertSafeReferences($actions);

        $payload = [
            'name' => $validated['name'],
            'description' => $validated['description'] ?? null,
            'trigger' => $validated['trigger'],
            'sort_order' => (int) ($validated['sort_order'] ?? 100),
            'enabled' => (bool) ($validated['enabled'] ?? true),
            'stop_after_match' => (bool) ($validated['stop_after_match'] ?? true),
            'conditions' => $conditions,
            'actions' => $actions,
        ];

        if ($createdBy !== null) {
            $payload['created_by'] = $createdBy;
        }

        return $payload;
    }

    protected function assertSafeReferences(array $actions): void
    {
        foreach ($actions as $action) {
            $value = $action['value'];

            match ($action['type']) {
                'set_priority' => $this->assertIn($value, Ticket::PRIORITIES, 'Priority'),
                'set_status' => $this->assertIn($value, Ticket::STATUSES, 'Status'),
                'assign_agent' => $this->assertExists(StaffUser::class, $value, 'Agent'),
                'set_category' => $this->assertExists(TicketCategory::class, $value, 'Category'),
                'assign_team' => $this->assertExists(SupportTeam::class, $value, 'Team'),
                'add_note' => $this->assertNonEmpty($value, 'Note body'),
                'notify_staff' => $this->assertExists(StaffUser::class, $value, 'Staff'),
                default => null,
            };
        }
    }

    protected function assertIn(mixed $value, array $allowed, string $label): void
    {
        if (! in_array((string) $value, $allowed, true)) {
            throw ValidationException::withMessages([
                'actions' => "{$label} must be one of: ".implode(', ', $allowed).'.',
            ]);
        }
    }

    protected function assertExists(string $model, mixed $value, string $label): void
    {
        if (! is_numeric($value) || ! $model::query()->whereKey((int) $value)->exists()) {
            throw ValidationException::withMessages([
                'actions' => "{$label} does not exist.",
            ]);
        }
    }

    protected function assertNonEmpty(mixed $value, string $label): void
    {
        if (trim((string) $value) === '') {
            throw ValidationException::withMessages([
                'actions' => "{$label} must not be empty.",
            ]);
        }
    }
}
