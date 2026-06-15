# Healing Report - custom-url-20260614-104912

Final status: Needs Manual Review
Failure reason: timeout

## Failed Tests
- page loads successfully with title, body, and non-5xx response (59.4s)
- page loads successfully with title, body, and non-5xx response (retry #1) (59.5s)

## Evidence
- Screenshots: Not captured
- Traces: automation\reports\playwright-html\custom-url-20260614-104912\data\613c9a6aeb9dbed582303591ff1f05ffd79bc694.zip, automation\reports\playwright-html\custom-url-20260614-104912\data\b627b17a9d6eb41e110c826afe5deb9541e36460.zip, automation\reports\traces\custom-url-20260614-104912\generic-smoke-Generic-Cust-4b633-e-body-and-non-5xx-response-chromium\trace.zip, automation\reports\traces\custom-url-20260614-104912\generic-smoke-Generic-Cust-4b633-e-body-and-non-5xx-response-chromium-retry1\trace.zip

## Healing Attempts
- Attempt 1: Evidence captured and failure classified.
- Attempt 2: Healed script stub saved when generated script was available.
- Attempt 3: Marked as Needs Manual Review if failure persists.

## Recommended Healing Strategy
- Prefer data-testid, role, label, placeholder, text, then stable CSS selectors.
- Replace hard waits with locator waits and Playwright expect auto-waiting.
- Verify UI text changes before changing assertions.