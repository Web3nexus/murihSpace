<?php

use App\Exceptions\InsufficientBalanceException;
use App\Http\Middleware\CaptureRequestAndEnvelopeResponse;
use App\Http\Middleware\EnsureEmailIsVerified;
use App\Http\Middleware\IsAdmin;
use App\Http\Middleware\SecurityHeaders;
use App\Providers\AuthServiceProvider;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
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
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->api(prepend: [
            CaptureRequestAndEnvelopeResponse::class,
            SecurityHeaders::class,
        ]);

        $middleware->api(append: [
            \App\Http\Middleware\ActivityLogMiddleware::class,
        ]);

        $middleware->alias([
            'admin'            => IsAdmin::class,
            'admin.permission' => \App\Http\Middleware\EnsureAdminPermission::class,
            'creator'          => \App\Http\Middleware\IsCreator::class,
            'vendor'           => \App\Http\Middleware\IsVendor::class,
            'permission'       => \App\Http\Middleware\RequiresPermission::class,
            'kyc'              => \App\Http\Middleware\RequiresKyc::class,
            'verified'         => EnsureEmailIsVerified::class,
            'cache.public'     => \App\Http\Middleware\CachePublicResponse::class,
        ]);

    })
    ->withProviders([
        AuthServiceProvider::class,
    ])
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*'),
        );

        $exceptions->render(function (Throwable $e, Request $request) {
            if ($request->is('api/*')) {
                $status = 500;
                $message = $e->getMessage() ?: 'Internal Server Error';
                $errors = null;
                $code = null;

                if ($e instanceof HttpExceptionInterface) {
                    $status = $e->getStatusCode();
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
