<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use App\Http\Middleware\GraphAuth;
use App\Http\Middleware\GraphScope;
use App\Http\Middleware\RequestId;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        then: function () {
            \Illuminate\Support\Facades\Route::prefix('')
                ->middleware('api')
                ->group(base_path('routes/v1.php'));
        },
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->alias([
            'graph.auth'  => GraphAuth::class,
            'graph.scope' => GraphScope::class,
            'request.id'  => RequestId::class,
        ]);

        // Prepend request-ID middleware globally so every request gets one
        $middleware->prepend(RequestId::class);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // Return standardised Graph API error envelope for all JSON / API requests
        $exceptions->render(function (\Throwable $e, Request $request) {
            if ($request->is('v1/*') || $request->expectsJson()) {
                return \App\Support\ErrorResponse::fromException($e, $request);
            }
        });
    })->create();
