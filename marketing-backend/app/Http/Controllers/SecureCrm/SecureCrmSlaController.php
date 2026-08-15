<?php

namespace App\Http\Controllers\SecureCrm;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\SlaPolicy;
use App\Models\Ticket;
use App\Services\AuditLogService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\View\View;

class SecureCrmSlaController extends Controller
{
    public function index(Request $request): View
    {
        $policies = SlaPolicy::query()
            ->with(['createdBy'])
            ->orderByRaw("case priority when 'critical' then 0 when 'urgent' then 1 when 'high' then 2 when 'normal' then 3 when 'low' then 4 else 5 end")
            ->orderBy('id')
            ->get();

        $editPolicy = $request->filled('edit')
            ? SlaPolicy::query()->find($request->integer('edit'))
            : null;

        return view('securecrm.slas.index', [
            'policies' => $policies,
            'priorities' => Ticket::PRIORITIES,
            'editPolicy' => $editPolicy,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $policy = \Illuminate\Support\Facades\DB::transaction(function () use ($request) {
            $policy = SlaPolicy::create($this->payload($request, createdBy: $request->user('staff')->id));

            app(AuditLogService::class)->record(
                AuditLog::SLA_CREATE,
                subject: $policy,
                subject_reference: $policy->name,
                after: ['priority' => $policy->priority, 'enabled' => $policy->enabled],
            );

            return $policy;
        });

        return redirect()->route('securecrm.slas')
            ->with('status', "SLA policy \"{$policy->name}\" saved.");
    }

    public function update(Request $request, SlaPolicy $policy): RedirectResponse
    {
        \Illuminate\Support\Facades\DB::transaction(function () use ($request, $policy) {
            $before = ['priority' => $policy->priority, 'enabled' => $policy->enabled];

            $policy->update($this->payload($request));

            app(AuditLogService::class)->record(
                AuditLog::SLA_UPDATE,
                subject: $policy,
                subject_reference: $policy->name,
                before: $before,
                after: ['priority' => $policy->priority, 'enabled' => $policy->enabled],
            );
        });

        return redirect()->route('securecrm.slas')
            ->with('status', "SLA policy \"{$policy->name}\" updated.");
    }

    public function toggle(Request $request, SlaPolicy $policy): RedirectResponse
    {
        \Illuminate\Support\Facades\DB::transaction(function () use ($policy) {
            $policy->update(['enabled' => ! $policy->enabled]);

            app(AuditLogService::class)->record(
                AuditLog::SLA_TOGGLE,
                subject: $policy,
                subject_reference: $policy->name,
                after: ['enabled' => $policy->enabled],
            );
        });

        return back()->with(
            'status',
            $policy->enabled ? "SLA policy \"{$policy->name}\" enabled." : "SLA policy \"{$policy->name}\" disabled.",
        );
    }

    public function destroy(Request $request, SlaPolicy $policy): RedirectResponse
    {
        $name = $policy->name;

        \Illuminate\Support\Facades\DB::transaction(function () use ($policy, $name) {
            app(AuditLogService::class)->record(
                AuditLog::SLA_DELETE,
                subject: $policy,
                subject_reference: $name,
                before: ['enabled' => $policy->enabled],
            );

            $policy->delete();
        });

        return redirect()->route('securecrm.slas')
            ->with('status', "SLA policy \"{$name}\" deleted.");
    }

    protected function payload(Request $request, ?int $createdBy = null): array
    {
        $holidayDates = array_values(array_filter(array_map(
            fn ($d) => trim((string) $d),
            preg_split('/[\s,]+/', $request->input('holiday_dates', '')) ?: [],
        )));

        $request->merge(['holiday_dates_array' => $holidayDates]);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:2000'],
            'priority' => ['required', Rule::in(Ticket::PRIORITIES)],
            'first_response_target' => ['required', 'integer', 'min:1', 'max:100000'],
            'next_response_target' => ['nullable', 'integer', 'min:1', 'max:100000'],
            'resolution_target' => ['required', 'integer', 'min:1', 'max:100000'],
            'business_hours' => ['nullable', 'boolean'],
            'weekends' => ['nullable', 'boolean'],
            'holidays' => ['nullable', 'boolean'],
            'holiday_dates_array' => ['nullable', 'array'],
            'holiday_dates_array.*' => ['date_format:Y-m-d'],
            'pause_on_customer' => ['nullable', 'boolean'],
            'enabled' => ['nullable', 'boolean'],
        ]);

        $payload = [
            'name' => $validated['name'],
            'description' => $validated['description'] ?? null,
            'priority' => $validated['priority'],
            'first_response_target' => (int) $validated['first_response_target'],
            'next_response_target' => ($validated['next_response_target'] ?? null) !== null
                ? (int) $validated['next_response_target']
                : null,
            'resolution_target' => (int) $validated['resolution_target'],
            'business_hours' => $request->boolean('business_hours'),
            'weekends' => $request->boolean('weekends'),
            'holidays' => $request->boolean('holidays'),
            'holiday_dates' => $holidayDates ?: null,
            'pause_on_customer' => $request->boolean('pause_on_customer'),
            'enabled' => $request->boolean('enabled'),
        ];

        if ($createdBy !== null) {
            $payload['created_by'] = $createdBy;
        }

        return $payload;
    }
}
