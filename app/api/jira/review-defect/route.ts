import { NextResponse } from "next/server";
import { aiProviderOrchestrator, AiProviderId, ProviderSettings } from "@/src/services/ai/provider-orchestrator";

const allowedPriorities = ["Lowest", "Low", "Medium", "High", "Highest"];
const allowedSeverities = ["Low", "Medium", "High", "Critical", "Blocker"];

type ReviewDefectRequest = {
    quickDescription?: string;
    summary?: string;
    description?: string;
    actualResult?: string;
    expectedResult?: string;
    issueType?: "Bug" | "Defect";
    priority?: string;
    severity?: string;
    storyId?: string;
    model?: string;
    provider?: AiProviderId;
    providerSettings?: ProviderSettings;
};

function parseJson(content: string) {
    const cleaned = content.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
    return JSON.parse(cleaned);
}

function normalizeChoice(value: unknown, allowed: string[]) {
    const text = String(value || "").trim();
    return allowed.includes(text) ? text : "";
}

export async function POST(request: Request) {
    try {
        const body = await request.json() as ReviewDefectRequest;
        const quickDescription = body.quickDescription?.trim() || "";
        const summary = body.summary?.trim() || "";
        const description = body.description?.trim() || "";

        if (!quickDescription && !summary) {
            return NextResponse.json({ success: false, error: "Summary is required" }, { status: 400 });
        }
        if (!quickDescription && !description) {
            return NextResponse.json({ success: false, error: "Description is required" }, { status: 400 });
        }

        const prompt = `You are a senior QA engineer ${quickDescription ? "drafting" : "reviewing"} a Jira Bug defect.
Return ONLY valid JSON. Do not include markdown or explanation.

Rules:
- Generate or rewrite the summary professionally.
- Generate or rewrite the combined description and steps to reproduce clearly.
- Structure steps to reproduce inside the description only if provided or directly implied by the user's text.
- Identify actual result and expected result only from provided text.
- Suggest priority and severity based only on the provided text.
- Recommend issueType as either "Bug" or "Defect".
- Improve grammar and clarity.
- Keep the issue factual.
- Do not fabricate logs.
- Do not invent root cause.
- Do not invent screenshots.
- Do not invent error codes.
- If information is missing, use an empty string or "Not Provided".

Priority must be one of: Lowest, Low, Medium, High, Highest.
Severity must be one of: Low, Medium, High, Critical, Blocker.
Issue Type must be one of: Bug, Defect.

${quickDescription
    ? `Plain English defect description:
${quickDescription}`
    : `Input defect:
Summary: ${summary}
Description & Steps to Reproduce: ${description}
Actual Result: ${body.actualResult || "Not Provided"}
Expected Result: ${body.expectedResult || "Not Provided"}
Issue Type: ${body.issueType || "Bug"}
Priority: ${body.priority || "Not Provided"}
Severity: ${body.severity || "Not Provided"}`}
Linked Requirement: ${body.storyId || "Not Provided"}

Return this exact JSON shape:
{
  "summary": "",
  "description": "",
  "actualResult": "",
  "expectedResult": "",
  "issueType": "Bug",
  "priority": "",
  "severity": ""
}`;

        const aiResult = await aiProviderOrchestrator.generate(body.provider || "auto", {
            prompt,
            model: body.model || "auto",
            settings: body.providerSettings,
            responseFormat: "json",
            maxTokens: 1600,
            temperature: 0.2,
        });

        let parsed: Record<string, unknown>;
        try {
            parsed = parseJson(aiResult.content);
        } catch {
            return NextResponse.json({ success: false, error: "AI review failed: provider returned invalid JSON." }, { status: 422 });
        }

        return NextResponse.json({
            success: true,
            defect: {
                summary: String(parsed.summary || summary || "Not Provided"),
                description: String(parsed.description || description || quickDescription || "Not Provided"),
                actualResult: String(parsed.actualResult || "Not Provided"),
                expectedResult: String(parsed.expectedResult || "Not Provided"),
                issueType: parsed.issueType === "Defect" ? "Defect" : "Bug",
                priority: normalizeChoice(parsed.priority, allowedPriorities),
                severity: normalizeChoice(parsed.severity, allowedSeverities),
            },
            meta: {
                providerUsed: aiResult.providerUsed,
                modelUsed: aiResult.modelUsed,
                fallbackUsed: aiResult.fallbackUsed,
                attempts: aiResult.attempts,
            },
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return NextResponse.json({ success: false, error: `AI review failed: ${message}` }, { status: 500 });
    }
}
