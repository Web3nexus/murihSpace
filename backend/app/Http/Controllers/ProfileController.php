<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ProfileController extends Controller
{
    /**
     * Format user profile payload consistently.
     */
    private function formatUserProfile(\App\Models\User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'username' => $user->username,
            'role' => $user->role,
            'bio' => $user->bio,
            'avatar' => $user->avatar,
            'avatar_url' => $user->avatar_url ?? $user->avatar,
            'banner_url' => $user->banner_url ?? null,
            'website' => $user->website,
            'gender' => $user->gender,
            'category' => $user->category,
            'interests' => $user->interests,
            'languages' => $user->languages,
            'is_creator_account' => (bool) ($user->is_creator_account ?? true),
            'show_interests' => (bool) ($user->show_interests ?? true),
            'allow_tagging' => (bool) ($user->allow_tagging ?? true),
            'show_contact_info' => (bool) ($user->show_contact_info ?? true),
            'account_privacy' => $user->account_privacy ?? 'public',
            'country' => $user->country,
            'county' => $user->county,
            'state' => $user->state,
            'mobile_number' => $user->mobile_number,
            'phone' => $user->mobile_number,
            'birthday' => $user->birthday?->format('Y-m-d'),
            'kyc_status' => $user->kyc_status,
            'kyc_document' => $user->kyc_document,
            'kyc_rejection_reason' => $user->kyc_rejection_reason,
            'has_active_verification_badge' => $user->hasActiveVerificationBadge(),
            'email_verified' => $user->hasVerifiedEmail(),
            'posts_count' => $user->posts()->count(),
            'followers_count' => $user->followers()->count(),
            'following_count' => $user->follows()->count(),
            'communities_count' => $user->communities()->count(),
            'coins' => $user->systemWallet?->available ?? 0,
            'created_at' => $user->created_at?->toISOString(),
        ];
    }

    /**
     * Display the authenticated user's profile.
     */
    public function show(Request $request): JsonResponse
    {
        return response()->json($this->formatUserProfile($request->user()));
    }

    /**
     * Update the authenticated user's profile details.
     */
    public function update(Request $request): JsonResponse
    {
        $user = $request->user();

        if ($request->filled('phone') && ! $request->filled('mobile_number')) {
            $request->merge(['mobile_number' => $request->input('phone')]);
        }

        $validated = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'username' => ['sometimes', 'required', 'string', 'min:3', 'max:50', 'regex:/\A[a-zA-Z0-9_]+\z/', Rule::unique('users')->ignore($user->id)],
            'bio' => ['nullable', 'string', 'max:1000'],
            'avatar' => ['nullable', 'string', 'max:2048'],
            'avatar_url' => ['nullable', 'string', 'max:2048'],
            'banner_url' => ['nullable', 'string', 'max:2048'],
            'website' => ['nullable', 'string', 'max:512'],
            'gender' => ['nullable', 'string', 'max:50'],
            'category' => ['nullable', 'string', 'max:100'],
            'interests' => ['nullable', 'array', 'max:50'],
            'interests.*' => ['string', 'max:50'],
            'languages' => ['nullable', 'array', 'max:20'],
            'languages.*' => ['string', 'max:50'],
            'is_creator_account' => ['nullable', 'boolean'],
            'show_interests' => ['nullable', 'boolean'],
            'allow_tagging' => ['nullable', 'boolean'],
            'show_contact_info' => ['nullable', 'boolean'],
            'account_privacy' => ['nullable', 'string', 'in:public,private'],
            'country' => ['nullable', 'string', 'max:255'],
            'county' => ['nullable', 'string', 'max:255'],
            'state' => ['nullable', 'string', 'max:255'],
            'mobile_number' => ['nullable', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:255'],
            'birthday' => ['nullable', 'date', 'before:today'],
        ]);

        if (isset($validated['phone']) && ! isset($validated['mobile_number'])) {
            $validated['mobile_number'] = $validated['phone'];
        }
        unset($validated['phone']);

        if (isset($validated['avatar']) && ! isset($validated['avatar_url'])) {
            $validated['avatar_url'] = $validated['avatar'];
        }

        $user->update($validated);

        return response()->json($this->formatUserProfile($user));
    }

    /**
     * Upload and update user avatar image.
     */
    public function uploadAvatar(Request $request, \App\Services\StorageRouter $router, \App\Services\FileSecurityFilterService $securityFilter): JsonResponse
    {
        $user = $request->user();

        if ($request->has('avatar_url') || $request->has('avatar')) {
            $url = $request->input('avatar_url') ?: $request->input('avatar');
            $user->update([
                'avatar' => $url,
                'avatar_url' => $url,
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Avatar updated successfully.',
                'avatar' => $url,
                'avatar_url' => $url,
                'url' => $url,
                'user' => $this->formatUserProfile($user),
            ]);
        }

        $request->validate([
            'file' => [
                'required',
                'file',
                'image',
                'mimes:jpeg,png,jpg,webp,gif',
                'max:10240',
            ],
        ]);

        $file = $request->file('file');
        $securityFilter->validateUploadedFile($file);

        $mime = $file->getMimeType();
        $target = $router->resolve($mime, 'avatars');
        $disk = $target['disk'];
        $folder = $target['folder'];

        $diskConfig = config("filesystems.disks.{$disk}");
        if (! $diskConfig) {
            $disk = 'contabo';
        }

        $cleanExt = strtolower($file->getClientOriginalExtension() ?: 'jpg');
        $cleanExt = preg_replace('/[^a-z0-9]/', '', $cleanExt);
        $filename = 'avatar_' . $user->id . '_' . \Illuminate\Support\Str::random(24) . ($cleanExt ? '.' . $cleanExt : '');
        $path = ltrim($folder . '/' . $filename, '/');

        $stored = \Illuminate\Support\Facades\Storage::disk($disk)->put(
            $path,
            file_get_contents($file->getRealPath()),
            [
                'visibility' => 'public',
                'ContentType' => $mime,
                'CacheControl' => 'public, max-age=86400',
            ]
        );

        if (! $stored) {
            return response()->json(['message' => 'Failed to store avatar.'], 500);
        }

        $url = \Illuminate\Support\Facades\Storage::disk($disk)->url($path);

        $user->update([
            'avatar' => $url,
            'avatar_url' => $url,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Avatar updated successfully.',
            'avatar' => $url,
            'avatar_url' => $url,
            'url' => $url,
            'user' => $this->formatUserProfile($user),
        ]);
    }

    /**
     * Upload and update user profile cover banner image.
     */
    public function uploadBanner(Request $request, \App\Services\StorageRouter $router, \App\Services\FileSecurityFilterService $securityFilter): JsonResponse
    {
        $user = $request->user();

        if ($request->has('banner_url') || $request->has('banner')) {
            $url = $request->input('banner_url') ?: $request->input('banner');
            $user->update(['banner_url' => $url]);

            return response()->json([
                'success' => true,
                'message' => 'Cover banner updated successfully.',
                'banner_url' => $url,
                'url' => $url,
                'user' => $this->formatUserProfile($user),
            ]);
        }

        $request->validate([
            'file' => [
                'required',
                'file',
                'image',
                'mimes:jpeg,png,jpg,webp,gif',
                'max:15360',
            ],
        ]);

        $file = $request->file('file');
        $securityFilter->validateUploadedFile($file);

        $mime = $file->getMimeType();
        $target = $router->resolve($mime, 'banners');
        $disk = $target['disk'];
        $folder = $target['folder'];

        $diskConfig = config("filesystems.disks.{$disk}");
        if (! $diskConfig) {
            $disk = 'contabo';
        }

        $cleanExt = strtolower($file->getClientOriginalExtension() ?: 'jpg');
        $cleanExt = preg_replace('/[^a-z0-9]/', '', $cleanExt);
        $filename = 'banner_' . $user->id . '_' . \Illuminate\Support\Str::random(24) . ($cleanExt ? '.' . $cleanExt : '');
        $path = ltrim($folder . '/' . $filename, '/');

        $stored = \Illuminate\Support\Facades\Storage::disk($disk)->put(
            $path,
            file_get_contents($file->getRealPath()),
            [
                'visibility' => 'public',
                'ContentType' => $mime,
                'CacheControl' => 'public, max-age=86400',
            ]
        );

        if (! $stored) {
            return response()->json(['message' => 'Failed to store banner.'], 500);
        }

        $url = \Illuminate\Support\Facades\Storage::disk($disk)->url($path);

        $user->update(['banner_url' => $url]);

        return response()->json([
            'success' => true,
            'message' => 'Cover banner updated successfully.',
            'banner_url' => $url,
            'url' => $url,
            'user' => $this->formatUserProfile($user),
        ]);
    }

    /**
     * Submit identity verification (KYC) documents.
     */
    public function submitKyc(Request $request): JsonResponse
    {
        $user = $request->user();

        $documentData = $request->input('kyc_document');
        if (is_array($documentData)) {
            $docString = json_encode($documentData);
        } elseif (is_string($documentData)) {
            $docString = $documentData;
        } else {
            // Check for individual document fields
            $fields = $request->only([
                'document_type',
                'id_number',
                'full_legal_name',
                'country',
                'expiry_date',
                'front_url',
                'back_url',
                'selfie_url',
            ]);
            $docString = !empty(array_filter($fields)) ? json_encode($fields) : null;
        }

        if (empty($docString)) {
            return response()->json([
                'message' => 'The kyc_document field or document details are required.',
                'errors' => ['kyc_document' => ['Document submission details are required.']],
            ], 422);
        }

        $user->update([
            'kyc_document' => $docString,
            'kyc_status' => 'pending',
            'kyc_rejection_reason' => null,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'KYC verification submitted successfully and is pending review.',
            'kyc_status' => $user->kyc_status,
            'kyc_document' => $user->kyc_document,
        ]);
    }

    public function updatePrivacy(Request $request): JsonResponse
    {
        $data = $request->validate([
            'show_online_status' => 'boolean',
            'show_last_seen' => 'boolean',
            'show_email' => 'boolean',
            'show_phone' => 'boolean',
        ]);

        $request->user()->update($data);

        return response()->json(['message' => 'Privacy settings updated.', 'data' => $data]);
    }

    public function exportData(Request $request): JsonResponse
    {
        $user = $request->user();

        return response()->json([
            'user' => $user->toArray(),
            'wallet' => $user->wallet?->toArray(),
            'profile' => $user->profile?->toArray(),
        ]);
    }

    public function deleteAccount(Request $request): JsonResponse
    {
        $user = $request->user();

        // If user has a password set, require password or explicit DELETE confirmation
        if ($user->password) {
            if ($request->filled('password')) {
                $request->validate([
                    'password' => ['required', 'current_password'],
                ]);
            } else {
                $request->validate([
                    'confirmation' => ['required', 'string', 'in:DELETE,delete'],
                ]);
            }
        } else {
            // Passwordless (phone OTP / OAuth) users confirm via confirmation keyword
            $request->validate([
                'confirmation' => ['required', 'string', 'in:DELETE,delete'],
            ]);
        }

        // 1. Revoke API tokens
        $user->tokens()->delete();

        // 2. Delete push notification device tokens
        \App\Models\PushToken::where('user_id', $user->id)->delete();

        // 3. Mark user as deleted and free up username, while keeping user_id for financial compliance audit
        $originalUsername = $user->username;
        $user->update([
            'status' => 'deleted',
            'username' => null, // Free username for future reuse
            'bio' => null,
            'avatar' => null,
            'avatar_url' => null,
        ]);

        // 4. Soft delete user (preserves all ledger transactions, orders, and financial history)
        $user->delete();

        // 5. Create immutable audit log
        \App\Models\AuditLog::create([
            'user_id' => $user->id,
            'action' => 'account.deleted',
            'details' => json_encode([
                'reason' => $request->input('reason', 'User initiated account deletion'),
                'previous_username' => $originalUsername,
                'email' => $user->email,
                'mobile_number' => $user->mobile_number,
                'ip' => $request->ip(),
                'user_agent' => $request->userAgent(),
            ]),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Your account has been deleted successfully. Financial and audit records have been securely retained in accordance with legal and regulatory compliance standards.',
        ]);
    }

    public function kycStatus(Request $request): JsonResponse
    {
        $user = $request->user();

        return response()->json([
            'kyc_status' => $user->kyc_status ?? 'unsubmitted',
            'kyc_document' => $user->kyc_document,
            'kyc_rejection_reason' => $user->kyc_rejection_reason,
        ]);
    }

    /**
     * Switch active profile mode (member, creator, vendor).
     */
    public function switchRole(Request $request): JsonResponse
    {
        $user = $request->user();

        $validated = $request->validate([
            'role' => ['required', 'string', 'in:member,creator,vendor,admin'],
        ]);

        $targetRole = $validated['role'];

        // Admin can switch to any mode
        if ($user->role === 'admin' || $user->admin_role) {
            $user->update(['role' => $targetRole]);
            return response()->json([
                'message' => "Switched active mode to {$targetRole}.",
                'role' => $user->role,
            ]);
        }

        // Check if user has approved history or holds unlocked roles
        $hasApprovedRole = \App\Models\AccountRoleHistory::where('user_id', $user->id)
            ->where(function ($q) use ($targetRole) {
                $q->where('requested_role', $targetRole)
                  ->orWhere('previous_role', $targetRole)
                  ->orWhere('status', 'approved');
            })
            ->exists();

        if ($targetRole === 'member' || $hasApprovedRole || $user->role === $targetRole || in_array($targetRole, ['creator', 'vendor'], true)) {
            $user->update(['role' => $targetRole]);
            return response()->json([
                'message' => "Switched active mode to {$targetRole}.",
                'role' => $user->role,
            ]);
        }

        return response()->json([
            'message' => "You must apply and upgrade to {$targetRole} before switching to this mode.",
        ], 403);
    }

    /**
     * Display a user's public profile for web/mobile visitors.
     */
    public function publicProfile(string $username): JsonResponse
    {
        $cleanUsername = ltrim($username, '@');

        $user = \App\Models\User::where('username', $cleanUsername)->first();

        if (! $user || $user->isAdmin()) {
            return response()->json([
                'success' => false,
                'message' => 'User not found.',
            ], 404);
        }

        $publicCommunities = $user->communities()
            ->where('visibility', 'public')
            ->select('communities.id', 'communities.name', 'communities.slug', 'communities.logo_url', 'communities.cover_url', 'communities.description', 'communities.category', 'communities.members_count', 'communities.pricing_type', 'communities.price_amount')
            ->take(6)
            ->get();

        $reviewsQuery = \App\Models\ProductReview::whereHas('physicalProduct', fn ($q) => $q->where('creator_id', $user->id))->approved();
        $reviewsCount = (clone $reviewsQuery)->count();
        $averageRating = $reviewsCount > 0 ? round((clone $reviewsQuery)->avg('rating') ?? 0, 1) : null;

        $hasLinkInBio = \App\Models\LinkInBioLink::where('user_id', $user->id)->where('is_active', true)->exists();
        $storefront = \App\Models\Storefront::where('user_id', $user->id)->where('is_published', true)->first();

        $userBadges = \App\Models\UserBadge::where('user_id', $user->id)
            ->with('badge')
            ->latest('earned_at')
            ->get()
            ->filter(fn ($ub) => $ub->badge && $ub->badge->is_active)
            ->map(fn ($ub) => [
                'id' => $ub->badge->id,
                'slug' => $ub->badge->slug,
                'name' => $ub->badge->name,
                'level_label' => $ub->badge->level_label,
                'description' => $ub->badge->description,
                'icon' => $ub->badge->icon,
                'icon_3d' => $ub->badge->icon_3d,
                'color' => $ub->badge->color,
                'icon_gradient' => $ub->badge->icon_gradient,
                'criteria' => $ub->badge->criteria,
                'earned_at' => $ub->earned_at?->toISOString(),
            ])
            ->values();

        $isPrivate = ($user->account_privacy ?? 'public') === 'private';
        $viewerId = auth('sanctum')->id();
        $isOwnerOrFollower = $viewerId && ($viewerId === $user->id || $user->followers()->where('follower_id', $viewerId)->exists());
        $hidePrivateDetails = $isPrivate && ! $isOwnerOrFollower;
        $showContactInfo = (bool) ($user->show_contact_info ?? true);

        return response()->json([
            'id' => $user->id,
            'name' => $user->name,
            'username' => $user->username,
            'role' => $user->role,
            'bio' => $hidePrivateDetails ? null : $user->bio,
            'avatar' => $user->avatar,
            'avatar_url' => $user->avatar_url ?? $user->avatar,
            'banner_url' => $user->banner_url,
            'website' => ($showContactInfo && ! $hidePrivateDetails) ? $user->website : null,
            'category' => $user->category,
            'gender' => $user->gender,
            'interests' => (! $hidePrivateDetails && ($user->show_interests ?? true)) ? ($user->interests ?? []) : [],
            'languages' => $hidePrivateDetails ? [] : ($user->languages ?? []),
            'is_creator_account' => (bool) ($user->is_creator_account ?? true),
            'show_interests' => (bool) ($user->show_interests ?? true),
            'allow_tagging' => (bool) ($user->allow_tagging ?? true),
            'show_contact_info' => $showContactInfo,
            'account_privacy' => $user->account_privacy ?? 'public',
            'country' => $user->country,
            'kyc_status' => $user->kyc_status,
            'has_active_verification_badge' => $user->hasActiveVerificationBadge(),
            'followers_count' => $user->followers()->count(),
            'following_count' => $user->follows()->count(),
            'communities_count' => $hidePrivateDetails ? 0 : $user->communities()->count(),
            'posts_count' => $hidePrivateDetails ? 0 : $user->posts()->count(),
            'reviews_count' => $reviewsCount,
            'average_rating' => $averageRating,
            'has_link_in_bio' => $hidePrivateDetails ? false : $hasLinkInBio,
            'storefront' => (! $hidePrivateDetails && $storefront) ? [
                'short_code' => $storefront->short_code,
                'display_name' => $storefront->display_name,
            ] : null,
            'public_communities' => $hidePrivateDetails ? [] : $publicCommunities,
            'badges' => $hidePrivateDetails ? [] : $userBadges,
            'created_at' => $user->created_at?->toISOString(),
        ]);
    }

    /**
     * Update the authenticated user's FCM token.
     */
    public function updateFcmToken(Request $request): JsonResponse
    {
        $request->validate([
            'fcm_token' => 'required|string',
            'platform' => ['nullable', \Illuminate\Validation\Rule::in(['ios', 'android'])],
        ]);

        $user = $request->user();
        $token = $request->input('fcm_token');

        $user->update([
            'fcm_token' => $token,
        ]);

        // Also track every device token so pushes fan out to all of the
        // user's devices instead of only the most recently seen one.
        $ua = $request->header('User-Agent', '');
        $platform = $request->input('platform');
        if (! $platform) {
            $isIos = stripos($ua, 'ios') !== false || stripos($ua, 'iPhone') !== false || stripos($ua, 'iPad') !== false;
            $platform = $isIos ? 'ios' : 'android';
        }

        // Clean up this token if it was previously registered to another user account on the same device.
        \App\Models\PushToken::where('token', $token)->where('user_id', '!=', $user->id)->delete();

        $user->pushTokens()->updateOrCreate(
            ['token' => $token],
            ['platform' => $platform],
        );

        return response()->json(['message' => 'FCM token updated successfully.']);
    }
}
