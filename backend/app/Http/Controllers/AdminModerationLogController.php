<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminModerationLogController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $logs = AuditLog::where('action', 'like', 'moderation_%')
            ->orWhereIn('action', ['report_resolved', 'report_dismissed', 'content_hidden', 'user_suspended'])
            ->with('user:id,name,username')
            ->latest()
            ->paginate(50);

        return response()->json(['data' => $logs]);
    }
}
