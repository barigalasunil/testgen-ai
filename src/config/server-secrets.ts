export const SERVER_SECRETS = {
  jira: {
    baseUrl: process.env.JIRA_BASE_URL || 'https://yourcompany.atlassian.net',
    email: process.env.JIRA_EMAIL || 'your-email@company.com',
    apiToken: process.env.JIRA_API_TOKEN || 'your-jira-api-token',
    projectKey: process.env.JIRA_PROJECT_KEY || 'TCGB',
  },
  llm: {
    nvidiaBaseUrl: process.env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1',
    nvidiaApiKey: process.env.NVIDIA_API_KEY || '',
    nvidiaModel: process.env.NVIDIA_MODEL || '',
    openRouterApiKey: process.env.OPENROUTER_API_KEY || '',
    openRouterModel: process.env.OPENROUTER_MODEL || 'openrouter/auto',
    groqApiKey: process.env.GROQ_API_KEY || '',
    groqModel: process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
    opencodeApiKey: process.env.OPENCODE_API_KEY || '',
    opencodeModel: process.env.OPENCODE_MODEL || '',
    ollamaBaseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
    ollamaModel: process.env.OLLAMA_MODEL || '',
  },
};

export const getServerJiraConfig = () => SERVER_SECRETS.jira;
export const getServerLLMConfig = () => SERVER_SECRETS.llm;
