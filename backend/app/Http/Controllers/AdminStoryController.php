<?php

namespace App\Http\Controllers;

use App\Models\AdminSetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class AdminStoryController extends Controller
{
    public function show(): JsonResponse
    {
        return response()->json([
            'story_type_image_enabled' => AdminSetting::get('story_type_image_enabled', '1'),
            'story_type_text_enabled' => AdminSetting::get('story_type_text_enabled', '1'),
            'story_type_video_enabled' => AdminSetting::get('story_type_video_enabled', '1'),
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'story_type_image_enabled' => ['required', Rule::in(['0', '1'])],
            'story_type_text_enabled' => ['required', Rule::in(['0', '1'])],
            'story_type_video_enabled' => ['required', Rule::in(['0', '1'])],
        ]);

        foreach ($validated as $key => $value) {
            AdminSetting::set($key, $value);
        }

        return response()->json([
            'message' => 'Story type settings updated.',
            'data' => [
                'story_type_image_enabled' => AdminSetting::get('story_type_image_enabled', '1'),
                'story_type_text_enabled' => AdminSetting::get('story_type_text_enabled', '1'),
                'story_type_video_enabled' => AdminSetting::get('story_type_video_enabled', '1'),
            ],
        ]);
    }
}
