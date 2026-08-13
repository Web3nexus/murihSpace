<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class HelpArticleResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->slug,
            'slug' => $this->slug,
            'title' => $this->title,
            'excerpt' => $this->excerpt,
            'body' => $this->body,
            'sections' => $this->sections,
            'keywords' => $this->keywords,
            'tags' => $this->tags,
            'category' => $this->category?->slug,
            'category_name' => $this->category?->name,
            'featured' => $this->featured,
            'seo_title' => $this->seo_title,
            'seo_description' => $this->seo_description,
            'canonical_url' => $this->canonical_url,
            'related' => HelpArticleListResource::collection($this->whenLoaded('relatedArticles')),
            'updated_at' => $this->updated_at?->toIso8601String(),
            'published_at' => $this->published_at?->toIso8601String(),
        ];
    }
}
