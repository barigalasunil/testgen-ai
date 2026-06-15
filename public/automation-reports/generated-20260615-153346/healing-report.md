# Healing Report - generated-20260615-153346
Final Status: AUTO_HEALED
Failure Type: TEXT_ASSERTION_MISMATCH
Classification: HEALABLE
Root Cause: Assertion text differs from runtime text.
## Failed Tests
- healable assertion mismatch local probe
## Evidence
- Error Stack: automation\reports\healing\generated-20260615-153346\error-stack.txt
- Screenshots: automation\reports\healing\generated-20260615-153346\evidence\1-test-failed-1.png, automation\reports\healing\generated-20260615-153346\evidence\2-test-failed-1.png, automation\reports\healing\generated-20260615-153346\evidence\3-6773996acf8d8eb96ff24703310fc1bc04a378ff.png
- Traces: automation\reports\healing\generated-20260615-153346\evidence\1-trace.zip, automation\reports\healing\generated-20260615-153346\evidence\2-trace.zip, automation\reports\healing\generated-20260615-153346\evidence\3-9e00992591a4958fe754706473a812e69a6c2f4e.zip, automation\reports\healing\generated-20260615-153346\evidence\4-e382a805ef624088d69a8f03971b81a04a5a08bf.zip
- Videos: automation\reports\healing\generated-20260615-153346\evidence\1-video.webm, automation\reports\healing\generated-20260615-153346\evidence\2-video.webm, automation\reports\healing\generated-20260615-153346\evidence\3-173a6f183f54cb6b745e13138dc16c56bc13f284.webm, automation\reports\healing\generated-20260615-153346\evidence\4-66171f4a574449c53167993c728f90f06c89ae35.webm
- Failed Locator: '.login_logo'
## Locator Healing
- Original Locator: '.login_logo'
- Replacement Locator: Not applicable
## Code Changes
- assertion: toHaveText('swag labs') -> toHaveText(/swag labs/i) (Allowed assertion healing: casing difference.)
## Re-run Result
- Failed-only grep: healable assertion mismatch local probe
- Healed Script: D:\TCGen-Buddy\automation\scripts\healed\generated-20260615-153346.spec.ts
- Re-run Status: PASS