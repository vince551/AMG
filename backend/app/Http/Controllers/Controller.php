<?php

namespace App\Http\Controllers;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;

abstract class Controller
{
    protected function perPage(Request $request): int
    {
        $request->validate([
            'page' => ['sometimes', 'integer', 'min:1'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
            'search' => ['sometimes', 'nullable', 'string', 'max:160'],
            'status' => ['sometimes', 'nullable', 'string', 'max:40'],
            'category' => ['sometimes', 'nullable', 'string', 'max:60'],
            'from' => ['sometimes', 'nullable', 'date_format:Y-m-d'],
            'to' => ['sometimes', 'nullable', 'date_format:Y-m-d', 'after_or_equal:from'],
        ]);

        return $request->integer('per_page', 20);
    }

    protected function search(Builder $query, Request $request, array $fields): void
    {
        if ($request->filled('search')) {
            $term = '%'.$request->string('search')->trim().'%';
            $query->where(function ($nested) use ($term, $fields) {
                foreach ($fields as $field) {
                    $nested->orWhere($field, 'like', $term);
                }
            });
        }
    }
}
