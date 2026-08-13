<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class HelpCategoryResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->slug,
            'slug' => $this->slug,
            'name' => $this->name,
            'label' => $this->name,
            'blurb' => $this->blurb,
            'icon' => $this->icon,
            'article_count' => $this->whenCounted('articles'),
            'children' => HelpCategoryResource::collection($this->whenLoaded('children')),
        ];
    }
}
