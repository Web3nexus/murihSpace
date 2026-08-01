<?php

namespace App\Http\Requests\Storefront;

use App\Models\Storefront;
use Illuminate\Foundation\Http\FormRequest;

class UpdateStorefrontRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $store = Storefront::where('user_id', $this->user()->id)->first();

        return [
            'display_name' => ['required', 'string', 'max:100'],
            'tagline' => ['nullable', 'string', 'max:255'],
            'bio' => ['nullable', 'string', 'max:2000'],
            'cover_url' => ['nullable', 'string', 'max:2000'],
            'avatar_url' => ['nullable', 'string', 'max:2000'],
            'short_code' => ['required', 'string', 'alpha_dash', 'max:50', 'unique:storefronts,short_code,' . ($store->id ?? 'NULL')],
            'links' => ['nullable', 'array', 'max:10'],
            'links.*.label' => ['required_with:links', 'string', 'max:50'],
            'links.*.url' => ['required_with:links', 'string', 'url', 'max:500'],
            'name' => ['sometimes', 'string', 'max:255'],
            'currency' => ['nullable', 'string', 'size:3'],
            'tax_rate' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'shipping_policy' => ['nullable', 'string', 'max:5000'],
            'return_policy' => ['nullable', 'string', 'max:5000'],
            'logo_url' => ['nullable', 'string', 'max:2000'],
            'banner_url' => ['nullable', 'string', 'max:2000'],
        ];
    }

    public function messages(): array
    {
        return [
            'short_code.alpha_dash' => 'The short code may only contain letters, numbers, dashes, and underscores.',
            'short_code.unique' => 'This short code is already taken.',
            'links.max' => 'You can have up to 10 links.',
            'currency.size' => 'Currency must be a 3-letter code.',
        ];
    }
}
