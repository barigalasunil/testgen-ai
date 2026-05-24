type RawTestCase = {
  testCaseId?: string;
  id?: string;
  title?: string;
  testType?: string;
  type?: string;
  priority?: string;
  preconditions?: string;
  precondition?: string;
  testData?: string | object;
  data?: string | object;
  steps?: string | string[];
  expectedResult?: string;
  expected?: string;
};

type ParsedOutput = {
  testCases: {
    testCaseId: string;
    title: string;
    testType: string;
    priority: string;
    preconditions: string;
    testData: string;
    steps: string;
    expectedResult: string;
  }[];
};

class ResponseParser {
  parse(raw: string): ParsedOutput {
    // Strip markdown code fences if present
    let cleaned = raw.trim();
    cleaned = cleaned
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();

    // Remove all trailing newlines/whitespace
    cleaned = cleaned.trimEnd();

    let parsed: any;

    try {
      parsed = JSON.parse(cleaned);
    } catch {
      // LLM truncated the response — try to recover partial JSON
      parsed = this.recoverPartialJson(cleaned);
    }

    const rawCases: RawTestCase[] =
      parsed.testCases || parsed.test_cases || parsed.cases || [];

    if (!Array.isArray(rawCases) || rawCases.length === 0) {
      throw new Error('No test cases array found in parsed response');
    }

    const testCases = rawCases.map((tc, index) => {
      const num = String(index + 1).padStart(3, '0');
      return {
        testCaseId: String(tc.testCaseId || tc.id || `TC-${num}`),
        title: String(tc.title || `Test Case ${num}`),
        testType: String(tc.testType || tc.type || 'Functional'),
        priority: this.normalizePriority(tc.priority),
        preconditions: String(tc.preconditions || tc.precondition || 'None'),
        testData: this.normalizeTestData(tc.testData || tc.data),
        steps: this.normalizeSteps(tc.steps),
        expectedResult: String(tc.expectedResult || tc.expected || ''),
      };
    });

    return { testCases };
  }

  // Handles testData as object OR string
  private normalizeTestData(raw?: string | object): string {
    if (!raw) return 'N/A';
    if (typeof raw === 'string') return raw.trim() || 'N/A';
    // LLM returned an object like { username: "x", password: "y" }
    // Convert to readable key: value format
    return Object.entries(raw)
      .map(([k, v]) => `${k}: ${v}`)
      .join(' | ');
  }

  // Handles steps as array OR string
  private normalizeSteps(raw?: string | string[]): string {
    if (!raw) return '';
    if (Array.isArray(raw)) {
      return raw
        .map((s, i) => {
          const step = String(s).trim();
          // If step already starts with a number, keep it, else add one
          return /^\d+\./.test(step) ? step : `${i + 1}. ${step}`;
        })
        .join('\n');
    }
    return String(raw).trim();
  }

  // Recover as many complete test cases as possible from a truncated response
  private recoverPartialJson(raw: string): any {
    // Find the testCases array start
    const arrayStart = raw.indexOf('"testCases"');
    if (arrayStart === -1) throw new Error('Cannot recover: no testCases key found');

    // Collect all complete objects inside the array
    // A complete object ends with } followed by , or ]
    const completeCases: any[] = [];
    const objRegex = /\{[^{}]*(?:\{[^{}]*\}[^{}]*)?\}/g;

    // Find the array content
    const arrayOpen = raw.indexOf('[', arrayStart);
    if (arrayOpen === -1) throw new Error('Cannot recover: no array found');

    const arrayContent = raw.slice(arrayOpen);
    let match;

    while ((match = objRegex.exec(arrayContent)) !== null) {
      try {
        const obj = JSON.parse(match[0]);
        if (obj.title || obj.testCaseId) {
          completeCases.push(obj);
        }
      } catch {
        // Skip malformed partial objects
      }
    }

    if (completeCases.length === 0) {
      throw new Error('Cannot recover any complete test cases from truncated response');
    }

    console.warn(
      `[ResponseParser] Recovered ${completeCases.length} complete test case(s) from truncated LLM response`
    );

    return { testCases: completeCases };
  }

  private normalizePriority(raw?: string): 'High' | 'Medium' | 'Low' {
    const val = (raw || '').toLowerCase().trim();
    if (val === 'high') return 'High';
    if (val === 'low') return 'Low';
    return 'Medium';
  }
}

export const responseParser = new ResponseParser();