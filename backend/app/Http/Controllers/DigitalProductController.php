<?php

namespace App\Http\Controllers;

use App\Models\DigitalProduct;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use App\Services\StorageRouter;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

class DigitalProductController extends Controller
{
    public function __construct(
        private readonly StorageRouter $router,
    ) {}

    /**
     * List all digital products owned by the authenticated creator.
     */
    public function index(Request $request): JsonResponse
    {
        $query = DigitalProduct::query();

        if ($request->filled('creator_id')) {
            $creatorId = $request->input('creator_id');
            $query->where('creator_id', $creatorId);
            if (!$request->user() || $request->user()->id != $creatorId) {
                $query->where('status', 'published');
            }
        } elseif ($request->user()) {
            $query->where('creator_id', $request->user()->id);
        } else {
            $query->where('status', 'published');
        }

        $products = $query->latest()->get();

        return response()->json([
            'data' => $products,
            'meta' => ['categories' => DigitalProduct::CATEGORIES],
        ]);
    }

    /**
     * Store a new digital product with private file upload.
     */
    public function store(Request $request): JsonResponse
    {
        $this->authorize('create', DigitalProduct::class);

        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:5000'],
            'cover_url' => ['nullable', 'string', 'max:2000'],
            'price' => ['required', 'numeric', 'min:0'],
            'currency' => ['nullable', 'string', 'size:3'],
            'is_free' => ['required', 'boolean'],
            'category' => ['required', Rule::in(array_keys(DigitalProduct::CATEGORIES))],
            'status' => ['nullable', Rule::in(['draft', 'published'])],
            'file' => ['nullable', 'file', 'max:102400'], // 100MB max
        ]);

        $slug = Str::slug($validated['title']).'-'.Str::random(6);
        $filePath = null;
        $fileOriginalName = null;
        $fileMimeType = null;
        $fileSizeBytes = 0;

        if ($request->hasFile('file')) {
            $uploadedFile = $request->file('file');
            $filePath = $uploadedFile->store('digital_products/private', $this->router->privateDisk());
            $fileOriginalName = $uploadedFile->getClientOriginalName();
            $fileMimeType = $uploadedFile->getClientMimeType();
            $fileSizeBytes = $uploadedFile->getSize();
        }

        $product = DigitalProduct::create([
            'creator_id' => $request->user()->id,
            'title' => $validated['title'],
            'slug' => $slug,
            'description' => $validated['description'] ?? null,
            'cover_url' => $validated['cover_url'] ?? null,
            'price' => $validated['is_free'] ? 0.00 : $validated['price'],
            'currency' => strtoupper($validated['currency'] ?? 'USD'),
            'is_free' => $validated['is_free'],
            'category' => $validated['category'],
            'status' => $validated['status'] ?? 'draft',
            'file_path' => $filePath,
            'file_original_name' => $fileOriginalName,
            'file_mime_type' => $fileMimeType,
            'file_size_bytes' => $fileSizeBytes,
        ]);

        return response()->json([
            'message' => 'Digital product created successfully.',
            'data' => $product,
        ], 201);
    }

    /**
     * Show creator's single product details.
     */
    public function show(Request $request, int $id): JsonResponse
    {
        $product = DigitalProduct::where('creator_id', $request->user()->id)
            ->findOrFail($id);

        return response()->json(['data' => $product]);
    }

    /**
     * Update digital product details.
     */
    public function update(Request $request, int $id): JsonResponse
    {
        $product = DigitalProduct::where('creator_id', $request->user()->id)
            ->findOrFail($id);

        $this->authorize('update', $product);

        $validated = $request->validate([
            'title' => ['sometimes', 'required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:5000'],
            'cover_url' => ['nullable', 'string', 'max:2000'],
            'price' => ['sometimes', 'required', 'numeric', 'min:0'],
            'currency' => ['nullable', 'string', 'size:3'],
            'is_free' => ['sometimes', 'required', 'boolean'],
            'category' => ['sometimes', Rule::in(array_keys(DigitalProduct::CATEGORIES))],
            'status' => ['sometimes', Rule::in(['draft', 'published'])],
            'file' => ['nullable', 'file', 'max:102400'],
        ]);

        if (isset($validated['is_free']) && $validated['is_free']) {
            $validated['price'] = 0.00;
        }

        if ($request->hasFile('file')) {
            $uploadedFile = $request->file('file');
            $newPath = $uploadedFile->store('digital_products/private', $this->router->privateDisk());
            $oldPath = $product->file_path;

            $validated['file_path'] = $newPath;
            $validated['file_original_name'] = $uploadedFile->getClientOriginalName();
            $validated['file_mime_type'] = $uploadedFile->getClientMimeType();
            $validated['file_size_bytes'] = $uploadedFile->getSize();

            $product->update($validated);

            if ($oldPath && Storage::disk($this->router->privateDisk())->exists($oldPath)) {
                Storage::disk($this->router->privateDisk())->delete($oldPath);
            }
        } else {
            $product->update($validated);
        }

        return response()->json([
            'message' => 'Digital product updated successfully.',
            'data' => $product->fresh(),
        ]);
    }

    /**
     * Toggle product publish state.
     */
    public function publish(Request $request, int $id): JsonResponse
    {
        $product = DigitalProduct::where('creator_id', $request->user()->id)
            ->findOrFail($id);

        $this->authorize('publish', $product);

        $validated = $request->validate([
            'status' => ['required', Rule::in(['draft', 'published'])],
        ]);

        $product->update(['status' => $validated['status']]);

        return response()->json([
            'message' => "Product is now {$product->status}.",
            'data' => $product,
        ]);
    }

    /**
     * Delete product & private file.
     */
    public function destroy(Request $request, int $id): JsonResponse
    {
        $product = DigitalProduct::where('creator_id', $request->user()->id)
            ->findOrFail($id);

        $this->authorize('delete', $product);

        if ($product->file_path && Storage::disk($this->router->privateDisk())->exists($product->file_path)) {
            Storage::disk($this->router->privateDisk())->delete($product->file_path);
        }

        $product->delete();

        return response()->json(['message' => 'Product deleted successfully.']);
    }

    /**
     * Public endpoint: Showcase published product by slug (omits file_path).
     */
    public function publicShow(string $slug): JsonResponse
    {
        $product = DigitalProduct::where('slug', $slug)
            ->where('status', 'published')
            ->with('creator:id,name,username,avatar')
            ->firstOrFail();

        return response()->json([
            'data' => [
                'id' => $product->id,
                'title' => $product->title,
                'slug' => $product->slug,
                'description' => $product->description,
                'cover_url' => $product->cover_url,
                'price' => $product->price,
                'currency' => $product->currency,
                'is_free' => $product->is_free,
                'category' => $product->category,
                'file_original_name' => $product->file_original_name,
                'file_size_bytes' => $product->file_size_bytes,
                'download_count' => $product->download_count,
                'creator' => $product->creator,
                'created_at' => $product->created_at,
            ],
        ]);
    }

    /**
     * Private download endpoint: Serves file securely and increments download count.
     */
    public function download(Request $request, int $id): StreamedResponse|JsonResponse
    {
        $product = DigitalProduct::findOrFail($id);

        // Authorization check: creator OR free product OR purchased order (sprint 15)
        $isCreator = $request->user()->id === $product->creator_id;

        if (! $isCreator && ! $product->is_free && $product->status !== 'published') {
            return response()->json(['message' => 'Unauthorized file download.'], 403);
        }

        if (! $product->file_path || ! Storage::disk($this->router->privateDisk())->exists($product->file_path)) {
            return response()->json(['message' => 'Product file is missing or not uploaded yet.'], 404);
        }

        // Increment download counter
        $product->increment('download_count');

        return Storage::disk($this->router->privateDisk())->download(
            $product->file_path,
            $product->file_original_name ?? "product-{$product->id}.bin"
        );
    }
}
