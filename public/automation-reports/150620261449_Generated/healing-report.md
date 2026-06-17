# Healing Report - generated-20260615-144955
Final Status: AUTO_HEALED
Failure Type: TEXT_ASSERTION_MISMATCH
Classification: HEALABLE
Root Cause: Assertion text differs from runtime text.
## Failed Tests
- healable assertion mismatch local probe
## Evidence
- Error Stack: automation\reports\healing\generated-20260615-144955\error-stack.txt
- Screenshots: automation\reports\healing\generated-20260615-144955\evidence\1-test-failed-1.png, automation\reports\healing\generated-20260615-144955\evidence\2-test-failed-1.png, automation\reports\healing\generated-20260615-144955\evidence\3-6773996acf8d8eb96ff24703310fc1bc04a378ff.png
- Traces: automation\reports\healing\generated-20260615-144955\evidence\1-trace.zip, automation\reports\healing\generated-20260615-144955\evidence\2-trace.zip, automation\reports\healing\generated-20260615-144955\evidence\3-b047be46a9a8f70de64eb80f585b1ee882699bd8.zip, automation\reports\healing\generated-20260615-144955\evidence\4-dc30a9d277852bcf6147988108507551f07a13ac.zip
- Videos: automation\reports\healing\generated-20260615-144955\evidence\1-video.webm, automation\reports\healing\generated-20260615-144955\evidence\2-video.webm, automation\reports\healing\generated-20260615-144955\evidence\3-203ac6ae814b2f9c35299265e78d9178c7ff351e.webm, automation\reports\healing\generated-20260615-144955\evidence\4-a04b16f8c33a96f8733c019008526815b09e430a.webm
- Failed Locator: '.login_logo'
## Locator Healing
- Original Locator: '.login_logo'
- Replacement Locator: Not applicable
## Code Changes
- assertion: toHaveText('swag labs') -> toHaveText(/swag labs/i) (Allowed assertion healing: casing difference.)
## Re-run Result
- Failed-only grep: healable assertion mismatch local probe
- Healed Script: D:\TCGen-Buddy\automation\scripts\healed\generated-20260615-144955.spec.ts
- Re-run Status: PASS