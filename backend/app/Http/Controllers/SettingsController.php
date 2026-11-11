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
            'capacity' => ['sometimes', 'integer', 'min:1', 'max:10000'],
            'name' => ['sometimes', 'required', 'string', 'max:160'],
            'contact' => ['sometimes', 'nullable', 'string', 'max:191'],
            'hours' => ['sometimes', 'nullable', 'string', 'max:191'],
            'loan_days' => ['sometimes', 'integer', 'min:1', 'max:365'],
            'loan_limit' => ['sometimes', 'integer', 'min:1', 'max:100'],
            'renewal_limit' => ['sometimes', 'integer', 'min:0', 'max:20'],
            'renewal_days' => ['sometimes', 'integer', 'min:1', 'max:365'],
            'hold_hours' => ['sometimes', 'integer', 'min:1', 'max:720'],
        ]);

        $settings = $this->settingsService->update($data, Auth::user()->uid);

        return response()->json($settings);
    }
}
