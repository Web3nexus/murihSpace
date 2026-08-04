<?php

namespace App\Jobs;

use App\Models\User;
use App\Notifications\NewDeviceLoginNotification;
use App\Services\NotificationService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class SendSecurityLoginAlert implements ShouldQueue
{
    use Queueable;

    public int $tries = 2;

    public function __construct(
        public readonly User $user,
        public readonly ?string $ip,
        public readonly ?string $userAgent,
    ) {}

    public function handle(): void
    {
        $device = $this->describeDevice();

        $this->user->notify(new NewDeviceLoginNotification($device, (string) $this->ip));

        try {
            app(NotificationService::class)->actionEmail(
                user: $this->user,
                title: 'New device sign-in to your MurihSpace account',
                bodyHtml: '<p>Your account was just signed in to from a new device.</p>'
                    .'<p><strong>Device:</strong> '.e($device['device'].' / '.$device['browser'])
                    .'<br><strong>IP address:</strong> '.e((string) $this->ip)
                    .'<br><strong>Time:</strong> '.now()->format('Y-m-d H:i').' WAT</p>'
                    .'<p>If this was you, no action is needed. If you do not recognise this sign-in, revoke the session and contact support.</p>',
                actionLabel: 'Review sessions',
                actionUrl: NotificationService::link('app/settings/security'),
                template: 'new_device_login',
            );
        } catch (\Throwable $e) {
            report($e);
        }
    }

    /**
     * @return array{device: string, browser: string}
     */
    private function describeDevice(): array
    {
        $ua = (string) $this->userAgent;
        $device = 'Unknown device';
        $browser = 'Unknown';

        if (preg_match('/Firefox\/(\S+)/', $ua)) {
            $browser = 'Firefox';
        } elseif (preg_match('/Chrome\/(\S+)/', $ua)) {
            $browser = 'Chrome';
        } elseif (preg_match('/Safari\/(\S+)/', $ua) && ! preg_match('/Chrome/', $ua)) {
            $browser = 'Safari';
        } elseif (preg_match('/Edge\/(\S+)/', $ua)) {
            $browser = 'Edge';
        }

        if (preg_match('/iPhone|iPad/', $ua)) {
            $device = 'iOS Device';
        } elseif (preg_match('/Android/', $ua)) {
            $device = 'Android Device';
        } elseif (preg_match('/Mac OS/', $ua)) {
            $device = 'Mac';
        } elseif (preg_match('/Windows/', $ua)) {
            $device = 'Windows';
        } elseif (preg_match('/Linux/', $ua)) {
            $device = 'Linux';
        }

        return ['device' => $device, 'browser' => $browser];
    }
}
