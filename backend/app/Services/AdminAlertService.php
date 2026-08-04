<?php

namespace App\Services;

use App\Models\AdminAlert;
use App\Models\User;
use Illuminate\Support\Arr;
use Illuminate\Support\Str;

class AdminAlertService
{
    public function dispatch(array $data): AdminAlert
    {
        $alert = AdminAlert::create([
            'event_type' => $data['event_type'] ?? 'unknown',
            'severity' => $data['severity'] ?? 'warning',
            'environment' => $data['environment'] ?? 'production',
            'title' => $data['title'] ?? 'Admin alert',
            'description' => $this->sanitizeDescription($data['description'] ?? ''),
            'affected_service' => $data['affected_service'] ?? null,
            'reference' => $data['reference'] ?? null,
            'metadata' => $data['metadata'] ?? [],
            'channels' => $this->channelsFor($data['severity'] ?? 'warning'),
            'requires_acknowledgement' => $this->requiresAcknowledgement($data['severity'] ?? 'warning'),
            'status' => 'new',
        ]);

        return $alert;
    }

    public function acknowledge(AdminAlert $alert, User $actor, ?string $note = null): AdminAlert
    {
        $alert->update([
            'status' => 'acknowledged',
            'acknowledged_at' => now(),
            'acknowledged_by' => $actor->id,
            'acknowledgement_note' => $note,
        ]);

        return $alert->fresh();
    }

    protected function channelsFor(string $severity): array
    {
        return match ($severity) {
            'critical' => ['email', 'telegram'],
            'warning' => ['email', 'telegram'],
            default => ['email'],
        };
    }

    protected function requiresAcknowledgement(string $severity): bool
    {
        return $severity === 'critical';
    }

    protected function sanitizeDescription(string $description): string
    {
        $redacted = $description;
        foreach (['card_number', 'card', 'token', 'otp_code', 'password', 'secret'] as $key) {
            $redacted = preg_replace('/' . preg_quote($key, '/') . '\s*[:=]?\s*[^\s,;]+/i', '[redacted]', $redacted) ?? $redacted;
        }

        $redacted = preg_replace('/\b\d{4}(?:[- ]?\d{4}){3}\b/', '[redacted]', $redacted) ?? $redacted;
        $redacted = preg_replace('/\b[a-zA-Z0-9]{8,}\b/', '[redacted]', $redacted) ?? $redacted;
        $redacted = preg_replace('/\b\d{6}\b/', '[redacted]', $redacted) ?? $redacted;

        return trim($redacted);
    }
}
