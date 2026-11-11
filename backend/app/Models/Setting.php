<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Setting extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'key',
        'capacity',
        'updated_by',
        'name', 'contact', 'hours', 'loan_days', 'loan_limit', 'renewal_limit', 'renewal_days', 'hold_hours',
    ];

    protected function casts(): array
    {
        return [
            'capacity' => 'integer',
            'loan_days' => 'integer', 'loan_limit' => 'integer', 'renewal_limit' => 'integer', 'renewal_days' => 'integer', 'hold_hours' => 'integer',
            'updated_at' => 'datetime',
        ];
    }
}
