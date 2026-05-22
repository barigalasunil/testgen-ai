import { TestCase } from "@/src/modules/testcase-generator/types";

export interface GenerationResult {
    testCases: TestCase[];
}

export class ResponseParser {
    parse(rawResponse: string): GenerationResult {
        let cleanResponse = rawResponse.trim();
        
        if (cleanResponse.startsWith("```")) {
            cleanResponse = cleanResponse.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
        }

        try {
            const parsed = JSON.parse(cleanResponse);

            // Accept either an object with testCases or a raw array
            const rawCases = Array.isArray(parsed)
                ? parsed
                : Array.isArray(parsed.testCases)
                    ? parsed.testCases
                    : [];

            if (!Array.isArray(rawCases) || rawCases.length === 0) {
                throw new Error("Invalid response format: missing testCases array");
            }

            const normalizeField = (v: any) => {
                if (v === null || typeof v === 'undefined') return "";
                if (typeof v === 'string') return v;
                if (typeof v === 'number' || typeof v === 'boolean') return String(v);
                if (Array.isArray(v)) return v.map(item => normalizeField(item)).join("\n");
                if (typeof v === 'object') {
                    // Prefer a readable key: value list for flat objects
                    const keys = Object.keys(v);
                    const allPrimitive = keys.every(k => ["string","number","boolean"].includes(typeof v[k]));
                    if (allPrimitive) {
                        return keys.map(k => `${k}: ${String(v[k])}`).join("\n");
                    }
                    try {
                        return JSON.stringify(v, null, 2);
                    } catch (e) {
                        return String(v);
                    }
                }
                return String(v);
            };

            const validatedTestCases = rawCases.map((tc: any, index: number) => {
                const rawTitle = tc.title || tc.name || tc.summary || tc.description || `Untitled`;
                return {
                    testCaseId: tc.testCaseId || tc.id || tc.unique_id || `TC-${String(index + 1).padStart(3, "0")}`,
                    title: normalizeField(rawTitle),
                    testType: normalizeField(tc.testType || tc.type || tc.category || "Functional"),
                    priority: normalizeField(tc.priority || tc.criticality_udf || "Medium"),
                    preconditions: normalizeField(tc.preconditions || tc.prerequisites_udf || tc.precondition || "None"),
                    testData: normalizeField(tc.testData || tc.testdata_udf || tc.test_data || "N/A"),
                    steps: normalizeField(tc.steps || tc.step_description || tc.actions || tc.procedure || ""),
                    expectedResult: normalizeField(tc.expectedResult || tc.expected_result || tc.expected || tc.outcome || ""),
                } as TestCase;
            });

            return { testCases: validatedTestCases };
        } catch (error) {
            console.error("Failed to parse AI response:", error);
            throw new Error(`Failed to parse AI response: ${error instanceof Error ? error.message : "Malformed JSON"}`);
        }
    }
}

export const responseParser = new ResponseParser();
