import { TestCase } from "@/src/modules/testcase-generator/types";

export interface GenerationResult {
    testCases: TestCase[];
}

function removeCodeFence(raw: string) {
    let cleaned = raw.trim();
    if (cleaned.startsWith("```")) {
        cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }
    return cleaned.trim();
}

function normalizeField(v: any): string {
    if (v === null || typeof v === "undefined") return "";
    if (typeof v === "string") return v;
    if (typeof v === "number" || typeof v === "boolean") return String(v);
    if (Array.isArray(v)) return v.map(item => normalizeField(item)).join("\n");
    if (typeof v === "object") {
        const keys = Object.keys(v);
        const allPrimitive = keys.every(k => ["string", "number", "boolean"].includes(typeof v[k]));
        if (allPrimitive) {
            return keys.map(k => `${k}: ${String(v[k])}`).join("\n");
        }
        try {
            return JSON.stringify(v, null, 2);
        } catch {
            return String(v);
        }
    }
    return String(v);
}

function isLikelyTestCaseObject(value: any) {
    return (
        value &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        (typeof value.testCaseId === "string" || typeof value.title === "string" || typeof value.name === "string")
    );
}

function tryParseJson(text: string) {
    try {
        return JSON.parse(text);
    } catch {
        return null;
    }
}

function extractBalancedChunks(text: string): string[] {
    const chunks: string[] = [];
    const stack: string[] = [];
    const startStack: number[] = [];
    let inString = false;
    let escape = false;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];

        if (escape) {
            escape = false;
            continue;
        }

        if (char === "\\") {
            escape = true;
            continue;
        }

        if (char === '"') {
            inString = !inString;
            continue;
        }

        if (inString) {
            continue;
        }

        if (char === "{" || char === "[") {
            stack.push(char);
            startStack.push(i);
            continue;
        }

        const lastOpen = stack[stack.length - 1];
        if (char === "}" && lastOpen === "{") {
            stack.pop();
            const startIndex = startStack.pop();
            if (startIndex !== undefined) {
                chunks.push(text.substring(startIndex, i + 1));
            }
            continue;
        }

        if (char === "]" && lastOpen === "[") {
            stack.pop();
            const startIndex = startStack.pop();
            if (startIndex !== undefined) {
                chunks.push(text.substring(startIndex, i + 1));
            }
            continue;
        }
    }

    return chunks;
}

function findBestJsonCandidate(rawResponse: string) {
    const cleaned = removeCodeFence(rawResponse);
    const candidates = extractBalancedChunks(cleaned);

    for (const candidate of candidates) {
        const parsed = tryParseJson(candidate);
        if (!parsed) continue;

        if (Array.isArray(parsed)) {
            return parsed;
        }

        if (parsed && typeof parsed === "object") {
            if (Array.isArray((parsed as any).testCases)) {
                return parsed;
            }
            if (isLikelyTestCaseObject(parsed)) {
                return parsed;
            }
        }
    }

    const recoveredTestCases: any[] = [];
    for (const candidate of candidates) {
        const parsed = tryParseJson(candidate);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            if (isLikelyTestCaseObject(parsed)) {
                recoveredTestCases.push(parsed);
            } else if (Array.isArray((parsed as any).testCases)) {
                return parsed;
            }
        } else if (Array.isArray(parsed) && parsed.every(isLikelyTestCaseObject)) {
            return parsed;
        }
    }

    if (recoveredTestCases.length > 0) {
        return recoveredTestCases;
    }

    return null;
}

export class ResponseParser {
    parse(rawResponse: string): GenerationResult {
        const cleanResponse = removeCodeFence(rawResponse);
        let parsed: any = tryParseJson(cleanResponse);

        if (!parsed) {
            parsed = findBestJsonCandidate(cleanResponse);
        }

        if (!parsed) {
            throw new Error("Failed to parse AI response: unable to recover JSON payload");
        }

        const rawCases = Array.isArray(parsed)
            ? parsed
            : Array.isArray(parsed.testCases)
                ? parsed.testCases
                : [];

        if (!Array.isArray(rawCases) || rawCases.length === 0) {
            throw new Error("Invalid response format: missing testCases array");
        }

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
    }
}

export const responseParser = new ResponseParser();
