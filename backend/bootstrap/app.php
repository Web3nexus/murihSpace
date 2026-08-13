<?php

use App\Exceptions\InsufficientBalanceException;
use App\Http\Middleware\ActivityLogMiddleware;
use App\Http\Middleware\CachePublicResponse;
use App\Http\Middleware\CaptureRequestAndEnvelopeResponse;
use App\Http\Middleware\EnsureAdminPermission;
use App\Http\Middleware\EnsureEmailIsVerified;
use App\Http\Middleware\EnsureInternalRequest;
use App\Http\Middleware\IsAdmin;
use App\Http\Middleware\IsCreator;
use App\Http\Middleware\IsVendor;
use App\Http\Middleware\RequiresKyc;
use App\Http\Middleware\RequiresPermission;
use App\Http\Middleware\SecurityHeaders;
use App\Providers\AuthServiceProvider;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Illuminate\Routing\Middleware\SubstituteBindings;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        channels: __DIR__.'/../routes/channels.php',
        health: '/up',
        then: function () {
            Route::middleware([
                'internal',
                SubstituteBindings::class,
            ])->prefix('internal')
                ->group(__DIR__.'/../routes/internal.php');
        },
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->api(prepend: [
            CaptureRequestAndEnvelopeResponse::class,
            SecurityHeaders::class,
        ]);

        $middleware->api(append: [
            ActivityLogMiddleware::class,
        ]);

        $middleware->alias([
            'admin' => IsAdmin::class,
            'admin.permission' => EnsureAdminPermission::class,
            'creator' => IsCreator::class,
            'vendor' => IsVendor::class,
            'permission' => RequiresPermission::class,
            'kyc' => RequiresKyc::class,
            'verified' => EnsureEmailIsVerified::class,
            'cache.public' => CachePublicResponse::class,
            'internal' => EnsureInternalRequest::class,
        ]);

    })
    ->withProviders([
        AuthServiceProvider::class,
    ])
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->is('internal/*'),
        );

        $exceptions->render(function (Throwable $e, Request $request) {
            if ($request->is('api/*') || $request->is('internal/*')) {
                $status = 500;
                $message = 'Internal Server Error';
                $errors = null;
                $code = null;

                if ($e instanceof HttpExceptionInterface) {
                    $status = $e->getStatusCode();
                    $message = $e->getMessage() ?: 'Internal Server Error';
                } elseif ($e instanceof ValidationException) {
                    $status = 422;
                    $message = $e->getMessage();
                    $errors = $e->errors();
                } elseif ($e instanceof AuthenticationException) {
                    $status = 401;
                    $message = $e->getMessage() ?: 'Unauthenticated';
                } elseif ($e instanceof InsufficientBalanceException) {
                    $status = 422;
                    $code = InsufficientBalanceException::CODE;
                }

                $requestId = $request->header('X-Request-ID')
                    ?: $request->headers->get('X-Request-ID')
                    ?: (string) Str::uuid();

                $body = [
                    'success' => false,
                    'request_id' => $requestId,
                    'data' => null,
                    'message' => $message,
                    'errors' => $errors,
                ];

                if ($code !== null) {
                    $body['code'] = $code;
                }

                return response()->json($body, $status)->header('X-Request-ID', $requestId);
            }
        });
    })->create();
