# SKILL: Functional Test Case Generation

## Purpose
Generate structured, reusable, industry-standard functional test cases from
user stories, acceptance criteria, or feature descriptions.

## When to use this skill
- User provides a Jira story ID or pastes a requirement
- User asks to generate functional, UAT, or regression test cases
- Agent step 2 of the QA workflow needs to create a test plan

## Anti-Hallucination Rules — NON-NEGOTIABLE
- Generate ONLY test cases directly derivable from the provided requirement
- Never invent features, fields, or flows not mentioned in the input
- Use exact usernames, URLs, field names, and values from the requirement
- Every test step must be a single concrete executable action
- Every expected result must be specific and measurable
- Test data must contain real values — never "enter valid data" or "some text"
- If requirement is ambiguous, state the assumption in Preconditions field
- Do not duplicate scenarios — each test case must validate something distinct
- Minimum 6 test cases, maximum 15 per request

## Output Format
Return ONLY valid JSON. No markdown fences. No explanation. Raw JSON only.

```json
{
"testCases": [
{
"testCaseId": "TC-001",
"scenarioTitle": "One clear sentence describing what this validates",
"testType": "E2E",
"priority": "High",
"preconditions": "User is on the login page. Browser is open to https://www.saucedemo.com",
"testData": "username=standard_user, password=secret_sauce",
"testSteps": "1. Navigate to https://www.saucedemo.com\n2. Enter username: standard_user\n3. Enter password: secret_sauce\n4. Click Login button",
"expectedResult": "User is redirected to /inventory.html and sees a list of 6 products"
}
]
}

## Test Types
- E2E: Full user journey from entry to success confirmation
- Negative: Invalid input, wrong credentials, missing fields, unauthorized access
- Edge: Empty fields, max length, special characters, zero or null values
- Security: Auth bypass, SQL injection in inputs, direct URL access without login
- Boundary: Exact min, exact max, one below min, one above max
- Resilience: Network failure, session expiry, page refresh mid-flow
- Persona: Different user types with different permissions or behaviors

## Minimum Coverage Per Request
- At least 2 Negative test cases always
- At least 1 Security test case for any login or auth feature
- At least 1 Boundary test case for any form with text inputs
- At least 1 Persona test case if multiple user types are mentioned

## SauceDemo Reference Data
- URL: https://www.saucedemo.com
- Valid users: standard_user, problem_user, performance_glitch_user, error_user, visual_user
- Locked user: locked_out_user
- Password for all: secret_sauce
- Products: Sauce Labs Backpack ($29.99), Sauce Labs Bike Light ($9.99),
Sauce Labs Bolt T-Shirt ($15.99), Sauce Labs Fleece Jacket ($49.99),
Sauce Labs Onesie ($7.99), Test.allTheThings() T-Shirt ($15.99)
- Order confirmation: "Thank you for your order!"
- Locked error: "Epic sadface: Sorry, this user has been locked out."
- Invalid credentials error: "Epic sadface: Username and password do not match"