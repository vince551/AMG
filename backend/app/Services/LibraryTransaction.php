<?php

namespace App\Services;

use Closure;
use Illuminate\Support\Facades\DB;

class LibraryTransaction
{
    /** Serialize library state transitions before acquiring narrower record locks. */
    public static function run(Closure $operation): mixed
    {
        return DB::transaction(function () use ($operation) {
            DB::table('settings')->where('key', 'library')->lockForUpdate()->firstOrFail();

            return $operation();
        }, 3);
    }
}
