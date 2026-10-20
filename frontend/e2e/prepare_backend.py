"""Prepare the isolated e2e database for the real MurihSpace Laravel API.

Uses a SQLite file (web/backend/database/e2e.sqlite). It refuses to run unless
the target is that file, so the development PostgreSQL database is never touched.
Creates a demo creator account and writes a Sanctum token for the browser tests.

Run from web/frontend:  python3 e2e/prepare_backend.py
"""
import json
import os
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
BACKEND = (HERE / ".." / ".." / "backend").resolve()
DB_FILE = BACKEND / "database" / "e2e.sqlite"
TOKEN_FILE = HERE / "report" / "e2e-token.json"
EMAIL = "e2e.creator@example.test"
PASSWORD = "E2e-Test-Pass-123"

ENV = {
    **os.environ,
    "APP_ENV": "local",
    "DB_CONNECTION": "sqlite",
    "DB_DATABASE": str(DB_FILE),
    "BROADCAST_CONNECTION": "null",
    "CACHE_STORE": "array",
    "QUEUE_CONNECTION": "sync",
    "SESSION_DRIVER": "array",
    "MAIL_MAILER": "array",
}


def artisan(*args, check=True):
    return subprocess.run(["php", "artisan", *args], cwd=BACKEND, env=ENV,
                          capture_output=True, text=True, check=check)


def main():
    if DB_FILE.name != "e2e.sqlite" or "e2e" not in DB_FILE.name:
        sys.exit("refusing to run: target is not the e2e database")
    DB_FILE.touch()
    artisan("migrate:fresh", "--force")
    artisan("db:seed", "--class=FeatureFlagSeeder", "--force", check=False)
    tinker = f"""
$u = \\App\\Models\\User::updateOrCreate(['email' => '{EMAIL}'], [
  'name' => 'E2E Creator', 'username' => 'e2ecreator',
  'password' => \\Illuminate\\Support\\Facades\\Hash::make('{PASSWORD}'),
  'role' => 'creator',
]);
// email_verified_at and kyc_status are not mass-assignable, so set them explicitly.
$u->forceFill(['email_verified_at' => now(), 'kyc_status' => 'verified'])->save();
$t = $u->createToken('e2e')->plainTextToken;
echo 'TOKEN:' . $t;
"""
    out = artisan("tinker", "--execute", tinker).stdout
    token = next(line[len("TOKEN:"):] for line in out.splitlines() if line.startswith("TOKEN:"))
    TOKEN_FILE.parent.mkdir(exist_ok=True)
    TOKEN_FILE.write_text(json.dumps({"token": token, "email": EMAIL}))
    print(f"e2e database ready: {DB_FILE}")
    print(f"token written: {TOKEN_FILE}")


if __name__ == "__main__":
    main()
