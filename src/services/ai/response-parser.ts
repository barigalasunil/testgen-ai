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
            
            if (!parsed.testCases || !Array.isArray(parsed.testCases)) {
                throw new Error("Invalid response format: missing testCases array");
            }

            const validatedTestCases = parsed.testCases.map((tc: any, index: number) => {
                return {
                    testCaseId: tc.testCaseId || tc.unique_id || `TC-${String(index + 1).padStart(3, "0")}`,
                    title: tc.title || tc.name || "Untitled",
                    testType: tc.testType || tc.type || "Functional",
                    priority: tc.priority || tc.criticality_udf || "Medium",
                    preconditions: tc.preconditions || tc.prerequisites_udf || "None",
                    testData: tc.testData || tc.testdata_udf || "N/A",
                    steps: tc.steps || tc.step_description || "",
                    expectedResult: tc.expectedResult || tc.expected_result || "",
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
