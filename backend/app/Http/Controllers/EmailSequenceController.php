<?php

namespace App\Http\Controllers;

use App\Models\EmailSequence;
use App\Models\EmailSequenceStep;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class EmailSequenceController extends Controller
{
    // ── Sequences ──────────────────────────────────────────────────────────

    public function index(Request $request): JsonResponse
    {
        $sequences = EmailSequence::where('creator_id', $request->user()->id)
            ->with('steps')
            ->latest()
            ->get()
            ->map(fn($s) => [
                'id' => $s->id,
                'title' => $s->title,
                'description' => $s->description,
                'trigger_event' => $s->trigger_event,
                'status' => $s->status,
                'is_active' => $s->is_active,
                'steps_count' => $s->steps->count(),
                'created_at' => $s->created_at->toIso8601String(),
                'steps' => $s->steps->map(fn($st) => [
                    'id' => $st->id,
                    'subject' => $st->subject,
                    'delay_days' => $st->delay_days,
                    'order' => $st->order,
                ]),
            ]);

        return response()->json(['data' => $sequences]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:2000'],
            'trigger_event' => ['required', 'in:' . implode(',', EmailSequence::TRIGGER_EVENTS)],
        ]);

        $validated['creator_id'] = $request->user()->id;

        $sequence = EmailSequence::create($validated);

        return response()->json(['data' => $sequence->load('steps')], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $sequence = EmailSequence::where('creator_id', $request->user()->id)->findOrFail($id);

        $validated = $request->validate([
            'title' => ['sometimes', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:2000'],
            'trigger_event' => ['sometimes', 'in:' . implode(',', EmailSequence::TRIGGER_EVENTS)],
        ]);

        $sequence->update($validated);

        return response()->json(['data' => $sequence->fresh()->load('steps')]);
    }

    public function toggle(Request $request, int $id): JsonResponse
    {
        $sequence = EmailSequence::where('creator_id', $request->user()->id)->findOrFail($id);

        $newActive = !$sequence->is_active;
        $sequence->update([
            'is_active' => $newActive,
            'status' => $newActive ? 'active' : 'paused',
        ]);

        return response()->json(['data' => $sequence->fresh()->load('steps')]);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $sequence = EmailSequence::where('creator_id', $request->user()->id)->findOrFail($id);
        $sequence->delete();

        return response()->json(['message' => 'Sequence deleted.']);
    }

    // ── Steps ──────────────────────────────────────────────────────────────

    public function steps(Request $request, int $sequenceId): JsonResponse
    {
        $sequence = EmailSequence::where('creator_id', $request->user()->id)->findOrFail($sequenceId);

        return response()->json(['data' => $sequence->steps]);
    }

    public function storeStep(Request $request, int $sequenceId): JsonResponse
    {
        $sequence = EmailSequence::where('creator_id', $request->user()->id)->findOrFail($sequenceId);

        $validated = $request->validate([
            'subject' => ['required', 'string', 'max:255'],
            'content' => ['required', 'string', 'max:50000'],
            'delay_days' => ['sometimes', 'integer', 'min:0', 'max:365'],
            'order' => ['sometimes', 'integer', 'min:0'],
        ]);

        $validated['email_sequence_id'] = $sequence->id;

        if (!isset($validated['order'])) {
            $maxOrder = $sequence->steps()->max('order') ?? 0;
            $validated['order'] = $maxOrder + 1;
        }

        $step = EmailSequenceStep::create($validated);

        return response()->json(['data' => $step], 201);
    }

    public function updateStep(Request $request, int $sequenceId, int $stepId): JsonResponse
    {
        $sequence = EmailSequence::where('creator_id', $request->user()->id)->findOrFail($sequenceId);
        $step = $sequence->steps()->findOrFail($stepId);

        $validated = $request->validate([
            'subject' => ['sometimes', 'string', 'max:255'],
            'content' => ['sometimes', 'string', 'max:50000'],
            'delay_days' => ['sometimes', 'integer', 'min:0', 'max:365'],
            'order' => ['sometimes', 'integer', 'min:0'],
        ]);

        $step->update($validated);

        return response()->json(['data' => $step->fresh()]);
    }

    public function deleteStep(Request $request, int $sequenceId, int $stepId): JsonResponse
    {
        $sequence = EmailSequence::where('creator_id', $request->user()->id)->findOrFail($sequenceId);
        $step = $sequence->steps()->findOrFail($stepId);
        $step->delete();

        return response()->json(['message' => 'Step deleted.']);
    }
}
