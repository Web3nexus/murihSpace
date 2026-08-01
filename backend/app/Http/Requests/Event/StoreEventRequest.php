<?php

namespace App\Http\Requests\Event;

use App\Models\Event;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreEventRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'community_id' => ['required', 'exists:communities,id'],
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:10000'],
            'event_type' => ['required', Rule::in(Event::EVENT_TYPES)],
            'start_date' => ['required', 'date', 'after:now'],
            'end_date' => ['required', 'date', 'after:start_date'],
            'timezone' => ['nullable', 'string', 'max:64'],
            'location' => ['nullable', 'string', 'max:500'],
            'meeting_url' => ['nullable', 'string', 'url', 'max:2000'],
            'cover_url' => ['nullable', 'string', 'url', 'max:2000'],
            'capacity' => ['nullable', 'integer', 'min:1'],
            'registration_deadline' => ['nullable', 'date', 'before:start_date'],
        ];
    }

    public function messages(): array
    {
        return [
            'event_type.in' => 'The event type must be one of: online, in_person, hybrid.',
            'start_date.after' => 'The start date must be in the future.',
            'end_date.after' => 'The end date must be after the start date.',
            'registration_deadline.before' => 'The registration deadline must be before the start date.',
        ];
    }
}
