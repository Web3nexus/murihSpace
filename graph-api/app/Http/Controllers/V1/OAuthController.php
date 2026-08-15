<?php

namespace App\Http\Controllers\V1;

use Illuminate\Routing\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use App\Models\DeveloperApp;
use Illuminate\Support\Str;

/**
 * Phase 5: OAuth 2.0 Token & Scope Management.
 *
 * GET /v1/oauth/scopes   — list available API scopes
 * POST /v1/oauth/token   — issue app access tokens via OAuth client credentials
 */
class OAuthController extends Controller
{
    public const AVAILABLE_SCOPES = [
        'profile.read'    => 'Read public user profile information',
        'posts.read'      => 'Read posts and post timeline',
        'posts.write'     => 'Create and publish posts',
        'comments.read'   => 'Read post comments and reactions',
        'comments.write'  => 'Create comments and toggle reactions',
        'followers.read'  => 'Read user followers and following lists',
        'messages.read'   => 'Read user direct messages',
        'messages.send'   => 'Send direct messages',
        'business.read'   => 'Read business profile and storefront details',
        'business.manage' => 'Manage business storefront settings and inventory',
        'products.read'   => 'Read store products and catalogue',
        'products.manage' => 'Create and edit store products',
        'orders.read'     => 'Read marketplace order details and history',
        'ads.read'        => 'Read ad accounts, campaigns, and ad performance',
        'ads.manage'      => 'Create and edit ad campaigns and creatives',
        'analytics.read'  => 'Access analytics reports and performance metrics',
        'support.read'    => 'Read help center and support tickets',
        'support.write'   => 'Submit support tickets and replies',
    ];

    /** GET /v1/oauth/scopes */
    public function scopes(): JsonResponse
    {
        $data = [];
        foreach (self::AVAILABLE_SCOPES as $scope => $description) {
            $data[] = [
                'scope'       => $scope,
                'description' => $description,
            ];
        }

        return response()->json([
            'data' => $data,
            'meta' => ['total_scopes' => count($data)],
        ]);
    }

    /** POST /v1/oauth/token */
    public function token(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'grant_type'    => ['required', 'string', 'in:client_credentials,authorization_code'],
            'client_id'     => ['required', 'string'],
            'client_secret' => ['required', 'string'],
            'scope'         => ['nullable', 'string'],
        ]);

        $app = DeveloperApp::where('client_id', $validated['client_id'])->first();

        if (!$app || !hash_equals($app->client_secret, $validated['client_secret'])) {
            return response()->json([
                'error' => [
                    'code'    => 'UNAUTHENTICATED',
                    'message' => 'Invalid client credentials.',
                ],
            ], 401);
        }

        if ($app->status !== 'active') {
            return response()->json([
                'error' => [
                    'code'    => 'FORBIDDEN',
                    'message' => 'Developer application is inactive or suspended.',
                ],
            ], 403);
        }

        // Validate requested scopes against application's allowed_scopes
        $requestedScopes = array_filter(explode(' ', $validated['scope'] ?? ''));
        $allowedScopes   = $app->allowed_scopes ?? ['profile.read'];

        if (!empty($requestedScopes)) {
            $invalid = array_diff($requestedScopes, $allowedScopes);
            if (!empty($invalid)) {
                return response()->json([
                    'error' => [
                        'code'    => 'VALIDATION_ERROR',
                        'message' => 'Requested scope(s) not allowed for this application: ' . implode(', ', $invalid),
                    ],
                ], 422);
            }
            $grantedScopes = $requestedScopes;
        } else {
            $grantedScopes = $allowedScopes;
        }

        // Issue token signed payload
        $token = 'app_token_' . Str::random(40);
        $expiresIn = 3600 * 24 * 30; // 30 days for app tokens

        return response()->json([
            'access_token' => $token,
            'token_type'   => 'Bearer',
            'expires_in'   => $expiresIn,
            'scope'        => implode(' ', $grantedScopes),
            'app_id'       => $app->app_id,
        ]);
    }
}
