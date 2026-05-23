export type ArtifactKind = "TCs" | "Playwright" | "Playwright_Script";

export function sanitizeFilename(value: string): string {
    return value
        .trim()
        .replace(/[^a-zA-Z0-9\-_]/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_+|_+$/g, "");
}

export function getDateSuffix(): string {
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, "0");
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const yy = String(now.getFullYear()).slice(2);
    return `${dd}-${mm}-${yy}`;
}

export function buildArtifactFilename(
    jiraStoryId: string | undefined,
    artifactKind: ArtifactKind,
    extension: string
): string {
    const prefix = jiraStoryId?.trim() || "TCGen-Buddy";
    const sanitized = sanitizeFilename(prefix || "TCGen-Buddy");
    return `${sanitized}_UAT_${artifactKind}_${getDateSuffix()}.${extension}`;
}
