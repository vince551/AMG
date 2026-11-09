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
    ];

    protected function casts(): array
    {
        return [
            'capacity'   => 'integer',
            'updated_at' => 'datetime',
        ];
    }
}
