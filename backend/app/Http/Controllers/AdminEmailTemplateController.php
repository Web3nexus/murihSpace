<?php

namespace App\Http\Controllers;

use App\Mail\EmailTemplateDefaults;
use App\Models\EmailTemplate;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminEmailTemplateController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json([
            'data' => EmailTemplate::orderBy('key')->get(),
        ]);
    }

    public function show(string $key): JsonResponse
    {
        $template = EmailTemplate::where('key', $key)->firstOrFail();

        return response()->json(['data' => $template]);
    }

    public function update(Request $request, string $key): JsonResponse
    {
        $template = EmailTemplate::where('key', $key)->firstOrFail();

        $validated = $request->validate([
            'name' => ['sometimes', 'nullable', 'string', 'max:191'],
            'description' => ['sometimes', 'nullable', 'string', 'max:500'],
            'subject' => ['sometimes', 'nullable', 'string', 'max:191'],
            'body_html' => ['sometimes', 'nullable', 'string'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $template->update($validated);

        return response()->json([
            'message' => 'Email template updated.',
            'data' => $template->fresh(),
        ]);
    }

    public function reset(string $key): JsonResponse
    {
        $defaults = EmailTemplateDefaults::get($key);

        if ($defaults === null) {
            return response()->json(['message' => 'No default template available for this key.'], 404);
        }

        $template = EmailTemplate::where('key', $key)->firstOrFail();
        $template->update($defaults);

        return response()->json([
            'message' => 'Email template reset to default.',
            'data' => $template->fresh(),
        ]);
    }
}
