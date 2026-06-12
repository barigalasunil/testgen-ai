import { promises as fs } from 'fs';
import path from 'path';
import { aiProviderOrchestrator, AiProviderId, ProviderSettings } from '@/src/services/ai/provider-orchestrator';
import { filterChatModels } from '@/src/services/ai/providers/ollama-utils';
import { scriptPromptBuilder } from './prompt-builder';
import { parseGeneratedScript } from '../utils/response-parser';
import { ScriptGenerationResult, ScriptPlatform } from '../types';
import { TestCase } from '@/src/modules/testcase-generator/types';

function resolveFileName(jiraStoryId?: string): string {
  if (jiraStoryId?.trim()) {
    const sanitized = jiraStoryId.trim().replace(/[^a-zA-Z0-9\-_]/g, '_');
    return `${sanitized}.spec.ts`;
  }
  console.warn('[SCRIPT-GEN] No jiraStoryId provided, using timestamp-based filename');
  return `TCGen-Buddy_${Date.now()}.spec.ts`;
}

function validateGeneratedCode(code: string): { valid: boolean; error?: string } {
  // Strip string literals, template literals, and comments to avoid false positives
  const stripped = code
    .replace(/\/\/.*$/gm, '')               // single-line comments
    .replace(/\/\*[\s\S]*?\*\//g, '')       // multi-line comments
    .replace(/'[^'\\]*(?:\\.[^'\\]*)*'/g, '')  // single-quoted strings
    .replace(/"[^"\\]*(?:\\.[^"\\]*)*"/g, '')  // double-quoted strings
    .replace(/`[^`\\]*(?:\\.[^`\\]*)*`/g, ''); // template literals

  // Track delimiter stack
  const pairs: Record<string, string> = { '{': '}', '(': ')', '[': ']' };
  const closeToOpen: Record<string, string> = { '}': '{', ')': '(', ']': '[' };
  const stack: string[] = [];

  for (const ch of stripped) {
    if (ch === '{' || ch === '(' || ch === '[') {
      stack.push(ch);
    } else if (ch === '}' || ch === ')' || ch === ']') {
      const expected = closeToOpen[ch];
      if (stack.length === 0 || stack.pop() !== expected) {
        return { valid: false, error: `Unbalanced delimiter: unexpected '${ch}'` };
      }
    }
  }

  if (stack.length > 0) {
    const unclosed = stack.map(o => pairs[o]).join('');
    return { valid: false, error: `Unclosed delimiter(s): expected ${unclosed}` };
  }

  return { valid: true };
}

async function resolveAvailableModel(): Promise<string> {
  try {
    const res = await fetch('http://127.0.0.1:11434/api/tags', {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return '';
    const data = await res.json() as { models: { name: string }[] };
    const allModels = data.models.map(m => m.name);
    const chatModels = filterChatModels(allModels);
    return chatModels[0] || '';
  } catch {
    return '';
  }
}

function fixBrokenCode(
  code: string,
  prompt: string,
  provider: AiProviderId,
  model: string | undefined,
  providerSettings?: ProviderSettings
): Promise<string> {
  return new Promise(async (resolve) => {
    const validation = validateGeneratedCode(code);
    if (validation.valid) {
      resolve(code);
      return;
    }
    console.warn('[SCRIPT-GEN] Syntax error detected:', validation.error);
    console.warn('[SCRIPT-GEN] Retrying with fix prompt...');
    const fixPrompt = `${prompt}\n\nThe previous generation had a syntax error: ${validation.error}.\nThe broken code was:\n\`\`\`typescript\n${code.slice(0, 500)}\`\`\`\nPlease regenerate the ENTIRE script ensuring all strings, quotes, braces, and parentheses are properly closed. Return ONLY valid TypeScript Playwright code.`;
    try {
      const retry = await aiProviderOrchestrator.generate(provider, {
        prompt: fixPrompt,
        model,
        settings: providerSettings,
        maxTokens: 8192,
        temperature: 0.2,
      });
      const fixed = parseGeneratedScript(retry.content);
      const retryValidation = validateGeneratedCode(fixed);
      if (retryValidation.valid) {
        console.log('[SCRIPT-GEN] Retry succeeded — syntax is valid');
        resolve(fixed);
        return;
      }
      console.warn('[SCRIPT-GEN] Retry also has syntax issues:', retryValidation.error);
    } catch {
      console.warn('[SCRIPT-GEN] Retry failed, using original code');
    }
    resolve(code);
  });
}

export class ScriptGeneratorService {
  async generateScript(
    testCases: TestCase[],
    platform: ScriptPlatform,
    jiraStoryId?: string,
    model?: string,
    provider: AiProviderId = 'auto',
    providerSettings?: ProviderSettings
  ): Promise<ScriptGenerationResult> {
    const prompt = scriptPromptBuilder.buildPrompt(testCases, platform);
    const targetModel = model && model !== 'auto'
      ? model
      : provider === 'ollama'
        ? await resolveAvailableModel() || undefined
        : undefined;

    const fileName = resolveFileName(jiraStoryId);

    let code: string;

    try {
      const response = await aiProviderOrchestrator.generate(provider, {
        model: targetModel,
        prompt,
        settings: providerSettings,
        maxTokens: 8192,
        temperature: 0.2,
      });
      code = await fixBrokenCode(parseGeneratedScript(response.content), prompt, provider, targetModel, providerSettings);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(`Script generation failed: ${reason}`);
    }

    return { fileName, code };
  }

  async saveGeneratedScript(fileName: string, code: string): Promise<string> {
    const targetDir = path.join(process.cwd(), 'automation', 'scripts', 'generated');
    await fs.mkdir(targetDir, { recursive: true });
    const filePath = path.join(targetDir, fileName);
    await fs.writeFile(filePath, code, 'utf-8');
    return filePath;
  }
}

export const scriptGeneratorService = new ScriptGeneratorService();
