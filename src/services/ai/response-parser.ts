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

type ParsedResponseShape = {
  testCases?: RawTestCase[];
  test_cases?: RawTestCase[];
  testcases?: RawTestCase[];
  cases?: RawTestCase[];
  tests?: RawTestCase[];
  scenarios?: RawTestCase[];
};

class ResponseParser {
  parse(raw: string): ParsedOutput {
    const cleaned = this.cleanResponse(raw);
    let parsed: ParsedResponseShape | RawTestCase[];

    try {
      parsed = this.parseJsonCandidate(cleaned);
    } catch {
      parsed = this.recoverPartialJson(cleaned);
    }

    const rawCases = this.extractCases(parsed);

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

  private cleanResponse(raw: string): string {
    return raw
      .trim()
      .replace(/^```(?:json|javascript|js|ts|typescript)?\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();
  }

  private parseJsonCandidate(raw: string): ParsedResponseShape | RawTestCase[] {
    try {
      return JSON.parse(raw) as ParsedResponseShape | RawTestCase[];
    } catch {
      const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
      if (fenced?.[1]) {
        return JSON.parse(fenced[1].trim()) as ParsedResponseShape | RawTestCase[];
      }

      const objectCandidate = this.extractBalancedJson(raw, '{', '}');
      if (objectCandidate) {
        return JSON.parse(objectCandidate) as ParsedResponseShape;
      }

      const arrayCandidate = this.extractBalancedJson(raw, '[', ']');
      if (arrayCandidate) {
        return JSON.parse(arrayCandidate) as RawTestCase[];
      }

      throw new Error('No parseable JSON candidate found');
    }
  }

  private extractBalancedJson(raw: string, openChar: '{' | '[', closeChar: '}' | ']'): string | null {
    const start = raw.indexOf(openChar);
    if (start === -1) return null;

    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let i = start; i < raw.length; i += 1) {
      const char = raw[i];

      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === '\\') {
        escaped = true;
        continue;
      }
      if (char === '"') {
        inString = !inString;
        continue;
      }
      if (inString) continue;

      if (char === openChar) depth += 1;
      if (char === closeChar) depth -= 1;

      if (depth === 0) {
        return raw.slice(start, i + 1);
      }
    }

    return null;
  }

  private extractCases(parsed: ParsedResponseShape | RawTestCase[]): RawTestCase[] {
    if (Array.isArray(parsed)) return parsed;

    return parsed.testCases ||
      parsed.test_cases ||
      parsed.testcases ||
      parsed.cases ||
      parsed.tests ||
      parsed.scenarios ||
      [];
  }

  private normalizeTestData(raw?: string | object): string {
    if (!raw) return 'N/A';
    if (typeof raw === 'string') return raw.trim() || 'N/A';
    return Object.entries(raw)
      .map(([k, v]) => `${k}: ${v}`)
      .join(' | ');
  }

  private normalizeSteps(raw?: string | string[]): string {
    if (!raw) return '';
    if (Array.isArray(raw)) {
      return raw
        .map((s, i) => {
          const step = String(s).trim();
          return /^\d+\./.test(step) ? step : `${i + 1}. ${step}`;
        })
        .join('\n');
    }
    return String(raw).trim();
  }

  private recoverPartialJson(raw: string): ParsedResponseShape {
    const arrayStart = this.findCasesKeyIndex(raw);
    if (arrayStart === -1) throw new Error('Cannot recover: no test cases key found');

    const completeCases: RawTestCase[] = [];
    const objRegex = /\{[^{}]*(?:\{[^{}]*\}[^{}]*)?\}/g;
    const arrayOpen = raw.indexOf('[', arrayStart);
    if (arrayOpen === -1) throw new Error('Cannot recover: no array found');

    const arrayContent = raw.slice(arrayOpen);
    let match: RegExpExecArray | null;

    while ((match = objRegex.exec(arrayContent)) !== null) {
      try {
        const obj = JSON.parse(match[0]) as RawTestCase;
        if (obj.title || obj.testCaseId || obj.id) {
          completeCases.push(obj);
        }
      } catch {
        // Skip malformed partial objects.
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

  private findCasesKeyIndex(raw: string): number {
    const keys = ['"testCases"', '"test_cases"', '"testcases"', '"cases"', '"tests"', '"scenarios"'];
    const indexes = keys
      .map((key) => raw.indexOf(key))
      .filter((index) => index >= 0);

    return indexes.length ? Math.min(...indexes) : -1;
  }

  private normalizePriority(raw?: string): 'High' | 'Medium' | 'Low' {
    const val = (raw || '').toLowerCase().trim();
    if (val === 'high') return 'High';
    if (val === 'low') return 'Low';
    return 'Medium';
  }
}

export const responseParser = new ResponseParser();
