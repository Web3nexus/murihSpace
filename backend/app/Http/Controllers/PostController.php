<?php

namespace App\Http\Controllers;

use App\Models\Community;
use App\Models\CommunityMembership;
use App\Models\CommunityMemberRestriction;
use App\Models\Post;
use App\Models\PostComment;
use App\Models\PostReaction;
use App\Models\SavedPost;
use App\Models\PostReport;
use App\Models\User;
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
        $posts = Post::with(['author:id,name,username,avatar,verification_badge_status,verification_badge_expires_at', 'community:id,name,slug,logo_url', 'reactions'])
            ->where('community_id', $communityId)
            ->published()
            ->pinnedFirst()
            ->paginate(15);

        return response()->json($posts);
    }

    /**
     * Display the authenticated user's saved posts.
     */
    public function savedPosts(Request $request): JsonResponse
    {
        $posts = Post::with(['author:id,name,username,avatar,verification_badge_status,verification_badge_expires_at', 'community:id,name,slug,logo_url', 'reactions'])
            ->whereHas('saves', fn ($q) => $q->where('user_id', $request->user()->id))
            ->published()
            ->pinnedFirst()
            ->paginate(20);

        return response()->json($posts);
    }

    /**
     * Display aggregate global feed across all communities.
     */
    public function globalFeed(Request $request): JsonResponse
    {
        $posts = Post::with(['author:id,name,username,avatar,verification_badge_status,verification_badge_expires_at', 'community:id,name,slug,logo_url', 'reactions'])
            ->published()
            ->pinnedFirst()
            ->paginate(20);

        return response()->json($posts);
    }

    /**
     * Store a newly created post / status with server-side link restriction checks.
     */
    public function store(Request $request): JsonResponse
    {
        $this->authorize('create', Post::class);

        $user = $request->user();

        $validated = $request->validate([
            'community_id' => ['required', 'exists:communities,id'],
            'type' => ['required', Rule::in(['post', 'status', 'announcement', 'poll', 'media', 'event', 'product', 'service'])],
            'content' => ['required', 'string', 'max:50000'],
            'media_urls' => ['nullable', 'array'],
            'media_urls.*' => ['string', 'url'],
            'link_url' => ['nullable', 'string', 'url'],
            'is_draft' => ['nullable', 'boolean'],
            'hashtags' => ['nullable', 'array'],
            'hashtags.*' => ['string', 'max:100'],
            'mentions' => ['nullable', 'array'],
            'mentions.*' => ['integer', 'exists:users,id'],
            'location' => ['nullable', 'string', 'max:255'],
            'privacy' => ['nullable', Rule::in(['public', 'followers', 'connections', 'selected', 'community', 'private'])],
            'comments_disabled' => ['nullable', 'boolean'],
            'accessibility_text' => ['nullable', 'string', 'max:1000'],
            'poll_question' => ['nullable', 'string', 'max:500'],
            'poll_options' => ['nullable', 'array', 'min:2', 'max:10'],
            'poll_options.*' => ['string', 'max:255'],
            'poll_ends_at' => ['nullable', 'date', 'after:now'],
            'cta_text' => ['nullable', 'string', 'max:100'],
            'cta_url' => ['nullable', 'string', 'url', 'max:500'],
            'scheduled_at' => ['nullable', 'date', 'after:now'],
        ]);

        $community = Community::findOrFail($validated['community_id']);

        // Enforce active membership or ownership for any post in this community
        $isOwner = $community->user_id === $user->id;
        if (! $isOwner) {
            $isMember = CommunityMembership::where('community_id', $community->id)
                ->where('user_id', $user->id)
                ->where('status', 'active')
                ->exists();
            if (! $isMember) {
                return response()->json(['message' => 'You must be an active member of this community to post.'], 403);
            }
        }

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
            'hashtags' => $validated['hashtags'] ?? null,
            'mentions' => $validated['mentions'] ?? null,
            'location' => $validated['location'] ?? null,
            'is_draft' => $validated['is_draft'] ?? false,
            'privacy' => $validated['privacy'] ?? 'public',
            'comments_disabled' => $validated['comments_disabled'] ?? false,
            'accessibility_text' => $validated['accessibility_text'] ?? null,
            'poll_question' => $validated['poll_question'] ?? null,
            'poll_options' => $validated['poll_options'] ?? null,
            'poll_ends_at' => $validated['poll_ends_at'] ?? null,
            'cta_text' => $validated['cta_text'] ?? null,
            'cta_url' => $validated['cta_url'] ?? null,
            'scheduled_at' => $validated['scheduled_at'] ?? null,
        ]);

        $post->load(['author:id,name,username,avatar,verification_badge_status,verification_badge_expires_at', 'community:id,name,slug,logo_url']);

        return response()->json([
            'message' => 'Post published successfully.',
            'post' => $post,
        ], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $post = Post::findOrFail($id);
        $this->authorize('update', $post);

        $validated = $request->validate([
            'content' => ['sometimes', 'string', 'max:50000'],
            'media_urls' => ['nullable', 'array'],
            'media_urls.*' => ['string', 'url'],
            'link_url' => ['nullable', 'string', 'url'],
            'is_draft' => ['nullable', 'boolean'],
        ]);

        if (! $post->community?->share_links && (! empty($validated['link_url']) || str_contains($validated['content'] ?? $post->content, 'http'))) {
            abort(403, 'Link sharing is disabled in this community.');
        }

        $post->update($validated);

        $post->load(['author:id,name,username,avatar,verification_badge_status,verification_badge_expires_at', 'community:id,name,slug,logo_url', 'reactions']);

        return response()->json([
            'message' => 'Post updated.',
            'post' => $post,
        ]);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $post = Post::withTrashed()->findOrFail($id);
        $this->authorize('delete', $post);

        if ($post->trashed()) {
            $post->reactions()->delete();
            $post->comments()->forceDelete();
            $post->forceDelete();
        } else {
            $post->delete();
        }

        return response()->json(['message' => 'Post deleted.']);
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
        $comment->load('author:id,name,username,avatar,verification_badge_status,verification_badge_expires_at');

        return response()->json([
            'message' => 'Comment added.',
            'comment' => $comment,
        ], 201);
    }

    public function pin(Request $request, int $id): JsonResponse
    {
        $post = Post::findOrFail($id);
        $this->authorizePin($request->user(), $post);

        $post->update([
            'is_pinned' => true,
            'pinned_at' => now(),
        ]);

        return response()->json([
            'message' => 'Post pinned.',
            'post' => $post->fresh()->load(['author:id,name,username,avatar,verification_badge_status,verification_badge_expires_at', 'community:id,name,slug,logo_url']),
        ]);
    }

    public function unpin(Request $request, int $id): JsonResponse
    {
        $post = Post::findOrFail($id);
        $this->authorizePin($request->user(), $post);

        $post->update([
            'is_pinned' => false,
            'pinned_at' => null,
        ]);

        return response()->json([
            'message' => 'Post unpinned.',
            'post' => $post->fresh()->load(['author:id,name,username,avatar,verification_badge_status,verification_badge_expires_at', 'community:id,name,slug,logo_url']),
        ]);
    }

    private function authorizePin(User $user, Post $post): void
    {
        if ($user->id === $post->user_id) {
            return;
        }

        $isCommunityModerator = $post->community_id !== null
            && CommunityMembership::where('community_id', $post->community_id)
                ->where('user_id', $user->id)
                ->whereIn('role', ['owner', 'admin', 'moderator'])
                ->exists();

        if (! $isCommunityModerator) {
            abort(403, 'You do not have permission to pin posts in this community.');
        }
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

    /**
     * Get comments for a post.
     */
    public function getComments(Request $request, int $postId): JsonResponse
    {
        $post = Post::findOrFail($postId);
        $comments = PostComment::with('author:id,name,username,avatar,verification_badge_status,verification_badge_expires_at')
            ->where('post_id', $post->id)
            ->latest()
            ->paginate(20);

        return response()->json($comments);
    }

    /**
     * Share a post.
     */
    public function share(Request $request, int $postId): JsonResponse
    {
        $post = Post::findOrFail($postId);
        $post->increment('shares_count');

        return response()->json([
            'message' => 'Post shared successfully.',
            'shares_count' => $post->fresh()->shares_count,
        ]);
    }

    /**
     * Toggle save a post.
     */
    public function toggleSave(Request $request, int $postId): JsonResponse
    {
        $user = $request->user();
        $post = Post::findOrFail($postId);

        $existing = SavedPost::where('user_id', $user->id)
            ->where('post_id', $post->id)
            ->first();

        if ($existing) {
            $existing->delete();
            $post->decrement('saves_count');
            return response()->json(['saved' => false, 'saves_count' => max(0, $post->fresh()->saves_count)]);
        }

        SavedPost::create(['user_id' => $user->id, 'post_id' => $post->id]);
        $post->increment('saves_count');
        return response()->json(['saved' => true, 'saves_count' => $post->fresh()->saves_count]);
    }

    /**
     * Report a post.
     */
    public function report(Request $request, int $postId): JsonResponse
    {
        $validated = $request->validate([
            'reason' => ['required', Rule::in(PostReport::REASONS)],
            'description' => ['nullable', 'string', 'max:2000'],
        ]);

        $post = Post::findOrFail($postId);
        $user = $request->user();

        $exists = PostReport::where('post_id', $post->id)
            ->where('user_id', $user->id)
            ->exists();

        if ($exists) {
            return response()->json(['message' => 'You have already reported this post.'], 409);
        }

        PostReport::create([
            'post_id' => $post->id,
            'user_id' => $user->id,
            'reason' => $validated['reason'],
            'description' => $validated['description'] ?? null,
        ]);

        return response()->json(['message' => 'Post reported. Thank you for helping keep the community safe.'], 201);
    }
}
