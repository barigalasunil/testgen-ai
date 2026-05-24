import { buildSystemPromptForType } from '@/src/modules/testcase-generator/prompts';

export type TestType = 'functional' | 'negative' | 'boundary';
export type PlatformType = 'web' | 'mobile' | 'api';

const PLATFORM_CONTEXT: Record<PlatformType, string> = {
  web: 'Target platform: Web browser (Chrome). Focus on UI interactions, form inputs, navigation, and visual feedback.',
  mobile: 'Target platform: Mobile browser. Consider touch interactions, small screen layout, and mobile-specific behavior.',
  api: 'Target platform: REST API. Focus on request/response validation, status codes, headers, and payload structure.',
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
    const platformSection = PLATFORM_CONTEXT[platformType];

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
}

export const promptBuilder = new PromptBuilder();