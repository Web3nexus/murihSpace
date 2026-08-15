<?php

namespace App\Http\Controllers\V1;

use Illuminate\Routing\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use App\Services\MainApiClient;
use App\Support\ResponseNormaliser;

/**
 * GET /v1/users/{id}
 */
class UserController extends Controller
{
    public function __construct(private readonly MainApiClient $mainApi) {}

    public function show(Request $request, string $id): JsonResponse
    {
        $token = $this->token($request);
        $data  = $this->mainApi->getUser($id, $token);

        return response()->json([
            'data' => ResponseNormaliser::user($data['data'] ?? $data),
            'meta' => [],
        ]);
    }

    private function token(Request $request): string
    {
        return ltrim(str_replace('Bearer', '', $request->header('Authorization', '')));
    }
}
