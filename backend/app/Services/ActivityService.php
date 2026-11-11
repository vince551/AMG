<?php

namespace App\Services;

use App\Models\ActivityLog;
use App\Models\LibraryNotification;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;

class ActivityService
{
    public static function record(string $action, string $type, int|string|null $id, array $metadata = [], ?string $actor = null): void
    {
        ActivityLog::create([
            'actor_id' => $actor ?? Auth::user()?->uid,
            'action' => $action,
            'entity_type' => $type,
            'entity_id' => $id === null ? null : (string) $id,
            'metadata' => array_intersect_key($metadata, array_flip(['status', 'role', 'fields', 'count'])),
            'created_at' => now(),
        ]);
    }

    public static function notify(string $uid, string $title, string $message, string $section = 'overview', ?string $key = null): void
    {
        LibraryNotification::firstOrCreate(['dedupe_key' => $key ?? (string) Str::uuid()], [
            'user_id' => $uid, 'title' => $title, 'message' => $message, 'section' => $section,
        ]);
    }
}
