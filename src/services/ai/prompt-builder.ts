import fs from "fs";
import path from "path";

export type TestType = "functional" | "negative" | "boundary";
export type PlatformType = "web" | "mobile" | "api";

export class PromptBuilder {
    private promptsDir: string;

    constructor() {
        this.promptsDir = path.join(process.cwd(), "src", "prompts");
    }

    private loadTemplate(filename: string): string {
        const filePath = path.join(this.promptsDir, filename);
        try {
            return fs.readFileSync(filePath, "utf-8");
        } catch (error) {
            console.error(`Failed to load template: ${filename}`, error);
            return ""; // Return empty if optional template fails
        }
    }

    buildPrompt(
        userPrompt: string, 
        type: TestType = "functional", 
        platform: PlatformType = "web",
        customPrompt?: string,
        acceptanceCriteria?: string
    ): string {
        const system = this.loadTemplate("system.txt");
        const coverage = this.loadTemplate("coverage-rules.txt");
        const platformPrompt = this.loadTemplate(`platforms/${platform}.txt`);
        const testTypePrompt = this.loadTemplate(`test-types/${type}.txt`);
        const outputFormat = this.loadTemplate("output-format.txt");

        let combinedPrompt = `${system}\n\n${coverage}\n\n${platformPrompt}\n\n${testTypePrompt}\n\n${outputFormat}`;

        if (customPrompt) {
            combinedPrompt += `\n\nAdditional Custom Instructions:\n${customPrompt}`;
        }

        combinedPrompt += `\n\nUser Story / Request:\n${userPrompt}`;

        if (acceptanceCriteria) {
            combinedPrompt += `\n\nAcceptance Criteria:\n${acceptanceCriteria}`;
        }

        return combinedPrompt;
    }
}

export const promptBuilder = new PromptBuilder();
