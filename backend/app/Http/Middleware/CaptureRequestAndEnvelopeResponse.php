<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

class CaptureRequestAndEnvelopeResponse
{
    /**
     * Handle an incoming request.
     */
    public function handle(Request $request, Closure $next): Response
    {
        // 1. Generate Request ID
        $requestId = (string) Str::uuid();

        // 2. Attach to request headers
        $request->headers->set('X-Request-ID', $requestId);

        // 3. Process Request
        $response = $next($request);

        // 4. Attach to response headers
        $response->headers->set('X-Request-ID', $requestId);

        // 5. Envelope JsonResponse
        if ($response instanceof JsonResponse) {
            $originalData = $response->getData(true);

            // If the response is already enveloped (has keys success, request_id, data, etc.), skip re-enveloping
            if (is_array($originalData) && array_key_exists('success', $originalData) && array_key_exists('request_id', $originalData)) {
                return $response;
            }

            $status = $response->getStatusCode();
            $success = $status >= 200 && $status < 300;

            $message = '';
            $errors = null;

            // Handle standard message or error extractions if present
            if (is_array($originalData)) {
                if (isset($originalData['message'])) {
                    $message = $originalData['message'];
                    unset($originalData['message']);
                }
                if (isset($originalData['errors'])) {
                    $errors = $originalData['errors'];
                    unset($originalData['errors']);
                }
            }

            // Clean data wrapping
            $wrappedData = is_array($originalData) && count($originalData) === 0 ? null : $originalData;

            // Special handling for validation or structure formatting
            if (!$success && is_null($errors) && is_array($wrappedData)) {
                $errors = $wrappedData;
                $wrappedData = null;
            }

            $response->setData([
                'success' => $success,
                'request_id' => $requestId,
                'data' => $success ? $wrappedData : null,
                'message' => $message ?: ($success ? 'Request succeeded.' : 'Request failed.'),
                'errors' => $errors,
            ]);
        }

        return $response;
    }
}
