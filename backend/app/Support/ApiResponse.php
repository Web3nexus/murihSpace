<?php

namespace App\Support;

use Illuminate\Http\JsonResponse;

/**
 * Standardised API response envelope.
 *
 * Usage:
 *   return ApiResponse::success($data, 'Created', 201);
 *   return ApiResponse::error('Not found', [], 404);
 *   return ApiResponse::paginated($paginatedCollection, 'Fetched');
 */
class ApiResponse
{
    /**
     * Return a successful JSON response.
     *
     * @param  mixed       $data
     * @param  string|null $message
     * @param  int         $status
     * @return JsonResponse
     */
    public static function success(mixed $data = null, ?string $message = null, int $status = 200): JsonResponse
    {
        $body = [
            'success' => true,
        ];

        if ($message !== null) {
            $body['message'] = $message;
        }

        if ($data !== null) {
            $body['data'] = $data;
        }

        return response()->json($body, $status);
    }

    /**
     * Return an error JSON response.
     *
     * @param  string     $message
     * @param  array      $errors
     * @param  int        $status
     * @return JsonResponse
     */
    public static function error(string $message, array $errors = [], int $status = 400): JsonResponse
    {
        $body = [
            'success' => false,
            'message' => $message,
        ];

        if (! empty($errors)) {
            $body['errors'] = $errors;
        }

        return response()->json($body, $status);
    }

    /**
     * Return a paginated success response — preserves Laravel's LengthAwarePaginator structure
     * under a `data` key while adding the standard success envelope fields.
     *
     * @param  mixed       $paginator  LengthAwarePaginator or plain collection
     * @param  string|null $message
     * @return JsonResponse
     */
    public static function paginated(mixed $paginator, ?string $message = null): JsonResponse
    {
        $body = [
            'success' => true,
        ];

        if ($message !== null) {
            $body['message'] = $message;
        }

        // If it's a paginator, merge its toArray() so pagination metadata is preserved
        if (method_exists($paginator, 'toArray')) {
            $paginatorArray = $paginator->toArray();
            $body = array_merge($body, $paginatorArray);
        } else {
            $body['data'] = $paginator;
        }

        return response()->json($body);
    }
}
