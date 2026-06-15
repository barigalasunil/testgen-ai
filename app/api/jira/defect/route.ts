import { NextResponse } from "next/server";

type JiraCredentials = {
    baseUrl?: string;
    email?: string;
    apiToken?: string;
    projectKey?: string;
};

type DefectRequest = {
    summary?: string;
    description?: string;
    actualResult?: string;
    expectedResult?: string;
    issueType?: "Bug" | "Defect";
    priority?: string;
    severity?: string;
    storyId?: string;
    credentials?: JiraCredentials;
};

type JiraCreateResult = {
    issueKey: string;
    issueUrl: string;
    issueType: "Bug" | "Defect";
    warning?: string;
};

type JiraConfig = {
    baseUrl: string;
    email: string;
    apiToken: string;
    projectKey: string;
    source: "env" | "settings";
};

type AdfNode = {
    type: string;
    version?: number;
    attrs?: Record<string, unknown>;
    content?: AdfNode[];
    text?: string;
    marks?: { type: string }[];
};

// ── Extract exact Jira error message ──────────────────────────────────────
function extractJiraError(responseText: string, status: number): string {
    try {
        const errorJson = JSON.parse(responseText);
        const messages = Array.isArray(errorJson.errorMessages) ? errorJson.errorMessages : [];
        const errors = Object.entries(errorJson.errors || {}).map(([field, value]) => `${field}: ${String(value)}`);
        const combined = [...messages, ...errors].filter(Boolean).join(', ');
        if (combined) return `Jira API error (${status}): ${combined}`;
    } catch {}
    return `Jira API error (HTTP ${status}): ${responseText.slice(0, 500)}`;
}

function paragraph(text: string): AdfNode {
    return {
        type: "paragraph",
        content: text ? [{ type: "text", text }] : [],
    };
}

function heading(text: string): AdfNode {
    return {
        type: "heading",
        attrs: { level: 3 },
        content: [{ type: "text", text }],
    };
}

function textToNodes(text: string): AdfNode[] {
    const blocks = text
        .split(/\r?\n\r?\n/)
        .map(block => block.trim())
        .filter(Boolean);

    return blocks.length
        ? blocks.map(block => paragraph(block.replace(/\r?\n/g, "\n")))
        : [paragraph(text.trim())];
}

function addSection(content: AdfNode[], title: string, body?: string) {
    const value = body?.trim();
    if (!value) return;
    content.push(heading(title), ...textToNodes(value));
}

function buildDescription(payload: DefectRequest): string {
    const sections: string[] = [
        `Summary:\n${payload.summary?.trim() || ""}`,
        `Description & Steps to Reproduce:\n${payload.description?.trim() || ""}`,
    ];

    if (payload.actualResult?.trim()) sections.push(`Actual Result:\n${payload.actualResult.trim()}`);
    if (payload.expectedResult?.trim()) sections.push(`Expected Result:\n${payload.expectedResult.trim()}`);
    if (payload.priority?.trim()) sections.push(`Priority:\n${payload.priority.trim()}`);
    if (payload.severity?.trim()) sections.push(`Severity:\n${payload.severity.trim()}`);
    if (payload.issueType?.trim()) sections.push(`Issue Type:\n${payload.issueType.trim()}`);
    if (payload.storyId?.trim()) sections.push(`Linked Requirement:\n${payload.storyId.trim()}`);

    return sections.join("\n\n");
}

function toADF(payload: DefectRequest): AdfNode {
    const content: AdfNode[] = [];
    addSection(content, "Summary", payload.summary);
    addSection(content, "Description & Steps to Reproduce", payload.description);
    addSection(content, "Actual Result", payload.actualResult);
    addSection(content, "Expected Result", payload.expectedResult);
    addSection(content, "Priority", payload.priority);
    addSection(content, "Severity", payload.severity);
    addSection(content, "Issue Type", payload.issueType);
    addSection(content, "Linked Requirement", payload.storyId);

    return {
        type: "doc",
        version: 1,
        content: content.length ? content : [paragraph(buildDescription(payload))],
    };
}

function cleanBaseUrl(url: string) {
    return (url.startsWith("http") ? url : `https://${url}`).replace(/\/$/, "");
}

function normalizeProjectKey(projectKey: string) {
    return projectKey.trim().toUpperCase();
}

function validateProjectKey(projectKey: string) {
    return /^[A-Z][A-Z0-9_]*$/.test(projectKey);
}

function getJiraConfig(credentials: JiraCredentials): JiraConfig | { error: string } {
    const envHasJiraConfig = Boolean(
        process.env.JIRA_BASE_URL?.trim()
        || process.env.JIRA_EMAIL?.trim()
        || process.env.JIRA_API_TOKEN?.trim()
        || process.env.JIRA_PROJECT_KEY?.trim()
    );

    const baseUrl = (process.env.JIRA_BASE_URL || credentials.baseUrl || "").trim();
    const email = (process.env.JIRA_EMAIL || credentials.email || "").trim();
    const apiToken = (process.env.JIRA_API_TOKEN || credentials.apiToken || "").trim();
    const projectKeyRaw = (process.env.JIRA_PROJECT_KEY || credentials.projectKey || "").trim();

    if (!baseUrl || !email || !apiToken) {
        return { error: "Jira settings missing. Open Settings and save Jira Base URL, Email, and API Token, or configure them in .env.local." };
    }
    if (!projectKeyRaw) {
        return { error: "Jira project key missing. Open Settings and save Jira Project Key, or configure JIRA_PROJECT_KEY in .env.local." };
    }

    const projectKey = normalizeProjectKey(projectKeyRaw);
    if (!validateProjectKey(projectKey)) {
        return { error: "Jira project key is invalid. Use the project key shown in Jira, for example TCGB." };
    }

    return {
        baseUrl,
        email,
        apiToken,
        projectKey,
        source: envHasJiraConfig ? "env" : "settings",
    };
}

async function runPreflight({
    normalizedUrl,
    auth,
    projectKey,
    requestedIssueType,
}: {
    normalizedUrl: string;
    auth: string;
    projectKey: string;
    requestedIssueType: "Bug" | "Defect";
}): Promise<{ issueType: "Bug" | "Defect"; warning?: string } | { error: string; status: number }> {
    // ── Step 1: Validate project exists ──────────────────────────────
    const projectRes = await fetch(`${normalizedUrl}/rest/api/3/project/${encodeURIComponent(projectKey)}`, {
        headers: { Authorization: `Basic ${auth}`, Accept: "application/json" },
    });
    const projectText = await projectRes.text();
    if (!projectRes.ok) {
        return { error: `Project validation failed: ${extractJiraError(projectText, projectRes.status)}`, status: projectRes.status };
    }

    // ── Step 2: Verify issue type exists ─────────────────────────────
    const issuetypeRes = await fetch(`${normalizedUrl}/rest/api/3/issuetype`, {
        headers: { Authorization: `Basic ${auth}`, Accept: "application/json" },
    });
    const issuetypeText = await issuetypeRes.text();
    if (!issuetypeRes.ok) {
        return { error: `Issue type lookup failed: ${extractJiraError(issuetypeText, issuetypeRes.status)}`, status: issuetypeRes.status };
    }

    let issuetypeData: { name?: string }[];
    try { issuetypeData = JSON.parse(issuetypeText); } catch {
        return { error: "Issue type endpoint returned an invalid response.", status: 502 };
    }

    const typeExists = issuetypeData.some(t => t.name?.toLowerCase() === requestedIssueType.toLowerCase());
    if (!typeExists) {
        const available = issuetypeData.map(t => t.name || '?').join(', ');
        return {
            error: `Issue type "${requestedIssueType}" does not exist in this Jira instance. Available types: ${available}`,
            status: 400,
        };
    }

    // ── Step 3: Verify create permission via createmeta ──────────────
    const createmetaUrl = `${normalizedUrl}/rest/api/3/issue/createmeta?projectKeys=${encodeURIComponent(projectKey)}&expand=projects.issuetypes`;
    const cmRes = await fetch(createmetaUrl, {
        headers: { Authorization: `Basic ${auth}`, Accept: "application/json" },
    });
    const cmText = await cmRes.text();

    if (!cmRes.ok) {
        return { error: `Permission check failed: ${extractJiraError(cmText, cmRes.status)}`, status: cmRes.status };
    }

    let cmData: { projects?: { key?: string; issuetypes?: { name?: string; subtask?: boolean }[] }[] };
    try { cmData = JSON.parse(cmText); } catch {
        return { error: "Permission check returned an invalid response.", status: 502 };
    }

    const projectMeta = cmData.projects?.find(p => p.key?.toUpperCase() === projectKey.toUpperCase());
    const creatableTypes = projectMeta?.issuetypes?.filter(t => !t.subtask).map(t => t.name).filter(Boolean) || [];

    if (!projectMeta || creatableTypes.length === 0) {
        return { error: `User does not have permission to create issues in project "${projectKey}".`, status: 403 };
    }

    if (creatableTypes.some(t => t?.toLowerCase() === requestedIssueType.toLowerCase())) {
        return { issueType: requestedIssueType };
    }

    if (requestedIssueType === "Defect" && creatableTypes.some(t => t?.toLowerCase() === "bug")) {
        return {
            issueType: "Bug",
            warning: `Defect issue type not found in creatable types for ${projectKey}. Created as Bug. Available: ${creatableTypes.join(', ')}`,
        };
    }

    return {
        error: `Issue type "${requestedIssueType}" is not creatable in project "${projectKey}". Available creatable types: ${creatableTypes.join(', ')}`,
        status: 400,
    };
}

export async function POST(request: Request) {
    try {
        const body = await request.json() as DefectRequest;
        const summary = body.summary?.trim() || "";
        const description = body.description?.trim() || "";
        const actualResult = body.actualResult?.trim() || "";
        const expectedResult = body.expectedResult?.trim() || "";
        const issueType = body.issueType === "Defect" ? "Defect" : body.issueType === "Bug" ? "Bug" : "";

        if (!summary) {
            return NextResponse.json({ success: false, error: "Summary is required" }, { status: 400 });
        }
        if (!description) {
            return NextResponse.json({ success: false, error: "Description & Steps to Reproduce is required" }, { status: 400 });
        }
        if (!actualResult) {
            return NextResponse.json({ success: false, error: "Actual Result is required" }, { status: 400 });
        }
        if (!expectedResult) {
            return NextResponse.json({ success: false, error: "Expected Result is required" }, { status: 400 });
        }
        if (!issueType) {
            return NextResponse.json({ success: false, error: "Issue Type is required" }, { status: 400 });
        }

        const config = getJiraConfig(body.credentials || {});
        if ("error" in config) {
            return NextResponse.json({ success: false, error: config.error }, { status: 400 });
        }

        const normalizedUrl = cleanBaseUrl(config.baseUrl);
        const auth = Buffer.from(`${config.email}:${config.apiToken}`).toString("base64");

        // ── Log pre-creation details ─────────────────────────────────────
        console.log('[JIRA DEFECT] --- Pre-creation audit ---');
        console.log('[JIRA DEFECT] Base URL:', normalizedUrl);
        console.log('[JIRA DEFECT] Project Key:', config.projectKey);
        console.log('[JIRA DEFECT] Issue Type:', issueType);
        console.log('[JIRA DEFECT] Parent Story ID:', body.storyId || '(none)');
        console.log('[JIRA DEFECT] Auth user email:', config.email);

        const preflight = await runPreflight({
            normalizedUrl,
            auth,
            projectKey: config.projectKey,
            requestedIssueType: issueType,
        });
        if ("error" in preflight) {
            return NextResponse.json({ success: false, error: preflight.error }, { status: preflight.status });
        }

        const createPayload = (mappedIssueType: "Bug" | "Defect", includePriority = true) => {
            const fields: Record<string, unknown> = {
                project: { key: config.projectKey },
                summary,
                issuetype: { name: mappedIssueType },
                description: toADF({ ...body, summary, description, actualResult, expectedResult, issueType: mappedIssueType }),
                labels: ["tcgen-buddy", "qa-defect"],
            };

            if (includePriority && body.priority?.trim()) {
                fields.priority = { name: body.priority.trim() };
            }

            return { fields };
        };

        const createIssue = (mappedIssueType: "Bug" | "Defect", includePriority = true) => fetch(`${normalizedUrl}/rest/api/3/issue`, {
            method: "POST",
            headers: {
                Authorization: `Basic ${auth}`,
                "Content-Type": "application/json",
                Accept: "application/json",
            },
            body: JSON.stringify(createPayload(mappedIssueType, includePriority)),
        });

        const linkIssue = async (issueKey: string) => {
            if (!body.storyId?.trim()) return;
            try {
                await fetch(`${normalizedUrl}/rest/api/3/issueLink`, {
                    method: "POST",
                    headers: {
                        Authorization: `Basic ${auth}`,
                        "Content-Type": "application/json",
                        Accept: "application/json",
                    },
                    body: JSON.stringify({
                        type: { name: "Relates" },
                        inwardIssue: { key: issueKey },
                        outwardIssue: { key: body.storyId.trim() },
                    }),
                });
            } catch (error) {
                console.warn("[JIRA DEFECT LINK]", error);
            }
        };

        const successResponse = async (result: JiraCreateResult) => {
            await linkIssue(result.issueKey);
            return NextResponse.json({
                success: true,
                issueKey: result.issueKey,
                issueUrl: result.issueUrl,
                issueType: result.issueType,
                warning: result.warning,
                description: buildDescription({ ...body, summary, description, actualResult, expectedResult, issueType: result.issueType }),
            });
        };

        let resolvedIssueType = preflight.issueType;
        let warning = preflight.warning;
        let res = await createIssue(resolvedIssueType);
        const responseText = await res.text();
        if (!res.ok) {
            console.warn("[JIRA DEFECT CREATE]", {
                status: res.status,
                projectKey: config.projectKey,
                requestedIssueType: issueType,
                resolvedIssueType,
                rawError: responseText,
            });
            const lowerError = responseText.toLowerCase();
            const priorityRejected = res.status === 400 && lowerError.includes("priority") && body.priority?.trim();
            if (priorityRejected) {
                res = await createIssue(resolvedIssueType, false);
                const retryText = await res.text();
                if (!res.ok) {
                    return NextResponse.json({ success: false, error: extractJiraError(retryText, res.status) }, { status: res.status });
                }
                warning = warning
                    ? `${warning} Jira priority was not accepted and was omitted.`
                    : "Jira priority was not accepted and was omitted.";
                const retryData = JSON.parse(retryText);
                const issueKey = retryData.key;
                const issueUrl = `${normalizedUrl}/browse/${issueKey}`;
                return successResponse({ issueKey, issueUrl, issueType: resolvedIssueType, warning });
            }

            return NextResponse.json({ success: false, error: extractJiraError(responseText, res.status) }, { status: res.status });
        }

        const data = JSON.parse(responseText);
        const issueKey = data.key;
        const issueUrl = `${normalizedUrl}/browse/${issueKey}`;

        return successResponse({ issueKey, issueUrl, issueType: resolvedIssueType, warning });
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return NextResponse.json({ success: false, error: `Jira defect creation failed: ${message}` }, { status: 500 });
    }
}
