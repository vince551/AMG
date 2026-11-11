<?php

namespace App\Services;

use App\Exceptions\ConflictException;
use App\Models\Hold;
use App\Models\Loan;
use App\Models\RenewalRequest;
use App\Models\User;

class RenewalService
{
    public function request(Loan $loan, User $user): RenewalRequest
    {
        abort_unless($loan->user_id === $user->uid, 403);

        return LibraryTransaction::run(function () use ($loan, $user) {
            $loan->refresh();
            app(CirculationService::class)->assertEligible($user->fresh());
            $this->assertRenewable($loan);
            if (RenewalRequest::where('active_loan_id', $loan->id)->exists()) {
                throw new ConflictException('A renewal request is already pending.');
            }

            return RenewalRequest::create(['loan_id' => $loan->id, 'active_loan_id' => $loan->id, 'user_id' => $user->uid, 'status' => 'Pending']);
        });
    }

    public function decide(RenewalRequest $request, string $decision, ?string $reason, User $actor): RenewalRequest
    {
        return LibraryTransaction::run(function () use ($request, $decision, $reason, $actor) {
            $request->refresh();
            if ($request->status !== 'Pending') {
                throw new ConflictException('This renewal request has already been processed.');
            }
            $loan = $request->loan;
            if ($decision === 'Approved') {
                app(CirculationService::class)->assertEligible(User::where('uid', $request->user_id)->firstOrFail());
                $this->assertRenewable($loan);
                $loan->update(['due_at' => $loan->due_at->copy()->addDays(app(SettingsService::class)->get()['renewal_days']), 'renewal_count' => $loan->renewal_count + 1]);
            }
            $request->update(['status' => $decision, 'active_loan_id' => null, 'reason' => $reason, 'processed_at' => now(), 'processed_by' => $actor->uid]);
            ActivityService::record('renewal.'.strtolower($decision), 'renewal', $request->id);
            ActivityService::notify($request->user_id, 'Renewal '.strtolower($decision), $decision === 'Approved' ? $loan->book_title.' is now due '.$loan->due_at->toDateString().'.' : ($reason ?: 'Contact the librarian about this renewal.'), 'loans');

            return $request;
        });
    }

    private function assertRenewable(Loan $loan): void
    {
        if ($loan->status !== 'Borrowed' || $loan->due_at->isPast() || $loan->renewal_count >= app(SettingsService::class)->get()['renewal_limit']) {
            throw new ConflictException('Only current, non-overdue loans within the renewal allowance can be renewed.');
        }
        if (Hold::where('book_id', $loan->book_id)->where('user_id', '!=', $loan->user_id)->whereIn('status', ['Waiting', 'Ready'])->exists()) {
            throw new ConflictException('Another member is waiting for this title.');
        }
    }
}
