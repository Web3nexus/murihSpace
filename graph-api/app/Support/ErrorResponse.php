<?php

namespace App\Support;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use App\Exceptions\UnauthorizedException;
use App\Exceptions\ServiceUnavailableException;

/**
 * Centralised Graph API error envelope factory.
 *
 * All error responses follow the standard:
 * {
 *   "error": {
 *     "code": "ERROR_CODE",
 *     "message": "Human readable message.",
 *     "request_id": "req_..."
 *   }
 * }
 */
class ErrorResponse
{
    public static function fromException(\Throwable $e, Request $request): JsonResponse
    {
        $requestId = $request->header('X-Request-ID', app('graph.request_id', null));

        if ($e instanceof ValidationException) {
            return self::make('VALIDATION_ERROR', $e->getMessage(), 422, $requestId, [
                'fields' => $e->errors(),
            ]);
        }

        if ($e instanceof UnauthorizedException) {
            return self::make('UNAUTHENTICATED', 'Invalid or expired access token.', 401, $requestId);
        }

        if ($e instanceof ServiceUnavailableException) {
            return self::make('SERVICE_UNAVAILABLE', 'A downstream service is temporarily unavailable.', 503, $requestId);
        }

        if ($e instanceof HttpExceptionInterface) {
            $code = match ($e->getStatusCode()) {
                401 => 'UNAUTHENTICATED',
                403 => 'FORBIDDEN',
                404 => 'RESOURCE_NOT_FOUND',
                409 => 'CONFLICT',
                422 => 'VALIDATION_ERROR',
                429 => 'RATE_LIMITED',
                503 => 'SERVICE_UNAVAILABLE',
                default => 'INTERNAL_ERROR',
            };
            return self::make($code, $e->getMessage() ?: 'An error occurred.', $e->getStatusCode(), $requestId);
        }

        // Never expose internal details in production
        $message = app()->isProduction() ? 'An internal error occurred.' : $e->getMessage();

        return self::make('INTERNAL_ERROR', $message, 500, $requestId);
    }

    public static function make(
        string  $code,
        string  $message,
        int     $status,
        ?string $requestId = null,
        array   $extra = []
    ): JsonResponse {
        return response()->json([
            'error' => array_filter([
                'code'       => $code,
                'message'    => $message,
                'request_id' => $requestId,
            ] + $extra),
        ], $status);
    }
}
