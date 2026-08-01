<?php

namespace App\Http\Controllers;

use App\Services\StorageRouter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminStorageController extends Controller
{
    public function __construct(
        private readonly StorageRouter $router,
    ) {}

    public function show(): JsonResponse
    {
        return response()->json([
            'data' => [
                'config' => $this->router->getConfig(),
                'available_disks' => $this->router->availableDisks(),
            ],
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'default' => ['required', 'string'],
            'default_folder' => ['required', 'string', 'max:100'],
            'private_disk' => ['nullable', 'string'],
            'rules' => ['required', 'array', 'min:1'],
            'rules.*.label' => ['required', 'string', 'max:100'],
            'rules.*.mime_pattern' => ['required', 'string', 'max:100'],
            'rules.*.disk' => ['required', 'string'],
            'rules.*.folder' => ['required', 'string', 'max:100'],
        ]);

        $this->router->updateConfig($validated);

        return response()->json(['message' => 'Storage configuration updated.']);
    }
}
