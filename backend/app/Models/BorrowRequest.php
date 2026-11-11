<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BorrowRequest extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'user_name',
        'book_id',
        'book_title',
        'book_category',
        'status',
        'loan_id',
        'processed_at',
        'processed_by',
        'returned_at',
        'reason',
    ];

    protected function casts(): array
    {
        return [
            'processed_at' => 'datetime',
            'returned_at' => 'datetime',
        ];
    }

    public function book(): BelongsTo
    {
        return $this->belongsTo(Book::class);
    }

    public function loan(): BelongsTo
    {
        return $this->belongsTo(Loan::class);
    }
}
