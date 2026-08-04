<?php

namespace App\Http\Controllers;

use App\Services\AuthMethodConfigService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class AdminAuthMethodController extends Controller
{
    public function show(AuthMethodConfigService $methods): JsonResponse
    {
        return response()->json([
            'data' => $methods->all(),
        ]);
    }

    public function update(Request $request, AuthMethodConfigService $methods): JsonResponse
    {
        $validated = $request->validate([
            'primary' => ['required', 'string', Rule::in(AuthMethodConfigService::METHODS)],
            'methods' => ['required', 'array'],
            'methods.*.login' => ['sometimes', 'boolean'],
            'methods.*.registration' => ['sometimes', 'boolean'],
            'methods.*.display_order' => ['sometimes', 'integer', 'min:1'],
        ]);

        $config = $methods->update($validated, $request->user());

        return response()->json([
            'message' => 'Authentication methods updated.',
            'data' => $config,
        ]);
    }
}
