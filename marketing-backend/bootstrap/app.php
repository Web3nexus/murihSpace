<?php

use App\Http\Middleware\CachePublicResponse;
use App\Http\Middleware\EnsureInternalRequest;
use App\Http\Middleware\EnsureSignedInternalRequest;
use App\Http\Middleware\EnsureStaffAuthenticated;
use App\Http\Middleware\EnsureStaffPermission;
use App\Http\Middleware\SecurityHeaders;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->api(prepend: [
            SecurityHeaders::class,
        ]);

        $middleware->alias([
            'cache.public' => CachePublicResponse::class,
            'security' => SecurityHeaders::class,
            'staff' => EnsureStaffAuthenticated::class,
            'staff.permission' => EnsureStaffPermission::class,
            'internal' => EnsureInternalRequest::class,
            'internal.signed' => EnsureSignedInternalRequest::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*'),
        );

        $exceptions->render(function (Throwable $e, Request $request) {
            if ($request->is('api/*')) {
                $status = 500;
                $message = $e->getMessage() ?: 'Internal Server Error';
                $errors = null;

                if ($e instanceof HttpExceptionInterface) {
                    $status = $e->getStatusCode();
                } elseif ($e instanceof ValidationException) {
                    $status = 422;
                    $message = $e->getMessage();
                    $errors = $e->errors();
                } elseif ($e instanceof AuthenticationException) {
                    $status = 401;
                    $message = $e->getMessage() ?: 'Unauthenticated';
                }

                return response()->json([
                    'success' => false,
                    'data' => null,
                    'message' => $message,
                    'errors' => $errors,
                ], $status);
            }
        });
    })->create();
