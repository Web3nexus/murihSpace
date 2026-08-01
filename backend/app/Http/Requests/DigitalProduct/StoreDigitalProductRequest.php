<?php

namespace App\Http\Requests\DigitalProduct;

use App\Models\DigitalProduct;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreDigitalProductRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:5000'],
            'cover_url' => ['nullable', 'string', 'max:2000'],
            'price' => ['required', 'numeric', 'min:0'],
            'currency' => ['nullable', 'string', 'size:3'],
            'is_free' => ['required', 'boolean'],
            'category' => ['required', Rule::in(array_keys(DigitalProduct::CATEGORIES))],
            'status' => ['nullable', Rule::in(['draft', 'published'])],
            'file' => ['nullable', 'file', 'max:102400'],
        ];
    }

    public function messages(): array
    {
        return [
            'category.in' => 'The selected category is invalid.',
            'status.in' => 'Status must be either draft or published.',
            'file.max' => 'The file must not be larger than 100MB.',
        ];
    }
}
