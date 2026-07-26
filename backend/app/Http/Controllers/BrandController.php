<?php

namespace App\Http\Controllers;

use App\Models\Brand;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BrandController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $brands = Brand::approved()
            ->when($request->industry, fn($q, $v) => $q->where('industry', $v))
            ->latest()
            ->get()
            ->map(fn($b) => [
                'id' => $b->id,
                'name' => $b->name,
                'slug' => $b->slug,
                'logo_url' => $b->logo_url,
                'website' => $b->website,
                'description' => $b->description,
                'industry' => $b->industry,
                'contact_email' => $b->contact_email,
            ]);

        return response()->json(['data' => $brands]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'website' => ['nullable', 'url', 'max:255'],
            'description' => ['nullable', 'string', 'max:2000'],
            'industry' => ['nullable', 'string', 'max:100'],
            'contact_email' => ['nullable', 'email', 'max:255'],
        ]);

        $brand = Brand::create($validated);

        return response()->json(['data' => $brand], 201);
    }

    public function show(int $id): JsonResponse
    {
        $brand = Brand::findOrFail($id);

        return response()->json(['data' => $brand]);
    }
}
