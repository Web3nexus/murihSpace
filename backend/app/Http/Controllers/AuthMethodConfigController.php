<?php

namespace App\Http\Controllers;

use App\Services\AuthMethodConfigService;
use Illuminate\Http\JsonResponse;

class AuthMethodConfigController extends Controller
{
    public function publicConfig(AuthMethodConfigService $methods): JsonResponse
    {
        return response()->json([
            'data' => $methods->public(),
        ]);
    }
}
