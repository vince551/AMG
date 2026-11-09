<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Loan extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'user_name',
        'book_id',
        'book_title',
        'book_category',
        'book_copy_id',
        'status',
        'borrowed_at',
        'due_at',
        'returned_at',
        'issued_by',
        'returned_by',
    ];

    protected function casts(): array
    {
        return [
            'borrowed_at'  => 'datetime',
            'due_at'       => 'datetime',
            'returned_at'  => 'datetime',
        ];
    }

    public function book(): BelongsTo
    {
        return $this->belongsTo(Book::class);
    }

    public function bookCopy(): BelongsTo
    {
        return $this->belongsTo(BookCopy::class);
    }
}
