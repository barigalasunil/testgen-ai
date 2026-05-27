import * as XLSX from "xlsx";
import { TestCase } from "@/src/modules/testcase-generator/types";
import { buildArtifactFilename } from "./artifact-filename";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildFilename(jiraStoryId: string | undefined, extension: string): string {
    return buildArtifactFilename(jiraStoryId, "TCs", extension);
}

function normalizeValue(value: unknown): string {
    if (value === null || typeof value === "undefined") return "";
    if (Array.isArray(value)) return value.map((item) => normalizeValue(item)).join("\n");
    if (typeof value === "object") return JSON.stringify(value, null, 2);
    return String(value);
}

function getMaxLineLength(value: string): number {
    return value.split("\n").reduce((max, line) => Math.max(max, line.length), 0);
}

function mapTestCases(testCases: TestCase[]) {
    return testCases.map((tc) => ({
        "Test Case ID": normalizeValue(tc.testCaseId),
        "Scenario Title": normalizeValue(tc.scenarioTitle),
        "Test Type": normalizeValue(tc.testType),
        "Priority": normalizeValue(tc.priority),
        "Preconditions": normalizeValue(tc.preconditions),
        "Test Data": normalizeValue(tc.testData),
        "Test Steps": normalizeValue(tc.testSteps),
        "Expected Result": normalizeValue(tc.expectedResult),
    }));
}

// ---------------------------------------------------------------------------
// Excel
// ---------------------------------------------------------------------------

export function exportExcel(testCases: TestCase[], jiraStoryId?: string): string {
    const rows = mapTestCases(testCases);
    const worksheet = XLSX.utils.json_to_sheet(rows);

    // Auto column widths
    const colWidths = Object.keys(rows[0] || {}).map((key) => ({
        wch: Math.max(
            key.length,
            ...rows.map((r) => getMaxLineLength(normalizeValue((r as Record<string, unknown>)[key]))),
            14
        ),
    }));
    worksheet["!cols"] = colWidths;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Test Cases");

    const filename = buildFilename(jiraStoryId, "xlsx");
    XLSX.writeFile(workbook, filename);
    return filename;
}

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

export function exportCsv(testCases: TestCase[], jiraStoryId?: string): string {
    const rows = mapTestCases(testCases);
    const headers = Object.keys(rows[0] || {});

    const escape = (value: unknown) => {
        const str = normalizeValue(value).replace(/"/g, '""');
        return str.includes(",") || str.includes("\n") || str.includes('"') ? `"${str}"` : str;
    };

    const csvContent =
        headers.map(escape).join(",") +
        "\n" +
        rows.map((row) => headers.map((h) => escape((row as Record<string, unknown>)[h])).join(",")).join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const filename = buildFilename(jiraStoryId, "csv");
    triggerDownload(blob, filename);
    return filename;
}

// ---------------------------------------------------------------------------
// JSON
// ---------------------------------------------------------------------------

export function exportJson(testCases: TestCase[], jiraStoryId?: string): string {
    const payload = {
        generatedAt: new Date().toISOString(),
        jiraStoryId: jiraStoryId?.trim() || null,
        totalTestCases: testCases.length,
        testCases: testCases.map((tc) => ({
            testCaseId: tc.testCaseId,
            scenarioTitle: tc.scenarioTitle,
            testType: tc.testType,
            priority: tc.priority,
            preconditions: tc.preconditions,
            testData: tc.testData,
            testSteps: tc.testSteps,
            expectedResult: tc.expectedResult,
        })),
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const filename = buildFilename(jiraStoryId, "json");
    triggerDownload(blob, filename);
    return filename;
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function triggerDownload(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}
