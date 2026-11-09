<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Post extends Model
{
    use HasFactory;

    protected $fillable = [
        'type',
        'title',
        'body',
        'date',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'date' => 'date',
        ];
    }

    /**
     * Computed field for frontend compatibility.
     */
    public function getAnnouncementKindAttribute(): string
    {
        return $this->type === 'announcement' ? 'Announcement' : 'Event';
    }

    public function getSourceAttribute(): string
    {
        return $this->type === 'announcement' ? 'announcements' : 'events';
    }
}
