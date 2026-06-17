# Healing Report - generated-20260615-152830
Final Status: AUTO_HEALED
Failure Type: LOCATOR_NOT_FOUND
Classification: HEALABLE
Root Cause: Locator could not resolve to a usable element.
## Failed Tests
- healable locator local probe
- healable locator local probe ──
- healable locator local probe ───
## Evidence
- Error Stack: automation\reports\healing\generated-20260615-152830\error-stack.txt
- Screenshots: automation\reports\healing\generated-20260615-152830\evidence\1-test-failed-1.png, automation\reports\healing\generated-20260615-152830\evidence\2-test-failed-1.png, automation\reports\healing\generated-20260615-152830\evidence\3-4d441aaeb61406fca3a9804007165884fe1512f2.png
- Traces: automation\reports\healing\generated-20260615-152830\evidence\1-trace.zip, automation\reports\healing\generated-20260615-152830\evidence\2-trace.zip, automation\reports\healing\generated-20260615-152830\evidence\3-028a06d999be194f7e2cce334f1907c1b638a003.zip, automation\reports\healing\generated-20260615-152830\evidence\4-1ffdf643ffb1ea05c5411acfe7852fc7d762ba12.zip
- Videos: automation\reports\healing\generated-20260615-152830\evidence\1-video.webm, automation\reports\healing\generated-20260615-152830\evidence\2-video.webm, automation\reports\healing\generated-20260615-152830\evidence\3-38474780cfed346e6bbde7ab7912f844e69f53f6.webm, automation\reports\healing\generated-20260615-152830\evidence\4-f92d1dd533ca18d0e46fb156363374e924beb2fd.webm
- Failed Locator: '#login-button-broken'
## Locator Healing
- Original Locator: '#login-button-broken'
- Replacement Locator: .getByRole('button', { name: /login/i })
## Code Changes
- locator: .locator('#login-button-broken') -> .getByRole('button', { name: /login/i }) (Use accessible role before falling back to CSS.)
## Re-run Result
- Failed-only grep: healable locator local probe
- Healed Script: D:\TCGen-Buddy\automation\scripts\healed\generated-20260615-152830.spec.ts
- Re-run Status: PASS