<?php

namespace App\Http\Controllers;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Validation\ValidationException;

class TicketProxyController extends Controller
{
    private function baseUrl(): string
    {
        return (string) config('services.ticket_service.base_url');
    }

    private function token(): string
    {
        return (string) config('services.ticket_service.internal_token');
    }

    private function withHeaders(Request $request): array
    {
        return [
            'Accept' => 'application/json',
            'X-Internal-Token' => $this->token(),
            'X-Customer-Email' => (string) $request->user()->email,
        ];
    }

    private function forward(Request $request, callable $call): JsonResponse
    {
        try {
            $response = $call();

            return response()->json(
                $response->json(),
                $response->status(),
            );
        } catch (ConnectionException $e) {
            throw ValidationException::withMessages([
                'ticket' => ['Support services are temporarily unavailable. Please try again shortly.'],
            ]);
        }
    }

    public function categories(Request $request): JsonResponse
    {
        return $this->forward($request, fn () => Http::withHeaders($this->withHeaders($request))
            ->timeout(10)
            ->get($this->baseUrl().'/api/customer/tickets/categories'));
    }

    public function index(Request $request): JsonResponse
    {
        return $this->forward($request, fn () => Http::withHeaders($this->withHeaders($request))
            ->timeout(10)
            ->get($this->baseUrl().'/api/customer/tickets', [
                'status' => $request->query('status'),
            ]));
    }

    public function store(Request $request): JsonResponse
    {
        return $this->forward($request, fn () => Http::withHeaders($this->withHeaders($request))
            ->timeout(10)
            ->asMultipart()
            ->post($this->baseUrl().'/api/customer/tickets', $this->forwardablePayload($request)));
    }

    public function show(Request $request, int $ticketId): JsonResponse
    {
        return $this->forward($request, fn () => Http::withHeaders($this->withHeaders($request))
            ->timeout(10)
            ->get($this->baseUrl()."/api/customer/tickets/{$ticketId}"));
    }

    public function reply(Request $request, int $ticketId): JsonResponse
    {
        return $this->forward($request, fn () => Http::withHeaders($this->withHeaders($request))
            ->timeout(10)
            ->asForm()
            ->post($this->baseUrl()."/api/customer/tickets/{$ticketId}/reply", [
                'body' => $request->input('body'),
            ]));
    }

    public function status(Request $request, int $ticketId): JsonResponse
    {
        return $this->forward($request, fn () => Http::withHeaders($this->withHeaders($request))
            ->timeout(10)
            ->asForm()
            ->post($this->baseUrl()."/api/customer/tickets/{$ticketId}/status", [
                'status' => $request->input('status'),
            ]));
    }

    public function rate(Request $request, int $ticketId): JsonResponse
    {
        return $this->forward($request, fn () => Http::withHeaders($this->withHeaders($request))
            ->timeout(10)
            ->asForm()
            ->post($this->baseUrl()."/api/customer/tickets/{$ticketId}/rate", [
                'rating' => $request->input('rating'),
                'comment' => $request->input('comment'),
            ]));
    }

    private function forwardablePayload(Request $request): array
    {
        $payload = [
            'subject' => $request->input('subject'),
            'description' => $request->input('description'),
            'category_id' => $request->input('category_id'),
            'priority' => $request->input('priority'),
        ];

        if ($request->hasFile('attachment')) {
            $payload['attachment'] = $request->file('attachment');
        }

        return array_filter($payload, fn ($value) => $value !== null && $value !== '');
    }
}
