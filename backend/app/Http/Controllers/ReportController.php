<?php

namespace App\Http\Controllers;

use App\Models\AttendanceRecord;
use App\Models\BookCopy;
use App\Models\Loan;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ReportController extends Controller
{
    public function index(Request $request, string $type): JsonResponse|StreamedResponse
    {
        $size = $this->perPage($request);
        $request->validate(['format' => ['sometimes', 'in:json,csv']]);
        [$query, $columns, $date, $search] = match ($type) {
            'members' => [User::where('role', 'learner'), ['library_number', 'full_name', 'email', 'membership_status', 'is_active', 'created_at'], 'created_at', ['full_name', 'library_number']],
            'loans' => [Loan::query(), ['id', 'user_name', 'book_title', 'book_category', 'status', 'borrowed_at', 'due_at', 'returned_at'], 'borrowed_at', ['user_name', 'book_title']],
            'inventory' => [BookCopy::join('books', 'books.id', '=', 'book_copies.book_id'), ['book_copies.id', 'books.title', 'books.category', 'book_copies.barcode', 'book_copies.status', 'book_copies.created_at'], 'book_copies.created_at', ['books.title', 'book_copies.barcode']],
            'attendance' => [AttendanceRecord::query(), ['id', 'member_name', 'library_number', 'status', 'check_in_at', 'check_out_at'], 'check_in_at', ['member_name', 'library_number']],
            default => abort(404),
        };
        $this->search($query, $request, $search);
        if ($request->filled('from')) {
            $query->whereDate($date, '>=', $request->input('from'));
        }
        if ($request->filled('to')) {
            $query->whereDate($date, '<=', $request->input('to'));
        }
        if ($request->filled('category') && in_array($type, ['inventory', 'loans'], true)) {
            $query->where($type === 'inventory' ? 'books.category' : 'book_category', $request->input('category'));
        }
        if ($request->filled('status')) {
            if ($type === 'loans' && $request->input('status') === 'Overdue') {
                $query->where('status', 'Borrowed')->where('due_at', '<', now());
            } else {
                $query->where(match ($type) {
                    'members' => 'membership_status', 'inventory' => 'book_copies.status', default => 'status'
                }, $request->input('status'));
            }
        }
        $query->select($columns)->orderByDesc($date)->orderByDesc($type === 'inventory' ? 'book_copies.id' : 'id');
        $headers = array_map(fn ($column) => str_contains($column, '.') ? explode('.', $column)[1] : $column, $columns);
        if ($request->input('format') === 'csv') {
            return response()->streamDownload(function () use ($query, $headers) {
                $stream = fopen('php://output', 'w');
                fputcsv($stream, $headers, ',', '"', '');
                foreach ($query->cursor() as $record) {
                    $row = array_map(function ($field) use ($record) {
                        $value = (string) ($record->getRawOriginal($field) ?? '');

                        return preg_match('/^[\s]*[=+@-]|^[\t\r\n]/u', $value) ? "'".$value : $value;
                    }, $headers);
                    fputcsv($stream, $row, ',', '"', '');
                }
                fclose($stream);
            }, 'amg-'.$type.'-'.now()->toDateString().'.csv', ['Content-Type' => 'text/csv; charset=UTF-8', 'Cache-Control' => 'private, no-store']);
        }

        return response()->json(['columns' => $headers, 'records' => $query->paginate($size)]);
    }
}
