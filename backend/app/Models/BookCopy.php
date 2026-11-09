<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

class BookCopy extends Model
{
    use HasFactory;

    protected $fillable = [
        'book_id',
        'copy_number',
        'barcode',
        'status',
    ];

    protected function casts(): array
    {
        return [
            'copy_number' => 'integer',
        ];
    }

    public function book(): BelongsTo
    {
        return $this->belongsTo(Book::class);
    }

    public function activeLoan(): HasOne
    {
        return $this->hasOne(Loan::class)->where('status', 'Borrowed');
    }
}
