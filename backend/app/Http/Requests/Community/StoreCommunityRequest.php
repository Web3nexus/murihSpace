<?php

namespace App\Http\Requests\Community;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreCommunityRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:100'],
            'description' => ['nullable', 'string', 'max:1000'],
            'category' => ['required', 'string', 'max:50'],
            'visibility' => ['required', Rule::in(['public', 'private'])],
            'pricing_type' => ['required', Rule::in(['free', 'paid'])],
            'price_amount' => ['nullable', 'numeric', 'min:0'],
            'logo_url' => ['nullable', 'string', 'max:500'],
            'cover_url' => ['nullable', 'string', 'max:500'],
            'rules' => ['nullable', 'array'],
            'rules.*' => ['string', 'max:255'],
        ];
    }

    public function messages(): array
    {
        return [
            'visibility.in' => 'Visibility must be either public or private.',
            'pricing_type.in' => 'Pricing type must be either free or paid.',
        ];
    }
}
