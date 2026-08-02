<?php

namespace App\Http\Controllers;

use App\Services\AiService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AiChatController extends Controller
{
    public function __construct(
        private readonly AiService $ai,
    ) {
    }

    public function chat(Request $request): JsonResponse
    {
        $user = $request->user();

        if (! $user->hasVerifiedEmail()) {
            return response()->json([
                'message' => 'Please verify your email address before using Mera.',
                'error' => 'EMAIL_NOT_VERIFIED',
            ], 403);
        }

        $validated = $request->validate([
            'message' => ['required', 'string', 'max:5000'],
        ]);

        $reply = $this->ai->chat($user, $validated['message'], AiService::SOURCE_ASSISTANT);

        return response()->json(['data' => ['reply' => $reply]]);
    }
}
