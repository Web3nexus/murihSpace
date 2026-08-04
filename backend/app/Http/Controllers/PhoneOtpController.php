<?php

namespace App\Http\Controllers;

use App\Services\Otp\OtpProviderException;
use App\Services\Otp\PhoneOtpService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
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
        ]);

        try {
            $result = $this->otp->request($validated, $request);
        } catch (OtpProviderException $e) {
            return response()->json([
                'message' => 'The verification could not be sent. Please try again later.',
            ], 503);
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
