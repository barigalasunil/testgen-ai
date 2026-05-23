import { TestCase } from "@/src/modules/testcase-generator/types";

export type ScriptPlatform = "web" | "api" | "mobile";

export interface ScriptGenerationRequest {
  testCases: TestCase[];
  platform: ScriptPlatform;
  jiraStoryId?: string;
}

export interface ScriptGenerationResult {
  fileName: string;
  code: string;
}
