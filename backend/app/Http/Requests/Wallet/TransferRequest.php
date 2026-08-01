<?php

namespace App\Http\Requests\Wallet;

use Illuminate\Foundation\Http\FormRequest;

class TransferRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'recipient_username' => ['required', 'string', 'max:255', 'exists:users,username'],
            'amount' => ['required', 'integer', 'min:1'],
            'currency' => ['nullable', 'string', 'max:3'],
            'note' => ['nullable', 'string', 'max:255'],
            'pin' => ['required', 'string', 'digits:4'],
        ];
    }

    public function messages(): array
    {
        return [
            'recipient_username.exists' => 'The recipient username was not found.',
            'pin.digits' => 'The transaction PIN must be exactly 4 digits.',
        ];
    }
}
