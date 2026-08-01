<?php

namespace App\Http\Controllers;

use App\Models\Post;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ContentPlannerController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $scheduled = Post::where('user_id', $request->user()->id)
            ->whereNotNull('scheduled_at')
            ->where('scheduled_at', '>=', now())
            ->orderBy('scheduled_at')
            ->get()
            ->groupBy(fn (Post $post) => $post->scheduled_at->format('Y-m-d'));

        $published = Post::where('user_id', $request->user()->id)
            ->where('is_draft', false)
            ->whereNull('scheduled_at')
            ->orderBy('created_at', 'desc')
            ->limit(10)
            ->get();

        $drafts = Post::where('user_id', $request->user()->id)
            ->where('is_draft', true)
            ->whereNull('scheduled_at')
            ->orderBy('created_at', 'desc')
            ->limit(10)
            ->get();

        return response()->json([
            'data' => [
                'scheduled' => $scheduled,
                'published' => $published,
                'drafts' => $drafts,
            ],
        ]);
    }

    public function upcoming(Request $request): JsonResponse
    {
        $items = Post::where('user_id', $request->user()->id)
            ->whereNotNull('scheduled_at')
            ->where('scheduled_at', '>=', now())
            ->orderBy('scheduled_at')
            ->limit(20)
            ->get()
            ->map(fn (Post $post) => [
                'id' => $post->id,
                'title' => str($post->content)->limit(80),
                'type' => 'post',
                'status' => 'scheduled',
                'scheduled_at' => $post->scheduled_at,
                'day' => $post->scheduled_at->format('D'),
                'date' => $post->scheduled_at->format('M j'),
                'community' => $post->community?->name,
            ]);

        return response()->json(['data' => $items]);
    }

    public function schedule(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'post_id' => ['required', 'integer', 'exists:posts,id'],
            'scheduled_at' => ['required', 'date', 'after:now'],
        ]);

        $post = Post::where('user_id', $request->user()->id)
            ->findOrFail($validated['post_id']);

        $post->update([
            'scheduled_at' => $validated['scheduled_at'],
            'is_draft' => true,
        ]);

        return response()->json(['data' => $post]);
    }

    public function unschedule(Request $request, int $id): JsonResponse
    {
        $post = Post::where('user_id', $request->user()->id)
            ->findOrFail($id);

        $post->update(['scheduled_at' => null]);

        return response()->json(['message' => 'Post unscheduled.']);
    }
}
