<?php

namespace App\Http\Controllers\V1;

use Illuminate\Routing\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use App\Models\DeveloperApp;
use Illuminate\Support\Str;

/**
 * Phase 5: Developer Applications Management.
 *
 * GET /v1/developer/apps                    — list developer apps owned by authenticated user
 * POST /v1/developer/apps                   — register a new developer application
 * GET /v1/developer/apps/{id}               — get app details
 * PUT /v1/developer/apps/{id}               — update app configuration
 * DELETE /v1/developer/apps/{id}            — revoke/delete developer app
 * POST /v1/developer/apps/{id}/rotate-secret — generate a new client_secret
 */
class DeveloperAppController extends Controller
{
    /** GET /v1/developer/apps */
    public function index(Request $request): JsonResponse
    {
        $userId = $request->attributes->get('graph_user_id');

        $apps = DeveloperApp::where('user_id', $userId)
            ->withCount('webhooks')
            ->get();

        return response()->json([
            'data' => $apps->map(fn ($app) => $this->formatApp($app)),
            'meta' => [],
        ]);
    }

    /** POST /v1/developer/apps */
    public function store(Request $request): JsonResponse
    {
        $userId = $request->attributes->get('graph_user_id');

        $validated = $request->validate([
            'name'           => ['required', 'string', 'max:255'],
            'description'    => ['nullable', 'string', 'max:1000'],
            'redirect_uris'  => ['nullable', 'array'],
            'redirect_uris.*'=> ['url'],
            'allowed_scopes' => ['nullable', 'array'],
        ]);

        $app = DeveloperApp::create([
            'name'           => $validated['name'],
            'description'    => $validated['description'] ?? null,
            'redirect_uris'  => $validated['redirect_uris'] ?? [],
            'allowed_scopes' => $validated['allowed_scopes'] ?? ['profile.read'],
            'user_id'        => (string) $userId,
            'status'         => 'active',
        ]);

        return response()->json([
            'data'    => $this->formatApp($app, true),
            'message' => 'Developer application created successfully.',
        ], 201);
    }

    /** GET /v1/developer/apps/{id} */
    public function show(Request $request, string $id): JsonResponse
    {
        $userId = $request->attributes->get('graph_user_id');

        $app = DeveloperApp::where('user_id', $userId)
            ->where(fn ($q) => $q->where('id', $id)->orWhere('app_id', $id))
            ->firstOrFail();

        return response()->json([
            'data' => $this->formatApp($app),
            'meta' => [],
        ]);
    }

    /** PUT /v1/developer/apps/{id} */
    public function update(Request $request, string $id): JsonResponse
    {
        $userId = $request->attributes->get('graph_user_id');

        $app = DeveloperApp::where('user_id', $userId)
            ->where(fn ($q) => $q->where('id', $id)->orWhere('app_id', $id))
            ->firstOrFail();

        $validated = $request->validate([
            'name'           => ['sometimes', 'string', 'max:255'],
            'description'    => ['nullable', 'string', 'max:1000'],
            'redirect_uris'  => ['nullable', 'array'],
            'allowed_scopes' => ['nullable', 'array'],
            'status'         => ['sometimes', 'in:active,suspended,deprecated'],
        ]);

        $app->update(array_filter($validated, fn ($v) => $v !== null));

        return response()->json([
            'data'    => $this->formatApp($app),
            'message' => 'Developer application updated.',
        ]);
    }

    /** DELETE /v1/developer/apps/{id} */
    public function destroy(Request $request, string $id): JsonResponse
    {
        $userId = $request->attributes->get('graph_user_id');

        $app = DeveloperApp::where('user_id', $userId)
            ->where(fn ($q) => $q->where('id', $id)->orWhere('app_id', $id))
            ->firstOrFail();

        $app->delete();

        return response()->json(null, 204);
    }

    /** POST /v1/developer/apps/{id}/rotate-secret */
    public function rotateSecret(Request $request, string $id): JsonResponse
    {
        $userId = $request->attributes->get('graph_user_id');

        $app = DeveloperApp::where('user_id', $userId)
            ->where(fn ($q) => $q->where('id', $id)->orWhere('app_id', $id))
            ->firstOrFail();

        $newSecret = 'sec_' . Str::random(32);
        $app->update(['client_secret' => $newSecret]);

        return response()->json([
            'data' => [
                'app_id'        => $app->app_id,
                'client_id'     => $app->client_id,
                'client_secret' => $newSecret,
            ],
            'message' => 'Client secret rotated. Store this new secret securely.',
        ]);
    }

    private function formatApp(DeveloperApp $app, bool $includeSecret = false): array
    {
        $res = [
            'id'             => $app->app_id,
            'type'           => 'developer_app',
            'name'           => $app->name,
            'description'    => $app->description,
            'client_id'      => $app->client_id,
            'redirect_uris'  => $app->redirect_uris,
            'allowed_scopes' => $app->allowed_scopes,
            'status'         => $app->status,
            'created_at'     => $app->created_at?->toIso8601String(),
        ];

        if ($includeSecret) {
            $res['client_secret'] = $app->client_secret;
        }

        return $res;
    }
}
