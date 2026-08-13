<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateAdRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => ['sometimes', 'string', 'max:255'],
            'status' => ['sometimes', 'string', 'in:active,paused,archived'],
            'headline' => ['nullable', 'string', 'max:255'],
            'body' => ['nullable', 'string'],
            'cta_type' => ['nullable', 'string'],
            'destination_url' => ['nullable', 'url', 'max:1024'],
        ];
    }
}
