import { NextResponse } from 'next/server';
import { scriptGeneratorService } from '@/src/modules/script-generator/services/script-generator.service';
import { TestCase } from '@/src/modules/testcase-generator/types';

interface ApiRequestBody {
  testCases: TestCase[];
  platform?: 'web' | 'api' | 'mobile';
  jiraStoryId?: string;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ApiRequestBody;
    const testCases = body.testCases ?? [];
    const platform = body.platform ?? 'web';
    const jiraStoryId = body.jiraStoryId;

    if (!Array.isArray(testCases) || testCases.length === 0) {
      return NextResponse.json({ error: true, message: 'No test cases provided.' }, { status: 400 });
    }

    const { fileName, code } = await scriptGeneratorService.generateScript(testCases, platform, jiraStoryId);
    const savedPath = await scriptGeneratorService.saveGeneratedScript(fileName, code);

    return NextResponse.json({ error: false, fileName, code, savedPath });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate script';
    return NextResponse.json({ error: true, message }, { status: 500 });
  }
}
