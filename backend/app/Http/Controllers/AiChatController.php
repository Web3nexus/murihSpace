<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AiChatController extends Controller
{
    public function chat(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'message' => ['required', 'string', 'max:5000'],
        ]);

        $message = $validated['message'];

        // Simple heuristic response — replace with actual AI integration
        $reply = $this->generateReply($message);

        return response()->json(['data' => ['reply' => $reply]]);
    }

    private function generateReply(string $message): string
    {
        $lower = strtolower($message);

        if (str_contains($lower, 'content') || str_contains($lower, 'post')) {
            return "I can help you create content! Try posting engaging visuals with strong captions. What type of content are you creating?";
        }

        if (str_contains($lower, 'community') || str_contains($lower, 'audience')) {
            return "Growing your community is all about consistent engagement. Reply to comments, host Q&As, and share exclusive content for your members.";
        }

        if (str_contains($lower, 'pricing') || str_contains($lower, 'price') || str_contains($lower, 'sell')) {
            return "Pricing depends on your niche and audience. Start by researching competitors, then test different price points to find what converts.";
        }

        if (str_contains($lower, 'analytics') || str_contains($lower, 'stats')) {
            return "Check your Analytics dashboard for detailed insights on revenue, engagement, and audience growth. Let me know if you need help interpreting any metric!";
        }

        return "That's a great question! I'd recommend checking your dashboard for the relevant tools, or I can point you to the right section. What specific area are you working on?";
    }
}
