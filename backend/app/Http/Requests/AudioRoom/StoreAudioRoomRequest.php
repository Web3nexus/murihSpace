<?php

namespace App\Http\Requests\AudioRoom;

use Illuminate\Foundation\Http\FormRequest;

class StoreAudioRoomRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'community_id' => ['nullable', 'integer', 'exists:communities,id'],
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:5000'],
            'cover_url' => ['nullable', 'string', 'url', 'max:2000'],
            'scheduled_at' => ['nullable', 'date', 'after:now'],
            'max_participants' => ['nullable', 'integer', 'min:1', 'max:10000'],
            'is_recorded' => ['nullable', 'boolean'],
        ];
    }

    public function messages(): array
    {
        return [
            'scheduled_at.after' => 'The scheduled time must be in the future.',
        ];
    }
}
