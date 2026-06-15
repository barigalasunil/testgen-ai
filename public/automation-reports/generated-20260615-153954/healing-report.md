# Healing Report - generated-20260615-153954
Final Status: PARTIALLY_HEALED
Failure Type: TIMING_ISSUE
Classification: HEALABLE
Root Cause: A very short wait or assertion timeout expired before the UI became ready.
## Failed Tests
- healable timing local probe (414ms)
- healable timing local probe (394ms)
- healable timing local probe ────
- healable timing local probe ─────
## Evidence
- Error Stack: automation\reports\healing\generated-20260615-153954\error-stack.txt
- Screenshots: automation\reports\healing\generated-20260615-153954\evidence\1-test-failed-1.png, automation\reports\healing\generated-20260615-153954\evidence\2-test-failed-1.png, automation\reports\healing\generated-20260615-153954\evidence\3-78485ad26ab49de2007fe98b0854715a58aaf5b6.png
- Traces: automation\reports\healing\generated-20260615-153954\evidence\1-trace.zip, automation\reports\healing\generated-20260615-153954\evidence\2-trace.zip, automation\reports\healing\generated-20260615-153954\evidence\3-0b545a563d65c7b638dc525b553c6b23b87ee640.zip, automation\reports\healing\generated-20260615-153954\evidence\4-93ac8e280e0dc96be12c3a2c19f395f540e7ffc5.zip
- Videos: automation\reports\healing\generated-20260615-153954\evidence\1-video.webm, automation\reports\healing\generated-20260615-153954\evidence\2-video.webm, automation\reports\healing\generated-20260615-153954\evidence\3-234715afbca4815caa5bc45f1ae90e9712d279b4.webm, automation\reports\healing\generated-20260615-153954\evidence\4-480ce77ee52033480a376b6b6203d293987112bc.webm
- Failed Locator: '#ready'
## Locator Healing
- Original Locator: '#ready'
- Replacement Locator: Not applicable
## Code Changes
- wait: await page.waitForTimeout(1); -> await page.waitForLoadState('networkidle'); (Replace hard timeout with Playwright load-state wait.)
- wait: timeout: 5 -> timeout: 5000 (Increase unrealistically short explicit timeout for Playwright auto-waiting.)
## Re-run Result
- Failed-only grep: healable timing local probe \(414ms\)
- Healed Script: D:\TCGen-Buddy\automation\scripts\healed\generated-20260615-153954.spec.ts
- Re-run Status: FAIL