<?php

namespace App\Http\Requests\Post;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StorePostRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'community_id' => ['required', 'exists:communities,id'],
            'type' => ['required', Rule::in(['post', 'status', 'announcement'])],
            'content' => ['required', 'string', 'max:5000'],
            'media_urls' => ['nullable', 'array'],
            'media_urls.*' => ['string', 'url'],
            'link_url' => ['nullable', 'string', 'url'],
            'is_draft' => ['nullable', 'boolean'],
        ];
    }

    public function messages(): array
    {
        return [
            'type.in' => 'The post type must be one of: post, status, announcement.',
        ];
    }
}
