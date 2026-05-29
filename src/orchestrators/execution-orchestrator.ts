import { AutomationRequest } from './automation-orchestrator';

export function buildAutomationPayload(request: AutomationRequest) {
    return {
        type: 'generated',
        scriptFile: request.testCases && request.testCases.length > 0 ? `generated-${Date.now()}.spec.ts` : 'generated.spec.ts',
        jiraStoryId: request.jiraStoryId,
        headed: request.headed,
    };
}

export function parseExecutionMessage(line: string) {
    if (!line) return null;
    try {
        if (line.startsWith('__RESULT__:')) {
            return JSON.parse(line.slice('__RESULT__:'.length));
        }
    } catch {
        return null;
    }
    return null;
}
