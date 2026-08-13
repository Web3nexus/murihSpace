<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreAdRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'ad_group_id' => ['required', 'uuid', 'exists:ad_groups,id'],
            'name' => ['required', 'string', 'max:255'],
            'status' => ['nullable', 'string', 'in:active,paused'],
            'creative_id' => ['required', 'uuid', 'exists:creatives,id'],
            'promoted_object_type' => ['nullable', 'string'],
            'promoted_object_id' => ['nullable', 'string'],
            'headline' => ['nullable', 'string', 'max:255'],
            'body' => ['nullable', 'string'],
            'cta_type' => ['nullable', 'string'],
            'destination_url' => ['nullable', 'url', 'max:1024'],
        ];
    }
}
