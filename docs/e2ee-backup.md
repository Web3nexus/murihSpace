# End-to-end encryption: key backup

A user can restore their encrypted chats on a new device. The server stores an
encrypted copy of the device state and cannot read it.

## How it works

1. The browser exports the device state (`Device.export()` from `e2ee-bridge`) as JSON.
2. The user's passphrase is turned into a 256-bit key with PBKDF2-HMAC-SHA256,
   using a random 16-byte salt and 600,000 iterations (WebCrypto).
3. The JSON is encrypted with AES-256-GCM under a random 12-byte IV. The format
   version and iteration count are bound to the ciphertext as additional
   authenticated data, so changing either one breaks decryption.
4. The browser uploads `version`, `salt`, `iv`, `iterations` and `ciphertext`
   (base64) with `PUT /api/v1/e2ee/backup`. Each user has one backup, and a new
   upload replaces it.
5. `GET /api/v1/e2ee/backup` returns the blob to its owner only. It is sent with
   `Cache-Control: no-store`.

The server never receives the passphrase, the derived key or the plaintext. The
backend refuses any field other than the five above, so a plaintext field cannot
be stored by mistake. The size limit is 2,097,152 characters for `ciphertext`.

Code: `frontend/src/lib/e2ee/backup.ts` (`createBackup`, `restoreBackup`), backend
`E2eeBackupController`, table `e2ee_backups`.

## Iteration count

New backups use 600,000 PBKDF2 iterations, which is the OWASP minimum for
PBKDF2-HMAC-SHA256. The server rejects a `iterations` value below 600,000 or above
10,000,000, and the browser also refuses to read a blob with a count below 600,000.
That stops a compromised server from lowering the cost of an offline guess. To
raise the count later, bump `BACKUP_VERSION` and keep reading the old version.

Argon2id would be a stronger choice, but the project has no vetted Argon2
library in the browser, so PBKDF2 is used.

## Recovery trade-off

**If the passphrase is lost, the backup cannot be recovered.** This is by design.
The server holds no key and no recovery copy, and nobody at MuriSpace can decrypt
the backup. The user has to create a new backup from a device that still has the
keys, or start over with new keys.

The UI should say this clearly when the passphrase is set, and should not offer
a "forgot passphrase" reset that would bypass the encryption.

A weak passphrase is the main risk. The browser refuses passphrases shorter than
12 characters. Longer passphrases are better, and a password manager is a good way
to create and store one.

## Rotating the passphrase

The backup is encrypted under one passphrase at a time. To change it:

1. On a device that already holds the live keys, export the state with
   `Device.export()` and call `createBackup(newPassphrase, json)`.
2. The upload replaces the old backup. The old passphrase no longer opens the
   server's copy.

The old ciphertext is overwritten on the server, not kept as history. Anyone who
copied the old blob earlier can still try the old passphrase against it, so
rotate the passphrase after a suspected leak as well.

## Limits

- The backup holds the device state (keys and sessions), not a separate message archive.
- Rate limits apply: 10 uploads per minute and 30 downloads per minute per user.
- Backup and restore run in the browser only. No UI is wired up yet.
