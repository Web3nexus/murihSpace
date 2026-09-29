<?php

namespace App\Http\Controllers;

use App\Services\Otp\OtpProviderException;
use App\Services\Otp\PhoneOtpService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;

class PhoneOtpController extends Controller
{
    public function __construct(
        private readonly PhoneOtpService $otp,
    ) {}

    public function request(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'intent' => ['required', 'string', Rule::in(['register', 'login'])],
            'phone_e164' => ['required_without:mobile_number', 'string', 'regex:/^\+[1-9]\d{1,14}$/'],
            'country_iso2' => ['required_without:phone_e164', 'string', 'size:2'],
            'mobile_number' => ['required_without:phone_e164', 'string'],
            'device_id' => ['nullable', 'string', 'max:255'],
            'channel' => ['sometimes', 'string', Rule::in(['sms', 'call', 'whatsapp'])],
            // Without this the client could never opt out of in-app delivery, and
            // the flag was silently dropped before reaching PhoneOtpService.
            'force_sms' => ['sometimes', 'boolean'],
        ]);

        try {
            $result = $this->otp->request($validated, $request);
        } catch (OtpProviderException $e) {
            // Log the real reason: the client previously only ever saw
            // "could not be sent", which made misconfiguration (blank
            // OTP_DRIVER, missing Twilio secrets) undiagnosable.
            Log::error('[phone-otp] request failed', [
                'intent' => $validated['intent'],
                'driver' => (string) config('services.twilio.otp_driver'),
                'environment' => app()->environment(),
                'reason' => $e->getMessage(),
            ]);

            $payload = [
                'message' => 'The verification could not be sent. Please try again later.',
            ];

            // Outside production the operator needs the actual cause; a generic
            // 503 gave no way to tell misconfiguration from a provider outage.
            // The response envelope always nulls `data` on failure and relocates
            // unknown keys into `errors`, so it is emitted there deliberately.
            if (! app()->environment('production')) {
                $payload['errors'] = ['debug_reason' => $e->getMessage()];
            }

            return response()->json($payload, 503);
        }

        return response()->json(array_merge([
            'message' => 'Verification code sent.',
        ], $result));
    }

    public function verify(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'intent' => ['required', 'string', Rule::in(['register', 'login'])],
            'phone_e164' => ['required', 'string', 'regex:/^\+[1-9]\d{1,14}$/'],
            'code' => ['required', 'string', 'size:6', 'regex:/^\d{6}$/'],
            'registration_session_id' => ['nullable', 'string', 'max:255'],
            'device_id' => ['nullable', 'string', 'max:255'],
        ]);

        try {
            $result = $this->otp->verify($validated, $request);
        } catch (OtpProviderException $e) {
            return response()->json([
                'message' => 'The verification could not be completed. Please try again later.',
            ], 503);
        }

        return response()->json(array_merge([
            'message' => 'Phone number verified.',
        ], $result));
    }
}
