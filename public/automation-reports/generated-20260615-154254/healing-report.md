# Healing Report - generated-20260615-154254
Final Status: AUTO_HEALED
Failure Type: TIMING_ISSUE
Classification: HEALABLE
Root Cause: A very short wait or assertion timeout expired before the UI became ready.
## Failed Tests
- healable timing local probe (406ms)
- healable timing local probe (448ms)
- healable timing local probe ────
- healable timing local probe ─────
## Evidence
- Error Stack: automation\reports\healing\generated-20260615-154254\error-stack.txt
- Screenshots: automation\reports\healing\generated-20260615-154254\evidence\1-test-failed-1.png, automation\reports\healing\generated-20260615-154254\evidence\2-test-failed-1.png, automation\reports\healing\generated-20260615-154254\evidence\3-78485ad26ab49de2007fe98b0854715a58aaf5b6.png
- Traces: automation\reports\healing\generated-20260615-154254\evidence\1-trace.zip, automation\reports\healing\generated-20260615-154254\evidence\2-trace.zip, automation\reports\healing\generated-20260615-154254\evidence\3-4b6c9071df5dd181080a52154334afce6522b564.zip, automation\reports\healing\generated-20260615-154254\evidence\4-a8ee19bb173ef78e1efa9d416956ed5ca8058fc9.zip
- Videos: automation\reports\healing\generated-20260615-154254\evidence\1-video.webm, automation\reports\healing\generated-20260615-154254\evidence\2-video.webm, automation\reports\healing\generated-20260615-154254\evidence\3-3b1b96ff2654bd23528949e2d7a52872b9612044.webm, automation\reports\healing\generated-20260615-154254\evidence\4-52c7360b53fba4726b97f7f459b438d04d98f3bc.webm
- Failed Locator: '#ready'
## Locator Healing
- Original Locator: '#ready'
- Replacement Locator: Not applicable
## Code Changes
- wait: await page.waitForTimeout(1); -> await page.waitForLoadState('networkidle'); (Replace hard timeout with Playwright load-state wait.)
- wait: timeout: 5 -> timeout: 5000 (Increase unrealistically short explicit timeout for Playwright auto-waiting.)
## Re-run Result
- Failed-only grep: healable timing local probe \(406ms\)
- Healed Script: D:\TCGen-Buddy\automation\scripts\healed\generated-20260615-154254.spec.ts
- Re-run Status: PASS