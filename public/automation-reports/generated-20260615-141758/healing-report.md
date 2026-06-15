# Healing Report - generated-20260615-141758
Final Status: PARTIALLY_HEALED
Failure Type: TEXT_ASSERTION_MISMATCH
Classification: HEALABLE
Root Cause: Assertion text differs from runtime text.
## Failed Tests
- healable assertion mismatch probe
- healable assertion mismatch probe (retry #1)
- healable assertion mismatch probe
## Evidence
- Error Stack: automation\reports\healing\generated-20260615-141758\error-stack.txt
- Screenshots: automation\reports\healing\generated-20260615-141758\evidence\1-test-failed-1.png, automation\reports\healing\generated-20260615-141758\evidence\2-test-failed-1.png, automation\reports\healing\generated-20260615-141758\evidence\3-1bab72eaff857fb8bdb0fc9e164beacc156a0402.png
- Traces: automation\reports\healing\generated-20260615-141758\evidence\1-trace.zip, automation\reports\healing\generated-20260615-141758\evidence\2-trace.zip, automation\reports\healing\generated-20260615-141758\evidence\3-016d7789887a59e2c34a62f897d110aa181f169a.zip, automation\reports\healing\generated-20260615-141758\evidence\4-6b47c344c682fa744767ce2793621b90d9023da8.zip
- Videos: automation\reports\healing\generated-20260615-141758\evidence\1-video.webm, automation\reports\healing\generated-20260615-141758\evidence\2-video.webm, automation\reports\healing\generated-20260615-141758\evidence\3-170c26aa1e414241d2b07a16c29ac4a1b9c67aa0.webm, automation\reports\healing\generated-20260615-141758\evidence\4-8346105e6571a874f014366bcdd70f0a5d728dfc.webm
- Failed Locator: '.login_logo'
## Locator Healing
- Original Locator: '.login_logo'
- Replacement Locator: Not applicable
## Code Changes
- assertion: toHaveText('swag labs') -> toHaveText(/swag labs/i) (Allowed assertion healing: casing difference.)
## Re-run Result
- Failed-only grep: healable assertion mismatch probe|healable assertion mismatch probe \(retry #1\)|healable assertion mismatch probe
- Healed Script: D:\TCGen-Buddy\automation\scripts\healed\generated-20260615-141758.spec.ts
- Re-run Status: FAIL