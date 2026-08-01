<?php

namespace App\Http\Requests\CoachingService;

use Illuminate\Foundation\Http\FormRequest;

class StoreCoachingServiceRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:5000'],
            'duration_minutes' => ['required', 'integer', 'min:15', 'max:480'],
            'price' => ['required', 'integer', 'min:0'],
            'currency' => ['nullable', 'string', 'size:3'],
            'location_type' => ['nullable', 'in:online,in_person'],
            'meeting_url' => ['nullable', 'string', 'url', 'max:2000'],
            'is_active' => ['nullable', 'boolean'],
            'buffer_minutes' => ['nullable', 'integer', 'min:0', 'max:120'],
            'max_daily_bookings' => ['nullable', 'integer', 'min:1', 'max:50'],
        ];
    }

    public function messages(): array
    {
        return [
            'location_type.in' => 'Location type must be online or in_person.',
            'duration_minutes.max' => 'Session duration cannot exceed 480 minutes.',
            'currency.size' => 'Currency must be a 3-letter code.',
        ];
    }
}
