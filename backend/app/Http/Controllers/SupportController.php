<?php

namespace App\Http\Controllers;

use App\Models\SupportThread;
use App\Models\SupportMessage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SupportController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $threads = SupportThread::where('user_id', $request->user()->id)
            ->withCount('messages')
            ->latest()->get();

        return response()->json(['data' => $threads]);
    }

    public function messages(Request $request, SupportThread $thread): JsonResponse
    {
        $messages = $thread->messages()->with('user')->oldest()->get();
        return response()->json(['data' => $messages]);
    }

    public function sendMessage(Request $request, SupportThread $thread): JsonResponse
    {
        $validated = $request->validate([
            'content' => ['required', 'string', 'max:10000'],
        ]);

        $message = $thread->messages()->create([
            'user_id' => $request->user()->id,
            'content' => $validated['content'],
            'from_admin' => $request->user()->role === 'admin',
        ]);

        return response()->json(['data' => $message->load('user')], 201);
    }
}
