import fs from 'fs';
import path from 'path';
import { ScriptPlatform } from '../types';
import { TestCase } from '@/src/modules/testcase-generator/types';

export class ScriptPromptBuilder {
  private promptsDir: string;

  constructor() {
    this.promptsDir = path.join(process.cwd(), 'src', 'prompts', 'automation');
  }

  private loadTemplate(filename: string): string {
    const filePath = path.join(this.promptsDir, filename);
    try {
      return fs.readFileSync(filePath, 'utf-8');
    } catch (error) {
      console.error(`Failed to load automation prompt: ${filename}`, error);
      return '';
    }
  }

  buildPrompt(testCases: TestCase[], platform: ScriptPlatform): string {
    const system = this.loadTemplate('playwright-system.txt');
    const platformPrompt = this.loadTemplate(
      platform === 'api' ? 'playwright-api.txt' : 'playwright-web.txt'
    );

    const testCasesJson = JSON.stringify(
      testCases.map((tc) => ({
        title: tc.scenarioTitle,
        steps: tc.testSteps,
        expectedResult: tc.expectedResult,
      }))
    );

    return `${system}\n\n${platformPrompt}\n\nTest cases:\n${testCasesJson}`;
  }
}

export const scriptPromptBuilder = new ScriptPromptBuilder();
