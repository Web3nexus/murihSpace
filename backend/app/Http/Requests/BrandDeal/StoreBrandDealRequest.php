<?php

namespace App\Http\Requests\BrandDeal;

use App\Models\BrandDeal;
use Illuminate\Foundation\Http\FormRequest;

class StoreBrandDealRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'brand_id' => ['required', 'exists:brands,id'],
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:5000'],
            'deal_type' => ['required', 'in:' . implode(',', BrandDeal::DEAL_TYPES)],
            'status' => ['sometimes', 'in:' . implode(',', BrandDeal::STATUSES)],
            'budget' => ['required', 'integer', 'min:0'],
            'currency' => ['sometimes', 'string', 'max:3'],
            'deliverables' => ['nullable', 'string', 'max:5000'],
            'starts_at' => ['nullable', 'date'],
            'ends_at' => ['nullable', 'date', 'after_or_equal:starts_at'],
        ];
    }

    public function messages(): array
    {
        return [
            'deal_type.in' => 'The deal type is invalid.',
            'status.in' => 'The status is invalid.',
            'ends_at.after_or_equal' => 'The end date must be after or equal to the start date.',
        ];
    }
}
