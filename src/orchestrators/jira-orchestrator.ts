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
    const urlMatch = trimmed.match(/\/browse\/([A-Z][A-Z0-9]+-\d+)/i);
    if (urlMatch) return urlMatch[1].toUpperCase();

    const queryMatch = trimmed.match(/(?:[?&](?:selectedIssue|issue|key)=)([A-Z][A-Z0-9]+-\d+)/i);
    if (queryMatch) return queryMatch[1].toUpperCase();

    const idMatch = trimmed.match(/\b([A-Z][A-Z0-9]+-\d+)\b/);
    if (idMatch) return idMatch[1].toUpperCase();
    return null;
}

export function deriveProjectKey(storyId: string, fallback: string = 'TCGB'): string {
    return storyId.split('-')[0] || fallback;
}
