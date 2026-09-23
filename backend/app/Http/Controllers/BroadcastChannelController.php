<?php

namespace App\Http\Controllers;

use App\Models\BroadcastChannel;
use App\Models\BroadcastChannelMember;
use App\Models\Community;
use App\Models\CommunityMembership;
use App\Models\FriendRequest;
use App\Models\Group;
use App\Models\GroupMember;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class BroadcastChannelController extends Controller
{
    /**
     * List the authenticated user's broadcast channels.
     */
    public function index(Request $request): JsonResponse
    {
        $userId = $request->user()->id;

        $channels = BroadcastChannel::with('owner:id,name,username,avatar')
            ->where('user_id', $userId)
            ->latest()
            ->paginate(12);

        return response()->json([
            'success' => true,
            'data' => $channels,
        ]);
    }

    /**
     * Create a broadcast channel linked to an entity the user owns.
     *
     * Recipients are derived automatically from the linked entity:
     *  - page      → friends + followers of your profile
     *  - group     → active members of a group you own/admin
     *  - community → active members of a community you own
     *
     * You can never manually add arbitrary users to a broadcast channel; the
     * audience is always the audience of the linked page/group/community.
     */
    public function store(Request $request): JsonResponse
    {
        $userId = $request->user()->id;

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:80'],
            'handle' => ['nullable', 'string', 'max:40', 'regex:/^[a-zA-Z0-9_]+$/',],
            'description' => ['nullable', 'string', 'max:500'],
            'allow_replies' => ['sometimes', 'boolean'],
            'linked_type' => ['required', Rule::in([BroadcastChannel::LINKED_PAGE, BroadcastChannel::LINKED_GROUP, BroadcastChannel::LINKED_COMMUNITY])],
            'linked_id' => ['nullable', 'integer'],
        ]);

        $linkedType = $validated['linked_type'];
        $linkedId = $validated['linked_id'] ?? null;

        $this->assertCanLink($userId, $linkedType, $linkedId);

        $recipientIds = $this->resolveAudience($userId, $linkedType, $linkedId);

        $handleBase = $validated['handle'] ?? (Str::slug(trim($validated['name']), '_') ?: 'channel');

        $channel = $this->createWithUniqueHandle(
            $handleBase,
            fn (string $handle) => $this->createForAudience(
                $userId,
                $validated,
                $handle,
                $linkedType,
                $linkedId,
                $recipientIds,
            )
        );

        return response()->json([
            'success' => true,
            'message' => 'Broadcast channel created. Recipients were added automatically from '.
                $this->linkedLabel($linkedType).'.',
            'data' => $channel->load('owner:id,name,username,avatar'),
            'recipients_count' => count($recipientIds),
        ], 201);
    }

    /**
     * Show a single broadcast channel the user owns (or is currently in the
     * audience of its linked entity).
     */
    public function show(Request $request, BroadcastChannel $channel): JsonResponse
    {
        $userId = $request->user()->id;

        $isRecipient = in_array(
            $userId,
            $this->resolveAudience($channel->user_id, $channel->linked_type, $channel->linked_id),
            true,
        );

        if (! $channel->isOwner($userId) && ! $isRecipient) {
            return response()->json(['success' => false, 'message' => 'Broadcast channel not found.'], 404);
        }

        return response()->json([
            'success' => true,
            'data' => $channel->load('owner:id,name,username,avatar'),
        ]);
    }

    /**
     * List recipients of a broadcast channel (owner only).
     */
    public function members(Request $request, BroadcastChannel $channel): JsonResponse
    {
        if (! $channel->isOwner($request->user()->id)) {
            return response()->json(['success' => false, 'message' => 'Broadcast channel not found.'], 404);
        }

        $this->syncRecipients(
            $channel,
            $this->resolveAudience($channel->user_id, $channel->linked_type, $channel->linked_id),
        );

        $members = $channel->members()
            ->with('user:id,name,username,avatar')
            ->latest()
            ->paginate(24);

        return response()->json([
            'success' => true,
            'data' => $members,
        ]);
    }

    /**
     * Delete a broadcast channel (owner only).
     */
    public function destroy(Request $request, BroadcastChannel $channel): JsonResponse
    {
        if (! $channel->isOwner($request->user()->id)) {
            return response()->json(['success' => false, 'message' => 'Broadcast channel not found.'], 404);
        }

        $channel->delete();

        return response()->json(['success' => true, 'message' => 'Broadcast channel deleted.']);
    }

    /**
     * Verify the current user may link a broadcast channel to the given entity.
     */
    private function assertCanLink(int $userId, string $linkedType, ?int $linkedId): void
    {
        if ($linkedType === BroadcastChannel::LINKED_GROUP) {
            $group = $linkedId ? Group::find($linkedId) : null;

            if (! $group || ! $group->isAdminOrOwner($userId)) {
                abort(403, 'You can only link a broadcast channel to a group you own or admin.');
            }
        } elseif ($linkedType === BroadcastChannel::LINKED_COMMUNITY) {
            $community = $linkedId ? Community::find($linkedId) : null;

            if (! $community || (int) $community->user_id !== $userId) {
                abort(403, 'You can only link a broadcast channel to a community you own.');
            }
        }
    }

    /**
     * Resolve the current recipient user ids for a linked entity.
     *
     * The audience is always derived from the linked entity at the moment the
     * list is needed, so unfriending, unfollowing, or leaving a group/community
     * immediately removes a user from the audience.
     */
    private function resolveAudience(int $userId, string $linkedType, ?int $linkedId): array
    {
        if ($linkedType === BroadcastChannel::LINKED_PAGE) {
            $friendIds = collect(FriendRequest::accepted()->where('sender_id', $userId)->pluck('receiver_id'))
                ->merge(FriendRequest::accepted()->where('receiver_id', $userId)->pluck('sender_id'))
                ->all();

            $ids = array_merge(
                $friendIds,
                DB::table('follows')->where('following_id', $userId)->pluck('follower_id')->all(),
            );
        } elseif ($linkedType === BroadcastChannel::LINKED_GROUP && $linkedId) {
            $ids = GroupMember::where('group_id', $linkedId)
                ->where('status', 'active')
                ->pluck('user_id')
                ->all();
        } elseif ($linkedType === BroadcastChannel::LINKED_COMMUNITY && $linkedId) {
            $ids = CommunityMembership::where('community_id', $linkedId)
                ->where('status', 'active')
                ->where('user_id', '!=', $userId)
                ->pluck('user_id')
                ->all();
        } else {
            $ids = [];
        }

        return collect($ids)
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->reject(fn (int $id) => $id === $userId)
            ->values()
            ->all();
    }

    /**
     * Create the channel and insert all recipients atomically.
     */
    private function createForAudience(
        int $userId,
        array $validated,
        string $handle,
        string $linkedType,
        ?int $linkedId,
        array $recipientIds,
    ): BroadcastChannel {
        return DB::transaction(function () use ($userId, $validated, $handle, $linkedType, $linkedId, $recipientIds) {
            $channel = BroadcastChannel::create([
                'user_id' => $userId,
                'name' => trim($validated['name']),
                'handle' => $handle,
                'description' => isset($validated['description']) ? trim($validated['description']) : null,
                'allow_replies' => $validated['allow_replies'] ?? false,
                'linked_type' => $linkedType,
                'linked_id' => $linkedId,
                'recipients_count' => count($recipientIds),
            ]);

            $this->insertRecipients($channel, $recipientIds);

            return $channel;
        });
    }

    /**
     * Repeatedly reserve a unique handle, retrying if a concurrent request wins
     * the insert first (violates the unique handle index).
     */
    private function createWithUniqueHandle(string $base, callable $create): BroadcastChannel
    {
        $attempts = 0;

        while (true) {
            try {
                return $create($this->uniqueHandle($base));
            } catch (UniqueConstraintViolationException $e) {
                if (++$attempts >= 10) {
                    throw $e;
                }
            }
        }
    }

    /**
     * Reconcile stored member rows with the current linked-entity audience.
     * Marks departed users as removed and adds newly joined users.
     */
    private function syncRecipients(BroadcastChannel $channel, array $audienceIds): void
    {
        $now = now();
        $audienceIds = collect($audienceIds)->map(fn ($id) => (int) $id)->unique()->values()->all();

        $stored = Collection::make(
            BroadcastChannelMember::where('broadcast_channel_id', $channel->id)
                ->where('status', BroadcastChannelMember::STATUS_ACTIVE)
                ->pluck('user_id')
                ->all()
        )->map(fn ($id) => (int) $id)->all();

        $stale = array_values(array_diff($stored, $audienceIds));

        if ($stale !== []) {
            BroadcastChannelMember::where('broadcast_channel_id', $channel->id)
                ->whereIn('user_id', $stale)
                ->update(['status' => BroadcastChannelMember::STATUS_REMOVED]);
        }

        $active = Collection::make(
            BroadcastChannelMember::where('broadcast_channel_id', $channel->id)
                ->where('status', BroadcastChannelMember::STATUS_ACTIVE)
                ->pluck('user_id')
                ->all()
        )->map(fn ($id) => (int) $id)->all();

        foreach (array_values(array_diff($audienceIds, $active)) as $userId) {
            BroadcastChannelMember::updateOrCreate(
                ['broadcast_channel_id' => $channel->id, 'user_id' => $userId],
                [
                    'status' => BroadcastChannelMember::STATUS_ACTIVE,
                    'joined_at' => $now,
                    'updated_at' => $now,
                ],
            );
        }

        $channel->update(['recipients_count' => count($audienceIds)]);
    }

    private function insertRecipients(BroadcastChannel $channel, array $recipientIds): void
    {
        $recipientIds = collect($recipientIds)->map(fn ($id) => (int) $id)->unique()->values()->all();

        if ($recipientIds === []) {
            return;
        }

        $now = now();

        foreach (array_chunk($recipientIds, 1000) as $chunk) {
            DB::table('broadcast_channel_members')
                ->insert(array_map(function (int $userId) use ($channel, $now) {
                    return [
                        'broadcast_channel_id' => $channel->id,
                        'user_id' => $userId,
                        'status' => BroadcastChannelMember::STATUS_ACTIVE,
                        'joined_at' => $now,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ];
                }, $chunk));
        }
    }

    private function uniqueHandle(string $base): string
    {
        $handle = $base === '' ? 'channel' : $base;
        $candidate = $handle;
        $i = 2;

        while (BroadcastChannel::where('handle', $candidate)->exists()) {
            $candidate = "{$handle}_{$i}";
            $i++;
        }

        return $candidate;
    }

    private function linkedLabel(string $linkedType): string
    {
        return match ($linkedType) {
            BroadcastChannel::LINKED_GROUP => 'your group',
            BroadcastChannel::LINKED_COMMUNITY => 'your community',
            default => 'your page',
        };
    }
}