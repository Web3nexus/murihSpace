"""End-to-end smoke test for the MurihSpace web dashboard against the REAL Laravel API.

What it checks, per route x viewport x theme:
  - uncaught page errors and console errors
  - every API call to the real backend that returns 4xx/5xx or fails to connect
  - error pages shown to the user ("Page not found", error boundary text)
  - empty content area
  - a screenshot for visual review

Setup (run from web/frontend):
  1. python3 e2e/prepare_backend.py        # isolated SQLite DB + demo token
  2. python3 /Users/vincent/.claude/skills/webapp-testing/scripts/with_server.py \
       --server "<backend cmd>" --port 8100 \
       --server "VITE_API_BASE_URL=http://127.0.0.1:8100/api/v1 npx vite --port 5190 --strictPort" --port 5190 \
       --timeout 90 -- python3 e2e/smoke.py

Exit code 1 if any check fails. Output: e2e/report/report.json and screenshots.
"""
import json
import os
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

HERE = Path(__file__).resolve().parent
OUT = HERE / "report"
OUT.mkdir(exist_ok=True)
BASE = os.environ.get("BASE_URL", "http://localhost:5190")
API = os.environ.get("API_URL", "http://127.0.0.1:8100/api/v1")
EMAIL = "e2e.creator@example.test"
PASSWORD = "E2e-Test-Pass-123"
API_ORIGIN = API.split("/api/v1")[0]

ROUTES = [
    ("login", "/login", False),
    ("feed", "/app/feed", True),
    ("wallet", "/app/wallet", True),
    ("communities", "/app/communities", True),
    ("store", "/app/store", True),
    ("messages", "/app/messages", True),
    ("friends", "/app/friends", True),
    ("friend-requests", "/app/friends/requests", True),
    ("kyc", "/app/kyc", True),
    ("store-products", "/app/store/products", True),
    ("store-digital", "/app/store/digital", True),
    ("store-reviews", "/app/store/reviews", True),
    ("upgrade", "/app/settings/upgrade", True),
    ("content-studio", "/app/studio", True),
]
VIEWPORTS = {"desktop": {"width": 1440, "height": 900}, "mobile": {"width": 390, "height": 844}}
THEMES = ["light", "dark"]

# Dev-only noise that is not a product bug.
IGNORED_CONSOLE = (
    "WebSocket connection",  # realtime socket (Reverb/Pusher) is not running in this test
    "[vite]",
    "Download the React DevTools",
    "net::ERR_FAILED",  # aborted socket/telemetry requests
)
ERROR_PAGE_MARKERS = ("Page not found", "This page does not exist", "Something went wrong")


def sign_in(ctx):
    """Signs the context in through the API so the httpOnly session cookie is set.

    The app no longer reads bearer tokens. The browser holds only the cookie, plus a
    session flag that tells the app to load the user.
    """
    from urllib.parse import unquote
    headers = {"Accept": "application/json", "Origin": BASE, "Referer": BASE + "/login"}
    ctx.request.get(f"{API_ORIGIN}/sanctum/csrf-cookie", headers=headers)
    xsrf = next((c["value"] for c in ctx.cookies() if c["name"] == "XSRF-TOKEN"), "")
    resp = ctx.request.post(
        f"{API}/auth/login",
        data=json.dumps({"email": EMAIL, "password": PASSWORD}),
        headers={**headers, "Content-Type": "application/json", "X-XSRF-TOKEN": unquote(xsrf), "X-Client-Platform": "web"},
    )
    if not resp.ok:
        raise RuntimeError(f"e2e sign-in failed: HTTP {resp.status}")


def run_case(browser, name, path, authed, vp_name, theme):
    ctx = browser.new_context(viewport=VIEWPORTS[vp_name], device_scale_factor=1)
    session_js = "localStorage.setItem('murihspace-session-hint','1');" if authed else "localStorage.removeItem('murihspace-session-hint');"
    ctx.add_init_script(f"localStorage.setItem('murihspace-theme','{theme}'); {session_js}")
    if authed:
        sign_in(ctx)
    page = ctx.new_page()

    page_errors, console_errors, api_failures = [], [], []
    page.on("pageerror", lambda e: page_errors.append(str(e)[:300]))
    page.on("console", lambda m: console_errors.append(m.text[:300])
            if m.type == "error" and not any(s in m.text for s in IGNORED_CONSOLE) else None)
    page.on("response", lambda r: api_failures.append(f"{r.request.method} {r.url[:160]} -> {r.status}")
            if r.url.startswith(API) and r.status >= 400 else None)
    aborted = []
    # ERR_ABORTED means the browser cancelled the request (navigation or unmount), not a server failure.
    page.on("requestfailed", lambda r: (aborted if "ERR_ABORTED" in (r.failure or "") else api_failures).append(
        f"{r.method} {r.url[:160]} failed: {r.failure}") if r.url.startswith(API) else None)

    result = {"route": path, "viewport": vp_name, "theme": theme, "status": "ok", "problems": []}
    try:
        page.goto(BASE + path, wait_until="domcontentloaded", timeout=60000)
        page.wait_for_load_state("networkidle", timeout=60000)
        page.wait_for_timeout(1500)
        text = page.inner_text("body")
        for marker in ERROR_PAGE_MARKERS:
            if marker in text:
                result["problems"].append(f"error page shown: '{marker}'")
        if not text.strip():
            result["problems"].append("blank page")
        if authed and page.locator("#main-content").count():
            main_chars = len(page.locator("#main-content").inner_text().strip())
            result["main_text_chars"] = main_chars
            if main_chars < 20:
                result["problems"].append(f"empty content area ({main_chars} chars)")
    except Exception as exc:
        result["problems"].append(f"navigation failed: {str(exc)[:200]}")

    page.screenshot(path=str(OUT / f"{name}-{vp_name}-{theme}.png"))
    result.update(page_errors=page_errors, console_errors=console_errors, api_failures=api_failures, aborted_requests=aborted)
    if page_errors:
        result["problems"].append(f"{len(page_errors)} uncaught page error(s)")
    if console_errors:
        result["problems"].append(f"{len(console_errors)} console error(s)")
    if api_failures:
        result["problems"].append(f"{len(api_failures)} failed API call(s)")
    if result["problems"]:
        result["status"] = "FAIL"
    ctx.close()
    return result


def main():
    results = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        for name, path, authed in ROUTES:
            for vp_name in VIEWPORTS:
                for theme in THEMES:
                    r = run_case(browser, name, path, authed, vp_name, theme)
                    results.append(r)
                    print(f"{r['status']:4} {name:12} {vp_name:8} {theme:5} {'; '.join(r['problems']) or 'clean'}")
        browser.close()
    (OUT / "report.json").write_text(json.dumps(results, indent=2))
    failed = [r for r in results if r["status"] == "FAIL"]
    print(f"\n{len(results) - len(failed)}/{len(results)} clean. Report: {OUT / 'report.json'}")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
