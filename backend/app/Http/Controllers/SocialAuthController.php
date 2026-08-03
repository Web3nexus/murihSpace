<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Services\NotificationService;
use App\Services\OAuthProviderService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class SocialAuthController extends Controller
{
    public function __construct(
        private readonly OAuthProviderService $oauth,
        private readonly NotificationService $notifications,
    ) {}

    public function redirect(Request $request, string $provider)
    {
        if (! in_array($provider, OAuthProviderService::PROVIDERS, true)) {
            return response()->json(['message' => 'Unsupported provider.'], 400);
        }

        if (! $this->oauth->isConfigured($provider)) {
            return response()->json([
                'message' => "{$provider} login is not configured. Use email registration instead.",
                'manual_register' => true,
            ], 400);
        }

        $state = $this->oauth->state($provider);

        return response()->json([
            'redirect_url' => $this->oauth->authorizeUrl($provider, $state),
        ]);
    }

    public function callback(Request $request, string $provider)
    {
        if (! in_array($provider, OAuthProviderService::PROVIDERS, true)) {
            return $this->htmlOrJson($request, ['message' => 'Unsupported provider.'], 400);
        }

        $code = $request->input('code');
        $state = $request->input('state');

        if (! $code) {
            $error = $request->input('error', 'Authorization code missing.');
            $description = $request->input('error_description', '');

            return $this->htmlOrJson($request, [
                'message' => $description ?: $error,
                'error' => 'OAUTH_DENIED',
            ], 400);
        }

        if ($state && ! $this->oauth->verifyState($state, $provider)) {
            return $this->htmlOrJson($request, ['message' => 'Invalid OAuth state.', 'error' => 'OAUTH_STATE'], 400);
        }

        $profile = $this->oauth->profile($provider, $code, $request->all());

        if (! $profile || empty($profile['email'])) {
            return $this->htmlOrJson($request, [
                'message' => 'Could not fetch your profile from '.ucfirst($provider).'. Please try again.',
                'error' => 'OAUTH_PROFILE',
            ], 400);
        }

        $user = $this->findOrCreateUser($provider, $profile);

        if (! $user) {
            return $this->htmlOrJson($request, [
                'message' => 'An account already exists with this email using another sign-in method.',
                'error' => 'EMAIL_TAKEN',
            ], 409);
        }

        app(\App\Services\SocialAccountService::class)->connect($user, $provider, $profile);

        $ttl = (int) (config('sanctum.expiration') ?? 1440);
        $token = $user->createToken('auth-token', ['*'], now()->addMinutes($ttl))->plainTextToken;

        $payload = [
            'token' => $token,
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'username' => $user->username,
                'role' => $user->role,
                'avatar_url' => $user->avatar_url,
                'email_verified' => $user->hasVerifiedEmail(),
                'link_in_bio_url' => $user->getLinkInBioUrl(),
                'username_trial_ends_at' => $user->username_trial_ends_at?->toIso8601String(),
            ],
        ];

        if ($this->wantsHtml($request)) {
            return $this->htmlRedirect($payload, $request->input('error') ?: null);
        }

        return response()->json($payload);
    }

    private function findOrCreateUser(string $provider, array $profile): ?User
    {
        // Existing account already linked to this provider identity.
        $linked = User::where('provider', $provider)
            ->where('provider_id', $profile['id'])
            ->first();

        if ($linked) {
            return $linked;
        }

        $byEmail = User::where('email', $profile['email'])->first();

        if ($byEmail) {
            // Same email, same provider but not linked yet — safe to link.
            if ($byEmail->provider === $provider) {
                $byEmail->update(['provider_id' => $profile['id']]);

                return $byEmail;
            }

            // Same email already tied to another sign-in method — refuse to take over.
            if ($byEmail->provider) {
                return null;
            }

            $byEmail->update([
                'provider' => $provider,
                'provider_id' => $profile['id'],
            ]);

            return $byEmail;
        }

        $username = $this->uniqueUsername($profile['email']);

        $trialDays = (int) \App\Models\AdminSetting::get('free_username_trial_days', 7);

        $user = User::create([
            'name' => $profile['name'] ?: explode('@', $profile['email'])[0],
            'email' => $profile['email'],
            'username' => $username,
            'password' => Hash::make(Str::random(32)),
            'provider' => $provider,
            'provider_id' => $profile['id'],
            'avatar_url' => $profile['avatar'] ?? null,
            'role' => 'member',
            'username_trial_ends_at' => now()->addDays($trialDays),
            'email_verified_at' => now(),
        ]);

        try {
            $this->notifications->actionEmail(
                user: $user,
                title: 'Welcome to MurihSpace, '.e($user->name).'!',
                bodyHtml: '<p>Welcome to MurihSpace, '.e($user->name).'! Your account is ready.</p><p>Create your profile, share posts, join communities, and connect with creators and members around the world.</p>',
                actionLabel: 'Explore MurihSpace',
                actionUrl: NotificationService::link('app'),
                template: 'welcome',
            );
        } catch (\Throwable $e) {
            report($e);
        }

        return $user;
    }

    private function uniqueUsername(string $email): string
    {
        $base = Str::slug(explode('@', $email)[0], '_');
        $base = substr($base ?: 'user', 0, 40);

        $username = $base;
        $i = 1;

        while (User::where('username', $username)->exists()) {
            $username = substr($base, 0, 40 - strlen((string) $i)).$i;
            $i++;
        }

        return $username;
    }

    private function wantsHtml(Request $request): bool
    {
        if ($request->isMethod('post')) {
            return true;
        }

        return ! $request->wantsJson();
    }

    private function htmlRedirect(array $payload, ?string $error): \Illuminate\Http\Response
    {
        $frontend = rtrim((string) config('app.frontend_url'), '/').'/social/callback#';

        $fragments = ['token='.urlencode($payload['token'])];
        $fragments[] = 'user='.urlencode(base64_encode(json_encode($payload['user'])));

        if ($error) {
            $fragments[] = 'error='.urlencode($error);
        }

        $url = $frontend.implode('&', $fragments);

        $html = '<!doctype html><html><head><meta name="robots" content="noindex"><meta http-equiv="refresh" content="0; url='.e($url).'"></head>'
            .'<body><script>window.location.replace('.json_encode($url).');</script>'
            .'<p>Signing you in… <a href="'.e($url).'">Continue</a></p></body></html>';

        return response($html)->header('Content-Type', 'text/html');
    }

    private function htmlOrJson(Request $request, array $data, int $status): JsonResponse|\Illuminate\Http\Response
    {
        if ($this->wantsHtml($request)) {
            $frontend = rtrim((string) config('app.frontend_url'), '/').'/social/callback#error='.urlencode($data['message']);

            $html = '<!doctype html><html><head><meta name="robots" content="noindex"><meta http-equiv="refresh" content="0; url='.e($frontend).'"></head>'
                .'<body><script>window.location.replace('.json_encode($frontend).');</script>'
                .'<p>'.e($data['message']).' <a href="'.e($frontend).'">Continue</a></p></body></html>';

            return response($html, $status)->header('Content-Type', 'text/html');
        }

        return response()->json($data, $status);
    }
}
