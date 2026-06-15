"use client";

import { useEffect, useMemo, useState } from "react";
import { Bug, Loader2, Sparkles, X } from "lucide-react";
import * as jiraService from "@/src/services/jira/jira.service";
import { memoryIdForJiraStory, projectKeyFromText, upsertDefectConvertedTestCase, upsertMemoryVaultRecord } from "@/src/services/memory-vault/memory-vault.service";
import { DefectToast, DefectToastState } from "@/src/modules/defect-studio/DefectToast";
import { TestCase } from "../types";

type Props = {
    isOpen: boolean;
    onClose: () => void;
    testCase: TestCase | null;
    requirementId?: string;
};

const priorities = ["Lowest", "Low", "Medium", "High", "Highest"];
const severities = ["", "Low", "Medium", "High", "Critical", "Blocker"];
const issueTypes = ["Bug", "Defect"];

function priorityFromTestCase(priority?: string) {
    if (priority === "P1") return "High";
    if (priority === "P3") return "Low";
    return "Medium";
}

function Field({
    label,
    value,
    onChange,
    placeholder,
    multiline,
    required,
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    multiline?: boolean;
    required?: boolean;
}) {
    const className = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#10A37F] focus:ring-2 focus:ring-[#10A37F]/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500";

    return (
        <label className="block">
            <span className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-200">
                {label}{required ? <span className="text-red-500"> *</span> : null}
            </span>
            {multiline ? (
                <textarea
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                    placeholder={placeholder}
                    rows={4}
                    className={`${className} resize-y`}
                />
            ) : (
                <input
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                    placeholder={placeholder}
                    className={`h-10 ${className}`}
                />
            )}
        </label>
    );
}

function SelectField({
    label,
    value,
    options,
    onChange,
    required,
}: {
    label: string;
    value: string;
    options: string[];
    onChange: (value: string) => void;
    required?: boolean;
}) {
    return (
        <label className="block">
            <span className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-200">
                {label}{required ? <span className="text-red-500"> *</span> : null}
            </span>
            <select
                value={value}
                onChange={(event) => onChange(event.target.value)}
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-[#10A37F] focus:ring-2 focus:ring-[#10A37F]/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            >
                {options.map((option) => <option key={option || "blank"} value={option}>{option || "Not selected"}</option>)}
            </select>
        </label>
    );
}

export default function JiraModal({ isOpen, onClose, testCase, requirementId }: Props) {
    const [actualResult, setActualResult] = useState("");
    const [expectedResult, setExpectedResult] = useState("");
    const [summary, setSummary] = useState("");
    const [description, setDescription] = useState("");
    const [issueType, setIssueType] = useState("Bug");
    const [priority, setPriority] = useState("Medium");
    const [severity, setSeverity] = useState("");
    const [linkToStory, setLinkToStory] = useState(false);
    const [labels, setLabels] = useState("regression, tcgen-buddy");
    const [loading, setLoading] = useState(false);
    const [aiLoading, setAiLoading] = useState(false);
    const [toast, setToast] = useState<DefectToastState | null>(null);

    useEffect(() => {
        if (!isOpen || !testCase) return;
        const timeout = window.setTimeout(() => {
            setActualResult("");
            setExpectedResult(testCase.expectedResult || "");
            setSummary(testCase.scenarioTitle || "");
            setDescription(testCase.testSteps || "");
            setIssueType("Bug");
            setPriority(priorityFromTestCase(testCase.priority));
            setSeverity("");
            setLinkToStory(false);
            setLabels("regression, tcgen-buddy");
            setToast(null);
        }, 0);
        return () => window.clearTimeout(timeout);
    }, [isOpen, testCase]);

    const jiraDescription = useMemo(() => [
        `Linked Test Case ID: ${testCase?.testCaseId || "N/A"}`,
        linkToStory && requirementId ? `Linked Jira Story: ${requirementId}` : "",
        severity ? `Severity: ${severity}` : "",
        "",
        "Description & Steps to Reproduce:",
        description || "Not provided",
        "",
        "Expected Result:",
        expectedResult || "Not provided",
        "",
        "Actual Result:",
        actualResult || "Not provided",
    ].filter((line, index, lines) => line || lines[index - 1] !== "").join("\n"), [actualResult, description, expectedResult, linkToStory, requirementId, severity, testCase?.testCaseId]);

    const validate = () => {
        if (!summary.trim()) return "Summary is required.";
        if (!description.trim()) return "Description & Steps to Reproduce is required.";
        if (!actualResult.trim()) return "Actual Result is required.";
        if (!expectedResult.trim()) return "Expected Result is required.";
        if (!issueType.trim()) return "Issue Type is required.";
        return "";
    };

    const handleGenerate = async () => {
        if (!testCase) return;
        const error = validate();
        if (error) {
            setToast({ type: "error", message: error });
            return;
        }
        setAiLoading(true);
        setToast(null);
        try {
            const res = await jiraService.generateDefect({
                testCaseTitle: testCase.scenarioTitle,
                testCaseSteps: testCase.testSteps,
                expectedResult,
                actualResult,
            });
            if (res?.success) {
                setSummary(res.summary || summary);
                setDescription(res.description || description);
                setPriority(res.priority || priority);
                setLabels(Array.isArray(res.labels) ? res.labels.join(", ") : labels);
            } else {
                setToast({ type: "error", message: res.error || "AI generation failed" });
            }
        } catch (err) {
            setToast({ type: "error", message: err instanceof Error ? err.message : String(err) });
        } finally {
            setAiLoading(false);
        }
    };

    const handleCreate = async () => {
        const error = validate();
        if (error) {
            setToast({ type: "error", message: error });
            return;
        }

        setLoading(true);
        setToast(null);
        try {
            const res = await jiraService.createIssue({
                summary,
                description: jiraDescription,
                issueType,
                priority,
                labels: labels.split(",").map(item => item.trim()).filter(Boolean),
                storyId: linkToStory ? requirementId : undefined,
                traceability: linkToStory && requirementId
                    ? { sourceId: requirementId, sourceType: "requirement", testCaseId: testCase?.testCaseId }
                    : undefined,
            });
            if (res?.success) {
                const linkedStoryId = linkToStory ? requirementId : undefined;
                const projectKey = projectKeyFromText(linkedStoryId || res.issueKey);
                upsertMemoryVaultRecord({
                    id: res.issueKey ? `defect-${res.issueKey}` : undefined,
                    projectKey,
                    sourceType: "defect",
                    title: res.issueKey || summary,
                    content: [
                        `Defect: ${res.issueKey || summary}`,
                        `Summary: ${summary}`,
                        `Linked Test Case ID: ${testCase?.testCaseId || ""}`,
                        linkedStoryId ? `Linked Story: ${linkedStoryId}` : "",
                        "",
                        jiraDescription,
                    ].filter(Boolean).join("\n"),
                    metadata: {
                        issueKey: res.issueKey,
                        issueUrl: res.issueUrl,
                        issueType,
                        priority,
                        severity,
                        testCaseId: testCase?.testCaseId,
                        storyId: linkedStoryId,
                        linkedMemoryStoryId: linkedStoryId ? memoryIdForJiraStory(linkedStoryId) : undefined,
                    },
                });
                upsertDefectConvertedTestCase({
                    defectId: res.issueKey,
                    defectUrl: res.issueUrl,
                    projectKey,
                    summary,
                    description,
                    actualResult,
                    expectedResult,
                    priority,
                    severity,
                    storyId: linkedStoryId,
                    testCaseId: testCase?.testCaseId ? `DTC-${testCase.testCaseId}` : undefined,
                });
                setToast({
                    type: "success",
                    message: `${issueType || "Bug"} created successfully`,
                    issueKey: res.issueKey,
                    issueUrl: res.issueUrl,
                });
            } else {
                setToast({ type: "error", message: res.error || "Failed to create issue" });
            }
        } catch (err) {
            setToast({ type: "error", message: err instanceof Error ? err.message : String(err) });
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <DefectToast toast={toast} onClose={() => setToast(null)} />
            <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-900 shadow-2xl dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100">
                <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-300">
                            <Bug className="h-4 w-4" />
                        </span>
                        <div>
                            <h3 className="text-base font-bold">Create Defect from Test Case</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400">{testCase?.testCaseId || "Generated test case"}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="grid flex-1 grid-cols-1 gap-0 overflow-y-auto lg:grid-cols-[1.25fr_0.85fr]">
                    <section className="space-y-4 border-b border-slate-200 p-4 dark:border-slate-800 lg:border-b-0 lg:border-r">
                        <Field label="Summary" required value={summary} onChange={setSummary} placeholder="Short defect summary" />
                        <Field label="Description & Steps to Reproduce" required multiline value={description} onChange={setDescription} placeholder="Steps from the failed test case" />
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <Field label="Actual Result" required multiline value={actualResult} onChange={setActualResult} placeholder="What actually happened?" />
                            <Field label="Expected Result" required multiline value={expectedResult} onChange={setExpectedResult} placeholder="Expected behavior" />
                        </div>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                            <SelectField label="Issue Type" required value={issueType} options={issueTypes} onChange={setIssueType} />
                            <SelectField label="Priority" value={priority} options={priorities} onChange={setPriority} />
                            <SelectField label="Severity" value={severity} options={severities} onChange={setSeverity} />
                        </div>
                        <Field label="Labels" value={labels} onChange={setLabels} placeholder="regression, tcgen-buddy" />
                        {requirementId ? (
                            <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200">
                                <input
                                    type="checkbox"
                                    checked={linkToStory}
                                    onChange={(event) => setLinkToStory(event.target.checked)}
                                    className="h-4 w-4 rounded border-slate-300 text-[#10A37F] focus:ring-[#10A37F]"
                                />
                                Link this defect to Jira story {requirementId}
                            </label>
                        ) : null}
                    </section>

                    <aside className="space-y-4 bg-slate-50 p-4 dark:bg-slate-950/60">
                        <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                            <p className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Test Case Reference</p>
                            <p className="text-sm font-bold text-slate-900 dark:text-white">{testCase?.scenarioTitle || "No test case selected"}</p>
                            <pre className="mt-3 max-h-40 overflow-auto whitespace-pre-wrap rounded-md border border-slate-200 bg-slate-50 p-2 text-xs leading-5 text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200">{testCase?.testSteps || ""}</pre>
                        </div>

                        <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Jira Preview</p>
                            <pre className="max-h-64 overflow-auto whitespace-pre-wrap text-xs leading-5 text-slate-700 dark:text-slate-200">{jiraDescription}</pre>
                        </div>

                        <button
                            onClick={handleGenerate}
                            disabled={aiLoading || loading}
                            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#10A37F] px-4 text-sm font-bold text-white hover:bg-[#0d8c6d] disabled:opacity-50"
                        >
                            {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                            Review with AI
                        </button>
                    </aside>
                </div>

                <div className="flex flex-col gap-3 border-t border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
                    <div />
                    <div className="flex gap-2">
                        <button onClick={onClose} className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
                            Cancel
                        </button>
                        <button onClick={handleCreate} disabled={loading} className="inline-flex h-10 items-center gap-2 rounded-lg bg-red-600 px-4 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50">
                            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bug className="h-4 w-4" />}
                            Create in Jira
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
