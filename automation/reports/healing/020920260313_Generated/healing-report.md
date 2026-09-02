# Healing Report - 020920260313_Generated
Run ID: 020920260313_Generated
Suite: generated
Failed Test: generated heal verification should pass after locator healing
Final Status: AUTO_HEALED
Failure Type: LOCATOR_NOT_FOUND
Healable: Yes
Confidence: 0.98
Reason: The original locator '#login-button-broken' failed. A high-confidence replacement was found in the DOM candidates using the data-testid 'login-button', which follows the preferred locator strategy order.
## Failed Tests
- generated heal verification should pass after locator healing
## Evidence
- Evidence JSON: automation\reports\healing\020920260313_Generated\evidence.json
- Error Stack: automation\reports\healing\020920260313_Generated\error-stack.txt
- Screenshots: automation\reports\healing\020920260313_Generated\evidence\1-test-failed-1.png, automation\reports\healing\020920260313_Generated\evidence\2-test-failed-1.png, automation\reports\healing\020920260313_Generated\evidence\3-91ed1f4f31597c3b2bc272bde04c1985161b9c2b.png
- Traces: automation\reports\healing\020920260313_Generated\evidence\1-trace.zip, automation\reports\healing\020920260313_Generated\evidence\2-trace.zip, automation\reports\healing\020920260313_Generated\evidence\3-1a7cd95b3e301337629f381e1c1cca22dda3f611.zip, automation\reports\healing\020920260313_Generated\evidence\4-399c8c235a740b87dafe1ca071f23f0764241f5a.zip
- Videos: automation\reports\healing\020920260313_Generated\evidence\1-video.webm, automation\reports\healing\020920260313_Generated\evidence\2-video.webm, automation\reports\healing\020920260313_Generated\evidence\3-512efb37c13a1c3bb0c5ff17e25c2a99fd3d9354.webm, automation\reports\healing\020920260313_Generated\evidence\4-cc5b0827577c34cbf720c4037f24a0afe549818d.webm
- Failed Locator: '#login-button-broken'
- Current URL: https://www.saucedemo.com
- Browser: chromium
- DOM Candidates: automation\reports\healing\020920260313_Generated\dom-candidates.json (15)
- AI Prompt: automation\reports\healing\020920260313_Generated\ai-healing-prompt.txt
## Locator Healing
- Original Locator: '#login-button-broken'
- Replacement Locator: await page.getByTestId('login-button').click();
## Original Code
```ts
await page.locator('#login-button-broken').click();
```
## Healed Code
```ts
await page.getByTestId('login-button').click();
```
## Code Changes
- locator: await page.locator('#login-button-broken').click(); -> await page.getByTestId('login-button').click(); (AI-assisted healing: The original locator '#login-button-broken' failed. A high-confidence replacement was found in the DOM candidates using the data-testid 'login-button', which follows the preferred locator strategy order.)
## Re-run Result
- Failed-only grep: generated heal verification should pass after locator healing
- Healed Script: D:\TCGen-Buddy\automation\scripts\healed\020920260313_Generated\heal-verify.healed.spec.ts
- Re-run Status: PASS
## Manual Review Notes
- No manual review notes.