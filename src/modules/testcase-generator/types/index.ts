export type TestCase = {
    testCaseId: string;
    title: string;
    testType: string;
    priority: "High" | "Medium" | "Low";
    preconditions: string;
    testData: string;
    steps: string;
    expectedResult: string;
};

export type HistoryItem = {
    id: string;
    title?: string;
    prompt: string;
    result: { testCases: TestCase[] } | null;
    error: string | null;
    timestamp: number;
};
