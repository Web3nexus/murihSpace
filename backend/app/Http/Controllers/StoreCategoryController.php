<?php

namespace App\Http\Controllers;

use App\Models\StoreCategory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class StoreCategoryController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $categories = StoreCategory::where('creator_id', $request->user()->id)
            ->latest()->get();
        return response()->json(['data' => $categories]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
        ]);

        $category = StoreCategory::create([
            'creator_id' => $request->user()->id,
            'name' => $validated['name'],
            'slug' => Str::slug($validated['name']).'-'.Str::random(4),
        ]);

        return response()->json(['data' => $category], 201);
    }

    public function update(Request $request, StoreCategory $category): JsonResponse
    {
        $this->authorize('update', $category);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
        ]);

        $category->update([
            'name' => $validated['name'],
            'slug' => Str::slug($validated['name']).'-'.Str::random(4),
        ]);

        return response()->json(['data' => $category]);
    }

    public function destroy(Request $request, StoreCategory $category): JsonResponse
    {
        $this->authorize('delete', $category);
        $category->delete();
        return response()->json(['message' => 'Category deleted.']);
    }
}
