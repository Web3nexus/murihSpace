<?php

namespace App\Http\Requests\Conversation;

use Illuminate\Foundation\Http\FormRequest;

class SendMessageRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'content' => ['required_without:attachment_url', 'nullable', 'string', 'max:5000'],
            'client_uuid' => ['nullable', 'string', 'max:64'],
            'reply_to_id' => ['nullable', 'integer', 'exists:messages,id'],
            'attachment_url' => ['nullable', 'string', 'max:2000'],
            'attachment_type' => ['nullable', 'string', 'in:image,file,voice'],
        ];
    }

    public function messages(): array
    {
        return [
            'content.required_without' => 'A message must contain text or an attachment.',
            'attachment_type.in' => 'Attachment type must be one of: image, file, voice.',
        ];
    }
}
