<?php

namespace App\Http\Controllers;

use App\Models\Conversation;
use App\Models\ConversationParticipant;
use App\Models\E2eeSenderKeyEnvelope;
use App\Services\E2eeGroupService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Sender key distribution for encrypted group chats.
 *
 * A member creates a sender key for the current epoch and encrypts its distribution
 * to every other member over their 1:1 session. This controller only stores and
 * forwards those opaque ciphertexts. It cannot read them, and it never sees keys.
 */
class E2eeSenderKeyController extends Controller
{
    private const MAX_ENVELOPE_CIPHERTEXT = 16384;

    /** The envelopes addressed to me for the group's current epoch, not yet acknowledged. */
    public function index(Request $request, int $id): JsonResponse
    {
        $conversation = $this->encryptedGroup($request, $id);

        $envelopes = E2eeSenderKeyEnvelope::where('conversation_id', $conversation->id)
            ->where('recipient_user_id', $request->user()->id)
            ->where('epoch', $conversation->e2ee_epoch)
            ->orderBy('id')
            ->get(['id', 'sender_user_id', 'epoch', 'ciphertext']);

        return response()->json([
            'epoch' => $conversation->e2ee_epoch,
            'envelopes' => $envelopes,
        ]);
    }

    /**
     * Stores my sender key distribution for the current epoch, one envelope per other
     * member. Every member must be covered, or some would never be able to read my
     * messages. A stale epoch is refused so the sender rotates and sends again.
     */
    public function store(Request $request, int $id): JsonResponse
    {
        $conversation = $this->encryptedGroup($request, $id);
        $senderId = $request->user()->id;

        $validated = $request->validate([
            'epoch' => ['required', 'integer', 'min:0'],
            'envelopes' => ['required', 'array', 'min:1', 'max:'.E2eeGroupService::MAX_MEMBERS],
            'envelopes.*.recipient_user_id' => ['required', 'integer'],
            'envelopes.*.ciphertext' => ['required', 'string', 'max:'.self::MAX_ENVELOPE_CIPHERTEXT],
        ]);

        $epoch = $conversation->e2ee_epoch;
        if ((int) $validated['epoch'] !== $epoch) {
            return response()->json([
                'message' => 'Stale key epoch. Create and distribute a new sender key.',
                'code' => 'STALE_KEY_EPOCH',
                'epoch' => $epoch,
            ], 409);
        }

        $recipientIds = collect($validated['envelopes'])
            ->pluck('recipient_user_id')
            ->map(fn ($value) => (int) $value);

        if ($recipientIds->unique()->count() !== $recipientIds->count()) {
            return response()->json(['message' => 'Each member needs exactly one envelope.'], 422);
        }
        if ($recipientIds->contains($senderId)) {
            return response()->json(['message' => 'Do not send a sender key to yourself.'], 422);
        }

        $memberIds = ConversationParticipant::where('conversation_id', $conversation->id)
            ->where('user_id', '!=', $senderId)
            ->pluck('user_id')
            ->map(fn ($value) => (int) $value)
            ->sort()
            ->values();

        if ($recipientIds->sort()->values()->all() !== $memberIds->all()) {
            return response()->json([
                'message' => 'A sender key must be sent to every other member of the group.',
            ], 422);
        }

        $now = now();
        $rows = collect($validated['envelopes'])->map(fn (array $envelope) => [
            'conversation_id' => $conversation->id,
            'sender_user_id' => $senderId,
            'recipient_user_id' => (int) $envelope['recipient_user_id'],
            'epoch' => $epoch,
            'ciphertext' => $envelope['ciphertext'],
            'created_at' => $now,
            'updated_at' => $now,
        ])->all();

        E2eeSenderKeyEnvelope::upsert(
            $rows,
            ['conversation_id', 'sender_user_id', 'recipient_user_id', 'epoch'],
            ['ciphertext', 'updated_at'],
        );

        return response()->json(['epoch' => $epoch, 'stored' => count($rows)], 201);
    }

    /** The recipient confirms envelopes are installed on their device. They are then deleted. */
    public function acknowledge(Request $request, int $id): JsonResponse
    {
        $conversation = $this->encryptedGroup($request, $id);

        $validated = $request->validate([
            'ids' => ['required', 'array', 'min:1', 'max:256'],
            'ids.*' => ['integer'],
        ]);

        $removed = E2eeSenderKeyEnvelope::where('conversation_id', $conversation->id)
            ->where('recipient_user_id', $request->user()->id)
            ->whereIn('id', $validated['ids'])
            ->delete();

        return response()->json(['acknowledged' => $removed]);
    }

    /**
     * The conversation, if it is an encrypted-capable group and I am a member of it.
     */
    private function encryptedGroup(Request $request, int $id): Conversation
    {
        $conversation = Conversation::find($id);
        abort_if($conversation === null, 404, 'Conversation not found.');
        abort_unless(app(E2eeGroupService::class)->supports($conversation), 422, 'Sender keys are only used for group chats.');

        $isParticipant = ConversationParticipant::where('conversation_id', $conversation->id)
            ->where('user_id', $request->user()->id)
            ->exists();
        abort_unless($isParticipant, 403, 'You are not a participant in this conversation.');

        return $conversation;
    }
}
