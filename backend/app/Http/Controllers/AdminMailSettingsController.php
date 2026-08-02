<?php

namespace App\Http\Controllers;

use App\Services\MailEngineService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Mail\Message;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\Rule;

class AdminMailSettingsController extends Controller
{
    public function __construct(
        private readonly MailEngineService $engine,
    ) {}

    public function show(): JsonResponse
    {
        return response()->json([
            'data' => [
                'transport' => $this->engine->selected(),
                'default_transport' => config('mail.default', 'log'),
                'config' => $this->engine->metadata(),
            ],
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'transport' => ['sometimes', 'string', Rule::in($this->engine->transports())],
            'from_address' => ['sometimes', 'nullable', 'string', 'email', 'max:191'],
            'from_name' => ['sometimes', 'nullable', 'string', 'max:191'],
            'smtp_host' => ['sometimes', 'nullable', 'string', 'max:191'],
            'smtp_port' => ['sometimes', 'nullable', 'integer', 'between:1,65535'],
            'smtp_scheme' => ['sometimes', 'nullable', 'string', 'max:10'],
            'smtp_encryption' => ['sometimes', 'nullable', 'string', Rule::in(['', 'tls', 'ssl'])],
            'smtp_username' => ['sometimes', 'nullable', 'string', 'max:191'],
            'smtp_password' => ['sometimes', 'nullable', 'string'],
            'postmark_key' => ['sometimes', 'nullable', 'string'],
            'resend_key' => ['sometimes', 'nullable', 'string'],
            'sendmail_path' => ['sometimes', 'nullable', 'string', 'max:255'],
        ]);

        $this->engine->update($validated);

        return response()->json([
            'message' => 'Mail engine configuration updated.',
            'data' => [
                'transport' => $this->engine->selected(),
                'config' => $this->engine->metadata(),
            ],
        ]);
    }

    public function test(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'to' => ['required', 'string', 'email'],
        ]);

        $this->engine->apply();

        try {
            Mail::raw(
                'This is a test message from MurihSpace to confirm your mail engine is configured correctly.',
                function (Message $message) use ($validated) {
                    $message->to($validated['to'])
                        ->subject('MurihSpace mail engine test');
                }
            );

            return response()->json([
                'message' => 'Test email sent. Check the inbox of ' . $validated['to'] . '.',
                'data' => [
                    'transport' => $this->engine->selected(),
                    'from_address' => config('mail.from.address'),
                ],
            ]);
        } catch (\Throwable $e) {
            report($e);

            return response()->json([
                'message' => 'Failed to send test email: ' . $e->getMessage(),
            ], 500);
        }
    }
}
