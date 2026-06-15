# Healing Report - generated-20260615-153053
Final Status: PARTIALLY_HEALED
Failure Type: LOCATOR_NOT_FOUND
Classification: HEALABLE
Root Cause: Locator could not resolve to a usable element.
## Failed Tests
- healable assertion mismatch local probe
## Evidence
- Error Stack: automation\reports\healing\generated-20260615-153053\error-stack.txt
- Screenshots: automation\reports\healing\generated-20260615-153053\evidence\1-test-failed-1.png, automation\reports\healing\generated-20260615-153053\evidence\2-test-failed-1.png, automation\reports\healing\generated-20260615-153053\evidence\3-6773996acf8d8eb96ff24703310fc1bc04a378ff.png
- Traces: automation\reports\healing\generated-20260615-153053\evidence\1-trace.zip, automation\reports\healing\generated-20260615-153053\evidence\2-trace.zip, automation\reports\healing\generated-20260615-153053\evidence\3-3196ee0f6f9d302ea411ab0382b46c05c7b0468b.zip, automation\reports\healing\generated-20260615-153053\evidence\4-6e3629076faa0d0a9e4553bf061890993ab4a75e.zip
- Videos: automation\reports\healing\generated-20260615-153053\evidence\1-video.webm, automation\reports\healing\generated-20260615-153053\evidence\2-video.webm, automation\reports\healing\generated-20260615-153053\evidence\3-2bce55c0d78ddf67fb4d4f333bc6dfb970e7b8e3.webm, automation\reports\healing\generated-20260615-153053\evidence\4-7b16ea6e951c62f2997c44ac91aadfa59f132ede.webm
- Failed Locator: '.login_logo'
## Locator Healing
- Original Locator: '.login_logo'
- Replacement Locator: .locator('.login_logo:visible')
## Code Changes
- locator: .locator('.login_logo') -> .locator('.login_logo:visible') (Retain stable CSS selector but require visible element.)
## Re-run Result
- Failed-only grep: healable assertion mismatch local probe
- Healed Script: D:\TCGen-Buddy\automation\scripts\healed\generated-20260615-153053.spec.ts
- Re-run Status: FAIL