<?php

namespace App\Http\Controllers;

use App\Models\Community;
use App\Models\DigitalProduct;
use App\Models\Message;
use App\Models\PhysicalProduct;
use App\Models\Post;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SearchController extends Controller
{
    public function search(Request $request): JsonResponse
    {
        $request->validate([
            'q' => ['required', 'string', 'max:100'],
            'type' => ['nullable', 'string', 'in:all,users,communities,posts,messages,products'],
        ]);

        $q = $request->input('q');
        $type = $request->input('type', 'all');
        $perPage = (int) $request->input('per_page', 10);

        $results = [];

        if ($type === 'all' || $type === 'users') {
            $results['users'] = User::search($q)
                ->take($perPage)
                ->get()
                ->map(fn (User $u) => [
                    'id' => $u->id,
                    'name' => $u->name,
                    'username' => $u->username,
                    'avatar' => $u->avatar,
                    'bio' => $u->bio,
                    'type' => 'user',
                ]);
        }

        if ($type === 'all' || $type === 'communities') {
            $results['communities'] = Community::search($q)
                ->take($perPage)
                ->get()
                ->map(fn (Community $c) => [
                    'id' => $c->id,
                    'name' => $c->name,
                    'slug' => $c->slug,
                    'description' => $c->description,
                    'logo_url' => $c->logo_url,
                    'type' => 'community',
                    'member_count' => $c->member_count,
                ]);
        }

        if ($type === 'all' || $type === 'posts') {
            $results['posts'] = Post::search($q)
                ->take($perPage)
                ->get()
                ->load('author:id,name,username,avatar,verification_badge_status,verification_badge_expires_at', 'community:id,name,slug')
                ->map(fn (Post $p) => [
                    'id' => $p->id,
                    'content' => str($p->content)->limit(200),
                    'author' => $p->author?->only(['id', 'name', 'username', 'avatar']),
                    'community' => $p->community?->only(['id', 'name', 'slug']),
                    'created_at' => $p->created_at,
                    'type' => 'post',
                ]);
        }

        if ($type === 'all' || $type === 'messages') {
            $results['messages'] = Message::search($q)
                ->take($perPage)
                ->get()
                ->load('user:id,name,username,avatar')
                ->map(fn (Message $m) => [
                    'id' => $m->id,
                    'content' => str($m->content)->limit(200),
                    'sender' => $m->user?->only(['id', 'name', 'username', 'avatar']),
                    'conversation_id' => $m->conversation_id,
                    'created_at' => $m->created_at,
                    'type' => 'message',
                ]);
        }

        if ($type === 'all' || $type === 'products') {
            $products = collect();

            $digital = DigitalProduct::search($q)->take($perPage)->get()
                ->map(fn (DigitalProduct $p) => [
                    'id' => $p->id,
                    'title' => $p->title,
                    'description' => str($p->description)->limit(200),
                    'price' => $p->price,
                    'currency' => $p->currency ?? 'USD',
                    'type' => 'digital_product',
                ]);
            $products = $products->concat($digital);

            $physical = PhysicalProduct::search($q)->take($perPage)->get()
                ->map(fn (PhysicalProduct $p) => [
                    'id' => $p->id,
                    'title' => $p->title,
                    'description' => str($p->description)->limit(200),
                    'price' => $p->price,
                    'currency' => $p->currency ?? 'USD',
                    'type' => 'physical_product',
                ]);
            $products = $products->concat($physical);

            $results['products'] = $products;
        }

        return response()->json([
            'query' => $q,
            'type' => $type,
            'results' => $results,
        ]);
    }
}
