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
        $validated = $request->validate([
            'message' => ['required', 'string', 'max:5000'],
        ]);

        $reply = $this->ai->chat($request->user(), $validated['message'], AiService::SOURCE_ASSISTANT);

        return response()->json(['data' => ['reply' => $reply]]);
    }
}
