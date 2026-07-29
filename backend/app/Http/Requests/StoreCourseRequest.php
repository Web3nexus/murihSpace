<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreCourseRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'thumbnail_url' => ['nullable', 'string', 'max:2000'],
            'price' => ['nullable', 'numeric', 'min:0'],
            'currency' => ['sometimes', 'string', 'size:3'],
            'status' => ['sometimes', Rule::in(['draft', 'published', 'archived'])],
            'modules' => ['nullable', 'array'],
            'modules.*.title' => ['required', 'string', 'max:255'],
            'modules.*.sort_order' => ['sometimes', 'integer', 'min:0'],
            'modules.*.lessons' => ['nullable', 'array'],
            'modules.*.lessons.*.title' => ['required', 'string', 'max:255'],
            'modules.*.lessons.*.video_url' => ['nullable', 'string', 'max:2000'],
            'modules.*.lessons.*.is_free' => ['sometimes', 'boolean'],
            'modules.*.lessons.*.duration_minutes' => ['nullable', 'integer', 'min:0'],
            'modules.*.lessons.*.sort_order' => ['sometimes', 'integer', 'min:0'],
        ];
    }
}
