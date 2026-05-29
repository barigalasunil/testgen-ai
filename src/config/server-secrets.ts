export const SERVER_SECRETS = {
  jira: {
    baseUrl: process.env.JIRA_BASE_URL || 'https://yourcompany.atlassian.net',
    email: process.env.JIRA_EMAIL || 'your-email@company.com',
    apiToken: process.env.JIRA_API_TOKEN || 'your-jira-api-token',
    projectKey: process.env.JIRA_PROJECT_KEY || 'TCGB',
  },
  llm: {
    nvidiaBaseUrl: process.env.NVIDIA_OPENAI_BASE_URL || 'https://integrate.api.nvidia.com/v1',
    nvidiaApiKey: process.env.NVIDIA_OPENAI_API_KEY || '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',
    nvidiaModel: process.env.NVIDIA_OPENAI_MODEL || 'qwen/qwen3-coder-480b-a35b-instruct',
    openRouterApiKey: process.env.OPENROUTER_API_KEY || '',
    openRouterModel: process.env.OPENROUTER_MODEL || 'openrouter/auto',
  },
};

export const getServerJiraConfig = () => SERVER_SECRETS.jira;
export const getServerLLMConfig = () => SERVER_SECRETS.llm;
