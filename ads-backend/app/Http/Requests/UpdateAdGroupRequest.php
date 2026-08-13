<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateAdGroupRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation()
    {
        if ($id = $this->route('ad_group')) {
            $model = \App\Models\AdGroup::find($id);
            if ($model && !$this->has('start_time') && $model->start_time) {
                $this->merge([
                    'start_time' => $model->start_time,
                ]);
            }
        }
    }

    public function rules(): array
    {
        return [
            'name' => ['sometimes', 'string', 'max:255'],
            'status' => ['sometimes', 'string', 'in:active,paused,archived'],
            'targeting' => ['sometimes', 'array'],
            'placements' => ['sometimes', 'array'],
            'placements.*' => ['string', 'in:feed,story,discover,store'],
            'bid_strategy' => ['sometimes', 'string', 'in:lowest_cost,cost_cap,bid_cap'],
            'bid_amount' => ['nullable', 'numeric', 'min:0'],
            'daily_budget' => ['nullable', 'numeric', 'min:0'],
            'lifetime_budget' => ['nullable', 'numeric', 'min:0'],
            'end_time' => ['nullable', 'date', 'after:start_time'],
        ];
    }
}
