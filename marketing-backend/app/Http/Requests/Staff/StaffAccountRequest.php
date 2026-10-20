<?php

namespace App\Http\Requests\Staff;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

/**
 * Rules for creating and updating staff accounts. Creating requires every core
 * field; updating treats each field as optional. Route middleware performs the
 * super-admin gate.
 */
class StaffAccountRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        if (is_string($this->input('email'))) {
            $this->merge(['email' => strtolower(trim($this->input('email')))]);
        }
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        // POST to the collection has no {staff} parameter; PATCH always does.
        $req = $this->route('staff') ? 'sometimes' : 'required';

        return [
            'name' => [$req, 'string', 'max:255'],
            'email' => [
                $req, 'string', 'email:rfc', 'max:255',
                Rule::unique('staff_users', 'email')->ignore($this->route('staff')),
            ],
            'role' => [$req, 'string', Rule::in(array_keys((array) config('staff.roles', [])))],
            'password' => [$req, 'string', Password::min(12)->letters()->numbers()],
            'permissions' => ['sometimes', 'nullable', 'array'],
            'permissions.*' => ['string', Rule::in($this->knownPermissions())],
        ];
    }

    /**
     * Every permission string the SecureCRM knows about.
     *
     * @return array<int, string>
     */
    protected function knownPermissions(): array
    {
        $fromRoles = collect(config('staff.roles', []))->flatten()->all();
        $fromSections = array_values((array) config('staff.section_permissions', []));

        return array_values(array_unique(array_merge($fromRoles, $fromSections)));
    }
}
