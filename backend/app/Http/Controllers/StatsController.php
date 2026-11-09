<?php

namespace App\Http\Controllers;

use App\Services\StatsService;
use Illuminate\Http\JsonResponse;

class StatsController extends Controller
{
    public function __construct(private StatsService $statsService) {}

    /** GET /stats — librarian */
    public function index(): JsonResponse
    {
        return response()->json($this->statsService->summary());
    }
}
