<?php

namespace App\Http\Controllers;

use App\Models\AiMemory;
use App\Models\CreatorProfile;
use App\Models\LinkInBioDesign;
use App\Models\LinkInBioSocialLink;
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
        $data = $request->validate([
            'message' => ['required', 'string', 'max:5000'],
        ]);

        $reply = $this->ai->chat($request->user(), $data['message'], AiService::SOURCE_ONBOARDING);

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
        $draft = $this->ai->draftProfile($request->user());

        AiMemory::remember($request->user()->id, 'profile_draft', $draft);

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
