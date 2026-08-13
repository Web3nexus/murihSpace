<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreAdGroupRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'campaign_id' => ['required', 'uuid', 'exists:campaigns,id'],
            'name' => ['required', 'string', 'max:255'],
            'status' => ['nullable', 'string', 'in:active,paused'],
            'targeting' => ['required', 'array'],
            'placements' => ['nullable', 'array'],
            'placements.*' => ['string', 'in:feed,story,discover,store'],
            'optimization_goal' => ['required', 'string', 'in:impressions,clicks,conversions,reach'],
            'billing_event' => ['required', 'string', 'in:impressions,clicks'],
            'bid_strategy' => ['required', 'string', 'in:lowest_cost,cost_cap,bid_cap'],
            'bid_amount' => ['nullable', 'numeric', 'min:0'],
            'daily_budget' => ['nullable', 'numeric', 'min:0'],
            'lifetime_budget' => ['nullable', 'numeric', 'min:0'],
            'start_time' => ['nullable', 'date'],
            'end_time' => ['nullable', 'date', 'after:start_time'],
        ];
    }
}
