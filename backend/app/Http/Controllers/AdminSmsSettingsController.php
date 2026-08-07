<?php

namespace App\Http\Controllers;

use App\Services\SmsEngineService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class AdminSmsSettingsController extends Controller
{
    public function __construct(
        private readonly SmsEngineService $engine,
    ) {}

    public function show(): JsonResponse
    {
        return response()->json([
            'data' => [
                'transport' => $this->engine->selected(),
                'default_transport' => config('services.sms.driver', 'log'),
                'config' => $this->engine->metadata(),
            ],
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'transport' => ['sometimes', 'string', Rule::in($this->engine->transports())],
            'account_sid' => ['sometimes', 'nullable', 'string', 'max:191'],
            'from_number' => ['sometimes', 'nullable', 'string', 'max:32'],
            'auth_token' => ['sometimes', 'nullable', 'string'],
        ]);

        $this->engine->update($validated);

        return response()->json([
            'message' => 'SMS engine configuration updated.',
            'data' => [
                'transport' => $this->engine->selected(),
                'config' => $this->engine->metadata(),
            ],
        ]);
    }

    public function test(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'to' => ['required', 'string', 'max:32'],
        ]);

        $this->engine->apply();

        try {
            $this->engine->send(
                $validated['to'],
                'This is a test message from MurihSpace to confirm your SMS engine is configured correctly.'
            );

            return response()->json([
                'message' => 'Test SMS sent to ' . $validated['to'] . '.',
                'data' => [
                    'transport' => $this->engine->selected(),
                    'from_number' => config('services.sms.from_number'),
                ],
            ]);
        } catch (\Throwable $e) {
            report($e);

            return response()->json([
                'message' => 'Failed to send test SMS: ' . $e->getMessage(),
            ], 500);
        }
    }
}