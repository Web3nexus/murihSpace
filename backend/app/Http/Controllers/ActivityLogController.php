<?php

namespace App\Http\Controllers;

use App\Models\ActivityLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ActivityLogController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $logs = ActivityLog::where('user_id', $request->user()->id)
            ->orderBy('created_at', 'desc')
            ->paginate($request->integer('per_page', 25));

        return response()->json(['data' => $logs]);
    }

    public function latest(Request $request): JsonResponse
    {
        $logs = ActivityLog::where('user_id', $request->user()->id)
            ->orderBy('created_at', 'desc')
            ->limit(10)
            ->get();

        return response()->json(['data' => $logs]);
    }

    public function types(): JsonResponse
    {
        return response()->json(['data' => [
            'post.created',
            'post.published',
            'community.joined',
            'purchase.completed',
            'withdrawal.requested',
            'donation.sent',
            'event.registered',
            'subscription.started',
        ]]);
    }
}
