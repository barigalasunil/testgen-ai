# Healing Report - custom-url-20260613-183923

Final status: Needs Manual Review
Failure reason: needs analysis

## Failed Tests
- Unknown failed test

## Evidence
- Screenshots: Not captured
- Traces: Not captured

## Healing Attempts
- Attempt 1: Evidence captured and failure classified.
- Attempt 2: Healed script stub saved when generated script was available.
- Attempt 3: Marked as Needs Manual Review if failure persists.

## Recommended Healing Strategy
- Prefer data-testid, role, label, placeholder, text, then stable CSS selectors.
- Replace hard waits with locator waits and Playwright expect auto-waiting.
- Verify UI text changes before changing assertions.