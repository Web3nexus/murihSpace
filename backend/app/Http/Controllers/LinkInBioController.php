<?php

namespace App\Http\Controllers;

use App\Models\LinkInBioDesign;
use App\Models\LinkInBioLink;
use App\Models\LinkInBioProduct;
use App\Models\LinkInBioSocialLink;
use App\Models\LinkInBioTheme;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class LinkInBioController extends Controller
{
    // ── Links CRUD ─────────────────────────────────────────────────

    public function index(Request $request): JsonResponse
    {
        $links = LinkInBioLink::where('user_id', $request->user()->id)
            ->orderBy('sort_order')
            ->get();

        $socials = LinkInBioSocialLink::where('user_id', $request->user()->id)
            ->orderBy('sort_order')
            ->get();

        $products = LinkInBioProduct::where('user_id', $request->user()->id)
            ->orderBy('sort_order')
            ->get();

        $design = LinkInBioDesign::firstOrCreate(
            ['user_id' => $request->user()->id]
        );

        return response()->json([
            'data' => [
                'links' => $links,
                'social_links' => $socials,
                'products' => $products,
                'profile_name' => $design->profile_name,
                'profile_bio' => $design->profile_bio,
                'avatar_url' => $design->avatar_url,
                'banner_url' => $design->banner_url,
            ],
        ]);
    }

    public function storeLink(Request $request): JsonResponse
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'max:100'],
            'url' => ['required', 'string', 'url', 'max:500'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
        ]);

        $data['user_id'] = $request->user()->id;
        $data['sort_order'] ??= LinkInBioLink::where('user_id', $request->user()->id)->count();

        $link = LinkInBioLink::create($data);

        return response()->json(['data' => $link], 201);
    }

    public function updateLink(Request $request, LinkInBioLink $link): JsonResponse
    {
        if ($link->user_id !== $request->user()->id) abort(403);

        $data = $request->validate([
            'title' => ['sometimes', 'string', 'max:100'],
            'url' => ['sometimes', 'string', 'url', 'max:500'],
            'is_active' => ['sometimes', 'boolean'],
            'sort_order' => ['sometimes', 'integer', 'min:0'],
        ]);

        $link->update($data);

        return response()->json(['data' => $link]);
    }

    public function destroyLink(Request $request, LinkInBioLink $link): JsonResponse
    {
        if ($link->user_id !== $request->user()->id) abort(403);
        $link->delete();
        return response()->json(['message' => 'Link deleted.']);
    }

    // ── Profile ────────────────────────────────────────────────────

    public function saveProfile(Request $request): JsonResponse
    {
        $design = LinkInBioDesign::firstOrCreate(['user_id' => $request->user()->id]);

        $data = $request->validate([
            'profile_name' => ['nullable', 'string', 'max:100'],
            'profile_bio' => ['nullable', 'string', 'max:500'],
            'avatar_url' => ['nullable', 'string', 'max:500'],
            'banner_url' => ['nullable', 'string', 'max:500'],
        ]);

        $design->update($data);

        return response()->json(['data' => $design->fresh()]);
    }

    // ── Social Links CRUD ─────────────────────────────────────────

    public function indexSocials(Request $request): JsonResponse
    {
        $socials = LinkInBioSocialLink::where('user_id', $request->user()->id)
            ->orderBy('sort_order')
            ->get();

        return response()->json(['data' => $socials]);
    }

    public function storeSocial(Request $request): JsonResponse
    {
        $data = $request->validate([
            'platform' => ['required', 'string', 'max:50'],
            'url' => ['required', 'string', 'max:500'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
        ]);

        $data['user_id'] = $request->user()->id;
        $data['sort_order'] ??= LinkInBioSocialLink::where('user_id', $request->user()->id)->count();

        $social = LinkInBioSocialLink::create($data);

        return response()->json(['data' => $social], 201);
    }

    public function updateSocial(Request $request, LinkInBioSocialLink $social): JsonResponse
    {
        if ($social->user_id !== $request->user()->id) abort(403);

        $data = $request->validate([
            'platform' => ['sometimes', 'string', 'max:50'],
            'url' => ['sometimes', 'string', 'max:500'],
            'sort_order' => ['sometimes', 'integer', 'min:0'],
        ]);

        $social->update($data);

        return response()->json(['data' => $social]);
    }

    public function destroySocial(Request $request, LinkInBioSocialLink $social): JsonResponse
    {
        if ($social->user_id !== $request->user()->id) abort(403);
        $social->delete();
        return response()->json(['message' => 'Social link deleted.']);
    }

    // ── Products CRUD ─────────────────────────────────────────────

    public function indexProducts(Request $request): JsonResponse
    {
        $products = LinkInBioProduct::where('user_id', $request->user()->id)
            ->orderBy('sort_order')
            ->get();

        return response()->json(['data' => $products]);
    }

    public function storeProduct(Request $request): JsonResponse
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'max:200'],
            'description' => ['nullable', 'string', 'max:2000'],
            'price' => ['required', 'numeric', 'min:0'],
            'currency' => ['sometimes', 'string', 'max:3'],
            'type' => ['sometimes', 'string', 'in:digital,physical'],
            'media_url' => ['nullable', 'string', 'max:500'],
            'checkout_url' => ['nullable', 'string', 'max:500'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
        ]);

        $data['user_id'] = $request->user()->id;
        $data['sort_order'] ??= LinkInBioProduct::where('user_id', $request->user()->id)->count();

        $product = LinkInBioProduct::create($data);

        return response()->json(['data' => $product], 201);
    }

    public function updateProduct(Request $request, LinkInBioProduct $product): JsonResponse
    {
        if ($product->user_id !== $request->user()->id) abort(403);

        $data = $request->validate([
            'title' => ['sometimes', 'string', 'max:200'],
            'description' => ['nullable', 'string', 'max:2000'],
            'price' => ['sometimes', 'numeric', 'min:0'],
            'currency' => ['sometimes', 'string', 'max:3'],
            'type' => ['sometimes', 'string', 'in:digital,physical'],
            'media_url' => ['nullable', 'string', 'max:500'],
            'checkout_url' => ['nullable', 'string', 'max:500'],
            'is_active' => ['sometimes', 'boolean'],
            'sort_order' => ['sometimes', 'integer', 'min:0'],
        ]);

        $product->update($data);

        return response()->json(['data' => $product]);
    }

    public function destroyProduct(Request $request, LinkInBioProduct $product): JsonResponse
    {
        if ($product->user_id !== $request->user()->id) abort(403);
        $product->delete();
        return response()->json(['message' => 'Product deleted.']);
    }

    // ── Design / Theme ─────────────────────────────────────────────

    public function showDesign(Request $request): JsonResponse
    {
        $design = LinkInBioDesign::firstOrCreate(
            ['user_id' => $request->user()->id]
        );

        $themes = LinkInBioTheme::orderBy('sort_order')->get();

        $currentTheme = null;
        if ($design->theme_id) {
            $currentTheme = LinkInBioTheme::find($design->theme_id);
        }

        return response()->json([
            'data' => [
                'theme_id' => $design->theme_id,
                'bg' => $design->bg,
                'card_bg' => $design->card_bg,
                'text_color' => $design->text_color,
                'accent' => $design->accent,
                'font' => $design->font,
                'button_style' => $design->button_style,
                'layout' => $design->layout,
                'background_type' => $design->background_type,
                'background_value' => $design->background_value,
                'profile_name' => $design->profile_name,
                'profile_bio' => $design->profile_bio,
                'avatar_url' => $design->avatar_url,
                'banner_url' => $design->banner_url,
                'current_theme' => $currentTheme,
                'available_themes' => $themes,
            ],
        ]);
    }

    public function applyTheme(Request $request): JsonResponse
    {
        $data = $request->validate([
            'theme_id' => ['required', 'exists:link_in_bio_themes,id'],
        ]);

        $theme = LinkInBioTheme::findOrFail($data['theme_id']);
        $design = LinkInBioDesign::firstOrCreate(['user_id' => $request->user()->id]);

        $design->update([
            'theme_id' => $theme->id,
            'bg' => $theme->config['bg'] ?? $design->bg,
            'card_bg' => $theme->config['card_bg'] ?? $design->card_bg,
            'text_color' => $theme->config['text_color'] ?? $design->text_color,
            'accent' => $theme->config['accent'] ?? $design->accent,
            'font' => $theme->config['font'] ?? $design->font,
            'button_style' => $theme->config['button_style'] ?? $design->button_style,
            'layout' => $theme->config['layout'] ?? $design->layout,
            'background_type' => $theme->config['background_type'] ?? $design->background_type,
            'background_value' => $theme->config['background_value'] ?? $design->background_value,
        ]);

        return response()->json(['data' => $design->fresh()]);
    }

    public function updateDesign(Request $request): JsonResponse
    {
        $design = LinkInBioDesign::firstOrCreate(['user_id' => $request->user()->id]);

        $data = $request->validate([
            'theme_id' => ['nullable', 'exists:link_in_bio_themes,id'],
            'bg' => ['sometimes', 'string', 'max:20'],
            'card_bg' => ['sometimes', 'string', 'max:20'],
            'text_color' => ['sometimes', 'string', 'max:20'],
            'accent' => ['sometimes', 'string', 'max:20'],
            'font' => ['sometimes', 'string', 'in:sans,serif,mono'],
            'button_style' => ['sometimes', 'string', 'in:rounded,pill,sharp'],
            'layout' => ['sometimes', 'string', 'in:list,grid'],
            'background_type' => ['sometimes', 'string', 'in:solid,gradient,image'],
            'background_value' => ['nullable', 'string', 'max:500'],
        ]);

        $design->update($data);

        return response()->json(['data' => $design->fresh()]);
    }

    // ── Domain ─────────────────────────────────────────────────────

    public function updateDomain(Request $request): JsonResponse
    {
        $data = $request->validate([
            'domain' => ['nullable', 'string', 'max:255'],
            'subdomain' => ['nullable', 'string', 'max:255'],
        ]);

        $url = $data['domain'] ?? ($data['subdomain'] ? $data['subdomain'].'.murihspace.com' : null);

        $request->user()->link_in_bio_url = $url;
        $request->user()->domain_verified_at = null;
        $request->user()->save();

        return response()->json(['data' => ['url' => $url, 'domain_verified' => false]]);
    }

    public function verifyDomain(Request $request): JsonResponse
    {
        $domain = $request->user()->link_in_bio_url;

        if (! $domain) {
            return response()->json(['message' => 'No domain configured.'], 400);
        }

        $verified = false;
        $records = [];

        if (function_exists('dns_get_record')) {
            $records = @dns_get_record($domain, DNS_CNAME) ?: [];
            foreach ($records as $record) {
                if (rtrim($record['target'] ?? '', '.') === 'link.murihspace.com') {
                    $verified = true;
                    break;
                }
            }
        }

        if ($verified) {
            $request->user()->domain_verified_at = now();
            $request->user()->save();
        }

        return response()->json([
            'data' => [
                'domain' => $domain,
                'verified' => $verified,
                'verified_at' => $request->user()->domain_verified_at,
                'dns_records' => $records,
            ],
        ]);
    }

    // ── Click Tracking ─────────────────────────────────────────────

    public function trackClick(Request $request, int $linkId): JsonResponse
    {
        $link = LinkInBioLink::where('user_id', $request->user()->id)
            ->findOrFail($linkId);

        $link->increment('click_count');

        return response()->json(['data' => ['click_count' => $link->fresh()->click_count]]);
    }

    // ── Public Redirect (click tracking) ───────────────────────────

    public function redirectClick(int $linkId): RedirectResponse
    {
        $link = LinkInBioLink::find($linkId);

        if (! $link || ! $link->is_active) {
            abort(404);
        }

        $link->increment('click_count');

        return redirect($link->url);
    }

    // ── Public page ────────────────────────────────────────────────

    public function publicPage(string $username): JsonResponse
    {
        $user = User::where('username', $username)->first();

        if (! $user) {
            return response()->json(['message' => 'User not found.'], 404);
        }

        $links = LinkInBioLink::where('user_id', $user->id)
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->get(['id', 'title', 'url', 'sort_order', 'click_count']);

        $socials = LinkInBioSocialLink::where('user_id', $user->id)
            ->orderBy('sort_order')
            ->get(['id', 'platform', 'url']);

        $products = LinkInBioProduct::where('user_id', $user->id)
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->get();

        $design = LinkInBioDesign::where('user_id', $user->id)->first();

        return response()->json([
            'data' => [
                'username' => $user->username,
                'profile_name' => $design?->profile_name ?? $user->name,
                'profile_bio' => $design?->profile_bio,
                'avatar_url' => $design?->avatar_url,
                'banner_url' => $design?->banner_url,
                'bg' => $design?->bg ?? '#ffffff',
                'card_bg' => $design?->card_bg ?? '#f5f5f5',
                'text_color' => $design?->text_color ?? '#1a1a1a',
                'accent' => $design?->accent ?? '#2164b6',
                'font' => $design?->font ?? 'sans',
                'button_style' => $design?->button_style ?? 'rounded',
                'layout' => $design?->layout ?? 'list',
                'background_type' => $design?->background_type ?? 'solid',
                'background_value' => $design?->background_value,
                'links' => $links,
                'social_links' => $socials,
                'products' => $products,
            ],
        ]);
    }
}
