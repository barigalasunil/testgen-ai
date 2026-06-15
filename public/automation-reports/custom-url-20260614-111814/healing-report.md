# Healing Report - custom-url-20260614-111814

Final status: Needs Manual Review
Failure reason: assertion mismatch

## Failed Tests
- page has visible structure, usable major links, and no critical client errors (4.7s)
- page has visible structure, usable major links, and no critical client errors (retry #1) (4.6s)

## Evidence
- Screenshots: automation\reports\playwright-html\custom-url-20260614-110659\data\6e11ca7545fc3af8dbda2d363a941611c6441738.png, automation\reports\playwright-html\custom-url-20260614-111125\data\26d632fa1e2fff07c1125890fd49a49049f76e9c.png, automation\reports\playwright-html\custom-url-20260614-111814\data\316c2bf045ba7fcd6f32d476894917480c453d0c.png, automation\reports\playwright-html\custom-url-20260614-111814\data\700b6e9ddf91206905ae60bbd55803d5e82174af.png, automation\reports\playwright-html\custom-url-20260614-111814\data\98c707d89aae5a9434ab6c1eebc1634806d0b393.png, automation\reports\playwright-html\custom-url-20260614-111814\data\a47cf8051f9261e64fa22d2d026f6a31dbb4738c.png, automation\reports\traces\custom-url-20260614-111814\generic-sanity-Generic-Cus-3dde2-d-no-critical-client-errors-chromium\test-failed-1.png, automation\reports\traces\custom-url-20260614-111814\generic-sanity-Generic-Cus-3dde2-d-no-critical-client-errors-chromium-retry1\test-failed-1.png
- Traces: automation\reports\playwright-html\custom-url-20260614-104912\data\613c9a6aeb9dbed582303591ff1f05ffd79bc694.zip, automation\reports\playwright-html\custom-url-20260614-104912\data\b627b17a9d6eb41e110c826afe5deb9541e36460.zip, automation\reports\playwright-html\custom-url-20260614-111814\data\338da8e1f22b894e4057c0188a3d745cfc52da4b.zip, automation\reports\playwright-html\custom-url-20260614-111814\data\d7d993bcbd3d00a5c5e38df354f5554423ce6c7b.zip, automation\reports\traces\custom-url-20260614-104912\generic-smoke-Generic-Cust-4b633-e-body-and-non-5xx-response-chromium\trace.zip, automation\reports\traces\custom-url-20260614-104912\generic-smoke-Generic-Cust-4b633-e-body-and-non-5xx-response-chromium-retry1\trace.zip, automation\reports\traces\custom-url-20260614-111814\generic-sanity-Generic-Cus-3dde2-d-no-critical-client-errors-chromium\trace.zip, automation\reports\traces\custom-url-20260614-111814\generic-sanity-Generic-Cus-3dde2-d-no-critical-client-errors-chromium-retry1\trace.zip

## Healing Attempts
- Attempt 1: Evidence captured and failure classified.
- Attempt 2: Healed script stub saved when generated script was available.
- Attempt 3: Marked as Needs Manual Review if failure persists.

## Recommended Healing Strategy
- Prefer data-testid, role, label, placeholder, text, then stable CSS selectors.
- Replace hard waits with locator waits and Playwright expect auto-waiting.
- Verify UI text changes before changing assertions.