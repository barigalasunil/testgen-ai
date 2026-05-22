import { promises as fs } from 'fs';
import path from 'path';
import { ollamaService } from '@/src/services/ai/ollama.service';
import { scriptPromptBuilder } from './prompt-builder';
import { parseGeneratedScript } from '../utils/response-parser';
import { ScriptGenerationResult, ScriptPlatform } from '../types';
import { TestCase } from '@/src/modules/testcase-generator/types';

function resolveFileName(testCases: TestCase[], platform: ScriptPlatform): string {
  const titles = testCases.map((tc) => tc.title.toLowerCase()).join(' ');
  if (titles.includes('login')) return 'login.spec.ts';
  if (titles.includes('checkout') || titles.includes('order')) return 'checkout.spec.ts';
  if (titles.includes('cart')) return 'cart.spec.ts';
  return 'generated.spec.ts';
}

export class ScriptGeneratorService {
  async generateScript(testCases: TestCase[], platform: ScriptPlatform): Promise<ScriptGenerationResult> {
    const prompt = scriptPromptBuilder.buildPrompt(testCases, platform);
    const response = await ollamaService.generate({
      model: 'phi3:mini',
      prompt,
      format: 'json',
      stream: false,
    });

    const code = parseGeneratedScript(response.response);
    const fileName = resolveFileName(testCases, platform);

    return { fileName, code };
  }

  async saveGeneratedScript(fileName: string, code: string): Promise<string> {
    const targetDir = path.join(process.cwd(), 'automation', 'generated');
    await fs.mkdir(targetDir, { recursive: true });
    const filePath = path.join(targetDir, fileName);
    await fs.writeFile(filePath, code, 'utf-8');
    return filePath;
  }
}

export const scriptGeneratorService = new ScriptGeneratorService();
