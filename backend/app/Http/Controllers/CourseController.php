<?php

namespace App\Http\Controllers;

use App\Models\Course;
use App\Models\CourseModule;
use App\Models\CourseLesson;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class CourseController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $courses = Course::where('creator_id', $request->user()->id)
            ->withCount('lessons')
            ->latest()->get();

        return response()->json(['data' => $courses]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'thumbnail_url' => ['nullable', 'string', 'max:2000'],
            'price' => ['nullable', 'numeric', 'min:0'],
            'currency' => ['sometimes', 'string', 'size:3'],
            'status' => ['sometimes', Rule::in(['draft', 'published', 'archived'])],
            'modules' => ['nullable', 'array'],
            'modules.*.title' => ['required', 'string', 'max:255'],
            'modules.*.sort_order' => ['sometimes', 'integer', 'min:0'],
            'modules.*.lessons' => ['nullable', 'array'],
            'modules.*.lessons.*.title' => ['required', 'string', 'max:255'],
            'modules.*.lessons.*.video_url' => ['nullable', 'string', 'max:2000'],
            'modules.*.lessons.*.is_free' => ['sometimes', 'boolean'],
            'modules.*.lessons.*.duration_minutes' => ['nullable', 'integer', 'min:0'],
            'modules.*.lessons.*.sort_order' => ['sometimes', 'integer', 'min:0'],
        ]);

        $course = Course::create([
            'creator_id' => $request->user()->id,
            'title' => $validated['title'],
            'description' => $validated['description'] ?? null,
            'thumbnail_url' => $validated['thumbnail_url'] ?? null,
            'price' => $validated['price'] ?? 0,
            'currency' => $validated['currency'] ?? 'USD',
            'status' => $validated['status'] ?? 'draft',
        ]);

        if (!empty($validated['modules'])) {
            $this->syncModules($course, $validated['modules']);
        }

        $course->load('modules.lessons');

        return response()->json(['data' => $course], 201);
    }

    public function show(Request $request, Course $course): JsonResponse
    {
        if ($course->creator_id !== $request->user()->id) abort(403);
        $course->load('modules.lessons');
        return response()->json(['data' => $course]);
    }

    public function update(Request $request, Course $course): JsonResponse
    {
        if ($course->creator_id !== $request->user()->id) abort(403);

        $validated = $request->validate([
            'title' => ['sometimes', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'thumbnail_url' => ['nullable', 'string', 'max:2000'],
            'price' => ['nullable', 'numeric', 'min:0'],
            'currency' => ['sometimes', 'string', 'size:3'],
            'status' => ['sometimes', Rule::in(['draft', 'published', 'archived'])],
            'modules' => ['nullable', 'array'],
            'modules.*.title' => ['required', 'string', 'max:255'],
            'modules.*.sort_order' => ['sometimes', 'integer', 'min:0'],
            'modules.*.lessons' => ['nullable', 'array'],
            'modules.*.lessons.*.title' => ['required', 'string', 'max:255'],
            'modules.*.lessons.*.video_url' => ['nullable', 'string', 'max:2000'],
            'modules.*.lessons.*.is_free' => ['sometimes', 'boolean'],
            'modules.*.lessons.*.duration_minutes' => ['nullable', 'integer', 'min:0'],
            'modules.*.lessons.*.sort_order' => ['sometimes', 'integer', 'min:0'],
        ]);

        $course->update($validated);

        if (array_key_exists('modules', $validated)) {
            $this->syncModules($course, $validated['modules']);
        }

        $course->load('modules.lessons');

        return response()->json(['data' => $course->fresh()]);
    }

    public function destroy(Request $request, Course $course): JsonResponse
    {
        if ($course->creator_id !== $request->user()->id) abort(403);
        $course->delete();
        return response()->json(['message' => 'Course deleted.']);
    }

    private function syncModules(Course $course, array $modules): void
    {
        $existingIds = $course->modules()->pluck('id')->toArray();
        $keepIds = [];

        foreach ($modules as $order => $modData) {
            $mod = CourseModule::updateOrCreate(
                ['id' => $modData['id'] ?? null, 'course_id' => $course->id],
                ['title' => $modData['title'], 'sort_order' => $modData['sort_order'] ?? $order],
            );
            $keepIds[] = $mod->id;

            if (!empty($modData['lessons'])) {
                $this->syncLessons($mod, $modData['lessons']);
            }
        }

        $prune = array_diff($existingIds, $keepIds);
        if (!empty($prune)) {
            CourseModule::whereIn('id', $prune)->delete();
        }
    }

    private function syncLessons(CourseModule $module, array $lessons): void
    {
        $existingIds = $module->lessons()->pluck('id')->toArray();
        $keepIds = [];

        foreach ($lessons as $order => $lesData) {
            $lesson = CourseLesson::updateOrCreate(
                ['id' => $lesData['id'] ?? null, 'module_id' => $module->id],
                [
                    'course_id' => $module->course_id,
                    'title' => $lesData['title'],
                    'video_url' => $lesData['video_url'] ?? null,
                    'is_free' => $lesData['is_free'] ?? false,
                    'duration_minutes' => $lesData['duration_minutes'] ?? null,
                    'sort_order' => $lesData['sort_order'] ?? $order,
                ],
            );
            $keepIds[] = $lesson->id;
        }

        $prune = array_diff($existingIds, $keepIds);
        if (!empty($prune)) {
            CourseLesson::whereIn('id', $prune)->delete();
        }
    }
}
