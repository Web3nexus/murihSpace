<?php

namespace App\Http\Controllers;

use App\Models\E2eeBackup;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

/**
 * Stores and returns the owner's encrypted key backup. The blob is opaque to
 * the server: the browser derives the key from a passphrase the server never
 * sees, so this controller only checks shape and size.
 */
class E2eeBackupController extends Controller
{
    /** Minimum PBKDF2-SHA256 iterations the browser must have used. */
    private const MIN_ITERATIONS = 600000;

    private const MAX_ITERATIONS = 10000000;

    /** Ciphertext is base64 text, so this is a limit on characters (about 1.5 MB of data). */
    private const MAX_CIPHERTEXT_CHARS = 2097152;

    private const ALLOWED_FIELDS = ['version', 'salt', 'iv', 'iterations', 'ciphertext'];

    public function show(Request $request): JsonResponse
    {
        $backup = E2eeBackup::where('user_id', $request->user()->id)->first();

        if (! $backup) {
            return response()->json(['message' => 'No backup found.'], 404);
        }

        return response()->json(['data' => [
            'version' => $backup->version,
            'salt' => $backup->salt,
            'iv' => $backup->iv,
            'iterations' => $backup->iterations,
            'ciphertext' => $backup->ciphertext,
            'updated_at' => $backup->updated_at?->toIso8601String(),
        ]])->header('Cache-Control', 'no-store');
    }

    public function store(Request $request): JsonResponse
    {
        // Anything outside the blob fields is refused outright, so a client cannot
        // slip a plaintext or key field into the row by accident.
        $unknown = array_diff(array_keys($request->all()), self::ALLOWED_FIELDS);
        if ($unknown !== []) {
            throw ValidationException::withMessages([
                'plaintext' => ['Unexpected fields: '.implode(', ', $unknown).'.'],
            ]);
        }

        $validated = $request->validate([
            'version' => ['required', 'integer', 'min:1', 'max:255'],
            'salt' => ['required', 'string', 'max:128', 'regex:/^[A-Za-z0-9+\/]+={0,2}$/'],
            'iv' => ['required', 'string', 'max:64', 'regex:/^[A-Za-z0-9+\/]+={0,2}$/'],
            'iterations' => ['required', 'integer', 'min:'.self::MIN_ITERATIONS, 'max:'.self::MAX_ITERATIONS],
            'ciphertext' => ['required', 'string', 'max:'.self::MAX_CIPHERTEXT_CHARS],
        ]);

        $backup = E2eeBackup::updateOrCreate(
            ['user_id' => $request->user()->id],
            $validated,
        );

        return response()->json(['data' => [
            'version' => $backup->version,
            'updated_at' => $backup->updated_at?->toIso8601String(),
        ]]);
    }
}
