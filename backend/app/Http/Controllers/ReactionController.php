<?php

namespace App\Http\Controllers;

use App\Models\Post;
use App\Models\PostComment;
use App\Models\PostReaction;
use App\Models\CommentReaction;
use App\Models\Community;
use App\Models\CommunityMembership;
use App\Models\CommunityMemberRestriction;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ReactionController extends Controller
{
    public function togglePostReaction(Request $request, int $postId): JsonResponse
    {
        $validated = $request->validate([
            'type' => ['required', Rule::in(['like', 'dislike'])],
        ]);

        $user = $request->user();
        $post = Post::findOrFail($postId);

        if ($post->community_id) {
            $community = Community::find($post->community_id);
            if ($community) {
                $membership = CommunityMembership::where('community_id', $community->id)
                    ->where('user_id', $user->id)
                    ->where('status', 'active')
                    ->first();

                if (!$membership && $community->user_id !== $user->id) {
                    return response()->json([
                        'message' => 'Join this community to react or participate in the conversation.',
                        'requires_join' => true,
                        'community_id' => $community->id,
                        'community_slug' => $community->slug,
                    ], 403);
                }

                if ($membership) {
                    $restricted = CommunityMemberRestriction::where('community_id', $community->id)
                        ->where('user_id', $user->id)
                        ->where(function ($q) {
                            $q->where('expires_at', '>', now())->orWhereNull('expires_at');
                        })
                        ->exists();

                    if ($restricted) {
                        return response()->json(['message' => 'You have been restricted from interacting in this community.'], 403);
                    }
                }

                if ($validated['type'] === 'dislike' && !$community->dislikes_enabled) {
                    return response()->json(['message' => 'Dislikes are disabled in this community.'], 422);
                }
            }
        }

        $existing = PostReaction::where('post_id', $post->id)
            ->where('user_id', $user->id)
            ->first();

        if ($existing) {
            if ($existing->reaction_type === $validated['type']) {
                $existing->delete();
                if ($validated['type'] === 'like') {
                    $post->decrement('likes_count');
                } else {
                    $post->decrement('dislikes_count');
                }
                return response()->json(['reacted' => false, 'likes_count' => max(0, $post->fresh()->likes_count), 'dislikes_count' => max(0, $post->fresh()->dislikes_count)]);
            }

            $oldType = $existing->reaction_type;
            $existing->update(['reaction_type' => $validated['type']]);
            if ($oldType === 'like') {
                $post->decrement('likes_count');
            } else {
                $post->decrement('dislikes_count');
            }
            if ($validated['type'] === 'like') {
                $post->increment('likes_count');
            } else {
                $post->increment('dislikes_count');
            }
        } else {
            PostReaction::create([
                'post_id' => $post->id,
                'user_id' => $user->id,
                'reaction_type' => $validated['type'],
            ]);
            if ($validated['type'] === 'like') {
                $post->increment('likes_count');
            } else {
                $post->increment('dislikes_count');
            }
        }

        return response()->json([
            'reacted' => true,
            'type' => $validated['type'],
            'likes_count' => max(0, $post->fresh()->likes_count),
            'dislikes_count' => max(0, $post->fresh()->dislikes_count),
        ]);
    }

    public function toggleCommentReaction(Request $request, int $commentId): JsonResponse
    {
        $validated = $request->validate([
            'type' => ['required', Rule::in(['like', 'dislike'])],
        ]);

        $user = $request->user();
        $comment = PostComment::with('post')->findOrFail($postId = $commentId);

        if ($comment->post && $comment->post->community_id) {
            $community = Community::find($comment->post->community_id);
            if ($community) {
                $membership = CommunityMembership::where('community_id', $community->id)
                    ->where('user_id', $user->id)
                    ->where('status', 'active')
                    ->exists();
                if (!$membership && $community->user_id !== $user->id) {
                    return response()->json([
                        'message' => 'Join this community to react or participate in the conversation.',
                        'requires_join' => true,
                        'community_id' => $community->id,
                        'community_slug' => $community->slug,
                    ], 403);
                }
            }
        }

        $existing = CommentReaction::where('comment_id', $comment->id)
            ->where('user_id', $user->id)
            ->first();

        if ($existing) {
            if ($existing->type === $validated['type']) {
                $existing->delete();
                if ($validated['type'] === 'like') {
                    $comment->decrement('likes_count');
                } else {
                    $comment->decrement('dislikes_count');
                }
                return response()->json(['reacted' => false, 'likes_count' => max(0, $comment->fresh()->likes_count), 'dislikes_count' => max(0, $comment->fresh()->dislikes_count)]);
            }

            $oldType = $existing->type;
            $existing->update(['type' => $validated['type']]);
            if ($oldType === 'like') {
                $comment->decrement('likes_count');
            } else {
                $comment->decrement('dislikes_count');
            }
            if ($validated['type'] === 'like') {
                $comment->increment('likes_count');
            } else {
                $comment->increment('dislikes_count');
            }
        } else {
            CommentReaction::create([
                'comment_id' => $comment->id,
                'user_id' => $user->id,
                'type' => $validated['type'],
            ]);
            if ($validated['type'] === 'like') {
                $comment->increment('likes_count');
            } else {
                $comment->increment('dislikes_count');
            }
        }

        return response()->json([
            'reacted' => true,
            'type' => $validated['type'],
            'likes_count' => max(0, $comment->fresh()->likes_count),
            'dislikes_count' => max(0, $comment->fresh()->dislikes_count),
        ]);
    }
}
