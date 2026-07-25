<?php

namespace App\Http\Controllers;

use App\Models\Community;
use App\Models\CommunityMembership;
use App\Models\Post;
use App\Models\PostComment;
use App\Models\PostReaction;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class PostController extends Controller
{
    /**
     * Display a feed of published posts for a specific community.
     */
    public function index(Request $request, int $communityId): JsonResponse
    {
        $posts = Post::with(['author:id,name,username,avatar', 'community:id,name,slug,logo_url', 'reactions'])
            ->where('community_id', $communityId)
            ->published()
            ->latest()
            ->paginate(15);

        return response()->json($posts);
    }

    /**
     * Display aggregate global feed across all communities.
     */
    public function globalFeed(Request $request): JsonResponse
    {
        $posts = Post::with(['author:id,name,username,avatar', 'community:id,name,slug,logo_url', 'reactions'])
            ->published()
            ->latest()
            ->paginate(20);

        return response()->json($posts);
    }

    /**
     * Store a newly created post / status with server-side link restriction checks.
     */
    public function store(Request $request): JsonResponse
    {
        $user = $request->user();

        $validated = $request->validate([
            'community_id' => ['required', 'exists:communities,id'],
            'type' => ['required', Rule::in(['post', 'status', 'announcement'])],
            'content' => ['required', 'string', 'max:5000'],
            'media_urls' => ['nullable', 'array'],
            'media_urls.*' => ['string', 'url'],
            'link_url' => ['nullable', 'string', 'url'],
            'is_draft' => ['nullable', 'boolean'],
        ]);

        $community = Community::findOrFail($validated['community_id']);

        // Check link-sharing permissions on server side (Sprint 8 requirement)
        $hasUrlInContent = (bool) preg_match('/https?:\/\/[^\s]+/', $validated['content']);
        $hasLinkUrl = ! empty($validated['link_url']);

        if ($hasUrlInContent || $hasLinkUrl) {
            $isOwnerOrCreator = ($community->user_id === $user->id);

            if (! $isOwnerOrCreator) {
                $membership = CommunityMembership::with('customRole')
                    ->where('community_id', $community->id)
                    ->where('user_id', $user->id)
                    ->where('status', 'active')
                    ->first();

                $hasLinkPermission = false;
                if ($membership) {
                    if (in_array($membership->role, ['admin', 'moderator'])) {
                        $hasLinkPermission = true;
                    } elseif ($membership->customRole && $membership->customRole->hasPermission('share_links')) {
                        $hasLinkPermission = true;
                    }
                }

                if (! $hasLinkPermission) {
                    return response()->json([
                        'message' => 'Link sharing is restricted. Regular community members cannot share external URLs by default.',
                        'error_code' => 'LINK_SHARING_RESTRICTED',
                    ], 403);
                }
            }
        }

        $post = Post::create([
            'community_id' => $community->id,
            'user_id' => $user->id,
            'type' => $validated['type'],
            'content' => $validated['content'],
            'media_urls' => $validated['media_urls'] ?? [],
            'link_url' => $validated['link_url'] ?? null,
            'is_draft' => $validated['is_draft'] ?? false,
            'likes_count' => 0,
            'comments_count' => 0,
        ]);

        $post->load(['author:id,name,username,avatar', 'community:id,name,slug,logo_url']);

        return response()->json([
            'message' => 'Post published successfully.',
            'post' => $post,
        ], 201);
    }

    /**
     * Add a comment to a post.
     */
    public function addComment(Request $request, int $postId): JsonResponse
    {
        $validated = $request->validate([
            'content' => ['required', 'string', 'max:1000'],
        ]);

        $post = Post::findOrFail($postId);

        $comment = PostComment::create([
            'post_id' => $post->id,
            'user_id' => $request->user()->id,
            'content' => $validated['content'],
        ]);

        $post->increment('comments_count');
        $comment->load('author:id,name,username,avatar');

        return response()->json([
            'message' => 'Comment added.',
            'comment' => $comment,
        ], 201);
    }

    /**
     * Toggle an emoji reaction on a post.
     */
    public function toggleReaction(Request $request, int $postId): JsonResponse
    {
        $validated = $request->validate([
            'reaction_type' => ['required', Rule::in(['like', 'fire', 'clap', 'heart'])],
        ]);

        $user = $request->user();
        $post = Post::findOrFail($postId);

        $existing = PostReaction::where('post_id', $post->id)
            ->where('user_id', $user->id)
            ->where('reaction_type', $validated['reaction_type'])
            ->first();

        if ($existing) {
            $existing->delete();
            $post->decrement('likes_count');
            $reacted = false;
        } else {
            PostReaction::create([
                'post_id' => $post->id,
                'user_id' => $user->id,
                'reaction_type' => $validated['reaction_type'],
            ]);
            $post->increment('likes_count');
            $reacted = true;
        }

        return response()->json([
            'reacted' => $reacted,
            'likes_count' => max(0, $post->fresh()->likes_count),
        ]);
    }
}
