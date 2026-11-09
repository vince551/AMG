<?php

namespace App\Exceptions;

use RuntimeException;

class ConflictException extends RuntimeException
{
    public function __construct(string $message = 'Conflict.')
    {
        parent::__construct($message);
    }
}
