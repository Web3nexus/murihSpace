<?php

namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;

class RegisterRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'email', 'max:255', 'unique:users'],
            'password' => ['required', 'string', 'min:8', 'confirmed', 'regex:/[A-Z]/', 'regex:/[a-z]/', 'regex:/[0-9]/', 'regex:/[@$!%*#?&^_-]/'],
            'username' => ['required', 'string', 'min:3', 'max:50', 'unique:users', 'regex:/\A[a-zA-Z0-9_]+\z/'],
            'country' => ['nullable', 'string', 'size:2', 'exists:countries,iso2'],
            'mobile_number' => ['nullable', 'string', 'regex:/^\+?[1-9]\d{1,14}$/'],
            'county' => ['nullable', 'string', 'max:255'],
            'state' => ['nullable', 'string', 'max:255'],
            'role' => ['required', 'string', 'in:member,creator,vendor'],
            'kyc_document' => ['nullable', 'string'],
        ];
    }

    public function messages(): array
    {
        return [
            'password.regex' => 'The password must contain at least one uppercase letter, one lowercase letter, one number, and one special character.',
            'username.regex' => 'The username may only contain letters, numbers, and underscores.',
            'role.in' => 'The role must be one of: member, creator, vendor.',
            'country.exists' => 'The selected country code is invalid.',
            'mobile_number.regex' => 'The mobile number must be in valid E.164 international format (e.g. +447911123456).',
        ];
    }
}
