<?php

namespace App\Http\Controllers;

use App\Models\SystemBroadcast;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SystemBroadcastController extends Controller
{
    /**
     * List system broadcasts tailored for the authenticated user.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $query = SystemBroadcast::with('admin:id,name,username,avatar')
            ->forAudience($user)
            ->latest('sent_at');

        $broadcasts = $query->paginate(30);

        return response()->json([
            'data' => $broadcasts,
        ]);
    }
}

