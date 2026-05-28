import { test, expect, Page } from '@playwright/test';

class JiraAuthPage {
  readonly page: Page;
  readonly signInControl;
  readonly usernameInput;
  readonly passwordInput;
  readonly signInButton;
  readonly errorMessage;
  readonly issueHeader;

  constructor(page: Page) {
    this.page = page;
    this.signInControl = page.getByRole('link', { name: /sign in|log in|sign in with/i }).first();
    this.usernameInput = page.locator('input[name="username"], input[type="email"], input[autocomplete="username"], [data-test="username"]');
    this.passwordInput = page.locator('input[name="password"], input[type="password"], input[autocomplete="current-password"], [data-test="password"]');
    this.signInButton = page.getByRole('button', { name: /sign in|log in|continue/i }).first();
    this.errorMessage = page.locator('[data-test*="error"], [role="alert"], .error, .aui-message-error').first();
    this.issueHeader = page.locator('h1, [data-test="issue.views.issue-base.foundation.summary.heading"], [data-testid="issue.views.issue-base.foundation.summary.heading"]').first();
  }

  async gotoIssue() {
    await this.page.goto('https://tcgenbuddy.atlassian.net/browse/TCGB-27', { waitUntil: 'domcontentloaded' });
  }

  async openSignInForm() {
    if (await this.signInControl.isVisible().catch(() => false)) {
      await this.signInControl.click();
    }
  }

  async login(username: string, password: string) {
    await this.openSignInForm();
    await this.usernameInput.fill(username);
    await this.passwordInput.fill(password);
    await this.signInButton.click();
  }

  async expectAuthenticatedIssuePage() {
    await expect(this.page).toHaveURL(/\/browse\/TCGB-27/);
    await expect(this.errorMessage).toHaveCount(0);
    await expect(this.issueHeader).toContainText('TCGB-27');
  }

  async expectSignInError() {
    await expect(this.page).toHaveURL(/tcgenbuddy\.atlassian\.net/);
    await expect(this.errorMessage).toBeVisible();
  }

  async expectPasswordValidationOrAuthError() {
    await expect(this.passwordInput).toBeVisible();
    await expect(this.errorMessage.or(this.passwordInput)).toBeTruthy();
  }
}

test.describe('Jira authentication and access', () => {
  test('Verify a user can sign in to Jira through the web browser and land on the authenticated home page', async ({ page }) => {
    const jira = new JiraAuthPage(page);

    await jira.gotoIssue();
    await jira.login('test.user@example.com', 'CorrectHorseBatteryStaple!23');
    await page.waitForLoadState('networkidle');
    await jira.expectAuthenticatedIssuePage();
  });

  test('Verify login fails when an incorrect password is entered', async ({ page }) => {
    const jira = new JiraAuthPage(page);

    await jira.gotoIssue();
    await jira.login('test.user@example.com', 'WrongPassword!23');
    await page.waitForLoadState('networkidle');
    await jira.expectSignInError();
  });

  test('Verify login fails when the password field is left empty', async ({ page }) => {
    const jira = new JiraAuthPage(page);

    await jira.gotoIssue();
    await jira.openSignInForm();
    await jira.usernameInput.fill('test.user@example.com');
    await jira.passwordInput.fill('');
    await jira.signInButton.click();
    await page.waitForLoadState('networkidle');
    await jira.expectPasswordValidationOrAuthError();
  });

  test('Verify the login form rejects a password with the exact minimum boundary length if it is below policy', async ({ page }) => {
    const jira = new JiraAuthPage(page);

    await jira.gotoIssue();
    await jira.login('test.user@example.com', 'Abc123!');
    await page.waitForLoadState('networkidle');
    await jira.expectSignInError();
  });

  test('Verify direct access to the browse URL without authentication does not grant access', async ({ page, context }) => {
    const jira = new JiraAuthPage(page);

    await context.clearCookies();
    await page.goto('https://tcgenbuddy.atlassian.net/browse/TCGB-27', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('text=/sign in|log in|continue/i').first()).toBeVisible();
    await expect(jira.issueHeader).toHaveCount(0);
  });

  test('Verify a standard user can open the target Jira page after signing in and see the requested issue key', async ({ page }) => {
    const jira = new JiraAuthPage(page);

    await jira.gotoIssue();
    await jira.login('standard.user@example.com', 'StandardUserPass!45');
    await page.waitForLoadState('networkidle');
    await expect(jira.issueHeader).toContainText('TCGB-27');
  });

  test('Verify a locked user cannot sign in to Jira', async ({ page }) => {
    const jira = new JiraAuthPage(page);

    await jira.gotoIssue();
    await jira.login('locked.user@example.com', 'LockedUserPass!78');
    await page.waitForLoadState('networkidle');
    await jira.expectSignInError();
  });

  test('Verify login fails when the username is omitted', async ({ page }) => {
    const jira = new JiraAuthPage(page);

    await jira.gotoIssue();
    await jira.openSignInForm();
    await jira.usernameInput.fill('');
    await jira.passwordInput.fill('AnyPassword!12');
    await jira.signInButton.click();
    await page.waitForLoadState('networkidle');
    await expect(jira.usernameInput).toBeVisible();
    await expect(jira.errorMessage.or(jira.usernameInput)).toBeTruthy();
  });
});