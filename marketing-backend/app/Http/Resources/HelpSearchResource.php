<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class HelpSearchResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->slug,
            'slug' => $this->slug,
            'title' => $this->title,
            'excerpt' => $this->excerpt,
            'category' => $this->category?->slug,
            'category_name' => $this->category?->name,
            'keywords' => $this->keywords,
            'score' => $this->when(isset($this->search_score), fn () => $this->search_score),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
