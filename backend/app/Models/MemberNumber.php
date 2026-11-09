<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MemberNumber extends Model
{
    public $incrementing = false;
    public $timestamps   = false;
    protected $primaryKey = 'library_number';
    protected $keyType    = 'string';

    protected $fillable = [
        'library_number',
        'uid',
    ];
}
