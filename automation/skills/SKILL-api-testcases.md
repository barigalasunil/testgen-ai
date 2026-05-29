# SKILL: API Test Case Generation

## Purpose
Generate API tests from Swagger/OpenAPI specs, curl commands, or endpoint descriptions.
Supports RestAssured Java, Playwright TypeScript, Newman/Postman, Manual scenarios.

## When to use this skill
- User provides a Swagger URL or pastes OpenAPI JSON/YAML
- User provides a curl command
- Agent needs to generate API tests in any format

## Anti-Hallucination Rules — NON-NEGOTIABLE
- Only generate tests for endpoints explicitly in the spec
- Never invent endpoints, parameters, or response fields
- Use exact field names, types, and status codes from the spec

## Coverage Per Endpoint
For every endpoint always cover:
1. Happy path — all required fields, valid data, expected success status
2. Missing required field — expect 400
3. Invalid data type — expect 400
4. No auth token — expect 401
5. Resource not found — expect 404
6. Boundary — empty string, maximum length value

## RestAssured Output Template
```java
import io.restassured.RestAssured;
import static io.restassured.RestAssance.*;
import static org.hamcrest.Matchers.*;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

public class ApiTests {
@BeforeAll
static void setup() {
RestAssured.baseURI = "BASE_URL_HERE";
}

@Test
// TC-001: Description of what this test validates
void testName() {
given()
.contentType("application/json")
.body("{\"key\":\"value\"}")
.when()
.post("/endpoint")
.then()
.statusCode(200)
.body("field", notNullValue());
}
}

## Playwright API Output Template
```typescript
import { test, expect } from '@playwright/test';

test.describe('METHOD /endpoint', () => {
test('TC-001: Description', async ({ request }) => {
const response = await request.post('/endpoint', {
data: { key: 'value' }
});
expect(response.status()).toBe(200);
const body = await response.json();
expect(body.field).toBeTruthy();
});
});

## Manual Test Scenarios Output
One line per scenario:
TC-001 | METHOD /path | Scenario title | Test data | Expected status and response

## Newman/Postman Output
Valid Postman Collection v2.1 JSON.
Runnable with: `newman run collection.json`

## Chunking for Large Specs
If spec has more than 10 endpoints, split into groups of 5.
Separate each group with: `// ═══ Section: {group name} ═══`