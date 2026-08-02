<?php

namespace App\Http\Controllers;

use App\Services\OAuthProviderService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class AdminSocialLoginController extends Controller
{
    public function __construct(
        private readonly OAuthProviderService $oauth,
    ) {}

    public function show(): JsonResponse
    {
        return response()->json([
            'data' => [
                'providers' => $this->oauth->metadata(),
            ],
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'providers' => ['required', 'array'],
            'providers.*' => ['array'],
            'providers.*.client_id' => ['sometimes', 'nullable', 'string', 'max:255'],
            'providers.*.client_secret' => ['sometimes', 'nullable', 'string', 'max:2048'],
            'providers.*.redirect' => ['sometimes', 'nullable', 'url'],
            'providers.*.team_id' => ['sometimes', 'nullable', 'string', 'max:255'],
            'providers.*.key_id' => ['sometimes', 'nullable', 'string', 'max:255'],
            'providers.*.private_key' => ['sometimes', 'nullable', 'string'],
        ]);

        foreach (OAuthProviderService::PROVIDERS as $provider) {
            if (! isset($validated['providers'][$provider])) {
                continue;
            }

            $data = $validated['providers'][$provider];

            // Only update fields the admin actually submitted.
            $keys = array_intersect(
                ['client_id', 'client_secret', 'redirect', 'team_id', 'key_id', 'private_key'],
                array_keys($data)
            );

            $this->oauth->configure($provider, array_intersect_key($data, array_flip($keys)));
        }

        return response()->json([
            'message' => 'Social login settings updated.',
            'data' => [
                'providers' => $this->oauth->metadata(),
            ],
        ]);
    }
}
