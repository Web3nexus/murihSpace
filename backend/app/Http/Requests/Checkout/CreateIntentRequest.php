<?php

namespace App\Http\Requests\Checkout;

use Illuminate\Foundation\Http\FormRequest;

class CreateIntentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'product_id' => ['required', 'integer', 'exists:digital_products,id'],
            'payment_provider' => ['nullable', 'string', 'in:stripe,mock'],
            'idempotency_key' => ['required', 'string', 'max:128'],
        ];
    }

    public function messages(): array
    {
        return [
            'payment_provider.in' => 'Payment provider must be stripe or mock.',
        ];
    }
}
