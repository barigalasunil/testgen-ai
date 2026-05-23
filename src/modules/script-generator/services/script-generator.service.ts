import { promises as fs } from 'fs';
import path from 'path';
import { ollamaService } from '@/src/services/ai/ollama.service';
import { scriptPromptBuilder } from './prompt-builder';
import { parseGeneratedScript } from '../utils/response-parser';
import { ScriptGenerationResult, ScriptPlatform } from '../types';
import { TestCase } from '@/src/modules/testcase-generator/types';
import { buildArtifactFilename } from '@/src/services/export/artifact-filename';

function resolveFileName(jiraStoryId?: string): string {
  return buildArtifactFilename(jiraStoryId, 'Playwright', 'ts');
}

export class ScriptGeneratorService {
  async generateScript(testCases: TestCase[], platform: ScriptPlatform, jiraStoryId?: string): Promise<ScriptGenerationResult> {
    const prompt = scriptPromptBuilder.buildPrompt(testCases, platform);
    const response = await ollamaService.generate({
      model: 'phi3:mini',
      prompt,
      format: 'json',
      stream: false,
    });

    const code = parseGeneratedScript(response.response);
    const fileName = resolveFileName(jiraStoryId);

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
