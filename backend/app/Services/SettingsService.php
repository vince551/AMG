<?php

namespace App\Services;

use App\Models\Setting;

class SettingsService
{
    public function get(): array
    {
        $setting = Setting::where('key', 'library')->first();

        return ['capacity' => $setting?->capacity ?? 100];
    }

    public function update(int $capacity, string $librarianUid): array
    {
        $setting = Setting::updateOrCreate(
            ['key' => 'library'],
            ['capacity' => $capacity, 'updated_by' => $librarianUid]
        );

        return ['capacity' => $setting->capacity];
    }
}
