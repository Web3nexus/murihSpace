<?php

namespace App\Services;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;

class FileSecurityFilterService
{
    /**
     * Dangerous extensions that are strictly prohibited in filenames.
     * Checks against primary and intermediate extensions (e.g. file.php.png).
     */
    private const DANGEROUS_EXTENSIONS = [
        'php', 'phtml', 'php3', 'php4', 'php5', 'php7', 'php8', 'phar', 'pht',
        'sh', 'bash', 'zsh', 'csh', 'ksh',
        'exe', 'bat', 'cmd', 'com', 'scr', 'msi', 'vbs', 'vbe', 'wsf', 'wsh',
        'ps1', 'ps2', 'psc1', 'psc2', 'msh', 'msh1', 'msh2',
        'py', 'pyw', 'pyc', 'pyo', 'pyd',
        'rb', 'rbw',
        'pl', 'pm', 'cgi',
        'asp', 'aspx', 'cer', 'asa', 'asax', 'ashx', 'asmx', 'axd',
        'jsp', 'jspx', 'jsw', 'jsv', 'jspf',
        'htaccess', 'htpasswd', 'ini', 'config', 'env',
        'dll', 'so', 'dylib', 'bin',
    ];

    /**
     * Common webshell and code execution patterns to detect within uploaded content.
     */
    private const WEBSHELL_SIGNATURES = [
        '/<\?php/i',
        '/<\?=/i',
        '/<%/i',
        '/\b(eval|passthru|shell_exec|exec|system|popen|proc_open)\s*\(/i',
        '/\bbase64_decode\s*\(\s*[\'"][a-zA-Z0-9+\/]{20,}={0,2}[\'"]\s*\)/i',
        '/\bgzinflate\s*\(/i',
        '/\bgzuncompress\s*\(/i',
        '/\bassert\s*\(/i',
        '/\b__halt_compiler\s*\(/i',
    ];

    /**
     * Dangerous patterns specifically prohibited inside SVG vector images.
     */
    private const SVG_MALICIOUS_PATTERNS = [
        '/<\s*script/i',
        '/<\s*iframe/i',
        '/<\s*object/i',
        '/<\s*embed/i',
        '/<\s*applet/i',
        '/<\s*foreignObject/i',
        '/<\s*meta/i',
        '/<\s*link/i',
        '/on[a-z]+\s*=\s*["\']?[^"\'>\s]+/i', // e.g. onload=, onerror=, onclick=
        '/href\s*=\s*["\']?\s*javascript\s*:/i',
        '/xlink:href\s*=\s*["\']?\s*javascript\s*:/i',
        '/data\s*:\s*text\/html/i',
        '/<!ENTITY/i',
        '/<!DOCTYPE[^>]+SYSTEM/i',
    ];

    /**
     * Validate and sanitize an uploaded file on the server.
     *
     * @param UploadedFile $file
     * @param array $allowedMimes e.g. ['image/jpeg', 'image/png', ...] (empty means default safe set)
     * @throws ValidationException
     */
    public function validateUploadedFile(UploadedFile $file, array $allowedMimes = []): void
    {
        $realPath = $file->getRealPath();
        $originalName = $file->getClientOriginalName();

        if (! $realPath || ! file_exists($realPath)) {
            $this->fail('File upload was corrupted or missing from the temporary path.');
        }

        // 1. Filename & Null-Byte Inspection
        $this->verifyFilenameSafety($originalName);

        // 2. Real Magic Bytes / MIME Type Inspection
        $finfo = new \finfo(FILEINFO_MIME_TYPE);
        $detectedMime = $finfo->file($realPath) ?: 'application/octet-stream';

        if (! empty($allowedMimes) && ! in_array($detectedMime, $allowedMimes, true)) {
            $this->fail("The uploaded file type ({$detectedMime}) is not permitted.");
        }

        // 3. Executable Header Inspection (block PE, ELF, Mach-O disguised as images/docs)
        $this->verifyNoBinaryExecutables($realPath);

        // 4. Webshell & Script Injection Scan
        $this->scanForWebshellSignatures($realPath, $detectedMime);

        // 5. Image Structure & Integrity Validation
        if (str_starts_with($detectedMime, 'image/')) {
            $this->validateImageContent($realPath, $detectedMime);
        }
    }

    /**
     * Inspect file directly from storage content or local file (for completed S3 direct uploads).
     *
     * @param string $filePath Local or temporary file path
     * @param string $originalName
     * @param string $mimeType
     * @throws ValidationException
     */
    public function validateExistingFile(string $filePath, string $originalName, string $mimeType): void
    {
        if (! file_exists($filePath)) {
            $this->fail('File could not be found for security scanning.');
        }

        $this->verifyFilenameSafety($originalName);
        $this->verifyNoBinaryExecutables($filePath);
        $this->scanForWebshellSignatures($filePath, $mimeType);

        if (str_starts_with($mimeType, 'image/')) {
            $this->validateImageContent($filePath, $mimeType);
        }
    }

    /**
     * Validate that filename contains no dangerous extensions or null-bytes.
     */
    private function verifyFilenameSafety(string $filename): void
    {
        // Check for null bytes
        if (str_contains($filename, "\0") || str_contains($filename, '%00')) {
            $this->logWarning('File upload rejected: null byte detected in filename', ['filename' => $filename]);
            $this->fail('Malicious filename detected.');
        }

        // Split by dots to check all segments for dangerous extensions (e.g. shell.php.png)
        $parts = explode('.', strtolower($filename));
        array_shift($parts); // Remove base name

        foreach ($parts as $segment) {
            $cleanSegment = trim($segment);
            if (in_array($cleanSegment, self::DANGEROUS_EXTENSIONS, true)) {
                $this->logWarning('File upload rejected: dangerous extension detected', [
                    'filename' => $filename,
                    'extension' => $cleanSegment,
                ]);
                $this->fail('The uploaded file contains an unauthorized or dangerous extension.');
            }
        }
    }

    /**
     * Ensure the file does not start with executable machine code headers (PE, ELF, Mach-O).
     */
    private function verifyNoBinaryExecutables(string $realPath): void
    {
        $handle = @fopen($realPath, 'rb');
        if (! $handle) {
            return;
        }

        $header = fread($handle, 4);
        fclose($handle);

        if (strlen($header) >= 2) {
            // Windows PE / DOS executable header "MZ"
            if ($header[0] === 'M' && $header[1] === 'Z') {
                $this->logWarning('File upload rejected: Windows PE executable header detected', ['path' => $realPath]);
                $this->fail('Executable files are strictly forbidden.');
            }
        }

        if (strlen($header) >= 4) {
            // Linux ELF header (\x7fELF)
            if ($header === "\x7fELF") {
                $this->logWarning('File upload rejected: Linux ELF executable header detected', ['path' => $realPath]);
                $this->fail('Executable binary files are strictly forbidden.');
            }

            // Mach-O binary headers
            $machoSignatures = ["\xfe\xed\xfa\xce", "\xfe\xed\xfa\xcf", "\xce\xfa\xed\xfe", "\xcf\xfa\xed\xfe"];
            if (in_array($header, $machoSignatures, true)) {
                $this->logWarning('File upload rejected: Mach-O binary executable header detected', ['path' => $realPath]);
                $this->fail('Executable binary files are strictly forbidden.');
            }
        }
    }

    /**
     * Scan raw bytes for PHP/ASP script tags and webshell payloads.
     */
    private function scanForWebshellSignatures(string $realPath, string $mimeType): void
    {
        // Don't read files larger than 10MB completely into memory for regex scan; inspect first 1MB & last 256KB
        $size = filesize($realPath);
        if ($size === false || $size === 0) {
            $this->fail('Cannot process an empty file.');
        }

        $sample = '';
        $handle = @fopen($realPath, 'rb');
        if ($handle) {
            $sample = fread($handle, min($size, 1024 * 1024)); // First 1MB
            if ($size > 1024 * 1024) {
                fseek($handle, max(0, $size - (256 * 1024)));
                $sample .= fread($handle, 256 * 1024); // Tail 256KB
            }
            fclose($handle);
        }

        foreach (self::WEBSHELL_SIGNATURES as $pattern) {
            if (preg_match($pattern, $sample)) {
                $this->logWarning('File upload rejected: webshell signature detected', [
                    'path' => $realPath,
                    'mime' => $mimeType,
                    'pattern' => $pattern,
                ]);
                $this->fail('The file contains potentially malicious executable code and cannot be accepted.');
            }
        }
    }

    /**
     * Validate that an image is structurally valid and contains no embedded threats.
     */
    private function validateImageContent(string $realPath, string $mimeType): void
    {
        if ($mimeType === 'image/svg+xml') {
            $this->validateSvgSecurity($realPath);
            return;
        }

        // For raster formats (JPEG, PNG, GIF, WebP, AVIF)
        $imageInfo = @getimagesize($realPath);
        if ($imageInfo === false) {
            $this->logWarning('File upload rejected: invalid image dimensions/structure', ['path' => $realPath]);
            $this->fail('The uploaded file is not a valid or readable image.');
        }

        [$width, $height, $imageType] = $imageInfo;

        if ($width <= 0 || $height <= 0) {
            $this->fail('The image has invalid dimensions.');
        }

        // Verify that the detected image type matches recognized raster formats
        $validTypes = [
            IMAGETYPE_JPEG,
            IMAGETYPE_PNG,
            IMAGETYPE_GIF,
        ];

        if (defined('IMAGETYPE_WEBP')) {
            $validTypes[] = IMAGETYPE_WEBP;
        }
        if (defined('IMAGETYPE_AVIF')) {
            $validTypes[] = IMAGETYPE_AVIF;
        }

        if (! in_array($imageType, $validTypes, true)) {
            $this->fail('Unsupported or unrecognized image format.');
        }
    }

    /**
     * Scan SVG XML content for XSS vectors, external entities, and event handlers.
     */
    private function validateSvgSecurity(string $realPath): void
    {
        $content = @file_get_contents($realPath);
        if ($content === false || trim($content) === '') {
            $this->fail('Empty or unreadable SVG file.');
        }

        foreach (self::SVG_MALICIOUS_PATTERNS as $pattern) {
            if (preg_match($pattern, $content)) {
                $this->logWarning('File upload rejected: SVG contains active script or XXE vector', [
                    'pattern' => $pattern,
                ]);
                $this->fail('SVG image contains potentially unsafe scripts or elements and was rejected.');
            }
        }
    }

    /**
     * Clean and sanitize target upload folder to prevent directory traversal.
     */
    public function sanitizeFolder(?string $folder): string
    {
        if (! $folder) {
            return 'uploads';
        }

        // Remove any null bytes or directory traversal patterns
        $folder = str_replace(["\0", '%00', '\\'], '', $folder);
        $folder = preg_replace('/\.\.+/', '', $folder); // Strip ..
        $folder = preg_replace('/[^a-zA-Z0-9_\-\/]/', '', (string) $folder);
        $folder = trim((string) $folder, '/');

        return $folder !== '' ? $folder : 'uploads';
    }

    /**
     * Abort with a standard validation exception.
     */
    private function fail(string $message): never
    {
        try {
            throw ValidationException::withMessages([
                'file' => [$message],
            ]);
        } catch (\RuntimeException) {
            throw new \InvalidArgumentException($message);
        }
    }

    /**
     * Safe logging helper that works even outside full Laravel HTTP application cycles.
     */
    private function logWarning(string $message, array $context = []): void
    {
        try {
            Log::warning($message, $context);
        } catch (\Throwable) {
            // Silently continue if logger is unavailable
        }
    }
}
