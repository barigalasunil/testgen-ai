"use client";

import { useRef, useState } from "react";
import { Bug, CheckCircle2, ExternalLink, Loader2, Pencil, Sparkles, XCircle } from "lucide-react";
import { createDefect, DefectPayload, fetchJiraStory, reviewDefectWithAi } from "@/src/services/jira/jira.service";
import { extractJiraId } from "@/src/orchestrators/jira-orchestrator";
import type { AiProviderId, ProviderSettings } from "@/src/services/ai/provider-orchestrator";

const priorities = ["", "Lowest", "Low", "Medium", "High", "Highest"];
const severities = ["", "Low", "Medium", "High", "Critical", "Blocker"];
const issueTypes = ["Bug", "Defect"];

type DefectStudioProps = {
    provider: AiProviderId;
    model: string;
    providerSettings: ProviderSettings;
};

type Notice = {
    type: "success" | "error";
    message: string;
    url?: string;
    key?: string;
};

const emptyDefect: DefectPayload = {
    summary: "",
    description: "",
    actualResult: "",
    expectedResult: "",
    issueType: "Bug",
    priority: "",
    severity: "",
};

function Field({
    label,
    value,
    onChange,
    required,
    multiline,
    error,
}: {
    label: string;
    value?: string;
    onChange: (value: string) => void;
    required?: boolean;
    multiline?: boolean;
    error?: string;
}) {
    return (
        <label className="block">
            <span className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-200">
                {label}{required ? <span className="text-red-500"> *</span> : null}
            </span>
            {multiline ? (
                <textarea
                    value={value || ""}
                    onChange={(event) => onChange(event.target.value)}
                    rows={label === "Description" || label === "Reviewed Description" ? 5 : 3}
                    className="w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-[#10A37F] focus:ring-2 focus:ring-[#10A37F]/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
            ) : (
                <input
                    value={value || ""}
                    onChange={(event) => onChange(event.target.value)}
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-[#10A37F] focus:ring-2 focus:ring-[#10A37F]/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
            )}
            {error ? <span className="mt-1 block text-xs font-semibold text-red-600">{error}</span> : null}
        </label>
    );
}

function SelectField({
    label,
    value,
    options,
    onChange,
    required,
    error,
}: {
    label: string;
    value?: string;
    options: string[];
    onChange: (value: string) => void;
    required?: boolean;
    error?: string;
}) {
    return (
        <label className="block">
            <span className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-200">
                {label}{required ? <span className="text-red-500"> *</span> : null}
            </span>
            <select
                value={value || ""}
                onChange={(event) => onChange(event.target.value)}
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-[#10A37F] focus:ring-2 focus:ring-[#10A37F]/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            >
                {options.map((option) => (
                    <option key={option || "blank"} value={option}>{option || "Not selected"}</option>
                ))}
            </select>
            {error ? <span className="mt-1 block text-xs font-semibold text-red-600">{error}</span> : null}
        </label>
    );
}

function validate(defect: DefectPayload) {
    return {
        summary: defect.summary.trim() ? "" : "Summary is required",
        description: defect.description.trim() ? "" : "Description & Steps to Reproduce is required",
        actualResult: defect.actualResult?.trim() ? "" : "Actual Result is required",
        expectedResult: defect.expectedResult?.trim() ? "" : "Expected Result is required",
        issueType: defect.issueType === "Bug" || defect.issueType === "Defect" ? "" : "Issue Type is required",
    };
}

export function DefectStudio({ provider, model, providerSettings }: DefectStudioProps) {
    const [quickDescription, setQuickDescription] = useState("");
    const [linkToStory, setLinkToStory] = useState(false);
    const [storyInput, setStoryInput] = useState("");
    const [storyError, setStoryError] = useState("");
    const [manual, setManual] = useState<DefectPayload>(emptyDefect);
    const [reviewed, setReviewed] = useState<DefectPayload | null>(null);
    const [errors, setErrors] = useState({ summary: "", description: "", actualResult: "", expectedResult: "", issueType: "" });
    const [reviewedErrors, setReviewedErrors] = useState({ summary: "", description: "", actualResult: "", expectedResult: "", issueType: "" });
    const [notice, setNotice] = useState<Notice | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [isDrafting, setIsDrafting] = useState(false);
    const [isReviewing, setIsReviewing] = useState(false);
    const [isCreatingReviewed, setIsCreatingReviewed] = useState(false);
    const firstReviewedField = useRef<HTMLInputElement>(null);

    const updateManual = (field: keyof DefectPayload, value: string) => {
        setManual(prev => ({ ...prev, [field]: value }));
        if (field === "summary" || field === "description" || field === "actualResult" || field === "expectedResult" || field === "issueType") {
            setErrors(prev => ({ ...prev, [field]: "" }));
        }
    };

    const updateReviewed = (field: keyof DefectPayload, value: string) => {
        setReviewed(prev => prev ? { ...prev, [field]: value } : prev);
        if (field === "summary" || field === "description" || field === "actualResult" || field === "expectedResult" || field === "issueType") {
            setReviewedErrors(prev => ({ ...prev, [field]: "" }));
        }
    };

    const populateReviewed = (defect: DefectPayload) => {
        setReviewed({
            summary: defect.summary || "Not Provided",
            description: defect.description || "Not Provided",
            actualResult: defect.actualResult || "Not Provided",
            expectedResult: defect.expectedResult || "Not Provided",
            issueType: defect.issueType === "Defect" ? "Defect" : "Bug",
            priority: defect.priority || "",
            severity: defect.severity || "",
        });
    };

    const resolveStoryIdForCreate = async () => {
        if (!linkToStory) return "";
        const storyId = extractJiraId(storyInput);
        if (!storyId) {
            setStoryError("Enter a valid Jira story URL or issue ID.");
            throw new Error("Enter a valid Jira story URL or issue ID.");
        }
        const result = await fetchJiraStory(storyId);
        if (!result?.success) {
            const message = result?.error || "Jira story could not be validated.";
            setStoryError(message);
            throw new Error(message);
        }
        setStoryError("");
        return storyId;
    };

    const createInJira = async (payload: DefectPayload, reviewedMode = false) => {
        const validation = validate(payload);
        if (reviewedMode) {
            setReviewedErrors(validation);
        } else {
            setErrors(validation);
        }
        const firstError = Object.values(validation).find(Boolean);
        if (firstError) {
            setNotice({ type: "error", message: firstError });
            return;
        }

        reviewedMode ? setIsCreatingReviewed(true) : setIsCreating(true);
        setNotice(null);
        try {
            const explicitStoryId = await resolveStoryIdForCreate();
            const data = await createDefect({ ...payload, storyId: explicitStoryId || undefined });
            if (!data.success) throw new Error(data.error || "Jira defect creation failed");
            setNotice({
                type: "success",
                message: `${data.issueType || payload.issueType || "Bug"} created successfully${data.warning ? `: ${data.warning}` : ""}`,
                key: data.issueKey,
                url: data.issueUrl,
            });
        } catch (error) {
            setNotice({ type: "error", message: error instanceof Error ? error.message : String(error) });
        } finally {
            reviewedMode ? setIsCreatingReviewed(false) : setIsCreating(false);
        }
    };

    const reviewWithAi = async () => {
        const validation = validate(manual);
        setErrors(validation);
        const firstError = Object.values(validation).find(Boolean);
        if (firstError) {
            setNotice({ type: "error", message: firstError });
            return;
        }

        setIsReviewing(true);
        setNotice(null);
        try {
            const data = await reviewDefectWithAi({
                ...manual,
                provider,
                model,
                providerSettings,
            });
            if (!data.success) throw new Error(data.error || "AI review failed");
            populateReviewed({
                summary: data.defect.summary || manual.summary,
                description: data.defect.description || manual.description,
                actualResult: data.defect.actualResult || "",
                expectedResult: data.defect.expectedResult || "",
                issueType: data.defect.issueType || manual.issueType || "Bug",
                priority: data.defect.priority || "",
                severity: data.defect.severity || "",
            });
            setNotice({ type: "success", message: "AI review completed. Review and edit before creating the Jira defect." });
        } catch (error) {
            setNotice({ type: "error", message: error instanceof Error ? error.message : String(error) });
        } finally {
            setIsReviewing(false);
        }
    };

    const generateDefectDraft = async () => {
        if (!quickDescription.trim()) {
            setNotice({ type: "error", message: "Describe the issue in plain English before generating a draft." });
            return;
        }

        setIsDrafting(true);
        setNotice(null);
        try {
            const data = await reviewDefectWithAi({
                quickDescription,
                provider,
                model,
                providerSettings,
                summary: "",
                description: "",
            });
            if (!data.success) throw new Error(data.error || "AI draft generation failed");
            populateReviewed({
                summary: data.defect.summary || "Not Provided",
                description: data.defect.description || quickDescription,
                actualResult: data.defect.actualResult || "Not Provided",
                expectedResult: data.defect.expectedResult || "Not Provided",
                issueType: data.defect.issueType || "Bug",
                priority: data.defect.priority || "",
                severity: data.defect.severity || "",
            });
            setNotice({ type: "success", message: "Defect draft generated. Review and edit before creating the Jira defect." });
            window.setTimeout(() => firstReviewedField.current?.focus(), 0);
        } catch (error) {
            setNotice({ type: "error", message: error instanceof Error ? error.message : String(error) });
        } finally {
            setIsDrafting(false);
        }
    };

    return (
        <div className="mx-auto w-full max-w-7xl p-4 md:p-8">
            <div className="mb-6 flex flex-col gap-2">
                <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#10A37F]/10 text-[#10A37F]">
                        <Bug className="h-5 w-5" />
                    </span>
                    <div>
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Defect Studio</h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Create, review, and publish Jira defects with AI assistance.</p>
                    </div>
                </div>
            </div>

            {notice && (
                <div className={`mb-4 flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm font-semibold ${
                    notice.type === "success"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-900/20 dark:text-emerald-300"
                        : "border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300"
                }`}>
                    <span className="flex items-center gap-2">
                        {notice.type === "success" ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                        {notice.message}
                    </span>
                    {notice.url ? (
                        <a href={notice.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs underline">
                            Open {notice.key} <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                    ) : null}
                </div>
            )}

            <section className="mb-5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="mb-3">
                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Quick Defect Description</h3>
                </div>
                <label className="block">
                    <span className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-200">Describe the issue in plain English</span>
                    <textarea
                        value={quickDescription}
                        onChange={(event) => setQuickDescription(event.target.value)}
                        rows={5}
                        placeholder={`Examples:\n\n"The login button becomes unresponsive after entering valid credentials."\n\n"User is redirected to a blank page after submitting checkout."\n\n"Search results are not displayed when applying a price filter."\n\n"The API returns HTTP 500 when payload contains special characters."`}
                        className="w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#10A37F] focus:ring-2 focus:ring-[#10A37F]/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                    />
                </label>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                    <button
                        onClick={generateDefectDraft}
                        disabled={isDrafting || isCreating || isReviewing || isCreatingReviewed}
                        className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#10A37F] px-4 text-sm font-bold text-white hover:bg-[#0d8c6d] disabled:opacity-50"
                    >
                        {isDrafting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                        Generate Defect Draft
                    </button>
                </div>
            </section>

            <section className="mb-5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="mb-3">
                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Link to Jira Requirement</h3>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Optional. Defects are standalone unless this is enabled.</p>
                </div>
                <label className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                    <input
                        type="checkbox"
                        checked={linkToStory}
                        onChange={(event) => {
                            setLinkToStory(event.target.checked);
                            setStoryError("");
                        }}
                        className="h-4 w-4 rounded border-slate-300 text-[#10A37F] focus:ring-[#10A37F]"
                    />
                    Link Defect to Story
                </label>
                <label className="block">
                    <span className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-200">Jira Story URL or Jira ID</span>
                    <input
                        value={storyInput}
                        onChange={(event) => {
                            setStoryInput(event.target.value);
                            setStoryError("");
                        }}
                        disabled={!linkToStory}
                        placeholder="TCGB-123 or https://your-domain.atlassian.net/browse/TCGB-123"
                        className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-[#10A37F] focus:ring-2 focus:ring-[#10A37F]/10 disabled:bg-slate-100 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:disabled:bg-slate-800"
                    />
                    {storyError ? <span className="mt-1 block text-xs font-semibold text-red-600">{storyError}</span> : null}
                </label>
            </section>

            <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                <section className="rounded-xl border border-slate-200 bg-slate-50 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <div className="mb-4">
                        <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Manual Defect Entry</h3>
                    </div>
                    <div className="space-y-4">
                        <Field label="Summary" required value={manual.summary} error={errors.summary} onChange={(value) => updateManual("summary", value)} />
                        <Field label="Description & Steps to Reproduce" required multiline value={manual.description} error={errors.description} onChange={(value) => updateManual("description", value)} />
                        <Field label="Actual Result" required multiline value={manual.actualResult} error={errors.actualResult} onChange={(value) => updateManual("actualResult", value)} />
                        <Field label="Expected Result" required multiline value={manual.expectedResult} error={errors.expectedResult} onChange={(value) => updateManual("expectedResult", value)} />
                        <SelectField label="Issue Type" required value={manual.issueType} options={issueTypes} error={errors.issueType} onChange={(value) => updateManual("issueType", value)} />
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <SelectField label="Priority" value={manual.priority} options={priorities} onChange={(value) => updateManual("priority", value)} />
                            <SelectField label="Severity" value={manual.severity} options={severities} onChange={(value) => updateManual("severity", value)} />
                        </div>
                        <div className="flex flex-wrap gap-3 pt-2">
                            <button onClick={() => createInJira(manual)} disabled={isCreating || isReviewing} className="inline-flex h-10 items-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-white dark:text-slate-900">
                                {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bug className="h-4 w-4" />}
                                Create in Jira
                            </button>
                            <button onClick={reviewWithAi} disabled={isReviewing || isCreating} className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#10A37F] px-4 text-sm font-bold text-white hover:bg-[#0d8c6d] disabled:opacity-50">
                                {isReviewing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                                Review with AI
                            </button>
                        </div>
                    </div>
                </section>

                <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <div className="mb-4 flex items-center justify-between gap-3">
                        <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">AI Reviewed Defect</h3>
                        {reviewed ? <span className="rounded-full bg-[#10A37F]/10 px-3 py-1 text-[11px] font-bold text-[#10A37F]">Editable</span> : null}
                    </div>
                    {reviewed ? (
                        <div className="space-y-4">
                            <label className="block">
                                <span className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-200">Reviewed Summary</span>
                                <input
                                    ref={firstReviewedField}
                                    value={reviewed.summary || ""}
                                    onChange={(event) => updateReviewed("summary", event.target.value)}
                                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-[#10A37F] focus:ring-2 focus:ring-[#10A37F]/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                                />
                            </label>
                            {reviewedErrors.summary ? <span className="mt-1 block text-xs font-semibold text-red-600">{reviewedErrors.summary}</span> : null}
                            <Field label="Reviewed Description & Steps to Reproduce" required multiline value={reviewed.description} error={reviewedErrors.description} onChange={(value) => updateReviewed("description", value)} />
                            <Field label="Reviewed Actual Result" required multiline value={reviewed.actualResult} error={reviewedErrors.actualResult} onChange={(value) => updateReviewed("actualResult", value)} />
                            <Field label="Reviewed Expected Result" required multiline value={reviewed.expectedResult} error={reviewedErrors.expectedResult} onChange={(value) => updateReviewed("expectedResult", value)} />
                            <SelectField label="Reviewed Issue Type" required value={reviewed.issueType} options={issueTypes} error={reviewedErrors.issueType} onChange={(value) => updateReviewed("issueType", value)} />
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <SelectField label="Suggested Priority" value={reviewed.priority} options={priorities} onChange={(value) => updateReviewed("priority", value)} />
                                <SelectField label="Suggested Severity" value={reviewed.severity} options={severities} onChange={(value) => updateReviewed("severity", value)} />
                            </div>
                            <div className="flex flex-wrap gap-3 pt-2">
                                <button onClick={() => createInJira(reviewed, true)} disabled={isCreatingReviewed} className="inline-flex h-10 items-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-white dark:text-slate-900">
                                    {isCreatingReviewed ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bug className="h-4 w-4" />}
                                    Create Reviewed Defect in Jira
                                </button>
                                <button onClick={() => firstReviewedField.current?.focus()} className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800">
                                    <Pencil className="h-4 w-4" />
                                    Edit Reviewed Defect
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex min-h-[420px] items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 px-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-400">
                            AI reviewed fields will appear here after review.
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
}
