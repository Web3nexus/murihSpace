<?php

namespace App\Http\Controllers;

use App\Models\AiMemory;
use App\Models\CreatorProfile;
use App\Models\LinkInBioDesign;
use App\Models\LinkInBioSocialLink;
use App\Models\Storefront;
use App\Services\AiService;
use App\Services\SocialProfileService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class OnboardingController extends Controller
{
    public function __construct(
        private readonly AiService $ai,
        private readonly SocialProfileService $socials,
    ) {
    }

    /**
     * Get role-aware onboarding configuration & saved progress.
     */
    public function config(Request $request): JsonResponse
    {
        $user = $request->user();
        $role = $user->role ?? 'member';
        $isBusiness = in_array($role, ['creator', 'vendor'], true);

        $profile = $user->creatorProfile;
        $storefront = $user->storefront;

        $savedProgress = AiMemory::recall($user->id, 'onboarding_progress') ?? [];

        $steps = match ($role) {
            'vendor' => [
                ['key' => 'business', 'label' => 'Business Info'],
                ['key' => 'products', 'label' => 'Products & Fulfilment'],
                ['key' => 'target', 'label' => 'Target Market'],
                ['key' => 'brand', 'label' => 'Brand & Socials'],
                ['key' => 'setup', 'label' => 'Dashboard Setup'],
            ],
            'creator' => [
                ['key' => 'ai', 'label' => 'Meet Mera'],
                ['key' => 'socials', 'label' => 'Connect Socials'],
                ['key' => 'interests', 'label' => 'Your Interests'],
                ['key' => 'profile', 'label' => 'AI Profile'],
                ['key' => 'template', 'label' => 'Pick Template'],
            ],
            default => [
                ['key' => 'profile', 'label' => 'Profile Setup'],
                ['key' => 'interests', 'label' => 'Community Interests'],
                ['key' => 'preferences', 'label' => 'Preferences'],
            ],
        };

        return response()->json([
            'data' => [
                'role' => $role,
                'is_business' => $isBusiness,
                'onboarding_completed' => $profile?->onboarding_completed_at !== null,
                'steps' => $steps,
                'saved_progress' => $savedProgress,
                'profile' => [
                    'name' => $user->name,
                    'username' => $user->username,
                    'about' => $profile?->about,
                    'niche' => $profile?->niche,
                    'community_interests' => $profile?->community_interests ?? [],
                    'content_interests' => $profile?->content_interests ?? [],
                ],
                'storefront' => $storefront ? [
                    'name' => $storefront->display_name ?? $storefront->name,
                    'bio' => $storefront->bio,
                    'tagline' => $storefront->tagline,
                ] : null,
            ],
        ]);
    }

    /**
     * Save onboarding progress to enable resuming after interruption.
     */
    public function saveProgress(Request $request): JsonResponse
    {
        $data = $request->validate([
            'step' => ['required', 'integer', 'min:0'],
            'form_data' => ['nullable', 'array'],
        ]);

        AiMemory::remember($request->user()->id, 'onboarding_progress', [
            'step' => $data['step'],
            'form_data' => $data['form_data'] ?? [],
            'saved_at' => now()->toIso8601String(),
        ]);

        return response()->json(['message' => 'Progress saved.']);
    }

    /**
     * Vendor AI onboarding info save.
     */
    public function saveVendorInfo(Request $request): JsonResponse
    {
        $user = $request->user();

        if ($user->role !== 'vendor' && $user->role !== 'admin') {
            return response()->json(['message' => 'Vendor onboarding is only available for vendor accounts.'], 403);
        }

        $data = $request->validate([
            'business_name'    => ['required', 'string', 'max:255'],
            'business_category'=> ['nullable', 'string', 'max:120'],
            'fulfilment_model' => ['nullable', 'string', 'max:100'],
            'shipping_areas'   => ['nullable', 'array'],
            'business_goals'   => ['nullable', 'array'],
            'bio'              => ['nullable', 'string', 'max:1000'],
            'country'          => ['nullable', 'string', 'size:2', 'exists:countries,iso2'],
        ]);

        $storefront = Storefront::firstOrCreate(
            ['user_id' => $user->id],
            function () use ($data) {
                // Generate a unique short_code only when creating
                $slug = \Illuminate\Support\Str::slug($data['business_name']);
                $slug = $slug ?: 'store';

                do {
                    $shortCode = $slug . '-' . strtolower(\Illuminate\Support\Str::random(5));
                } while (Storefront::where('short_code', $shortCode)->exists());

                return [
                    'display_name' => $data['business_name'],
                    'name'         => $data['business_name'],
                    'short_code'   => $shortCode,
                ];
            }
        );

        // Build partial update — only write fields that were supplied
        $attributes = [
            'display_name' => $data['business_name'],
            'name'         => $data['business_name'],
        ];

        if (array_key_exists('business_category', $data)) {
            $attributes['tagline'] = $data['business_category'];
        }

        if (array_key_exists('bio', $data)) {
            $attributes['bio'] = $data['bio'];
        }

        if (array_key_exists('country', $data) && $data['country']) {
            $attributes['country'] = strtoupper($data['country']);
        }

        $storefront->update($attributes);

        AiMemory::remember($user->id, 'vendor_business', $data);

        return response()->json(['data' => $storefront->fresh()]);
    }

    /**
     * Normal user lightweight setup save.
     */
    public function saveMemberSetup(Request $request): JsonResponse
    {
        $user = $request->user();

        $data = $request->validate([
            'interests'               => ['nullable', 'array', 'max:30'],
            'interests.*'             => ['string', 'max:80'],
            'notification_preferences'=> ['nullable', 'array'],
        ]);

        $profile = CreatorProfile::firstOrCreate(['user_id' => $user->id]);
        $profile->update([
            'community_interests'  => $data['interests'] ?? [],
            'onboarding_completed_at' => now(),
        ]);

        // Persist notification preferences
        if (! empty($data['notification_preferences'])) {
            foreach ($data['notification_preferences'] as $type => $enabled) {
                \App\Models\NotificationPreference::updateOrCreate(
                    ['user_id' => $user->id, 'type' => (string) $type, 'channel' => 'in_app'],
                    ['enabled' => (bool) $enabled]
                );
            }
        }

        return response()->json(['data' => $this->profilePayload($profile->fresh())]);
    }

    public function state(Request $request): JsonResponse
    {
        $user = $request->user();
        $profile = $user->creatorProfile;

        $socialLinks = LinkInBioSocialLink::where('user_id', $user->id)
            ->orderBy('sort_order')
            ->get(['id', 'platform', 'url']);

        $design = LinkInBioDesign::firstOrCreate(['user_id' => $user->id]);

        return response()->json([
            'data' => [
                'onboarding_completed' => $profile?->onboarding_completed_at !== null,
                'profile' => [
                    'about' => $profile?->about,
                    'niche' => $profile?->niche,
                    'community_interests' => $profile?->community_interests ?? [],
                    'content_interests' => $profile?->content_interests ?? [],
                ],
                'social_links' => $socialLinks,
                'template' => $design->template ?? 'minimal',
                'profile_draft' => AiMemory::recall($user->id, 'profile_draft'),
            ],
        ]);
    }

    public function chat(Request $request): JsonResponse
    {
        $user = $request->user();

        if (! $user->hasVerifiedEmail()) {
            return response()->json([
                'message' => 'Please verify your email address to continue building your profile with Mera.',
                'error' => 'EMAIL_NOT_VERIFIED',
            ], 403);
        }

        $data = $request->validate([
            'message' => ['required', 'string', 'max:5000'],
        ]);

        $reply = $this->ai->chat($user, $data['message'], AiService::SOURCE_ONBOARDING);

        return response()->json(['data' => ['reply' => $reply]]);
    }

    public function saveAbout(Request $request): JsonResponse
    {
        $data = $request->validate([
            'about' => ['nullable', 'string', 'max:5000'],
            'niche' => ['nullable', 'string', 'max:120'],
        ]);

        $profile = CreatorProfile::firstOrCreate(['user_id' => $request->user()->id]);
        $profile->update($data);

        AiMemory::remember($request->user()->id, 'business', [
            'about' => $data['about'] ?? null,
            'niche' => $data['niche'] ?? null,
        ]);

        return response()->json(['data' => $this->profilePayload($profile)]);
    }

    public function saveInterests(Request $request): JsonResponse
    {
        $data = $request->validate([
            'community_interests' => ['nullable', 'array', 'max:30'],
            'community_interests.*' => ['string', 'max:80'],
            'content_interests' => ['nullable', 'array', 'max:30'],
            'content_interests.*' => ['string', 'max:80'],
        ]);

        $profile = CreatorProfile::firstOrCreate(['user_id' => $request->user()->id]);
        $profile->update([
            'community_interests' => $data['community_interests'] ?? [],
            'content_interests' => $data['content_interests'] ?? [],
        ]);

        AiMemory::remember($request->user()->id, 'interests', [
            'community' => $profile->community_interests ?? [],
            'content' => $profile->content_interests ?? [],
        ]);

        return response()->json(['data' => $this->profilePayload($profile)]);
    }

    public function saveSocials(Request $request): JsonResponse
    {
        $data = $request->validate([
            'socials' => ['required', 'array', 'max:20'],
            'socials.*.platform' => ['required', 'string', 'max:50'],
            'socials.*.handle' => ['required', 'string', 'max:100'],
        ]);

        $user = $request->user();
        $platforms = $this->socials->platforms();

        $saved = [];

        foreach ($data['socials'] as $entry) {
            $platform = $entry['platform'];

            if (! in_array($platform, $platforms, true)) {
                continue;
            }

            $handle = $this->socials->normalizeHandle($platform, $entry['handle']);

            if ($handle === null) {
                continue;
            }

            $url = $this->socials->url($platform, $handle) ?? $handle;

            $row = LinkInBioSocialLink::firstOrNew([
                'user_id' => $user->id,
                'platform' => $platform,
            ]);

            if (! $row->exists) {
                $row->sort_order = LinkInBioSocialLink::where('user_id', $user->id)->count();
            }

            $row->url = $url;
            $row->save();

            $saved[] = $row;
        }

        if ($saved) {
            AiMemory::remember($user->id, 'socials', collect($saved)->map(fn ($s) => [
                'platform' => $s->platform,
                'url' => $s->url,
            ])->all());
        }

        return response()->json([
            'data' => LinkInBioSocialLink::where('user_id', $user->id)->orderBy('sort_order')->get(['id', 'platform', 'url']),
        ]);
    }

    public function draftProfile(Request $request): JsonResponse
    {
        $user = $request->user();

        if (! $user->hasVerifiedEmail()) {
            return response()->json([
                'message' => 'Please verify your email address to continue building your profile with Mera.',
                'error' => 'EMAIL_NOT_VERIFIED',
            ], 403);
        }

        $draft = $this->ai->draftProfile($user);

        AiMemory::remember($user->id, 'profile_draft', $draft);

        return response()->json(['data' => $draft]);
    }

    public function setup(Request $request): JsonResponse
    {
        $data = $request->validate([
            'template' => ['sometimes', 'string', 'in:'.implode(',', LinkInBioController::TEMPLATES)],
            'profile_name' => ['nullable', 'string', 'max:100'],
            'profile_bio' => ['nullable', 'string', 'max:500'],
            'bg' => ['sometimes', 'string', 'max:20'],
            'card_bg' => ['sometimes', 'string', 'max:20'],
            'text_color' => ['sometimes', 'string', 'max:20'],
            'accent' => ['sometimes', 'string', 'max:20'],
            'font' => ['sometimes', 'string', 'in:sans,serif,mono'],
            'button_style' => ['sometimes', 'string', 'in:rounded,pill,sharp'],
            'background_type' => ['sometimes', 'string', 'in:solid,gradient,image'],
            'background_value' => ['nullable', 'string', 'max:500'],
        ]);

        $design = LinkInBioDesign::firstOrCreate(['user_id' => $request->user()->id]);

        $fields = array_intersect_key($data, array_flip([
            'template', 'bg', 'card_bg', 'text_color', 'accent',
            'font', 'button_style', 'background_type', 'background_value',
        ]));

        if (array_key_exists('profile_name', $data) || array_key_exists('profile_bio', $data)) {
            $fields['profile_name'] = $data['profile_name'] ?? null;
            $fields['profile_bio'] = $data['profile_bio'] ?? null;
        }

        $design->update($fields);

        return response()->json(['data' => $design->fresh()]);
    }

    public function complete(Request $request): JsonResponse
    {
        $profile = CreatorProfile::firstOrCreate(['user_id' => $request->user()->id]);
        $profile->update(['onboarding_completed_at' => now()]);

        return response()->json(['data' => $this->profilePayload($profile->fresh())]);
    }

    private function profilePayload(CreatorProfile $profile): array
    {
        return [
            'about' => $profile->about,
            'niche' => $profile->niche,
            'community_interests' => $profile->community_interests ?? [],
            'content_interests' => $profile->content_interests ?? [],
            'onboarding_completed' => $profile->onboarding_completed_at !== null,
        ];
    }
}
