import { BaseWorker, Job } from './types';

/**
 * Worker to handle Jira ingestion in the background.
 */
export class JiraIngestionWorker extends BaseWorker {
    async process(job: Job<{ jiraStoryId: string, projectKey: string }>) {
        console.log(`[JiraIngestionWorker] Processing job ${job.id} for story ${job.payload.jiraStoryId}`);
        // Logic to pull from Jira and store in RAG
    }
}

/**
 * Worker to handle automation execution in the background.
 */
export class AutomationWorker extends BaseWorker {
    async process(job: Job<{ testSuite: string, projectKey: string }>) {
        console.log(`[AutomationWorker] Processing automation for ${job.payload.testSuite}`);
        // Logic to trigger Playwright/RestAssured
    }
}
