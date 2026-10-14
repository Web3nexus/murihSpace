<?php

namespace App\Http\Controllers;

use App\Models\DeviceSession;
use App\Services\QrLoginService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Laravel\Sanctum\PersonalAccessToken;

class QrLoginController extends Controller
{
    public function __construct(private readonly QrLoginService $qr) {}

    public function start(Request $request): JsonResponse
    {
        $result = $this->qr->start($request);

        return response()->json($result);
    }

    public function poll(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'poll_token' => ['required', 'string', 'max:128'],
        ]);

        $result = $this->qr->poll($validated['poll_token']);

        $status = match ($result['status'] ?? 'unknown') {
            'approved' => 200,
            'scanned' => 200,
            'pending' => 200,
            'denied' => 403,
            'expired', 'not_found', 'consumed', 'failed' => 410,
            default => 200,
        };

        return response()->json($result, $status);
    }

    public function scan(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'qr_token' => ['required', 'string', 'max:128'],
        ]);

        $user = $request->user();
        $result = $this->qr->scan($validated['qr_token'], $user, $request);

        $status = match ($result['status'] ?? 'unknown') {
            'scanned' => 200,
            'approved', 'consumed' => 409, // already handled
            'denied' => 403,
            'expired' => 410,
            'invalid' => 404,
            default => 200,
        };

        return response()->json($result, $status);
    }

    public function approve(Request $request, int $id): JsonResponse
    {
        $validated = $request->validate([
            'confirmation_code' => ['required', 'string', 'max:12'],
        ]);

        $user = $request->user();

        $currentToken = $user->currentAccessToken();
        $tokenId = ($currentToken instanceof PersonalAccessToken) ? $currentToken->id : null;

        $currentSession = $tokenId
            ? DeviceSession::where('user_id', $user->id)
                ->where('personal_access_token_id', $tokenId)
                ->first()
            : null;

        try {
            $this->qr->approve($id, $user, $validated['confirmation_code'], $currentSession);
        } catch (\InvalidArgumentException $e) {
            $msg = $e->getMessage();
            $code = str_contains(strtolower($msg), 'unauthorized') ? 403 : 422;

            return response()->json(['message' => $msg], $code);
        }

        return response()->json([
            'message' => 'QR login approved.',
            'status' => 'approved',
        ]);
    }

    public function deny(Request $request, int $id): JsonResponse
    {
        $user = $request->user();

        try {
            $this->qr->deny($id, $user);
        } catch (\InvalidArgumentException $e) {
            $msg = $e->getMessage();
            $code = str_contains(strtolower($msg), 'unauthorized') ? 403 : 422;

            return response()->json(['message' => $msg], $code);
        }

        return response()->json([
            'message' => 'QR login denied.',
            'status' => 'denied',
        ]);
    }
}
