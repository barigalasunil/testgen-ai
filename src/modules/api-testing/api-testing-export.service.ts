"use client";

import * as XLSX from "xlsx";
import { ApiTestCase } from "./types";

function pad(value: number): string {
    return String(value).padStart(2, "0");
}

function filename(jiraStoryId: string | undefined, extension: string): string {
    const now = new Date();
    const date = `${pad(now.getDate())}-${pad(now.getMonth() + 1)}-${String(now.getFullYear()).slice(-2)}`;
    const prefix = jiraStoryId?.trim() || "TCGen-Buddy";
    return `${prefix}_API_TCs_${date}.${extension}`;
}

function normalize(value: unknown): string {
    if (value === null || typeof value === "undefined") return "";
    if (typeof value === "object") return JSON.stringify(value, null, 2);
    return String(value);
}

function rows(testCases: ApiTestCase[]) {
    return testCases.map(testCase => ({
        "Test Case ID": testCase.testCaseId,
        "API Scenario": testCase.apiScenario,
        Method: testCase.method,
        Endpoint: testCase.endpoint,
        Preconditions: testCase.preconditions,
        "Request Data": testCase.requestData,
        Steps: testCase.steps,
        "Expected Status Code": testCase.expectedStatusCode,
        "Expected Result": testCase.expectedResult,
        "Test Type": testCase.testType,
        Priority: testCase.priority,
    }));
}

function download(blob: Blob, name: string) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = name;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
}

export function exportApiExcel(testCases: ApiTestCase[], jiraStoryId?: string): string {
    const data = rows(testCases);
    const worksheet = XLSX.utils.json_to_sheet(data);
    worksheet["!cols"] = Object.keys(data[0] || {}).map(key => ({
        wch: Math.max(key.length, ...data.map(row => normalize((row as Record<string, unknown>)[key]).length), 14),
    }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "API Test Cases");
    const name = filename(jiraStoryId, "xlsx");
    XLSX.writeFile(workbook, name);
    return name;
}

export function exportApiCsv(testCases: ApiTestCase[], jiraStoryId?: string): string {
    const data = rows(testCases);
    const headers = Object.keys(data[0] || {});
    const escape = (value: unknown) => {
        const text = normalize(value).replace(/"/g, '""');
        return /[",\n]/.test(text) ? `"${text}"` : text;
    };
    const csv = [
        headers.map(escape).join(","),
        ...data.map(row => headers.map(header => escape((row as Record<string, unknown>)[header])).join(",")),
    ].join("\n");
    const name = filename(jiraStoryId, "csv");
    download(new Blob([csv], { type: "text/csv;charset=utf-8" }), name);
    return name;
}

export function exportApiJson(testCases: ApiTestCase[], jiraStoryId?: string): string {
    const name = filename(jiraStoryId, "json");
    download(new Blob([JSON.stringify({ generatedAt: new Date().toISOString(), jiraStoryId: jiraStoryId || null, testCases }, null, 2)], { type: "application/json" }), name);
    return name;
}
