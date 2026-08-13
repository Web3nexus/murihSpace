<?php

namespace App\Http\Controllers\SecureCrm;

use App\Http\Controllers\Controller;
use App\Models\Macro;
use App\Models\SupportTeam;
use App\Models\Ticket;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

class SecureCrmMacroController extends Controller
{
    public function index(Request $request): View
    {
        return view('securecrm.macros.index', [
            'macros' => Macro::query()
                ->with('createdBy')
                ->orderBy('category')
                ->orderBy('name')
                ->get(),
            'categories' => Macro::query()->whereNotNull('category')->distinct()->orderBy('category')->pluck('category'),
            'editMacro' => $request->filled('edit') ? Macro::find($request->integer('edit')) : null,
            'actionTypes' => Macro::ACTION_TYPES,
            'statuses' => Ticket::STATUSES,
            'priorities' => Ticket::PRIORITIES,
            'teams' => SupportTeam::query()->where('is_active', true)->orderBy('sort_order')->orderBy('name')->get(),
            'permissions' => [
                'reply' => 'ticket.reply',
                'close' => 'ticket.close',
                'note' => 'ticket.note',
                'assign' => 'ticket.assign',
            ],
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate($this->rules());

        Macro::create([
            'name' => $validated['name'],
            'category' => $validated['category'] ?? null,
            'body' => $validated['body'] ?? '',
            'actions' => $this->normalizeActions($validated['actions'] ?? []),
            'created_by' => $request->user('staff')->id,
            'is_active' => true,
        ]);

        return redirect()->route('securecrm.macros')
            ->with('status', 'Macro saved.');
    }

    public function update(Macro $macro, Request $request): RedirectResponse
    {
        $validated = $request->validate($this->rules());

        $macro->update([
            'name' => $validated['name'],
            'category' => $validated['category'] ?? null,
            'body' => $validated['body'] ?? '',
            'actions' => $this->normalizeActions($validated['actions'] ?? []),
        ]);

        return redirect()->route('securecrm.macros')
            ->with('status', 'Macro updated.');
    }

    public function toggle(Macro $macro, Request $request): RedirectResponse
    {
        $macro->forceFill(['is_active' => ! $macro->is_active])->save();

        return back()->with('status', $macro->is_active ? 'Macro enabled.' : 'Macro disabled.');
    }

    public function destroy(Macro $macro): RedirectResponse
    {
        $macro->delete();

        return redirect()->route('securecrm.macros')
            ->with('status', 'Macro deleted.');
    }

    protected function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'category' => ['nullable', 'string', 'max:120'],
            'body' => ['nullable', 'string', 'max:10000'],
            'actions' => ['nullable', 'array', 'max:10'],
            'actions.*.type' => ['required', 'string', 'in:'.implode(',', Macro::ACTION_TYPES)],
            'actions.*.value' => ['nullable', 'string', 'max:255'],
        ];
    }

    /**
     * Drop blank action rows and strip empty values so stored actions are clean.
     * Returns null when there are no actions.
     */
    protected function normalizeActions(array $actions): ?array
    {
        $normalized = collect($actions)
            ->filter(fn (array $action) => ($action['type'] ?? null) !== null)
            ->map(fn (array $action) => [
                'type' => $action['type'],
                'value' => trim((string) ($action['value'] ?? '')),
            ])
            ->filter(fn (array $action) => in_array($action['type'], Macro::ACTION_TYPES, true))
            ->values()
            ->all();

        return $normalized === [] ? null : $normalized;
    }
}
