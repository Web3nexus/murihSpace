<?php

use App\Models\Community;
use App\Models\CommunityMembership;
use App\Models\Conversation;
use App\Models\ConversationParticipant;
use App\Models\Group;
use App\Models\GroupMember;
use App\Models\LiveStream;
use App\Models\LiveStreamParticipant;
use App\Models\Meeting;
use App\Models\MeetingParticipant;
use Illuminate\Support\Facades\Broadcast;

// Register broadcast auth route (outside api middleware to avoid envelope wrapping)
Broadcast::routes(['middleware' => ['auth:sanctum']]);

Broadcast::channel('App.Models.User.{id}', function ($user, $id) {
    return (int) $user->id === (int) $id;
});

Broadcast::channel('user.{id}', function ($user, $id) {
    return (int) $user->id === (int) $id;
});

Broadcast::channel('call.{roomName}', function ($user, $roomName) {
    return true;
});

Broadcast::channel('conversation.{id}', function ($user, $id) {
    $conversation = Conversation::find($id);
    if (! $conversation) {
        return false;
    }

    if ($conversation->type === 'group' && $conversation->group_id) {
        $isMember = GroupMember::where('group_id', $conversation->group_id)
            ->where('user_id', $user->id)
            ->where('status', 'active')
            ->exists();

        $isCreator = Group::where('id', $conversation->group_id)
            ->where('creator_id', $user->id)
            ->exists();

        return $isMember || $isCreator;
    }

    if ($conversation->type === 'community' && $conversation->community_id) {
        $isMember = CommunityMembership::where('community_id', $conversation->community_id)
            ->where('user_id', $user->id)
            ->whereIn('status', ['active', 'approved'])
            ->exists();

        $isOwner = Community::where('id', $conversation->community_id)
            ->where('creator_id', $user->id)
            ->exists();

        return $isMember || $isOwner;
    }

    return ConversationParticipant::where('conversation_id', $id)
        ->where('user_id', $user->id)
        ->exists();
});

// Section 17 & 18: Strict admin-isolated notification channels.
//
// Channel authorisation does NOT run through the IsAdmin middleware, so
// isAdmin() on its own would admit any administrator token — including an
// ordinary consumer session for an admin account, which is exactly the token
// Securegate refuses to honour over HTTP. Every one of these closures therefore
// also demands a session that cleared a second factor.
Broadcast::channel('admin-notifications', function ($user) {
    return $user
        && $user->isAdmin()
        && \App\Support\AdminSession::clearedMfa(request());
});

// Category-scoped push channel. The category is in the channel name so the
// permission check happens at subscribe time rather than only on the list
// endpoint.
Broadcast::channel('admin.notifications.category.{category}', function ($user, $category) {
    if (! $user || ! $user->isAdmin() || ! \App\Support\AdminSession::clearedMfa(request())) {
        return false;
    }

    return in_array(
        (string) $category,
        app(\App\Services\AdminNotificationService::class)->allowedCategoriesFor($user),
        true
    );
});

Broadcast::channel('admin.notifications.{id}', function ($user, $id) {
    return $user
        && $user->isAdmin()
        && (int) $user->id === (int) $id
        && \App\Support\AdminSession::clearedMfa(request());
});

/*
 * Meeting + live presence channels.
 *
 * These are private because they carry the participant roster, which would
 * otherwise enumerate everyone watching a stream. Subscription alone grants no
 * moderation rights: every moderation endpoint re-checks the caller's roster
 * role server-side.
 */
Broadcast::channel('meeting.{code}', function ($user, $code) {
    $meeting = Meeting::query()->where('code', $code)->first();

    if (! $meeting) {
        return false;
    }

    if ((int) $meeting->host_user_id === (int) $user->id) {
        return true;
    }

    // Anyone already holding a LiveKit token is an accepted attendee.
    return MeetingParticipant::query()
        ->where('meeting_id', $meeting->id)
        ->where('user_id', $user->id)
        ->where('is_active', true)
        ->exists();
});

Broadcast::channel('live-room.{streamId}', function ($user, $streamId) {
    $stream = LiveStream::find($streamId);

    if (! $stream) {
        return false;
    }

    // The host and anyone with an active row in the broadcast roster.
    if ((int) $stream->user_id === (int) $user->id) {
        return true;
    }

    return LiveStreamParticipant::query()
        ->where('live_stream_id', $stream->id)
        ->where('user_id', $user->id)
        ->where('is_active', true)
        ->exists();
});

