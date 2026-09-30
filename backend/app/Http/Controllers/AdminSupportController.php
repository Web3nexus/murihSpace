<?php

namespace App\Http\Controllers;

use App\Models\SupportThread;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Administration view of member support threads.
 *
 * The `support` permission has existed in the matrix since roles were split
 * out, and it owns a navigation section, but no route was gated by it — so a
 * Support Admin was shown a Support area that had nothing behind it, and the
 * one workflow §20 names explicitly had no administration surface at all.
 *
 * Scoped deliberately: read the queue, read a thread, reply, and change status.
 * No bulk actions, no deletion. A support record is the evidence of what a
 * member was told, which is exactly the thing that must not be erasable from a
 * phone.
 */
class AdminSupportController extends Controller
{
    /**
     * GET /api/v1/securegate/support/threads
     */
    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'status' => ['sometimes', 'string', 'in:open,closed,resolved,all'],
            'search' => ['sometimes', 'string', 'max:100'],
        ]);

        $query = SupportThread::query()
            ->with('user:id,name,username,email,avatar,avatar_url')
            ->with('lastMessage')
            ->withCount('messages');

        $status = $request->query('status', 'open');
        if ($status !== 'all') {
            $query->where('status', $status);
        }

        if ($search = trim((string) $request->query('search', ''))) {
            $query->where(function ($q) use ($search) {
                $q->where('subject', 'like', "%{$search}%")
                    ->orWhereHas('user', function ($q) use ($search) {
                        $q->where('name', 'like', "%{$search}%")
                            ->orWhere('email', 'like', "%{$search}%")
                            ->orWhere('username', 'like', "%{$search}%");
                    });
            });
        }

        $threads = $query->latest()->paginate(25);

        return response()->json($threads);
    }

    /**
     * GET /api/v1/securegate/support/threads/{thread}
     */
    public function show(SupportThread $thread): JsonResponse
    {
        $thread->load('user:id,name,username,email,avatar,avatar_url')
            ->load(['messages' => fn ($q) => $q->with('user:id,name,username')->oldest()]);

        return response()->json(['thread' => $thread]);
    }

    /**
     * POST /api/v1/securegate/support/threads/{thread}/reply
     */
    public function reply(Request $request, SupportThread $thread): JsonResponse
    {
        if (! config('services.legacy_support_threads.enabled')) {
            return response()->json([
                'message' => 'Legacy support threads are disabled. Please use a ticket instead.',
                'code' => 'SUPPORT_THREADS_DISABLED',
            ], 410);
        }

        $validated = $request->validate([
            'content' => ['required', 'string', 'max:10000'],
        ]);

        $message = $thread->messages()->create([
            'user_id' => $request->user()->id,
            'content' => $validated['content'],
            'from_admin' => true,
        ]);

        // Replying to a resolved thread reopens it: the member has an open
        // question again, and leaving it resolved would hide that from anyone
        // filtering the queue by status.
        if ($thread->status !== 'open') {
            $thread->update(['status' => 'open']);
        }

        return response()->json([
            'message' => $message->load('user:id,name,username'),
            'thread_status' => $thread->fresh()->status,
        ], 201);
    }

    /**
     * PATCH /api/v1/securegate/support/threads/{thread}
     */
    public function update(Request $request, SupportThread $thread): JsonResponse
    {
        $validated = $request->validate([
            'status' => ['required', 'string', 'in:open,closed,resolved'],
        ]);

        $thread->update(['status' => $validated['status']]);

        return response()->json([
            'thread' => $thread->fresh()->load('user:id,name,username,email'),
            'message' => "Thread #{$thread->id} marked {$validated['status']}.",
        ]);
    }

    /**
     * Counts for the queue header, so an operator can see the split without
     * paging through every thread.
     */
    public function counts(): JsonResponse
    {
        return response()->json([
            'open' => SupportThread::where('status', 'open')->count(),
            'resolved' => SupportThread::where('status', 'resolved')->count(),
            'closed' => SupportThread::where('status', 'closed')->count(),
            'all' => SupportThread::count(),
        ]);
    }
}
