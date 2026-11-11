<?php

use App\Exceptions\ConflictException;
use App\Models\User;
use App\Services\ActivityService;
use App\Services\HoldService;
use App\Services\LibraryTransaction;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('library:create-admin {email?} {--name=}', function () {
    if (! $this->input->isInteractive()) {
        $this->error('Run interactively; the password is requested securely, never passed on the command line.');

        return 1;
    }
    $data = [
        'email' => mb_strtolower(trim($this->argument('email') ?: $this->ask('Administrator email'))),
        'full_name' => $this->option('name') ?: $this->ask('Full name'),
        'password' => $this->secret('Password (at least 12 characters)'),
        'password_confirmation' => $this->secret('Confirm password'),
    ];
    $validated = Validator::make($data, ['email' => ['required', 'email', 'max:191', 'unique:users,email'], 'full_name' => ['required', 'string', 'max:160'], 'password' => ['required', 'string', 'min:12', 'max:128', 'confirmed']])->validate();
    LibraryTransaction::run(function () use ($validated) {
        if (User::where('role', 'admin')->exists()) {
            throw new ConflictException('An administrator already exists. Use Users & staff to add another.');
        }
        $user = User::create($validated + ['uid' => (string) Str::uuid(), 'role' => 'admin', 'is_active' => true, 'is_approved' => true, 'membership_status' => 'Approved', 'starred_book_ids' => []]);
        ActivityService::record('admin.bootstrapped', 'user', $user->uid, [], $user->uid);
    });
    $this->info('Administrator created. Sign in through the library website.');

    return 0;
})->purpose('Securely create the first library administrator');

Artisan::command('library:maintenance', function () {
    app(HoldService::class)->maintain();
    $this->info('Hold queues and due-date notifications updated.');
})->purpose('Expire holds and create idempotent in-app reminders');

Schedule::command('library:maintenance')->everyFiveMinutes()->withoutOverlapping();
