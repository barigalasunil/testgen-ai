import { test, expect } from '@playwright/test';

test('headless sidebar and app load check', async ({ page }) => {
  const logs: string[] = [];
  page.on('console', (msg) => {
    logs.push(`console.${msg.type()}: ${msg.text()}`);
  });
  page.on('pageerror', (error) => {
    logs.push(`pageerror: ${error.message}`);
  });
  page.on('requestfailed', (request) => {
    logs.push(`requestfailed: ${request.url()} ${request.failure()?.errorText}`);
  });

  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });

  const title = await page.title();
  console.log('Page title:', title);

  const sidebar = page.locator('text=Chat Workspace');
  await expect(sidebar).toBeVisible({ timeout: 10000 });

  // Try clicking the sidebar navigation items to ensure panel state has effect
  const automationNav = page.getByRole('button', { name: 'Automation Workspace' }).first();
  await expect(automationNav).toBeVisible();
  await automationNav.click();

  const automationPanel = page.getByRole('button', { name: 'Headless' }).first();
  await expect(automationPanel).toBeVisible({ timeout: 10000 });

  const jiraNav = page.getByRole('button', { name: 'Jira Settings' }).first();
  await jiraNav.click();
  const jiraPanel = page.getByText('Jira Integration', { exact: true });
  await expect(jiraPanel).toBeVisible({ timeout: 10000 });

  console.log('Browser logs:');
  logs.forEach((line) => console.log(line));
});
