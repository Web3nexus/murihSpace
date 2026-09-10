<?php

namespace App\Http\Controllers;

use App\Models\Group;
use App\Models\Post;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class GroupPostController extends Controller
{
    /**
     * List posts in a group feed.
     */
    public function index(Request $request, Group $group): JsonResponse
    {
        $userId = $request->user()?->id;

        // Privacy check
        if ($group->privacy !== 'public' && !$group->isMember($userId)) {
            return response()->json([
                'error' => 'This group is private. Join the group to view its feed.',
                'is_private' => true,
            ], 403);
        }

        $posts = Post::where('group_id', $group->id)
            ->where('is_draft', false)
            ->with([
                'author:id,name,username,avatar',
                'reactions',
                'pollVotes' => function ($q) use ($userId) {
                    if ($userId) {
                        $q->where('user_id', $userId);
                    }
                },
            ])
            ->orderBy('is_pinned', 'desc')
            ->orderBy('pinned_at', 'desc')
            ->latest('created_at')
            ->paginate(15);

        // Attach user reaction & poll vote state
        if ($userId) {
            $posts->getCollection()->transform(function ($post) use ($userId) {
                $userReaction = $post->reactions->firstWhere('user_id', $userId);
                $post->user_reaction = $userReaction ? $userReaction->reaction_type : null;
                $userVote = $post->pollVotes->firstWhere('user_id', $userId);
                $post->user_poll_vote = $userVote ? $userVote->option_index : null;
                return $post;
            });
        }

        return response()->json([
            'success' => true,
            'data' => $posts,
            'posts' => $posts->items(),
        ]);
    }

    /**
     * Create a post inside a group.
     */
    public function store(Request $request, Group $group): JsonResponse
    {
        $user = $request->user();

        if (!$group->canPost($user->id)) {
            return response()->json([
                'error' => 'You do not have permission to post in this group.',
            ], 403);
        }

        $validated = $request->validate([
            'content' => 'required|string|max:10000',
            'type' => 'nullable|in:post,poll,announcement,media',
            'media_url' => 'nullable|url|max:500',
            'media_urls' => 'nullable|array',
            'link_url' => 'nullable|url|max:500',
            'poll_question' => 'nullable|string|max:255',
            'poll_options' => 'nullable|array|min:2|max:10',
            'poll_ends_at' => 'nullable|date|after:now',
        ]);

        $mediaUrls = $validated['media_urls'] ?? [];
        if (!empty($validated['media_url']) && !in_array($validated['media_url'], $mediaUrls, true)) {
            $mediaUrls[] = $validated['media_url'];
        }

        $post = DB::transaction(function () use ($group, $user, $validated, $mediaUrls) {
            $post = Post::create([
                'group_id' => $group->id,
                'user_id' => $user->id,
                'type' => $validated['type'] ?? (!empty($mediaUrls) ? 'media' : 'post'),
                'content' => $validated['content'],
                'media_urls' => !empty($mediaUrls) ? $mediaUrls : null,
                'link_url' => $validated['link_url'] ?? null,
                'poll_question' => $validated['poll_question'] ?? null,
                'poll_options' => $validated['poll_options'] ?? null,
                'poll_ends_at' => $validated['poll_ends_at'] ?? null,
                'is_draft' => false,
                'likes_count' => 0,
                'comments_count' => 0,
            ]);

            $group->increment('posts_count');

            return $post;
        });

        return response()->json([
            'success' => true,
            'message' => 'Post published to group feed.',
            'data' => $post->load('author:id,name,username,avatar'),
        ], 201);
    }

    /**
     * Toggle pinned state on a group post (Admin/Mod only).
     */
    public function togglePin(Request $request, Group $group, int $postId): JsonResponse
    {
        $userId = $request->user()->id;
        if (!$group->isModeratorOrAbove($userId)) {
            return response()->json(['error' => 'Unauthorized. Moderator privileges required.'], 403);
        }

        $post = Post::where('group_id', $group->id)->findOrFail($postId);
        $newPinned = !$post->is_pinned;

        $post->update([
            'is_pinned' => $newPinned,
            'pinned_at' => $newPinned ? now() : null,
        ]);

        return response()->json([
            'success' => true,
            'message' => $newPinned ? 'Post pinned to top of feed.' : 'Post unpinned.',
            'is_pinned' => $newPinned,
        ]);
    }

    /**
     * Delete a post from the group.
     */
    public function destroy(Request $request, Group $group, int $postId): JsonResponse
    {
        $userId = $request->user()->id;
        $post = Post::where('group_id', $group->id)->findOrFail($postId);

        $isAuthor = (int)$post->user_id === (int)$userId;
        $isMod = $group->isModeratorOrAbove($userId);

        if (!$isAuthor && !$isMod) {
            return response()->json(['error' => 'Unauthorized to delete this post.'], 403);
        }

        DB::transaction(function () use ($group, $post) {
            $post->delete();
            $group->decrement('posts_count');
        });

        return response()->json([
            'success' => true,
            'message' => 'Post deleted successfully.',
        ]);
    }
}
