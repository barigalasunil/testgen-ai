export type JiraCredentials = {
  baseUrl: string;
  email: string;
  apiToken: string;
  projectKey: string;
};

const STORAGE_KEY = 'jira-credentials';

export function saveJiraCredentials(creds: JiraCredentials): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(creds));
}

export function loadJiraCredentials(): JiraCredentials | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as JiraCredentials;
  } catch {
    return null;
  }
}

export function clearJiraCredentials(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export async function testConnection(creds: JiraCredentials) {
  const params = new URLSearchParams({
    baseUrl: creds.baseUrl,
    email: creds.email,
    apiToken: creds.apiToken,
  });
  const res = await fetch(`/api/jira/test-connection?${params.toString()}`);
  return res.json();
}

export async function createIssue(payload: {
  summary: string;
  description: string;
  issueType: string;
  priority: string;
  labels?: string[];
  storyId?: string;
}) {
  // Always attach saved credentials so server can use them
  const credentials = loadJiraCredentials();
  const res = await fetch('/api/jira/create-issue', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, credentials }),
  });
  return res.json();
}

export async function generateDefect(payload: {
  testCaseTitle: string;
  testCaseSteps: string;
  expectedResult: string;
  actualResult: string;
  model?: string;
}) {
  const res = await fetch('/api/jira/generate-defect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json();
}