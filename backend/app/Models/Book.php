<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Book extends Model
{
    use HasFactory;

    protected $fillable = [
        'title',
        'author',
        'category',
        'quantity',
        'available',
        'cover_url',
        'cover_storage_path',
        'description',
    ];

    protected function casts(): array
    {
        return [
            'quantity'  => 'integer',
            'available' => 'integer',
        ];
    }

    public function copies(): HasMany
    {
        return $this->hasMany(BookCopy::class);
    }

    public function loans(): HasMany
    {
        return $this->hasMany(Loan::class);
    }

    public function borrowRequests(): HasMany
    {
        return $this->hasMany(BorrowRequest::class);
    }
}
