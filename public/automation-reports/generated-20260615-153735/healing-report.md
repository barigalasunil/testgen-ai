# Healing Report - generated-20260615-153735
Final Status: PARTIALLY_HEALED
Failure Type: LOCATOR_NOT_FOUND
Classification: HEALABLE
Root Cause: Locator could not resolve to a usable element.
## Failed Tests
- healable timing local probe (412ms)
- healable timing local probe (392ms)
- healable timing local probe ────
- healable timing local probe ─────
## Evidence
- Error Stack: automation\reports\healing\generated-20260615-153735\error-stack.txt
- Screenshots: automation\reports\healing\generated-20260615-153735\evidence\1-test-failed-1.png, automation\reports\healing\generated-20260615-153735\evidence\2-test-failed-1.png, automation\reports\healing\generated-20260615-153735\evidence\3-78485ad26ab49de2007fe98b0854715a58aaf5b6.png
- Traces: automation\reports\healing\generated-20260615-153735\evidence\1-trace.zip, automation\reports\healing\generated-20260615-153735\evidence\2-trace.zip, automation\reports\healing\generated-20260615-153735\evidence\3-d88c232fe9eb35940439c8ccc2e07ed01c22d3df.zip, automation\reports\healing\generated-20260615-153735\evidence\4-dd390798cb826f751921a0f6e2acaabf701e7b08.zip
- Videos: automation\reports\healing\generated-20260615-153735\evidence\1-video.webm, automation\reports\healing\generated-20260615-153735\evidence\2-video.webm, automation\reports\healing\generated-20260615-153735\evidence\3-f4d46357a97dc860a1d20aa46e1bbff337413d95.webm, automation\reports\healing\generated-20260615-153735\evidence\4-f8c1f7908de10fd95c2c72a4481df0af624036dd.webm
- Failed Locator: '#ready'
## Locator Healing
- Original Locator: '#ready'
- Replacement Locator: .getByTestId('ready')
## Code Changes
- locator: .locator('#ready') -> .getByTestId('ready') (Try project data-test attribute derived from stable id.)
## Re-run Result
- Failed-only grep: healable timing local probe \(412ms\)
- Healed Script: D:\TCGen-Buddy\automation\scripts\healed\generated-20260615-153735.spec.ts
- Re-run Status: FAIL