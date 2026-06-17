# Healing Report - generated-20260615-150243
Final Status: PARTIALLY_HEALED
Failure Type: LOCATOR_NOT_FOUND
Classification: HEALABLE
Root Cause: Locator could not resolve to a usable element.
## Failed Tests
- healable locator local probe
- healable locator local probe ──
- healable locator local probe ───
## Evidence
- Error Stack: automation\reports\healing\generated-20260615-150243\error-stack.txt
- Screenshots: automation\reports\healing\generated-20260615-150243\evidence\1-test-failed-1.png, automation\reports\healing\generated-20260615-150243\evidence\2-test-failed-1.png, automation\reports\healing\generated-20260615-150243\evidence\3-4d441aaeb61406fca3a9804007165884fe1512f2.png
- Traces: automation\reports\healing\generated-20260615-150243\evidence\1-trace.zip, automation\reports\healing\generated-20260615-150243\evidence\2-trace.zip, automation\reports\healing\generated-20260615-150243\evidence\3-4930abcb4d580fc6282bccce288fb16b165d0de0.zip, automation\reports\healing\generated-20260615-150243\evidence\4-90f8ea09ccc66249ff9c791eae170336929dfc48.zip
- Videos: automation\reports\healing\generated-20260615-150243\evidence\1-video.webm, automation\reports\healing\generated-20260615-150243\evidence\2-video.webm, automation\reports\healing\generated-20260615-150243\evidence\3-4b3b83bdf167c0257a3d55e2da24bd8f2d520a07.webm, automation\reports\healing\generated-20260615-150243\evidence\4-8aa172e70a9c267a9b04e7866e28be63a6791044.webm
- Failed Locator: '#login-button-broken'
## Locator Healing
- Original Locator: '#login-button-broken'
- Replacement Locator: .getByRole('button', { name: /login/i })
## Code Changes
- locator: .locator('#login-button-broken') -> .getByRole('button', { name: /login/i }) (Use accessible role before falling back to CSS.)
## Re-run Result
- Failed-only grep: healable locator local probe|healable locator local probe ──|healable locator local probe ───
- Healed Script: D:\TCGen-Buddy\automation\scripts\healed\generated-20260615-150243.spec.ts
- Re-run Status: FAIL