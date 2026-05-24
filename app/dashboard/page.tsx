"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const SUITE_OPTIONS = [
  { id: "smoke", label: "Smoke" },
  { id: "sanity", label: "Sanity" },
  { id: "regression", label: "Regression" },
] as const;

type SuiteName = (typeof SUITE_OPTIONS)[number]["id"];

type StatusState = "Idle" | "Running" | "Passed" | "Failed";

export default function AutomationDashboardPage() {
  const [selectedSuite, setSelectedSuite] = useState<SuiteName>("smoke");
  const [status, setStatus] = useState<StatusState>("Idle");
  const [output, setOutput] = useState("");
  const [isDone, setIsDone] = useState(false);
  const [reportUrl, setReportUrl] = useState<string | null>(null);
  const [durationMs, setDurationMs] = useState<number | null>(null);
  const [resultSuccess, setResultSuccess] = useState<boolean | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const outputRef = useRef<HTMLPreElement | null>(null);
  const textDecoder = useMemo(() => new TextDecoder(), []);

  useEffect(() => {
    if (!outputRef.current) return;
    outputRef.current.scrollTop = outputRef.current.scrollHeight;
  }, [output]);

  const appendOutput = (text: string) => {
    setOutput((current) => current + text);
  };

  const parseDoneLine = (line: string) => {
    if (!line.startsWith("__DONE__:")) return null;
    try {
      const json = JSON.parse(line.replace(/^__DONE__:/, ""));
      return json as { success: boolean; suite: string; durationMs: number; reportUrl: string };
    } catch {
      return null;
    }
  };

  const runTests = async () => {
    setStatus("Running");
    setOutput("");
    setIsDone(false);
    setReportUrl(null);
    setDurationMs(null);
    setResultSuccess(null);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/automation/run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ suite: selectedSuite }),
      });

      if (!response.body) {
        throw new Error("Streaming response is not available.");
      }

      const reader = response.body.getReader();
      let partial = "";
      let done = false;

      while (!done) {
        const { value, done: streamDone } = await reader.read();
        done = streamDone;

        if (value) {
          partial += textDecoder.decode(value, { stream: true });
          const lines = partial.split(/\r?\n/);
          partial = lines.pop() ?? "";

          for (const line of lines) {
            const parsed = parseDoneLine(line);
            if (parsed) {
              setIsDone(true);
              setReportUrl(parsed.reportUrl);
              setDurationMs(parsed.durationMs);
              setResultSuccess(parsed.success);
              setStatus(parsed.success ? "Passed" : "Failed");
            }
            appendOutput(line + "\n");
          }
        }
      }

      if (partial.length) {
        const parsed = parseDoneLine(partial);
        if (parsed) {
          setIsDone(true);
          setReportUrl(parsed.reportUrl);
          setDurationMs(parsed.durationMs);
          setResultSuccess(parsed.success);
          setStatus(parsed.success ? "Passed" : "Failed");
        }
        appendOutput(partial);
      }

      if (!isDone) {
        setStatus("Failed");
        setResultSuccess(false);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      appendOutput(`ERROR: ${message}\n`);
      setStatus("Failed");
      setResultSuccess(false);
      setErrorMessage(message);
      setIsDone(true);
    }
  };

  const handleViewReport = () => {
    if (!reportUrl) return;
    window.open(reportUrl, "_blank");
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 px-6 py-8">
      <div className="mx-auto max-w-6xl rounded-3xl border border-slate-700 bg-slate-900/95 p-8 shadow-2xl shadow-black/40">
        <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Automation Dashboard</p>
            <h1 className="mt-2 text-4xl font-semibold text-white">Run Playwright Suites</h1>
            <p className="mt-2 max-w-2xl text-slate-400">
              Select a suite, execute tests, and watch live output stream directly in the browser.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-slate-800 px-4 py-2 text-sm uppercase tracking-[0.2em] text-slate-300">
              Status: {status}
            </span>
            <button
              type="button"
              onClick={runTests}
              className="rounded-full bg-emerald-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={status === "Running"}
            >
              Run Tests
            </button>
          </div>
        </div>

        <section className="mb-6 rounded-3xl border border-slate-700 bg-slate-950 p-5">
          <div className="flex flex-wrap gap-3">
            {SUITE_OPTIONS.map((option) => {
              const selected = selectedSuite === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setSelectedSuite(option.id)}
                  className={`rounded-2xl px-5 py-3 text-sm font-semibold transition ${
                    selected
                      ? "bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/30"
                      : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </section>

        {resultSuccess !== null && (
          <section className="mb-6 rounded-3xl border border-slate-700 bg-slate-950 p-5">
            <div className={`flex flex-col gap-2 rounded-3xl border px-5 py-4 ${
              resultSuccess ? "border-emerald-500 bg-emerald-500/10" : "border-rose-500 bg-rose-500/10"
            }`}
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-lg font-semibold text-white">
                  {resultSuccess ? "All Tests Passed" : "Tests Failed"}
                </p>
                {durationMs !== null && (
                  <span className="rounded-full bg-slate-800 px-3 py-1 text-sm text-slate-300">
                    Duration: {durationMs} ms
                  </span>
                )}
              </div>
              {errorMessage && <p className="text-sm text-rose-300">{errorMessage}</p>}
            </div>
          </section>
        )}

        <section className="mb-6 rounded-3xl border border-slate-700 bg-slate-950 p-5">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleViewReport}
              disabled={!isDone || !reportUrl}
              className="rounded-2xl bg-slate-800 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              View Report
            </button>
            <span className="rounded-full bg-slate-800 px-4 py-2 text-sm text-slate-300">
              Report URL: {reportUrl ?? "Not available until complete"}
            </span>
          </div>
          <div className="rounded-3xl bg-[#060606] p-4 text-slate-100 shadow-inner shadow-black/40">
            <pre
              ref={outputRef}
              className="min-h-[320px] overflow-y-auto whitespace-pre-wrap break-words text-sm leading-6"
            >
              {output || "Waiting for test execution..."}
            </pre>
          </div>
        </section>
      </div>
    </main>
  );
}
