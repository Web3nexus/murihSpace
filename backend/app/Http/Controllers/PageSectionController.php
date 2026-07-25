<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\PageSection;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PageSectionController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $page = $request->query('page', 'home');

        return response()->json(['data' => PageSection::page($page)->sorted()->get()]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'page' => ['required', 'string', 'max:50', 'in:home,features,pricing'],
            'key' => ['required', 'string', 'max:100', 'unique:page_sections,key', 'regex:/^[a-z0-9_.]+$/'],
            'type' => ['required', 'string', 'max:50'],
            'label' => ['required', 'string', 'max:255'],
            'content' => ['required', 'array'],
            'meta' => ['nullable', 'array'],
            'is_active' => ['nullable', 'boolean'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
        ]);

        $section = PageSection::create($validated);

        AuditLog::create([
            'user_id' => $request->user()->id,
            'action' => 'page_section.created',
            'resource_type' => 'page_section',
            'resource_id' => (string) $section->id,
            'metadata' => ['key' => $section->key, 'page' => $section->page],
        ]);

        return response()->json(['message' => 'Page section created.', 'data' => $section], 201);
    }

    public function show(int $id): JsonResponse
    {
        return response()->json(['data' => PageSection::findOrFail($id)]);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $section = PageSection::findOrFail($id);

        $validated = $request->validate([
            'page' => ['filled', 'string', 'max:50', 'in:home,features,pricing'],
            'key' => ['filled', 'string', 'max:100', 'regex:/^[a-z0-9_.]+$/', 'unique:page_sections,key,'.$id],
            'type' => ['filled', 'string', 'max:50'],
            'label' => ['filled', 'string', 'max:255'],
            'content' => ['filled', 'array'],
            'meta' => ['nullable', 'array'],
            'is_active' => ['nullable', 'boolean'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
        ]);

        $section->update($validated);

        AuditLog::create([
            'user_id' => $request->user()->id,
            'action' => 'page_section.updated',
            'resource_type' => 'page_section',
            'resource_id' => (string) $section->id,
            'metadata' => ['key' => $section->key],
        ]);

        return response()->json(['message' => 'Page section updated.', 'data' => $section]);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $section = PageSection::findOrFail($id);

        AuditLog::create([
            'user_id' => $request->user()->id,
            'action' => 'page_section.deleted',
            'resource_type' => 'page_section',
            'resource_id' => (string) $section->id,
            'metadata' => ['key' => $section->key],
        ]);

        $section->delete();

        return response()->json(['message' => 'Page section deleted.']);
    }

    public function reorder(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'sections' => ['required', 'array'],
            'sections.*.id' => ['required', 'integer', 'exists:page_sections,id'],
            'sections.*.sort_order' => ['required', 'integer', 'min:0'],
        ]);

        foreach ($validated['sections'] as $item) {
            PageSection::where('id', $item['id'])->update(['sort_order' => $item['sort_order']]);
        }

        $page = PageSection::find($validated['sections'][0]['id'])?->page ?? 'home';

        return response()->json(['message' => 'Sections reordered.', 'data' => PageSection::page($page)->sorted()->get()]);
    }
}
