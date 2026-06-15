# Healing Report - generated-20260615-141442
Final Status: PARTIALLY_HEALED
Failure Type: LOCATOR_NOT_FOUND
Classification: HEALABLE
Root Cause: Locator could not resolve to a usable element.
## Failed Tests
- healable assertion mismatch probe
- healable assertion mismatch probe (retry #1)
- healable assertion mismatch probe
## Evidence
- Error Stack: automation\reports\healing\generated-20260615-141442\error-stack.txt
- Screenshots: automation\reports\healing\generated-20260615-141442\evidence\1-test-failed-1.png, automation\reports\healing\generated-20260615-141442\evidence\2-test-failed-1.png, automation\reports\healing\generated-20260615-141442\evidence\3-1bab72eaff857fb8bdb0fc9e164beacc156a0402.png
- Traces: automation\reports\healing\generated-20260615-141442\evidence\1-trace.zip, automation\reports\healing\generated-20260615-141442\evidence\2-trace.zip, automation\reports\healing\generated-20260615-141442\evidence\3-3b19b9a45c5b22168c5795786f4ed7332ee416c1.zip, automation\reports\healing\generated-20260615-141442\evidence\4-596a6061bf5d2a91752796b66528bb9779d6ec47.zip
- Videos: automation\reports\healing\generated-20260615-141442\evidence\1-video.webm, automation\reports\healing\generated-20260615-141442\evidence\2-video.webm, automation\reports\healing\generated-20260615-141442\evidence\3-24e3c9563bc8a5a86e85a39a5273feb92d531fdd.webm, automation\reports\healing\generated-20260615-141442\evidence\4-6b72337662221f8c4f1afb90187a968dcf66117f.webm
- Failed Locator: '.login_logo'
## Locator Healing
- Original Locator: '.login_logo'
- Replacement Locator: .locator('.login_logo:visible')
## Code Changes
- locator: .locator('.login_logo') -> .locator('.login_logo:visible') (Retain stable CSS selector but require visible element.)
## Re-run Result
- Failed-only grep: healable assertion mismatch probe|healable assertion mismatch probe \(retry #1\)|healable assertion mismatch probe
- Healed Script: D:\TCGen-Buddy\automation\scripts\healed\generated-20260615-141442.spec.ts
- Re-run Status: FAIL