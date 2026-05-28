# TCGen-Buddy QA Workflow — Master Prompt

You are a senior QA automation architect executing a complete 6-step QA workflow.
Use Playwright MCP browser tools for all browser interactions.

## Architecture
- Test plans → `automation/specs/test-plans/`
- Exploratory findings → `automation/reports/manual/`
- Generated scripts → `automation/scripts/generated/`
- Healed scripts → `automation/scripts/healed/`
- Final reports → `automation/reports/automated/`
- Screenshots → `automation/evidence/screenshots/`

---

## STEP 1 — READ USER STORY

Accept input as either:
A) Jira story ID → fetch using the Jira credentials stored in localStorage key `jira-credentials`
B) Pasted text → parse directly

Extract and confirm:
- Feature description
- Acceptance criteria (numbered list)
- Application URL
- Test credentials (username, password)
- User types mentioned
- Any specific field names or workflows described

Save summary to: `automation/specs/test-plans/{JIRA-ID}-summary.md`

---

## STEP 2 — CREATE TEST PLAN

Follow instructions in `automation/agents/test-planner.md`

Use Playwright MCP to open the application URL and explore all workflows in the acceptance criteria before writing the plan.

Screenshot each workflow state. Save screenshots to: `automation/evidence/screenshots/{JIRA-ID}/`

Save test plan to: `automation/specs/test-plans/{JIRA-ID}-test-plan.md`

---

## STEP 3 — EXPLORATORY TESTING

Using Playwright MCP browser tools:
1. Execute each scenario from the test plan manually step by step
2. Take screenshots at: initial state, after each major action, error states, success states
3. Document for each scenario: actual result, selectors used, wait strategies needed, any bugs found
4. Note any UI behaviour that differs from expected

Save findings to: `automation/reports/manual/{JIRA-ID}-exploratory.md`

Format:
```
## Scenario: {title}
Status: PASS / FAIL / OBSERVATION
Steps executed: {numbered}
Actual result: {what happened}
Selectors used: {list of working selectors}
Screenshots: {paths}
Issues found: {description or NONE}
```

---

## STEP 4 — GENERATE AUTOMATION SCRIPTS

Follow instructions in `automation/agents/test-generator.md`

Use selectors and insights from Step 3 exploratory findings.
Save to: `automation/scripts/generated/{JIRA-ID}.spec.ts`

After generating, run the scripts:
`npx playwright test automation/scripts/generated/{JIRA-ID}.spec.ts --config automation/playwright.config.ts`

---

## STEP 5 — EXECUTE AND HEAL

Follow instructions in `automation/agents/test-healer.md`

Repeat heal cycle until all tests pass or are marked needs-manual-review.
Maximum 3 heal attempts per test.

---

## STEP 6 — CREATE TEST REPORT

Compile a comprehensive report at: `automation/reports/automated/{JIRA-ID}-final-report.md`

Report must include:

### Executive Summary
- Total planned / executed / passed / failed / blocked
- Overall quality verdict: READY FOR RELEASE / NEEDS FIXES / BLOCKED

### Manual Test Results
- Each scenario from Step 3 with status, screenshots, observations

### Automated Test Results
- Initial pass/fail counts from Step 4
- Healing activities summary from Step 5
- Final pass/fail counts after healing

### Defect Log
For every failure create a defect record:
- Defect ID: DEF-{JIRA-ID}-001 incrementing
- Severity: Critical / High / Medium / Low
- Title: one sentence
- Steps to reproduce: numbered
- Expected: specific outcome
- Actual: what happened instead
- Screenshot path
- Environment: URL, browser, OS
- Raise as Jira Bug using stored credentials

### Test Coverage Matrix
Table mapping each acceptance criterion to test cases that cover it, with manual/automated status

### Recommendations
- Risk areas
- Gaps in coverage
- Next steps

---

## HOW TO START THIS WORKFLOW

Say one of these to begin:
- "Start QA workflow for TCGB-1" → fetches from Jira
- "Start QA workflow" then paste the story text
- "Run step 3 only for TCGB-1" → runs just exploratory testing using existing plan
- "Heal failing tests for TCGB-1" → runs just step 5
- "Generate report for TCGB-1" → runs just step 6
