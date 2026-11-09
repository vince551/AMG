<?php

namespace App\Http\Controllers;

use App\Services\SettingsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class SettingsController extends Controller
{
    public function __construct(private SettingsService $settingsService) {}

    /** GET /settings — public */
    public function show(): JsonResponse
    {
        return response()->json($this->settingsService->get());
    }

    /** PUT /settings — librarian */
    public function update(Request $request): JsonResponse
    {
        $data = $request->validate([
            'capacity' => ['required', 'integer', 'min:1', 'max:10000'],
        ]);

        $settings = $this->settingsService->update($data['capacity'], Auth::user()->uid);

        return response()->json($settings);
    }
}
