<?php

use App\Models\Community;
use App\Models\CommunityMembership;
use App\Models\Conversation;
use App\Models\ConversationParticipant;
use Illuminate\Support\Facades\Broadcast;

// Register broadcast auth route (outside api middleware to avoid envelope wrapping)
Broadcast::routes(['middleware' => ['auth:sanctum']]);

Broadcast::channel('App.Models.User.{id}', function ($user, $id) {
    return (int) $user->id === (int) $id;
});

Broadcast::channel('conversation.{id}', function ($user, $id) {
    $conversation = Conversation::find($id);
    if (! $conversation) {
        return false;
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
