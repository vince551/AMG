<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class AttendanceRecord extends Model
{
    use HasFactory;

    protected $fillable = [
        'uid',
        'member_name',
        'library_number',
        'check_in_at',
        'check_out_at',
        'status',
        'recorded_by',
        'checked_out_by',
    ];

    protected function casts(): array
    {
        return [
            'check_in_at'  => 'datetime',
            'check_out_at' => 'datetime',
        ];
    }
}
