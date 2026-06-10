import { extractJiraId, deriveProjectKey } from './jira-orchestrator';
import { fetchJiraStory } from '@/src/services/jira/jira.service';

export interface ResolvedJiraContext {
    jiraStoryId: string | null;
    projectKey: string;
    prompt: string;
    story?: {
        summary: string;
        description: string;
        acceptanceCriteria: string;
        issueType: string;
        priority: string;
        status: string;
        issueUrl: string;
    };
}

export async function resolveTestCasePrompt(prompt: string): Promise<ResolvedJiraContext> {
    const jiraStoryId = extractJiraId(prompt);
    if (!jiraStoryId) {
        return {
            jiraStoryId: null,
            projectKey: 'TCGB',
            prompt,
        };
    }

    let jiraResult;
    try {
        jiraResult = await fetchJiraStory(jiraStoryId);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`[JIRA] Story lookup skipped for ${jiraStoryId}: ${message}`);
        return {
            jiraStoryId,
            projectKey: deriveProjectKey(jiraStoryId),
            prompt,
        };
    }
    if (!jiraResult?.success) {
        return {
            jiraStoryId,
            projectKey: deriveProjectKey(jiraStoryId),
            prompt,
        };
    }

    const story = {
        summary: jiraResult.summary || '',
        description: jiraResult.description || '',
        acceptanceCriteria: jiraResult.acceptanceCriteria || '',
        issueType: jiraResult.issueType || 'Story',
        priority: jiraResult.priority || 'Medium',
        status: jiraResult.status || '',
        issueUrl: jiraResult.issueUrl || '',
    };

    const storyPrompt = [`Jira Story: ${jiraStoryId}`];

    if (story.summary) storyPrompt.push(`Summary:\n${story.summary}`);
    if (story.description) storyPrompt.push(`Description:\n${story.description}`);
    if (story.acceptanceCriteria) storyPrompt.push(`Acceptance Criteria:\n${story.acceptanceCriteria}`);
    storyPrompt.push(`Project: ${deriveProjectKey(jiraStoryId)}`);
    storyPrompt.push(`Use this requirement to generate test cases. Do not use the Jira URL text itself.`);

    return {
        jiraStoryId,
        projectKey: deriveProjectKey(jiraStoryId),
        prompt: `${storyPrompt.join('\n\n')}\n\nOriginal request: ${prompt.replace(new RegExp(jiraStoryId, 'gi'), jiraStoryId)}`,
        story,
    };
}
