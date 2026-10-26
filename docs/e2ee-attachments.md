# E2EE attachments

Encrypted attachments (photos, videos, voice notes, files) are encrypted on the
device before upload. The storage bucket only holds ciphertext. The plaintext
attachment path (`POST /api/v1/messages/attachments`) is unchanged and still
exists alongside this one.

## Key flow

1. The client generates a fresh AES-256-GCM key and a fresh 96-bit nonce for
   each file (`frontend/src/lib/e2ee/attachments.ts`, `encryptAttachment`).
2. The client uploads only the ciphertext (`POST /api/v1/attachments/encrypted`).
   The GCM tag is appended by WebCrypto, so the stored size is plaintext + 16 bytes.
3. The client sends `metadata = {key, iv, mime, name, size}` to the recipient
   inside the existing 1:1 Signal session, together with the returned attachment
   `id`. The key never goes to the server.
4. The recipient fetches a short-lived signed URL
   (`GET /api/v1/attachments/encrypted/{id}/url`), downloads the bytes and calls
   `decryptAttachment(bytes, metadata)`.

## What the server can see

- The attachment id, owner user, conversation id, object path (random, no file
  name), ciphertext size, content type (always `application/octet-stream`) and
  upload time.
- Who requested a download URL, and when.
- Nothing about the file's content, name, mime type or key.

Objects live in the private bucket (`contabo_private`). No public URL is ever
returned. Download URLs expire after `ENCRYPTED_ATTACHMENT_URL_TTL` minutes
(default 5). Only participants of the conversation get a URL. Everyone else gets
a 404, so ids cannot be probed.

## Trade-off: content scanning

`FileSecurityFilterService` and the image/file content checks need plaintext, so
they cannot run on encrypted uploads. Malware, polyglot and webshell checks, and
mime enforcement, do not apply to encrypted attachments. Recipients get them as
opaque bytes and must treat decrypted content with the same caution as any
untrusted file.

Limits that still apply:

- Size: `ENCRYPTED_ATTACHMENT_MAX_BYTES` (default 25 MB, applied to ciphertext).
- Count: `ENCRYPTED_ATTACHMENT_DAILY_LIMIT` uploads per user per rolling 24 hours
  (default 200), plus a per-minute request throttle.
- Storage quota: `StorageQuotaService::checkUserQuota`.

## Known gaps

- Group and community conversations are not covered. Only direct conversations
  with participant rows are supported.
- Encrypted rows are not yet counted in `StorageUsage`, so they are not included
  in the quota total.
- The client upload UI and the Signal message carrying `metadata` are not wired
  up yet.
