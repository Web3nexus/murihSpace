<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateCampaignRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation()
    {
        if ($id = $this->route('campaign')) {
            $model = \App\Models\Campaign::find($id);
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
            'budget_type' => ['sometimes', 'string', 'in:daily,lifetime'],
            'budget_amount' => ['sometimes', 'numeric', 'min:0'],
            'end_time' => ['nullable', 'date', 'after:start_time'],
        ];
    }
}
