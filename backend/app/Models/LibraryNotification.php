<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class LibraryNotification extends Model
{
    use HasFactory;

    protected $guarded = ['id'];

    protected $hidden = ['dedupe_key'];

    protected function casts(): array
    {
        return ['read_at' => 'datetime'];
    }
}
