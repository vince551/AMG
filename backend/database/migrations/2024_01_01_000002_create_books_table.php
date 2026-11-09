<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('books', function (Blueprint $table) {
            $table->id();
            $table->string('title', 160);
            $table->string('author', 120)->nullable();
            $table->enum('category', [
                'PP / Pre-Primary',
                'Primary',
                'Junior Secondary',
                'Senior Secondary',
                'High School',
                'University',
                'General / Fiction',
                'Other',
            ])->nullable();
            $table->smallInteger('quantity')->unsigned();
            $table->smallInteger('available')->unsigned();
            $table->string('cover_url', 500)->nullable();
            $table->string('cover_storage_path', 500)->nullable();
            $table->string('description', 500)->nullable();
            $table->timestamps();

            $table->index('title');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('books');
    }
};
