<?php

namespace Tests\Property;

use Eris\TestTrait;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

abstract class PropertyTestCase extends TestCase
{
    use RefreshDatabase;
    use TestTrait;

    protected int $erisIterations = 100;
}
