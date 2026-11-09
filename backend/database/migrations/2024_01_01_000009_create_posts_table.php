<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('posts', function (Blueprint $table) {
            $table->id();
            $table->enum('type', ['announcement', 'event']);
            $table->string('title', 255);
            $table->text('body');
            $table->date('date')->nullable();
            $table->string('created_by', 36);
            $table->timestamps();

            $table->index(['type', 'date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('posts');
    }
};
