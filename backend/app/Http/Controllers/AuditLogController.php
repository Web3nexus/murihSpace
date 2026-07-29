<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AuditLogController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'action' => ['nullable', 'string'],
            'search' => ['nullable', 'string', 'max:100'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
            'per_page' => ['nullable', 'integer', 'min:10', 'max:200'],
        ]);

        $query = AuditLog::with('user:id,name')
            ->latest();

        if (! empty($validated['action'])) {
            $query->where('action', $validated['action']);
        }
        if (! empty($validated['search'])) {
            $s = $validated['search'];
            $query->where(function ($q) use ($s) {
                $q->where('action', 'like', "%{$s}%")
                    ->orWhereHas('user', fn($uq) => $uq->where('name', 'like', "%{$s}%"));
            });
        }
        if (! empty($validated['from'])) {
            $query->whereDate('created_at', '>=', $validated['from']);
        }
        if (! empty($validated['to'])) {
            $query->whereDate('created_at', '<=', $validated['to']);
        }

        return response()->json(
            $query->paginate($validated['per_page'] ?? 50)
        );
    }

    public function show(int $id): JsonResponse
    {
        $log = AuditLog::with('user:id,name,email')->findOrFail($id);

        return response()->json(['data' => $log]);
    }
}
