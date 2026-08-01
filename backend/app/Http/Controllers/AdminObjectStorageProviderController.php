<?php

namespace App\Http\Controllers;

use App\Models\ObjectStorageProvider;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Validation\Rule;

class AdminObjectStorageProviderController extends Controller
{
    public function index(): JsonResponse
    {
        $providers = ObjectStorageProvider::orderBy('label')->get();

        return response()->json([
            'data' => $providers->map(fn ($p) => $p->toArray()),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'key' => ['required', 'string', 'max:100', 'alpha_dash', Rule::unique('object_storage_providers')],
            'label' => ['required', 'string', 'max:255'],
            'driver' => ['nullable', 'string', 'in:s3'],
            'access_key' => ['required', 'string', 'max:500'],
            'secret_key' => ['required', 'string', 'max:2000'],
            'region' => ['nullable', 'string', 'max:100'],
            'bucket' => ['required', 'string', 'max:255'],
            'endpoint' => ['nullable', 'string', 'max:500'],
            'url' => ['nullable', 'string', 'max:500'],
            'use_path_style_endpoint' => ['nullable', 'boolean'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $provider = ObjectStorageProvider::create($validated);

        Cache::forget('object_storage_providers');
        Cache::forget('object_storage_providers_disks');

        return response()->json(['data' => $provider->toArray()], 201);
    }

    public function show(ObjectStorageProvider $provider): JsonResponse
    {
        return response()->json(['data' => $provider->toArray()]);
    }

    public function update(Request $request, ObjectStorageProvider $provider): JsonResponse
    {
        $validated = $request->validate([
            'key' => ['nullable', 'string', 'max:100', 'alpha_dash', Rule::unique('object_storage_providers')->ignore($provider->id)],
            'label' => ['nullable', 'string', 'max:255'],
            'driver' => ['nullable', 'string', 'in:s3'],
            'access_key' => ['nullable', 'string', 'max:500'],
            'secret_key' => ['nullable', 'string', 'max:2000'],
            'region' => ['nullable', 'string', 'max:100'],
            'bucket' => ['nullable', 'string', 'max:255'],
            'endpoint' => ['nullable', 'string', 'max:500'],
            'url' => ['nullable', 'string', 'max:500'],
            'use_path_style_endpoint' => ['nullable', 'boolean'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $provider->update($validated);

        Cache::forget('object_storage_providers');
        Cache::forget('object_storage_providers_disks');

        return response()->json(['data' => $provider->fresh()->toArray()]);
    }

    public function destroy(ObjectStorageProvider $provider): JsonResponse
    {
        $provider->delete();

        Cache::forget('object_storage_providers');
        Cache::forget('object_storage_providers_disks');

        return response()->json(['message' => 'Storage provider deleted.']);
    }
}
