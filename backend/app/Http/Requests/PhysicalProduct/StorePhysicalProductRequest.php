<?php

namespace App\Http\Requests\PhysicalProduct;

use App\Models\PhysicalProduct;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StorePhysicalProductRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:10000'],
            'sku' => ['required', 'string', 'max:100', 'unique:physical_products,sku'],
            'price' => ['required', 'integer', 'min:0'],
            'currency' => ['nullable', 'string', 'size:3'],
            'category' => ['nullable', Rule::in(PhysicalProduct::CATEGORIES)],
            'images' => ['nullable', 'array', 'max:10'],
            'images.*' => ['required', 'string', 'url', 'max:2000'],
            'stock_quantity' => ['nullable', 'integer', 'min:0'],
            'low_stock_threshold' => ['nullable', 'integer', 'min:0'],
            'track_inventory' => ['nullable', 'boolean'],
            'is_active' => ['nullable', 'boolean'],
            'weight_unit' => ['nullable', 'in:kg,g,lb,oz'],
            'weight' => ['nullable', 'numeric', 'min:0'],
            'length' => ['nullable', 'numeric', 'min:0'],
            'width' => ['nullable', 'numeric', 'min:0'],
            'height' => ['nullable', 'numeric', 'min:0'],
            'origin_country' => ['nullable', 'string', 'size:2'],
        ];
    }

    public function messages(): array
    {
        return [
            'sku.unique' => 'This SKU is already in use.',
            'images.max' => 'You can upload up to 10 images.',
            'currency.size' => 'Currency must be a 3-letter code.',
            'weight_unit.in' => 'Weight unit must be one of: kg, g, lb, oz.',
            'origin_country.size' => 'Origin country must be a 2-letter code.',
        ];
    }
}
