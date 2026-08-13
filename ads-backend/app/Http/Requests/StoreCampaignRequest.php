<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreCampaignRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // Authorization is handled via middleware/policies
    }

    public function rules(): array
    {
        return [
            'ad_account_id' => ['required', 'uuid', 'exists:ad_accounts,id'],
            'name' => ['required', 'string', 'max:255'],
            'objective' => ['required', 'string', 'in:awareness,traffic,engagement,followers,community_growth,product_sales'],
            'status' => ['nullable', 'string', 'in:active,paused'],
            'budget_type' => ['nullable', 'string', 'in:daily,lifetime'],
            'budget_amount' => ['nullable', 'numeric', 'min:0'],
            'start_time' => ['nullable', 'date'],
            'end_time' => ['nullable', 'date', 'after:start_time'],
        ];
    }
}
