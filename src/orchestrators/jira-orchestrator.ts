export interface JiraStoryContext {
    storyId: string;
    summary: string;
    description: string;
    acceptanceCriteria: string;
    projectKey: string;
    issueType: string;
    priority: string;
    status: string;
    issueUrl: string;
}

export function extractJiraId(input: string): string | null {
    const trimmed = input.trim();
    const urlMatch = trimmed.match(/\/browse\/([A-Z]+-\d+)/i);
    if (urlMatch) return urlMatch[1];
    const idMatch = trimmed.match(/\b([A-Z]+-\d+)\b/i);
    if (idMatch) return idMatch[0];
    return null;
}

export function deriveProjectKey(storyId: string, fallback: string = 'TCGB'): string {
    return storyId.split('-')[0] || fallback;
}
