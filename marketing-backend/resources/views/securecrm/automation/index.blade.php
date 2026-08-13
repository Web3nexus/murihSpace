@extends('securecrm.layouts.app')

@section('title', 'Automation')
@section('crumb', 'SecureCRM / Operations')
@section('heading', 'Automation')

@section('content')
    @if (session('status'))
        <div class="mb-5 rounded-xl border border-[#16A34A]/30 bg-[#16A34A]/10 px-4 py-3 text-[13px] font-semibold text-[#16A34A]">
            {{ session('status') }}
        </div>
    @endif

    @if ($errors->any())
        <div class="mb-5 rounded-xl border border-[#DC2626]/30 bg-[#DC2626]/10 px-4 py-3">
            <ul class="list-disc space-y-1 pl-5 text-[13px] font-medium text-[#DC2626]">
                @foreach ($errors->all() as $error)
                    <li>{{ $error }}</li>
                @endforeach
            </ul>
        </div>
    @endif

    <div class="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <!-- Rules list -->
        <div class="rounded-2xl border border-[#D6E0E8] bg-white p-6 xl:col-span-2">
            <div class="flex items-center justify-between">
                <div>
                    <h2 class="text-[15px] font-bold text-[#102840]">Rules</h2>
                    <p class="mt-0.5 text-[12px] text-[#98A2B3]">Rules run in order and stop at the first match by default.</p>
                </div>
                <span class="rounded-full bg-[#102840]/5 px-3 py-1 text-[11px] font-bold text-[#102840]">{{ $rules->count() }} rule{{ $rules->count() === 1 ? '' : 's' }}</span>
            </div>

            <div class="mt-5 space-y-3">
                @forelse ($rules as $rule)
                    <div class="rounded-xl border border-[#D6E0E8] p-4">
                        <div class="flex items-start justify-between gap-4">
                            <div class="min-w-0 flex-1">
                                <div class="flex flex-wrap items-center gap-2">
                                    <p class="text-[13px] font-bold text-[#102840]">{{ $rule->name }}</p>
                                    <span class="rounded-md bg-[#2164b6]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#2164b6]">{{ $rule->trigger }}</span>
                                    <span class="rounded-md bg-[#E8EEF4] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#667085]">order {{ $rule->sort_order }}</span>
                                    @if (! $rule->enabled)
                                        <span class="rounded-md bg-[#F2D0D0] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#B42318]">disabled</span>
                                    @endif
                                </div>
                                @if ($rule->description)
                                    <p class="mt-1 text-[12px] leading-relaxed text-[#667085]">{{ $rule->description }}</p>
                                @endif

                                <div class="mt-3 flex flex-wrap gap-1.5">
                                    @foreach ($rule->conditions ?? [] as $condition)
                                        <span class="rounded-md bg-[#F0F5F8] px-2 py-1 text-[11px] font-medium text-[#475467]">
                                            <span class="font-bold">{{ $condition['field'] }}</span>
                                            {{ $condition['operator'] }} <code class="text-[#2164b6]">{{ $condition['value'] ?? '—' }}</code>
                                        </span>
                                    @endforeach
                                    <span class="px-1 text-[11px] text-[#98A2B3]">→</span>
                                    @foreach ($rule->actions ?? [] as $action)
                                        <span class="rounded-md bg-[#16A34A]/10 px-2 py-1 text-[11px] font-semibold text-[#15803D]">
                                            {{ $action['type'] }}@if (($action['value'] ?? null) !== null && $action['type'] !== 'add_note'): <code>{{ $action['value'] }}</code>@endif
                                        </span>
                                    @endforeach
                                </div>

                                <p class="mt-2 text-[11px] text-[#98A2B3]">
                                    Triggered {{ $rule->times_triggered }}×
                                    @if ($rule->last_triggered_at) · last {{ $rule->last_triggered_at->diffForHumans() }}@endif
                                    · by {{ $rule->createdBy?->name ?? 'System' }}
                                </p>
                            </div>

                            <div class="flex shrink-0 flex-col items-end gap-2">
                                <form method="POST" action="{{ route('securecrm.automation.toggle', $rule) }}">
                                    @csrf
                                    <button type="submit"
                                            class="rounded-lg border px-3 py-1.5 text-[11px] font-bold transition-colors
                                            {{ $rule->enabled
                                                ? 'border-[#16A34A]/30 bg-[#16A34A]/10 text-[#15803D] hover:bg-[#16A34A]/20'
                                                : 'border-[#D6E0E8] bg-[#F7FAFC] text-[#667085] hover:bg-[#102840]/5' }}">
                                        {{ $rule->enabled ? 'Enabled' : 'Disabled' }}
                                    </button>
                                </form>
                                <div class="flex items-center gap-2">
                                    <a href="{{ route('securecrm.automation', ['edit' => $rule->id]) }}"
                                       class="rounded-lg border border-[#D6E0E8] px-3 py-1.5 text-[11px] font-bold text-[#2164b6] transition-colors hover:bg-[#2164b6]/5">Edit</a>
                                    <form method="POST" action="{{ route('securecrm.automation.destroy', $rule) }}"
                                          data-confirm-name="{{ $rule->name }}"
                                          onsubmit="return confirm(`Delete rule “${this.dataset.confirmName}”?`)">
                                        @csrf
                                        @method('DELETE')
                                        <button type="submit" class="rounded-lg border border-transparent px-3 py-1.5 text-[11px] font-bold text-[#DC2626] transition-colors hover:bg-[#DC2626]/5">Delete</button>
                                    </form>
                                </div>
                            </div>
                        </div>
                    </div>
                @empty
                    <p class="rounded-xl border border-dashed border-[#B7C6D1] px-4 py-8 text-center text-[13px] text-[#98A2B3]">
                        No automation rules yet — define your first “if … then …” workflow.
                    </p>
                @endforelse
            </div>

            <h2 class="mt-8 flex items-center gap-2 text-[15px] font-bold text-[#102840]">
                Recent runs
                <span class="rounded-full bg-[#102840]/5 px-2.5 py-0.5 text-[11px] font-bold text-[#102840]">{{ $logs->count() }}</span>
            </h2>
            <p class="mt-0.5 text-[12px] text-[#98A2B3]">Every evaluation is recorded — matching or not — so you can audit each rule.</p>

            <div class="mt-4 overflow-x-auto rounded-xl border border-[#D6E0E8]">
                <table class="w-full min-w-[520px] text-left text-[12px]">
                    <thead class="bg-[#F7FAFC] text-[11px] uppercase tracking-wide text-[#98A2B3]">
                        <tr>
                            <th class="px-4 py-2.5 font-bold">When</th>
                            <th class="px-4 py-2.5 font-bold">Rule</th>
                            <th class="px-4 py-2.5 font-bold">Ticket</th>
                            <th class="px-4 py-2.5 font-bold">Outcome</th>
                            <th class="px-4 py-2.5 font-bold">Actions applied</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-[#F0F5F8]">
                        @forelse ($logs as $log)
                            <tr>
                                <td class="whitespace-nowrap px-4 py-2.5 text-[#98A2B3]">{{ $log->created_at->diffForHumans() }}</td>
                                <td class="px-4 py-2.5 font-semibold text-[#102840]">{{ $log->rule?->name }}</td>
                                <td class="px-4 py-2.5 text-[#2164b6]">{{ $log->ticket?->ticket_number ?? '#' . $log->ticket_id }}</td>
                                <td class="px-4 py-2.5">
                                    @if ($log->matched)
                                        <span class="rounded-md bg-[#16A34A]/10 px-2 py-0.5 font-bold text-[#15803D]">matched</span>
                                    @else
                                        <span class="rounded-md bg-[#E8EEF4] px-2 py-0.5 font-bold text-[#667085]">no match</span>
                                    @endif
                                </td>
                                <td class="px-4 py-2.5 text-[#667085]">{{ $log->actions ? implode(', ', $log->actions) : '—' }}</td>
                            </tr>
                        @empty
                            <tr>
                                <td colspan="5" class="px-4 py-6 text-center text-[#98A2B3]">No runs recorded yet.</td>
                            </tr>
                        @endforelse
                    </tbody>
                </table>
            </div>
        </div>

        <!-- Rule form -->
        <div class="rounded-2xl border border-[#D6E0E8] bg-white p-6">
            @php
                $editing = $editRule ?? null;
            @endphp
            <h2 class="text-[15px] font-bold text-[#102840]">{{ $editing ? 'Edit rule' : 'New rule' }}</h2>
            <p class="mt-0.5 text-[12px] text-[#98A2B3]">
                {{ $editing ? 'Update “' . $editing->name . '”.' : 'Build an “if … then …” workflow.' }}
            </p>

            <form method="POST"
                  action="{{ $editing ? route('securecrm.automation.update', $editing) : route('securecrm.automation.store') }}"
                  class="mt-5 space-y-5">
                @csrf
                @if ($editing) @method('PATCH') @endif

                <div>
                    <label for="name" class="mb-1 block text-[12px] font-semibold text-[#102840]">Name</label>
                    <input id="name" type="text" name="name" required maxlength="255"
                           value="{{ old('name', $editing?->name) }}"
                           placeholder="e.g. Route billing tickets to Billing Support"
                           class="w-full rounded-lg border border-[#D6E0E8] px-3 py-2 text-[13px] text-[#102840] placeholder-[#98A2B3] outline-none focus:border-[#2164b6] focus:ring-2 focus:ring-[#2164b6]/15">
                </div>
                <div>
                    <label for="description" class="mb-1 block text-[12px] font-semibold text-[#102840]">Description</label>
                    <input id="description" type="text" name="description" maxlength="2000"
                           value="{{ old('description', $editing?->description) }}"
                           placeholder="What does this rule do, and why?"
                           class="w-full rounded-lg border border-[#D6E0E8] px-3 py-2 text-[13px] text-[#102840] placeholder-[#98A2B3] outline-none focus:border-[#2164b6] focus:ring-2 focus:ring-[#2164b6]/15">
                </div>

                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label for="trigger" class="mb-1 block text-[12px] font-semibold text-[#102840]">When to run</label>
                        <select id="trigger" name="trigger" class="w-full rounded-lg border border-[#D6E0E8] px-3 py-2 text-[13px] text-[#102840] outline-none focus:border-[#2164b6]">
                            @foreach ($triggers as $trigger)
                                <option value="{{ $trigger }}" @selected(old('trigger', $editing?->trigger ?? 'created') === $trigger)>{{ ucfirst($trigger) }}</option>
                            @endforeach
                        </select>
                    </div>
                    <div>
                        <label for="sort_order" class="mb-1 block text-[12px] font-semibold text-[#102840]">Order</label>
                        <input id="sort_order" type="number" name="sort_order" min="1" max="99999"
                               value="{{ old('sort_order', $editing?->sort_order ?? 100) }}"
                               class="w-full rounded-lg border border-[#D6E0E8] px-3 py-2 text-[13px] text-[#102840] outline-none focus:border-[#2164b6] focus:ring-2 focus:ring-[#2164b6]/15">
                    </div>
                </div>

                <div class="flex flex-wrap items-center gap-4">
                    <label class="flex items-center gap-2 text-[12px] font-semibold text-[#102840]">
                        <input type="checkbox" name="enabled" value="1"
                               @checked(old('enabled', $editing ? $editing->enabled : true))
                               class="size-4 rounded border-[#D6E0E8] text-[#2164b6]">
                        Enabled
                    </label>
                    <label class="flex items-center gap-2 text-[12px] font-semibold text-[#102840]">
                        <input type="checkbox" name="stop_after_match" value="1"
                               @checked(old('stop_after_match', $editing ? $editing->stop_after_match : true))
                               class="size-4 rounded border-[#D6E0E8] text-[#2164b6]">
                        Stop after match
                    </label>
                </div>

                <div>
                    <p class="text-[12px] font-bold text-[#102840]">Conditions <span class="font-normal text-[#98A2B3]">(all must match)</span></p>
                    <div class="mt-2 space-y-2">
                        @foreach ([0, 1, 2, 3] as $i)
                            @php
                                $c = $editing?->conditions[$i] ?? null;
                            @endphp
                            <div class="grid grid-cols-[1fr_1.1fr_1.2fr] gap-2 rounded-lg border border-[#F0F5F8] bg-[#F7FAFC] p-2">
                                <select name="conditions[{{ $i }}][field]" class="rounded-md border border-[#D6E0E8] px-2 py-1.5 text-[12px] text-[#102840] outline-none focus:border-[#2164b6]">
                                    <option value="">field…</option>
                                    @foreach ($fields as $field)
                                        <option value="{{ $field }}" @selected(($c['field'] ?? '') === $field)>{{ ucfirst(str_replace('_', ' ', $field)) }}</option>
                                    @endforeach
                                </select>
                                <select name="conditions[{{ $i }}][operator]" class="rounded-md border border-[#D6E0E8] px-2 py-1.5 text-[12px] text-[#102840] outline-none focus:border-[#2164b6]">
                                    <option value="">is…</option>
                                    @foreach ($operators as $operator)
                                        <option value="{{ $operator }}" @selected(($c['operator'] ?? '') === $operator)>{{ str_replace('_', ' ', $operator) }}</option>
                                    @endforeach
                                </select>
                                <input type="text" name="conditions[{{ $i }}][value]" value="{{ $c['value'] ?? '' }}"
                                       placeholder="e.g. billing / critical / withdrawal failed"
                                       class="rounded-md border border-[#D6E0E8] px-2 py-1.5 text-[12px] text-[#102840] placeholder-[#98A2B3] outline-none focus:border-[#2164b6]">
                            </div>
                        @endforeach
                    </div>
                </div>

                <div>
                    <p class="text-[12px] font-bold text-[#102840]">Actions <span class="font-normal text-[#98A2B3]">(in order)</span></p>
                    <div class="mt-2 space-y-2">
                        @foreach ([0, 1, 2] as $i)
                            @php
                                $a = $editing?->actions[$i] ?? null;
                            @endphp
                            <div class="grid grid-cols-[1.3fr_1fr] gap-2 rounded-lg border border-[#F0F5F8] bg-[#F7FAFC] p-2">
                                <select name="actions[{{ $i }}][type]" class="rounded-md border border-[#D6E0E8] px-2 py-1.5 text-[12px] text-[#102840] outline-none focus:border-[#2164b6]">
                                    <option value="">action…</option>
                                    @foreach ($actionTypes as $type)
                                        <option value="{{ $type }}" @selected(($a['type'] ?? '') === $type)>{{ str_replace('_', ' ', $type) }}</option>
                                    @endforeach
                                </select>
                                @if (($a['type'] ?? '') === 'assign_agent' || ($a['type'] ?? '') === 'notify_staff')
                                    <select name="actions[{{ $i }}][value]" class="rounded-md border border-[#D6E0E8] px-2 py-1.5 text-[12px] text-[#102840] outline-none focus:border-[#2164b6]">
                                        <option value="">staff…</option>
                                        @foreach ($agents as $agent)
                                            <option value="{{ $agent->id }}" @selected((string) ($a['value'] ?? '') === (string) $agent->id)>{{ $agent->name }}</option>
                                        @endforeach
                                    </select>
                                @elseif (($a['type'] ?? '') === 'set_category')
                                    <select name="actions[{{ $i }}][value]" class="rounded-md border border-[#D6E0E8] px-2 py-1.5 text-[12px] text-[#102840] outline-none focus:border-[#2164b6]">
                                        <option value="">category…</option>
                                        @foreach ($categories as $category)
                                            <option value="{{ $category->id }}" @selected((string) ($a['value'] ?? '') === (string) $category->id)>{{ $category->name }}</option>
                                        @endforeach
                                    </select>
                                @elseif (($a['type'] ?? '') === 'set_priority')
                                    <select name="actions[{{ $i }}][value]" class="rounded-md border border-[#D6E0E8] px-2 py-1.5 text-[12px] text-[#102840] outline-none focus:border-[#2164b6]">
                                        <option value="">priority…</option>
                                        @foreach ($priorities as $priority)
                                            <option value="{{ $priority }}" @selected((string) ($a['value'] ?? '') === $priority)>{{ ucfirst($priority) }}</option>
                                        @endforeach
                                    </select>
                                @elseif (($a['type'] ?? '') === 'set_status')
                                    <select name="actions[{{ $i }}][value]" class="rounded-md border border-[#D6E0E8] px-2 py-1.5 text-[12px] text-[#102840] outline-none focus:border-[#2164b6]">
                                        <option value="">status…</option>
                                        @foreach ($statuses as $status)
                                            <option value="{{ $status }}" @selected((string) ($a['value'] ?? '') === $status)>{{ ucfirst(str_replace('_', ' ', $status)) }}</option>
                                        @endforeach
                                    </select>
                                @else
                                    <input type="text" name="actions[{{ $i }}][value]" value="{{ $a['value'] ?? '' }}"
                                           placeholder="{{ ($a['type'] ?? '') === 'assign_team' ? 'team id…' : 'value / note text…' }}"
                                           class="rounded-md border border-[#D6E0E8] px-2 py-1.5 text-[12px] text-[#102840] placeholder-[#98A2B3] outline-none focus:border-[#2164b6]">
                                @endif
                            </div>
                        @endforeach
                        <p class="text-[11px] text-[#98A2B3]">
                            Tip: <code class="text-[#2164b6]">keyword</code> searches the subject and description (e.g. “withdrawal failed”).
                        </p>
                    </div>
                </div>

                <div class="flex gap-3">
                    <button type="submit" class="flex-1 rounded-lg bg-[#2164b6] px-4 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-[#1b52a0]">
                        {{ $editing ? 'Save changes' : 'Create rule' }}
                    </button>
                    @if ($editing)
                        <a href="{{ route('securecrm.automation') }}" class="rounded-lg border border-[#D6E0E8] px-4 py-2.5 text-[13px] font-semibold text-[#667085] transition-colors hover:bg-[#F7FAFC]">Cancel</a>
                    @endif
                </div>
            </form>
        </div>
    </div>
@endsection