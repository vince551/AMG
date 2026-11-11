<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('loans', function (Blueprint $table) {
            $table->id();
            $table->string('user_id', 36);   // users.uid
            $table->string('user_name', 160);
            $table->foreignId('book_id')->constrained('books');
            $table->string('book_title', 160);
            $table->string('book_category', 60)->nullable();
            $table->foreignId('book_copy_id')->nullable()->constrained('book_copies')->nullOnDelete();
            $table->enum('status', ['Borrowed', 'Returned'])->default('Borrowed');
            $table->timestamp('borrowed_at')->useCurrent();
            $table->dateTime('due_at');
            $table->timestamp('returned_at')->nullable();
            $table->string('issued_by', 36)->nullable();
            $table->string('returned_by', 36)->nullable();
            $table->timestamps();

            $table->index(['user_id', 'status']);
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('loans');
    }
};
