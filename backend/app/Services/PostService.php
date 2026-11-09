<?php

namespace App\Services;

use App\Models\Post;
use Illuminate\Support\Collection;

class PostService
{
    private const MAX_PER_TYPE = 20;

    public function publish(array $data, string $creatorUid): Post
    {
        return Post::create([
            'type'       => $data['type'],
            'title'      => $data['title'],
            'body'       => $data['body'],
            'date'       => $data['date'] ?? null,
            'created_by' => $creatorUid,
        ]);
    }

    /**
     * Combined feed: 20 most recent per type, ordered by date (fallback created_at) desc.
     */
    public function combinedFeed(): Collection
    {
        $announcements = Post::where('type', 'announcement')
            ->orderByRaw('COALESCE(date, created_at) DESC')
            ->limit(self::MAX_PER_TYPE)
            ->get();

        $events = Post::where('type', 'event')
            ->orderByRaw('COALESCE(date, created_at) DESC')
            ->limit(self::MAX_PER_TYPE)
            ->get();

        return $announcements->concat($events)
            ->sortByDesc(fn (Post $p) => $p->date ?? $p->created_at)
            ->values()
            ->map(fn (Post $p) => array_merge($p->toArray(), [
                'announcementKind' => $p->announcement_kind,
                'source'           => $p->source,
            ]));
    }
}
