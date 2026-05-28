import { buildSystemPromptForType } from '@/src/modules/testcase-generator/prompts';
import fs from 'fs';
import path from 'path';

export type TestType = 'functional' | 'negative' | 'boundary';
export type PlatformType = 'web' | 'mobile' | 'api' | 'automation';

const PLATFORM_CONTEXT: Record<string, string> = {
  web: 'Target platform: Web browser (Chrome). Focus on UI interactions, form inputs, navigation, and visual feedback.',
  mobile: 'Target platform: Mobile browser. Consider touch interactions, small screen layout, and mobile-specific behavior.',
  api: 'Target platform: REST API. Focus on request/response validation, status codes, headers, and payload structure.',
  automation: 'Target platform: Playwright automation. Generate automation-ready test cases with selector-aware steps, validations, assertions, navigation checkpoints, and execution expectations. Each step must be directly executable by Playwright.',
};

class PromptBuilder {
  buildPrompt(
    userPrompt: string,
    type: TestType = 'functional',
    platformType: PlatformType = 'web',
    customPrompt?: string,
    acceptanceCriteria?: string
  ): string {
    const systemSection = buildSystemPromptForType(type);
    const platformSection = PLATFORM_CONTEXT[platformType] || PLATFORM_CONTEXT.web;

    let fullPrompt = `${systemSection}\n\nPLATFORM: ${platformSection}`;

    if (acceptanceCriteria?.trim()) {
      fullPrompt += `\n\nACCEPTANCE CRITERIA TO COVER:\n${acceptanceCriteria.trim()}`;
    }

    if (customPrompt?.trim()) {
      fullPrompt += `\n\nADDITIONAL INSTRUCTIONS:\n${customPrompt.trim()}`;
    }

    fullPrompt += `\n\nFEATURE / REQUIREMENT TO TEST:\n${userPrompt}`;

    return fullPrompt;
  }

  buildAutomationPrompt(
    userPrompt: string,
    customPrompt?: string,
    acceptanceCriteria?: string
  ): string {
    const systemSection = buildSystemPromptForType('functional');

    let workflowMaster = '';
    try {
      const workflowPath = path.join(process.cwd(), 'automation', 'agents', 'workflow-master.md');
      workflowMaster = fs.readFileSync(workflowPath, 'utf-8');
    } catch {
      workflowMaster = '# QA Workflow Master\n\nAutomation-focused test generation mode.';
    }

    let fullPrompt = `${systemSection}

AUTOMATION WORKFLOW ORCHESTRATION:
${workflowMaster}

AUTOMATION MODE INSTRUCTIONS:
You are operating in AUTOMATION MODE. Generate test cases that are:
- Directly executable by Playwright
- Include selector-aware actions (use data-test attributes, IDs, or roles)
- Include explicit validations and assertions (toBeVisible, toHaveText, toHaveURL)
- Include navigation checkpoints (waitForLoadState, waitForURL)
- Include execution expectations (expected network requests, element states)
- Ready for Page Object Model implementation
- Include automation-friendly test data

TEST CASE STRUCTURE FOR AUTOMATION:
Each test case MUST include:
- scenarioTitle: Clear description of the automation scenario
- testType: One of E2E, Negative, Edge, Security, Boundary, Resilience, Persona
- priority: P1, P2, or P3
- preconditions: What must be true before execution (specific states)
- testData: Exact values to use in automation
- testSteps: Numbered, selector-aware steps like:
  1. Navigate to {URL}
  2. Click selector={button[data-test="login-button"]}
  3. Fill selector={input[data-test="username"]} with value="{username}"
  4. Wait for selector={.inventory-list} to be visible
  5. Assert that selector={.title} has text "Products"
- expectedResult: Specific, measurable, automation-verifiable outcome`;

    if (acceptanceCriteria?.trim()) {
      fullPrompt += `\n\nACCEPTANCE CRITERIA TO COVER:\n${acceptanceCriteria.trim()}`;
    }

    if (customPrompt?.trim()) {
      fullPrompt += `\n\nADDITIONAL INSTRUCTIONS:\n${customPrompt.trim()}`;
    }

    fullPrompt += `\n\nFEATURE / REQUIREMENT TO TEST:\n${userPrompt}`;

    return fullPrompt;
  }
}

export const promptBuilder = new PromptBuilder();