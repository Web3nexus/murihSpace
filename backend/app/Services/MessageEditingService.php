<?php

namespace App\Services;

use App\Models\Message;
use App\Models\MessageEdit;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * The single authority on whether a chat message may be edited.
 *
 * Everything the client draws — the edit affordance, the countdown, the
 * "edited" marker — is derived from these rules, and the write path re-runs
 * them, so a stale or forged UI can never widen the window or edit someone
 * else's text.
 */
class MessageEditingService
{
    public const REASON_NOT_OWNER = 'not_owner';

    public const REASON_WINDOW_CLOSED = 'window_closed';

    public const REASON_WINDOW_DISABLED = 'window_disabled';

    public const REASON_DELETED = 'deleted';

    public const REASON_AUTOMATED = 'automated';

    public const REASON_UNCHANGED = 'unchanged';

    /**
     * Length of the grace period, in seconds, measured from when the message
     * was sent. Zero means editing is switched off platform-wide.
     */
    public function windowSeconds(): int
    {
        return max(0, (int) config('murihspace.chat.edit_window_seconds', 120));
    }

    public function maxLength(): int
    {
        return max(1, (int) config('murihspace.chat.edit_max_length', 5000));
    }

    /**
     * When editing stops being possible for this message.
     */
    public function deadlineFor(Message $message): ?Carbon
    {
        if ($this->windowSeconds() <= 0 || ! $message->created_at) {
            return null;
        }

        return Carbon::parse($message->created_at)->addSeconds($this->windowSeconds());
    }

    public function canEdit(Message $message, User $user): bool
    {
        return $this->blockedReason($message, $user) === null;
    }

    /**
     * Why this edit is refused, or null when it is allowed.
     *
     * Only the sender may edit their own message: moderators, group admins and
     * platform admins included. Rewriting someone else's words is a different
     * feature (and an abuse vector), not a correction.
     */
    public function blockedReason(Message $message, User $user): ?string
    {
        if ((int) $message->user_id !== (int) $user->id) {
            return self::REASON_NOT_OWNER;
        }

        if ($this->windowSeconds() <= 0) {
            return self::REASON_WINDOW_DISABLED;
        }

        // A deleted message has no content left to correct, and an automated
        // greeting was never authored by the sender.
        if ($message->isDeletedForEveryone()) {
            return self::REASON_DELETED;
        }

        if ($message->is_automated) {
            return self::REASON_AUTOMATED;
        }

        $deadline = $this->deadlineFor($message);

        if (! $deadline || Carbon::now()->greaterThan($deadline)) {
            return self::REASON_WINDOW_CLOSED;
        }

        return null;
    }

    /**
     * Human-facing refusal text. Kept here so the API and any future CLI/admin
     * path explain the block identically.
     */
    public function messageFor(string $reason): string
    {
        return match ($reason) {
            self::REASON_NOT_OWNER => 'You can only edit your own messages.',
            self::REASON_WINDOW_CLOSED => 'This message can no longer be edited.',
            self::REASON_WINDOW_DISABLED => 'Editing messages is currently disabled.',
            self::REASON_DELETED => 'This message was deleted, so it cannot be edited.',
            self::REASON_AUTOMATED => 'Automated messages cannot be edited.',
            self::REASON_UNCHANGED => 'The message is unchanged.',
            default => 'This message cannot be edited.',
        };
    }

    /**
     * HTTP status for a refusal. Ownership is an authorisation failure (403);
     * an elapsed window is a conflict with server state (410 Gone), which keeps
     * it distinct from "you may never do this".
     */
    public function statusFor(string $reason): int
    {
        return match ($reason) {
            self::REASON_NOT_OWNER => 403,
            self::REASON_WINDOW_CLOSED, self::REASON_WINDOW_DISABLED => 410,
            default => 422,
        };
    }

    /**
     * Apply an edit, retaining the prior text as an audit row.
     *
     * The previous content is captured inside the same transaction as the
     * update so the audit trail can never drift from the live message.
     */
    public function apply(Message $message, User $editor, string $content): Message
    {
        $content = trim($content);

        return DB::transaction(function () use ($message, $editor, $content) {
            MessageEdit::create([
                'message_id' => $message->id,
                'editor_id' => $editor->id,
                'previous_content' => (string) $message->content,
                'content' => $content,
            ]);

            $message->update([
                'content' => $content,
                'edited_at' => now(),
                'edit_count' => (int) ($message->edit_count ?? 0) + 1,
            ]);

            return $message->refresh();
        });
    }
}