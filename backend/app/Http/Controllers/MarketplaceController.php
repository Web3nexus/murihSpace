<?php

namespace App\Http\Controllers;

use App\Models\DigitalProduct;
use App\Models\PhysicalProduct;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class MarketplaceController extends Controller
{
    /**
     * List all active marketplace products (physical & digital) with search & filtering.
     */
    public function index(Request $request): JsonResponse
    {
        $search = $request->input('search', $request->input('q'));
        $category = $request->input('category');
        $type = $request->input('type', 'all'); // 'all', 'physical', 'digital'
        $perPage = max(1, min((int) $request->input('per_page', 24), 100));

        $items = collect();

        // 1. Fetch Physical Products
        if ($type === 'all' || $type === 'physical') {
            $physicalQuery = PhysicalProduct::with(['creator:id,name,username,avatar,avatar_url,role,kyc_status,created_at'])
                ->active();

            if ($search) {
                $physicalQuery->where(function ($q) use ($search) {
                    $q->where('title', 'like', "%{$search}%")
                      ->orWhere('description', 'like', "%{$search}%")
                      ->orWhere('category', 'like', "%{$search}%");
                });
            }

            if ($category && strtolower($category) !== 'explore' && strtolower($category) !== 'all') {
                $physicalQuery->where('category', 'like', "%{$category}%");
            }

            $physicalProducts = $physicalQuery->latest()->take(60)->get();

            foreach ($physicalProducts as $p) {
                $items->push($this->formatPhysicalProduct($p));
            }
        }

        // 2. Fetch Digital Products
        if ($type === 'all' || $type === 'digital') {
            $digitalQuery = DigitalProduct::with(['creator:id,name,username,avatar,avatar_url,role,kyc_status,created_at'])
                ->where('status', 'published');

            if ($search) {
                $digitalQuery->where(function ($q) use ($search) {
                    $q->where('title', 'like', "%{$search}%")
                      ->orWhere('description', 'like', "%{$search}%")
                      ->orWhere('category', 'like', "%{$search}%");
                });
            }

            if ($category && strtolower($category) !== 'explore' && strtolower($category) !== 'all') {
                $digitalQuery->where('category', 'like', "%{$category}%");
            }

            $digitalProducts = $digitalQuery->latest()->take(60)->get();

            foreach ($digitalProducts as $p) {
                $items->push($this->formatDigitalProduct($p));
            }
        }

        // Sort items: latest first
        $sorted = $items->sortByDesc('created_at')->values();

        // Paginate in memory
        $page = max(1, (int) $request->input('page', 1));
        $total = $sorted->count();
        $pagedData = $sorted->forPage($page, $perPage)->values();

        return response()->json([
            'success' => true,
            'data' => $pagedData,
            'meta' => [
                'current_page' => $page,
                'per_page' => $perPage,
                'total' => $total,
                'last_page' => (int) ceil($total / $perPage),
            ],
        ]);
    }

    /**
     * Get marketplace categories summary.
     */
    public function categories(): JsonResponse
    {
        $categories = [
            ['name' => 'Explore', 'icon' => 'explore', 'type' => 'all'],
            ['name' => 'Electronics', 'icon' => 'devices', 'type' => 'physical'],
            ['name' => 'Clothing', 'icon' => 'checkroom', 'type' => 'physical'],
            ['name' => 'Accessories', 'icon' => 'watch', 'type' => 'physical'],
            ['name' => 'Digital Assets', 'icon' => 'code', 'type' => 'digital'],
            ['name' => 'E-Books', 'icon' => 'menu_book', 'type' => 'digital'],
            ['name' => 'Templates', 'icon' => 'dashboard', 'type' => 'digital'],
            ['name' => 'Courses', 'icon' => 'school', 'type' => 'digital'],
            ['name' => 'Home & Living', 'icon' => 'home', 'type' => 'physical'],
            ['name' => 'Beauty', 'icon' => 'spa', 'type' => 'physical'],
        ];

        return response()->json([
            'success' => true,
            'data' => $categories,
        ]);
    }

    /**
     * Show a single product by ID.
     */
    public function show(string $id): JsonResponse
    {
        if (str_starts_with($id, 'p_') || is_numeric($id)) {
            $numId = str_starts_with($id, 'p_') ? substr($id, 2) : $id;
            $product = PhysicalProduct::with(['creator:id,name,username,avatar,avatar_url,role,kyc_status,created_at'])
                ->find($numId);
            if ($product) {
                return response()->json([
                    'success' => true,
                    'data' => $this->formatPhysicalProduct($product),
                ]);
            }
        }

        if (str_starts_with($id, 'd_') || is_numeric($id)) {
            $numId = str_starts_with($id, 'd_') ? substr($id, 2) : $id;
            $product = DigitalProduct::with(['creator:id,name,username,avatar,avatar_url,role,kyc_status,created_at'])
                ->find($numId);
            if ($product) {
                return response()->json([
                    'success' => true,
                    'data' => $this->formatDigitalProduct($product),
                ]);
            }
        }

        return response()->json(['success' => false, 'message' => 'Product not found.'], 404);
    }

    /**
     * Unified product creation for Creators and Vendors.
     */
    public function store(Request $request): JsonResponse
    {
        $user = $request->user();

        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'name' => ['nullable', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:10000'],
            'price' => ['required', 'numeric', 'min:0'],
            'currency' => ['nullable', 'string', 'size:3'],
            'type' => ['nullable', 'in:physical,digital'],
            'product_type' => ['nullable', 'in:physical,digital'],
            'category' => ['nullable', 'string', 'max:100'],
            'images' => ['nullable', 'array'],
            'images.*' => ['nullable', 'string', 'max:2000'],
            'stock_quantity' => ['nullable', 'integer', 'min:0'],
            'sku' => ['nullable', 'string', 'max:100'],
            'is_free' => ['nullable', 'boolean'],
            'cover_url' => ['nullable', 'string', 'max:2000'],
            'escrow_protected' => ['nullable', 'boolean'],
        ]);

        $title = $validated['title'] ?? $validated['name'];
        $productType = $validated['type'] ?? $validated['product_type'] ?? 'physical';
        $currency = strtoupper($validated['currency'] ?? 'USD');
        $price = (float) $validated['price'];

        if ($productType === 'digital') {
            $slug = Str::slug($title).'-'.Str::random(6);
            $cover = $validated['cover_url'] ?? ($validated['images'][0] ?? null);

            $digital = DigitalProduct::create([
                'creator_id' => $user->id,
                'title' => $title,
                'slug' => $slug,
                'description' => $validated['description'] ?? null,
                'cover_url' => $cover,
                'price' => $price,
                'currency' => $currency,
                'is_free' => $validated['is_free'] ?? ($price <= 0),
                'category' => strtolower($validated['category'] ?? 'other'),
                'status' => 'published',
            ]);
            $digital->load('creator:id,name,username,avatar,avatar_url,role,kyc_status,created_at');

            return response()->json([
                'success' => true,
                'message' => 'Digital product created successfully.',
                'data' => $this->formatDigitalProduct($digital),
            ], 201);
        }

        // Physical Product Creation
        $images = $validated['images'] ?? [];
        if (empty($images) && !empty($validated['cover_url'])) {
            $images = [$validated['cover_url']];
        }

        $sku = !empty($validated['sku']) ? $validated['sku'] : ('SKU-'.strtoupper(Str::random(8)));

        $physical = PhysicalProduct::create([
            'creator_id' => $user->id,
            'title' => $title,
            'description' => $validated['description'] ?? null,
            'sku' => $sku,
            'price' => (int) round($price),
            'currency' => $currency,
            'category' => strtolower($validated['category'] ?? 'electronics'),
            'images' => $images,
            'stock_quantity' => $validated['stock_quantity'] ?? 50,
            'low_stock_threshold' => 5,
            'track_inventory' => true,
            'is_active' => true,
        ]);
        $physical->load('creator:id,name,username,avatar,avatar_url,role,kyc_status,created_at');

        return response()->json([
            'success' => true,
            'message' => 'Product published to marketplace successfully.',
            'data' => $this->formatPhysicalProduct($physical),
        ], 201);
    }

    /**
     * Get products created by the authenticated creator or vendor.
     */
    public function myProducts(Request $request): JsonResponse
    {
        $userId = $request->user()->id;

        $physical = PhysicalProduct::where('creator_id', $userId)->latest()->get()->map(fn ($p) => $this->formatPhysicalProduct($p));
        $digital = DigitalProduct::where('creator_id', $userId)->latest()->get()->map(fn ($p) => $this->formatDigitalProduct($p));

        $all = $physical->concat($digital)->sortByDesc('created_at')->values();

        return response()->json([
            'success' => true,
            'data' => $all,
        ]);
    }

    private function formatPhysicalProduct(PhysicalProduct $p): array
    {
        $symbol = match ($p->currency) {
            'NGN' => '₦',
            'EUR' => '€',
            'GBP' => '£',
            default => '$',
        };

        $images = is_array($p->images) && count($p->images) > 0
            ? $p->images
            : ['https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&auto=format&fit=crop'];

        return [
            'id' => (string) $p->id,
            'raw_id' => $p->id,
            'product_type' => 'physical',
            'type' => 'physical',
            'title' => $p->title,
            'name' => $p->title,
            'description' => $p->description ?? '',
            'price' => (float) $p->price,
            'currency' => $p->currency ?? 'USD',
            'symbol' => $symbol,
            'sellerId' => (string) $p->creator_id,
            'sellerName' => $p->creator?->name ?? 'Merchant',
            'sellerUsername' => $p->creator?->username ?? 'vendor',
            'sellerAvatar' => $p->creator?->avatar_url ?? $p->creator?->avatar,
            'sellerRating' => 4.9,
            'sellerJoinedDate' => $p->creator?->created_at?->format('Y') ?? '2024',
            'isVerified' => $p->creator?->kyc_status === 'verified' || $p->creator?->role === 'vendor' || $p->creator?->role === 'creator',
            'category' => ucfirst($p->category ?? 'General'),
            'condition' => 'Brand new',
            'images' => $images,
            'cover_url' => $images[0] ?? null,
            'escrow_protected' => true,
            'stock_quantity' => $p->stock_quantity,
            'in_stock' => $p->inStock(),
            'created_at' => $p->created_at?->toISOString(),
        ];
    }

    private function formatDigitalProduct(DigitalProduct $p): array
    {
        $symbol = match ($p->currency) {
            'NGN' => '₦',
            'EUR' => '€',
            'GBP' => '£',
            default => '$',
        };

        $cover = $p->cover_url ?: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop';

        return [
            'id' => (string) $p->id,
            'raw_id' => $p->id,
            'product_type' => 'digital',
            'type' => 'digital',
            'title' => $p->title,
            'name' => $p->title,
            'description' => $p->description ?? '',
            'price' => (float) $p->price,
            'currency' => $p->currency ?? 'USD',
            'symbol' => $symbol,
            'sellerId' => (string) $p->creator_id,
            'sellerName' => $p->creator?->name ?? 'Creator',
            'sellerUsername' => $p->creator?->username ?? 'creator',
            'sellerAvatar' => $p->creator?->avatar_url ?? $p->creator?->avatar,
            'sellerRating' => 5.0,
            'sellerJoinedDate' => $p->creator?->created_at?->format('Y') ?? '2024',
            'isVerified' => true,
            'category' => ucfirst($p->category ?? 'Digital'),
            'condition' => 'Digital download',
            'images' => [$cover],
            'cover_url' => $cover,
            'escrow_protected' => true,
            'stock_quantity' => 999,
            'in_stock' => true,
            'download_count' => $p->download_count,
            'created_at' => $p->created_at?->toISOString(),
        ];
    }
}
