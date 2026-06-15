# Healing Report - custom-url-20260614-093923

Final status: Needs Manual Review
Failure reason: timeout

## Failed Tests
- login for standard_user should success (42.9s)
- login for standard_user should success (retry #1) (43.2s)
- login for locked_out_user should fail (43.0s)
- login for locked_out_user should fail (retry #1) (47.2s)
- login for problem_user should success (47.1s)
- login for problem_user should success (retry #1) (47.2s)
- login for performance_glitch_user should success (47.1s)
- login for performance_glitch_user should success (retry #1) (47.3s)
- login for error_user should success (47.2s)
- login for error_user should success (retry #1) (47.2s)
- login for visual_user should success (47.1s)
- login for visual_user should success (retry #1) (47.1s)

## Evidence
- Screenshots: Not captured
- Traces: automation\reports\playwright-html\custom-url-20260614-093923\data\4cd550a377da3177a5706018720229084e5b240a.zip, automation\reports\playwright-html\custom-url-20260614-093923\data\648c6c7a3dbfb8e9f42c81b5c330ffa6a07ae381.zip, automation\reports\playwright-html\custom-url-20260614-093923\data\67d2cfd3455c95969a26a562729a57bc1bb7d95e.zip, automation\reports\playwright-html\custom-url-20260614-093923\data\71bfe9d7b0a5d48127ccf43773c5c6aa61d00b7f.zip, automation\reports\playwright-html\custom-url-20260614-093923\data\7282c73380675852af5eb6305f935fc61f8a89b9.zip, automation\reports\playwright-html\custom-url-20260614-093923\data\8bd3eda594c209135a4430b7fadba4396f641b32.zip, automation\reports\playwright-html\custom-url-20260614-093923\data\8e6d7ed0457db6b2c1f9892cd985bebb3bf3986f.zip, automation\reports\playwright-html\custom-url-20260614-093923\data\9b4961a17090bd00b70fe84c618dc464c2b652ef.zip, automation\reports\playwright-html\custom-url-20260614-093923\data\ac6990056b83d9910790c857e569405556f357d8.zip, automation\reports\playwright-html\custom-url-20260614-093923\data\af2707aa0ab328713a044874ea6aaed8e154467f.zip

## Healing Attempts
- Attempt 1: Evidence captured and failure classified.
- Attempt 2: Healed script stub saved when generated script was available.
- Attempt 3: Marked as Needs Manual Review if failure persists.

## Recommended Healing Strategy
- Prefer data-testid, role, label, placeholder, text, then stable CSS selectors.
- Replace hard waits with locator waits and Playwright expect auto-waiting.
- Verify UI text changes before changing assertions.