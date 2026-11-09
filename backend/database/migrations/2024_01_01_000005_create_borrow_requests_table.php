<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('borrow_requests', function (Blueprint $table) {
            $table->id();
            $table->string('user_id', 36);   // users.uid
            $table->string('user_name', 160);
            $table->foreignId('book_id')->constrained('books');
            $table->string('book_title', 160);
            $table->string('book_category', 60)->nullable();
            $table->enum('status', ['Pending', 'Approved', 'Declined', 'Returned'])->default('Pending');
            $table->foreignId('loan_id')->nullable()->constrained('loans')->nullOnDelete();
            $table->timestamp('processed_at')->nullable();
            $table->string('processed_by', 36)->nullable();
            $table->timestamp('returned_at')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'book_id', 'status']);
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('borrow_requests');
    }
};
