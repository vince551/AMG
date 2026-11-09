<?php

namespace Database\Factories;

use App\Models\AttendanceRecord;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class AttendanceRecordFactory extends Factory
{
    protected $model = AttendanceRecord::class;

    public function definition(): array
    {
        $user = User::factory()->approved()->withLibraryNumber()->create();

        return [
            'uid'            => $user->uid,
            'member_name'    => $user->full_name,
            'library_number' => $user->library_number,
            'check_in_at'    => now(),
            'check_out_at'   => null,
            'status'         => 'In library',
        ];
    }

    public function checkedOut(): static
    {
        return $this->state([
            'status'        => 'Checked out',
            'check_out_at'  => now()->addHours(2),
        ]);
    }
}
