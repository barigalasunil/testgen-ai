# Healing Report - generated-20260615-142501
Final Status: PARTIALLY_HEALED
Failure Type: TEXT_ASSERTION_MISMATCH
Classification: HEALABLE
Root Cause: Assertion text differs from runtime text.
## Failed Tests
- healable assertion mismatch local probe
- healable assertion mismatch local probe (retry #1)
- healable assertion mismatch local probe
## Evidence
- Error Stack: automation\reports\healing\generated-20260615-142501\error-stack.txt
- Screenshots: automation\reports\healing\generated-20260615-142501\evidence\1-test-failed-1.png, automation\reports\healing\generated-20260615-142501\evidence\2-test-failed-1.png, automation\reports\healing\generated-20260615-142501\evidence\3-6773996acf8d8eb96ff24703310fc1bc04a378ff.png
- Traces: automation\reports\healing\generated-20260615-142501\evidence\1-trace.zip, automation\reports\healing\generated-20260615-142501\evidence\2-trace.zip, automation\reports\healing\generated-20260615-142501\evidence\3-0c0c756dfe8ebbb3ed4defc275a872b01959bbc3.zip, automation\reports\healing\generated-20260615-142501\evidence\4-eedc787f31482268c27a7fbdaa14150e71d52e60.zip
- Videos: automation\reports\healing\generated-20260615-142501\evidence\1-video.webm, automation\reports\healing\generated-20260615-142501\evidence\2-video.webm, automation\reports\healing\generated-20260615-142501\evidence\3-6dd5197a072c78c78889d0f50c4a326613978b9c.webm, automation\reports\healing\generated-20260615-142501\evidence\4-b78d163cc8f7b528a757958efe949605b0cb0cf6.webm
- Failed Locator: '.login_logo'
## Locator Healing
- Original Locator: '.login_logo'
- Replacement Locator: Not applicable
## Code Changes
- assertion: toHaveText('swag labs') -> toHaveText(/swag labs/i) (Allowed assertion healing: casing difference.)
## Re-run Result
- Failed-only grep: healable assertion mismatch local probe|healable assertion mismatch local probe \(retry #1\)|healable assertion mismatch local probe
- Healed Script: D:\TCGen-Buddy\automation\scripts\healed\generated-20260615-142501.spec.ts
- Re-run Status: FAIL