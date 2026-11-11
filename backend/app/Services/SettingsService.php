<?php

namespace App\Services;

use App\Exceptions\ConflictException;
use App\Models\MemberPresence;
use App\Models\Setting;

class SettingsService
{
    public function get(): array
    {
        $setting = Setting::where('key', 'library')->first();

        return array_merge(['capacity' => 100, 'name' => 'AMG Library', 'contact' => '', 'hours' => '', 'loan_days' => 14, 'loan_limit' => 5, 'renewal_limit' => 1, 'renewal_days' => 14, 'hold_hours' => 48], $setting?->only(['capacity', 'name', 'contact', 'hours', 'loan_days', 'loan_limit', 'renewal_limit', 'renewal_days', 'hold_hours']) ?? []);
    }

    public function update(array $data, string $librarianUid): array
    {
        return LibraryTransaction::run(function () use ($data, $librarianUid) {
            if (isset($data['capacity']) && $data['capacity'] < MemberPresence::where('status', 'In library')->count()) {
                throw new ConflictException('Capacity cannot be lower than current occupancy.');
            }
            Setting::where('key', 'library')->firstOrFail()->update($data + ['updated_by' => $librarianUid]);
            ActivityService::record('settings.updated', 'settings', 'library', ['fields' => array_keys($data)], $librarianUid);

            return $this->get();
        });
    }
}
