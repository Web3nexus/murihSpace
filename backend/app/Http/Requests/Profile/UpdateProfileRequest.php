<?php

namespace App\Http\Requests\Profile;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateProfileRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'username' => ['sometimes', 'required', 'string', 'min:3', 'max:255', Rule::unique('users')->ignore($this->user()->id)],
            'bio' => ['nullable', 'string', 'max:1000'],
            'avatar' => ['nullable', 'string', 'max:2048'],
            'country' => ['nullable', 'string', 'size:2', 'exists:countries,iso2'],
            'county' => ['nullable', 'string', 'max:255'],
            'state' => ['nullable', 'string', 'max:255'],
            'mobile_number' => ['nullable', 'string', 'regex:/^\+?[1-9]\d{1,14}$/'],
        ];
    }

    public function messages(): array
    {
        return [
            'username.unique' => 'This username is already taken.',
            'country.exists' => 'The selected country code is invalid.',
            'mobile_number.regex' => 'The mobile number must be in valid E.164 international format (e.g. +447911123456).',
        ];
    }
}
