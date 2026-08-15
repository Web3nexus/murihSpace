<?php

namespace App\Http\Controllers\V1;

use Illuminate\Routing\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Phase 5: OpenAPI 3.0 Documentation & SDK Specification.
 *
 * GET /v1/openapi.json  — complete OpenAPI 3.0 specification for MurihSpace Graph API
 * GET /v1/sdks          — SDK integration guides and SDK client templates
 */
class OpenApiController extends Controller
{
    /** GET /v1/openapi.json */
    public function index(Request $request): JsonResponse
    {
        $spec = [
            'openapi' => '3.0.3',
            'info' => [
                'title'       => 'MurihSpace Graph API',
                'version'     => '1.0.0',
                'description' => 'Unified REST + JSON Graph API platform for MurihSpace ecosystem (Social, Marketplace, Ads, Marketing & Support).',
                'contact'     => [
                    'name'  => 'MurihSpace Developer Support',
                    'email' => 'developers@murihspace.com',
                    'url'   => 'https://graph.murihspace.com',
                ],
            ],
            'servers' => [
                ['url' => 'https://graph.murihspace.com/v1', 'description' => 'Production Graph API'],
                ['url' => 'http://localhost:8090/v1',       'description' => 'Local Development'],
            ],
            'security' => [
                ['BearerAuth' => []],
            ],
            'paths' => [
                '/health' => [
                    'get' => [
                        'summary' => 'System health status',
                        'tags' => ['Health'],
                        'responses' => ['200' => ['description' => 'Healthy'], '207' => ['description' => 'Degraded']],
                    ],
                ],
                '/me' => [
                    'get' => [
                        'summary' => 'Get current authenticated identity',
                        'tags' => ['Me'],
                        'responses' => ['200' => ['description' => 'Authenticated user object']],
                    ],
                ],
                '/me/posts' => [
                    'get' => [
                        'summary' => 'Get posts by authenticated user',
                        'tags' => ['Me'],
                        'responses' => ['200' => ['description' => 'Collection of posts']],
                    ],
                ],
                '/me/followers' => [
                    'get' => [
                        'summary' => 'Get followers of authenticated user',
                        'tags' => ['Me'],
                        'responses' => ['200' => ['description' => 'Collection of followers']],
                    ],
                ],
                '/me/following' => [
                    'get' => [
                        'summary' => 'Get users followed by authenticated user',
                        'tags' => ['Me'],
                        'responses' => ['200' => ['description' => 'Collection of followed users']],
                    ],
                ],
                '/me/businesses' => [
                    'get' => [
                        'summary' => 'Get storefronts/businesses owned by authenticated user',
                        'tags' => ['Me'],
                        'responses' => ['200' => ['description' => 'Collection of businesses']],
                    ],
                ],
                '/me/products' => [
                    'get' => [
                        'summary' => 'Get products listed by authenticated user',
                        'tags' => ['Me'],
                        'responses' => ['200' => ['description' => 'Collection of products']],
                    ],
                ],
                '/me/ad-accounts' => [
                    'get' => [
                        'summary' => 'Get ad accounts assigned to authenticated user',
                        'tags' => ['Me'],
                        'responses' => ['200' => ['description' => 'Collection of ad accounts']],
                    ],
                ],
                '/me/tickets' => [
                    'get' => [
                        'summary' => 'Get support tickets submitted by authenticated user',
                        'tags' => ['Me'],
                        'responses' => ['200' => ['description' => 'Collection of tickets']],
                    ],
                ],
                '/users/{id}' => [
                    'get' => [
                        'summary' => 'Get public user profile',
                        'tags' => ['Users'],
                        'parameters' => [['name' => 'id', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'string']]],
                        'responses' => ['200' => ['description' => 'User object']],
                    ],
                ],
                '/users/{id}/posts' => [
                    'get' => [
                        'summary' => 'Get posts by specific user',
                        'tags' => ['Users'],
                        'parameters' => [['name' => 'id', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'string']]],
                        'responses' => ['200' => ['description' => 'Collection of posts']],
                    ],
                ],
                '/posts/{id}' => [
                    'get' => [
                        'summary' => 'Get post by ID',
                        'tags' => ['Posts'],
                        'parameters' => [['name' => 'id', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'string']]],
                        'responses' => ['200' => ['description' => 'Post object']],
                    ],
                ],
                '/posts/{id}/comments' => [
                    'get' => [
                        'summary' => 'Get comments for a post',
                        'tags' => ['Posts'],
                        'parameters' => [['name' => 'id', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'string']]],
                        'responses' => ['200' => ['description' => 'Collection of comments']],
                    ],
                ],
                '/businesses/{id}' => [
                    'get' => [
                        'summary' => 'Get business/storefront by ID',
                        'tags' => ['Businesses'],
                        'parameters' => [['name' => 'id', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'string']]],
                        'responses' => ['200' => ['description' => 'Business object']],
                    ],
                ],
                '/products/{id}' => [
                    'get' => [
                        'summary' => 'Get product by ID',
                        'tags' => ['Products'],
                        'parameters' => [['name' => 'id', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'string']]],
                        'responses' => ['200' => ['description' => 'Product object']],
                    ],
                ],
                '/ad-accounts' => [
                    'get' => [
                        'summary' => 'List ad accounts',
                        'tags' => ['Ads'],
                        'responses' => ['200' => ['description' => 'Collection of ad accounts']],
                    ],
                ],
                '/ad-accounts/{id}/campaigns' => [
                    'get' => [
                        'summary' => 'List campaigns in an ad account',
                        'tags' => ['Ads'],
                        'parameters' => [['name' => 'id', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'string']]],
                        'responses' => ['200' => ['description' => 'Collection of campaigns']],
                    ],
                ],
                '/campaigns/{id}' => [
                    'get' => [
                        'summary' => 'Get ad campaign',
                        'tags' => ['Ads'],
                        'parameters' => [['name' => 'id', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'string']]],
                        'responses' => ['200' => ['description' => 'Campaign object']],
                    ],
                ],
                '/tickets' => [
                    'get' => [
                        'summary' => 'List support tickets',
                        'tags' => ['Support'],
                        'responses' => ['200' => ['description' => 'Collection of tickets']],
                    ],
                    'post' => [
                        'summary' => 'Submit a support ticket',
                        'tags' => ['Support'],
                        'responses' => ['201' => ['description' => 'Ticket created']],
                    ],
                ],
                '/developer/apps' => [
                    'get' => [
                        'summary' => 'List developer applications',
                        'tags' => ['Developer'],
                        'responses' => ['200' => ['description' => 'Collection of developer apps']],
                    ],
                    'post' => [
                        'summary' => 'Create a developer application',
                        'tags' => ['Developer'],
                        'responses' => ['201' => ['description' => 'Developer app created']],
                    ],
                ],
                '/oauth/token' => [
                    'post' => [
                        'summary' => 'Issue OAuth 2.0 access token',
                        'tags' => ['OAuth'],
                        'responses' => ['200' => ['description' => 'OAuth token issued']],
                    ],
                ],
                '/webhooks' => [
                    'get' => [
                        'summary' => 'List active webhook subscriptions',
                        'tags' => ['Webhooks'],
                        'responses' => ['200' => ['description' => 'Collection of webhooks']],
                    ],
                    'post' => [
                        'summary' => 'Subscribe to webhook events',
                        'tags' => ['Webhooks'],
                        'responses' => ['201' => ['description' => 'Webhook subscribed']],
                    ],
                ],
            ],
            'components' => [
                'securitySchemes' => [
                    'BearerAuth' => [
                        'type'         => 'http',
                        'scheme'       => 'bearer',
                        'bearerFormat' => 'Sanctum / OAuth2',
                    ],
                ],
            ],
        ];

        return response()->json($spec);
    }

    /** GET /v1/sdks */
    public function sdks(): JsonResponse
    {
        return response()->json([
            'data' => [
                'javascript' => [
                    'package'  => '@murihspace/graph-sdk',
                    'install'  => 'npm install @murihspace/graph-sdk',
                    'snippet'  => "import { MurihGraph } from '@murihspace/graph-sdk';\nconst client = new MurihGraph({ accessToken: '...' });\nconst me = await client.me.get();",
                ],
                'php' => [
                    'package'  => 'murihspace/graph-sdk',
                    'install'  => 'composer require murihspace/graph-sdk',
                    'snippet'  => "\$client = new \\MurihSpace\\Graph\\Client(['access_token' => '...']);\n\$me = \$client->me()->get();",
                ],
                'python' => [
                    'package'  => 'murihspace-graph-sdk',
                    'install'  => 'pip install murihspace-graph-sdk',
                    'snippet'  => "from murihspace import GraphClient\nclient = GraphClient(access_token='...')\nme = client.me.get()",
                ],
                'openapi_spec' => url('/v1/openapi.json'),
            ],
        ]);
    }
}
